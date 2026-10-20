/* Storage. The code is public; the data never leaves the organisation.

   The data is split into records: the organisation (with its team), each case, each inbox
   decision and each notice received by e-mail. Every record is saved on its own, so two people
   only ever collide when they touch the same record, and a record maps one to one onto a row
   if the organisation later moves to a server (a third store with the same read/save).

   FolderStore: a folder the team already shares (network drive, OneDrive, SharePoint, Drive for
   desktop) opened with the File System Access API (Chrome, Edge). One JSON file per record:
     organizacion.json · expedientes/<id>.json · bandeja/<id>.json · avisos/<id>.json
   plus documentos/ (the files of each case), copias/ (a full copy per day) and entrada/ (where a
   mailbox rule can drop e-mails to be read into the inbox). Nothing is uploaded anywhere.
   DemoStore: synthetic data in this browser only, for trying the tool.

   Concurrency: save() writes only the records that changed, and first checks that nobody wrote
   them since they were read. If someone did, it writes nothing and returns their keys; the app
   then re-reads and re-applies the same change on the fresh copy. */

const Store = (() => {
  const SCHEMA = 2;
  const ORG = "organizacion.json";
  const KINDS = { case: "expedientes", triage: "bandeja", notice: "avisos" };
  const LEGACY = "registro.json"; // schema 1: everything in one file
  const DOCS = "documentos", BACKUPS = "copias", INBOX = "entrada";
  const IDB = "registro-alegaciones";

  const supportsFolders = () => typeof window !== "undefined" && "showDirectoryPicker" in window;

  // Remember the folder handle between visits (the browser asks again for permission).
  function idb(mode, fn) {
    return new Promise((resolve, reject) => {
      const open = indexedDB.open(IDB, 1);
      open.onupgradeneeded = () => open.result.createObjectStore("kv");
      open.onerror = () => reject(open.error);
      open.onsuccess = () => {
        const tx = open.result.transaction("kv", mode);
        const req = fn(tx.objectStore("kv"));
        tx.oncomplete = () => resolve(req && req.result);
        tx.onerror = () => reject(tx.error);
      };
    });
  }
  const remember = (k, v) => idb("readwrite", (s) => s.put(v, k)).catch(() => {});
  const recall = (k) => idb("readonly", (s) => s.get(k)).catch(() => null);
  const forget = () => idb("readwrite", (s) => s.delete("dir")).catch(() => {});

  async function sha256(blob) {
    const buf = await crypto.subtle.digest("SHA-256", await blob.arrayBuffer());
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  const safeName = (s) => String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w.-]+/g, "_").slice(0, 90);
  const notFound = (e) => e && (e.name === "NotFoundError" || e.name === "TypeMismatchError");

  // ---------- records ----------
  function split(data) {
    const out = new Map([["org", { id: "org", schema: SCHEMA, org: data.org || {}, people: data.people || [] }]]);
    for (const c of data.cases || []) out.set(`case/${c.id}`, c);
    for (const [id, t] of Object.entries(data.triage || {})) out.set(`triage/${id}`, { id, ...t });
    for (const n of data.notices || []) out.set(`notice/${n.id}`, n);
    return out;
  }
  function join(records) {
    const o = records.get("org") || {};
    const data = { schema: SCHEMA, org: o.org || {}, people: o.people || [], triage: {}, cases: [], notices: [] };
    for (const [key, r] of records) {
      const kind = key.split("/")[0];
      if (kind === "case") data.cases.push(r);
      if (kind === "notice") data.notices.push(r);
      if (kind === "triage") { const { id, ...t } = r; data.triage[id] = t; }
    }
    const byCreated = (a, b) => ((a.created || a.at || "") < (b.created || b.at || "") ? -1 : 1);
    data.cases.sort(byCreated); data.notices.sort(byCreated);
    return data;
  }
  const pathOf = (key) => (key === "org" ? ORG : `${KINDS[key.split("/")[0]]}/${safeName(key.slice(key.indexOf("/") + 1))}.json`);

  class FolderStore {
    constructor(dir) {
      this.dir = dir; this.kind = "folder"; this.name = dir.name;
      this.known = new Map();     // key -> {path, modified, text, rev} as last read or written
      this.conflicted = [];       // files the sync client left as conflicting copies
    }

    static async pick() {
      const dir = await window.showDirectoryPicker({ id: "registro-alegaciones", mode: "readwrite" });
      await remember("dir", dir);
      return new FolderStore(dir);
    }

    static async reopen() {
      const dir = await recall("dir");
      return dir ? new FolderStore(dir) : null;
    }

    async permitted(ask) {
      const opts = { mode: "readwrite" };
      if ((await this.dir.queryPermission(opts)) === "granted") return true;
      return ask ? (await this.dir.requestPermission(opts)) === "granted" : false;
    }

    async sub(name, create = false) {
      try { return await this.dir.getDirectoryHandle(name, { create }); } catch (e) { if (notFound(e)) return null; throw e; }
    }

    async fileHandle(path, create = false) {
      const parts = path.split("/");
      let h = this.dir;
      for (const p of parts.slice(0, -1)) h = await h.getDirectoryHandle(p, { create });
      return h.getFileHandle(parts.at(-1), { create });
    }

    async modified(path) {
      try { return (await (await this.fileHandle(path)).getFile()).lastModified; } catch (e) { if (notFound(e)) return null; throw e; }
    }

    // Every record file in the folder: path -> handle.
    async listing() {
      const out = new Map();
      try { out.set(ORG, await this.dir.getFileHandle(ORG)); } catch (e) { if (!notFound(e)) throw e; }
      for (const folder of Object.values(KINDS)) {
        const d = await this.sub(folder);
        if (!d) continue;
        for await (const [name, h] of d.entries()) if (h.kind === "file" && name.endsWith(".json")) out.set(`${folder}/${name}`, h);
      }
      return out;
    }

    async read() {
      if (await this.migrate()) return this.read();
      const records = new Map();
      this.known.clear(); this.conflicted = [];
      for (const [path, h] of await this.listing()) {
        const f = await h.getFile();
        let doc;
        try { doc = JSON.parse(await f.text()); } catch { this.conflicted.push(path); continue; }
        const r = doc.data || doc;
        const kind = path === ORG ? "org" : Object.keys(KINDS).find((k) => path.startsWith(`${KINDS[k]}/`));
        const key = kind === "org" ? "org" : `${kind}/${r.id}`;
        // OneDrive and Drive keep both sides of a clash as "c-abc-PORTATIL.json": only the file
        // whose name is its record's id counts; the others are reported, never merged silently.
        if (!r.id || pathOf(key) !== path) { this.conflicted.push(path); continue; }
        records.set(key, r);
        this.known.set(key, { path, modified: f.lastModified, text: JSON.stringify(r), rev: doc.rev || 0 });
      }
      return records.has("org") ? join(records) : null;
    }

    async save(data, by = "") {
      const next = split(data);
      const changes = [];
      for (const [key, r] of next) {
        const text = JSON.stringify(r), k = this.known.get(key);
        if (!k || k.text !== text) changes.push({ key, r, text, k });
      }
      for (const [key, k] of this.known) if (!next.has(key)) changes.push({ key, k, remove: true });
      if (!changes.length) return { saved: 0, conflicts: [] };

      const conflicts = [];
      for (const ch of changes) if ((await this.modified(ch.k?.path || pathOf(ch.key))) !== (ch.k ? ch.k.modified : null)) conflicts.push(ch.key);
      if (conflicts.length) return { saved: 0, conflicts };

      const saved = new Date().toISOString();
      for (const ch of changes) {
        if (ch.remove) {
          const [folder, name] = ch.k.path.split("/");
          try { await (await this.dir.getDirectoryHandle(folder)).removeEntry(name); } catch (e) { if (!notFound(e)) throw e; }
          this.known.delete(ch.key);
          continue;
        }
        const path = pathOf(ch.key), rev = (ch.k?.rev || 0) + 1;
        const fh = await this.fileHandle(path, true);
        const w = await fh.createWritable();
        await w.write(JSON.stringify({ rev, saved, by, data: ch.r }, null, 1));
        await w.close();
        this.known.set(ch.key, { path, modified: (await fh.getFile()).lastModified, text: ch.text, rev });
      }
      await this.backup(data);
      return { saved: changes.length, conflicts: [] };
    }

    // Has anyone written, added or removed a record since we last read or wrote?
    async changedOnDisk() {
      const seen = new Set();
      for (const [path, h] of await this.listing()) {
        if (this.conflicted.includes(path)) continue;
        const k = [...this.known.values()].find((x) => x.path === path);
        if (!k || (await h.getFile()).lastModified !== k.modified) return true;
        seen.add(path);
      }
      return [...this.known.values()].some((k) => !seen.has(k.path));
    }

    // One full copy per day, so a bad edit can always be undone by hand.
    async backup(data) {
      const day = new Date().toISOString().slice(0, 10);
      const dir = await this.sub(BACKUPS, true);
      try { await dir.getFileHandle(`registro-${day}.json`); return; } catch (e) { if (!notFound(e)) throw e; }
      const w = await (await dir.getFileHandle(`registro-${day}.json`, { create: true })).createWritable();
      await w.write(JSON.stringify(data));
      await w.close();
    }

    // Schema 1 kept everything in registro.json: split it once and keep the old file in copias/.
    async migrate() {
      let legacy;
      try { legacy = await (await this.dir.getFileHandle(LEGACY)).getFile(); } catch (e) { if (notFound(e)) return false; throw e; }
      if (await this.modified(ORG)) return false;
      const old = JSON.parse(await legacy.text());
      this.known.clear();
      await this.save({ ...old, notices: old.notices || [] }, "migración");
      const w = await (await (await this.sub(BACKUPS, true)).getFileHandle(`registro-anterior-${new Date().toISOString().slice(0, 10)}.json`, { create: true })).createWritable();
      await w.write(await legacy.text());
      await w.close();
      await this.dir.removeEntry(LEGACY);
      return true;
    }

    async setup() { for (const d of [...Object.values(KINDS), DOCS, BACKUPS, INBOX]) await this.sub(d, true); }

    async attach(owner, file, prefix) {
      const folder = await (await this.sub(DOCS, true)).getDirectoryHandle(safeName(owner), { create: true });
      const name = safeName(`${prefix}_${file.name}`);
      const w = await (await folder.getFileHandle(name, { create: true })).createWritable();
      await w.write(file);
      await w.close();
      return { path: `${DOCS}/${safeName(owner)}/${name}`, sha256: await sha256(file), size: file.size };
    }

    async open(path) { return (await this.fileHandle(path)).getFile(); }

    // E-mails and PDFs left in entrada/ by a mailbox rule (Power Automate, a script…).
    async incoming() {
      const d = await this.sub(INBOX);
      const out = [];
      if (d) for await (const [name, h] of d.entries()) if (h.kind === "file" && /\.(eml|msg|pdf)$/i.test(name)) out.push(await h.getFile());
      return out;
    }
    async consume(name) {
      const d = await this.sub(INBOX);
      try { if (d) await d.removeEntry(name); } catch (e) { if (!notFound(e)) throw e; }
    }
  }

  class DemoStore {
    constructor() { this.kind = "demo"; this.name = "demostración"; this.blobs = new Map(); this.conflicted = []; }
    async permitted() { return true; }
    async read() {
      try { return JSON.parse(localStorage.getItem("registro-demo")); } catch { return null; }
    }
    async save(data) {
      try { localStorage.setItem("registro-demo", JSON.stringify(data)); } catch { /* private window */ }
      return { saved: 1, conflicts: [] };
    }
    async changedOnDisk() { return false; }
    async incoming() { return []; }
    async consume() {}
    async setup() {}
    async attach(owner, file, prefix) {
      const path = `demo/${safeName(owner)}/${safeName(`${prefix}_${file.name}`)}`;
      this.blobs.set(path, file);
      return { path, sha256: await sha256(file), size: file.size };
    }
    async open(path) {
      if (!this.blobs.has(path)) throw new Error("En la demostración los ficheros solo viven mientras la pestaña está abierta.");
      return this.blobs.get(path);
    }
    reset() { try { localStorage.removeItem("registro-demo"); } catch { /* ignore */ } }
  }

  return { FolderStore, DemoStore, supportsFolders, sha256, forget, split, join, SCHEMA };
})();

if (typeof module !== "undefined") module.exports = Store;

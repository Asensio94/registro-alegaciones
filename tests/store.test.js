// node --test tests/store.test.js
// FolderStore against an in-memory folder that behaves like the File System Access API.
const test = require("node:test");
const assert = require("node:assert/strict");
const Store = require("../app/store.js");

let clock = 1000;
const nf = () => Object.assign(new Error("not found"), { name: "NotFoundError" });
class MemDir {
  constructor(name = "equipo") { this.kind = "directory"; this.name = name; this.files = new Map(); this.dirs = new Map(); }
  async getDirectoryHandle(n, { create } = {}) {
    if (!this.dirs.has(n)) { if (!create) throw nf(); this.dirs.set(n, new MemDir(n)); }
    return this.dirs.get(n);
  }
  async getFileHandle(n, { create } = {}) {
    if (!this.files.has(n)) { if (!create) throw nf(); this.files.set(n, { content: "", modified: ++clock }); }
    const dir = this;
    return {
      kind: "file", name: n,
      async getFile() { const f = dir.files.get(n); if (!f) throw nf(); return new File([f.content], n, { lastModified: f.modified }); },
      async createWritable() {
        let buf = "";
        return { async write(x) { buf += typeof x === "string" ? x : await x.text(); }, async close() { dir.files.set(n, { content: buf, modified: ++clock }); } };
      },
    };
  }
  async removeEntry(n) { if (!this.files.delete(n) && !this.dirs.delete(n)) throw nf(); }
  async *entries() {
    for (const n of [...this.files.keys()]) yield [n, await this.getFileHandle(n)];
    for (const [n, d] of this.dirs) yield [n, d];
  }
  text(path) { const parts = path.split("/"); let d = this; for (const p of parts.slice(0, -1)) d = d.dirs.get(p); return d.files.get(parts.at(-1))?.content; }
}

const sample = () => ({
  org: { name: "ONG de prueba", region: "Madrid" }, people: [{ id: "p1", name: "Ana" }, { id: "p2", name: "Luis" }],
  triage: { "BOE-B-2026-1": { decision: "discarded", reason: "Fuera de ámbito" } },
  cases: [{ id: "c-1", title: "Uno", stage: "study", events: [] }, { id: "c-2", title: "Dos", stage: "study", events: [] }],
  notices: [{ id: "n-1", subject: "Consulta", at: "2026-10-05" }],
});

test("each record is saved in its own file", async () => {
  const dir = new MemDir(), s = new Store.FolderStore(dir);
  const r = await s.save(sample(), "p1");
  assert.deepEqual(r.conflicts, []);
  assert.equal(JSON.parse(dir.text("expedientes/c-1.json")).data.title, "Uno");
  assert.equal(JSON.parse(dir.text("bandeja/BOE-B-2026-1.json")).data.reason, "Fuera de ámbito");
  assert.equal(JSON.parse(dir.text("avisos/n-1.json")).by, "p1");
  assert.ok(dir.text("organizacion.json"));
  assert.deepEqual(await new Store.FolderStore(dir).read(), { schema: 2, ...sample() });
});

test("two people editing different cases never collide", async () => {
  const dir = new MemDir();
  await new Store.FolderStore(dir).save(sample());
  const a = new Store.FolderStore(dir), b = new Store.FolderStore(dir);
  const da = await a.read(), db = await b.read();
  da.cases[0].title = "Uno (Ana)"; db.cases[1].title = "Dos (Luis)";
  assert.deepEqual((await a.save(da)).conflicts, []);
  assert.ok(await b.changedOnDisk());
  assert.deepEqual((await b.save(db)).conflicts, []);
  const fresh = await new Store.FolderStore(dir).read();
  assert.deepEqual(fresh.cases.map((c) => c.title), ["Uno (Ana)", "Dos (Luis)"]);
});

test("editing the same case is detected and the change re-applied on the fresh copy", async () => {
  const dir = new MemDir();
  await new Store.FolderStore(dir).save(sample());
  const a = new Store.FolderStore(dir), b = new Store.FolderStore(dir);
  const da = await a.read(), db = await b.read();
  const addNote = (who) => (d) => d.cases.find((c) => c.id === "c-1").events.push({ id: `e-${who}`, type: "note" });
  addNote("ana")(da); addNote("luis")(db);
  await a.save(da);
  const r = await b.save(db);
  assert.deepEqual(r.conflicts, ["case/c-1"]);
  const again = await b.read(); addNote("luis")(again);
  assert.deepEqual((await b.save(again)).conflicts, []);
  const fresh = await new Store.FolderStore(dir).read();
  assert.deepEqual(fresh.cases[0].events.map((e) => e.id), ["e-ana", "e-luis"]);
});

test("removing a decision deletes its file", async () => {
  const dir = new MemDir(), s = new Store.FolderStore(dir);
  const d = sample(); await s.save(d);
  delete d.triage["BOE-B-2026-1"];
  await s.save(d);
  assert.equal(dir.text("bandeja/BOE-B-2026-1.json"), undefined);
});

test("a conflicting copy left by the sync client is reported, not merged", async () => {
  const dir = new MemDir(), s = new Store.FolderStore(dir);
  await s.save(sample());
  const copy = await (await dir.getDirectoryHandle("expedientes")).getFileHandle("c-1-PORTATIL.json", { create: true });
  const w = await copy.createWritable(); await w.write(JSON.stringify({ rev: 1, data: { id: "c-1", title: "Otra versión" } })); await w.close();
  const d = await s.read();
  assert.equal(d.cases.find((c) => c.id === "c-1").title, "Uno");
  assert.deepEqual(s.conflicted, ["expedientes/c-1-PORTATIL.json"]);
});

test("a schema-1 registro.json is split once and kept in copias/", async () => {
  const dir = new MemDir();
  const old = { schema: 1, revision: 7, ...sample() }; delete old.notices;
  const w = await (await dir.getFileHandle("registro.json", { create: true })).createWritable(); await w.write(JSON.stringify(old)); await w.close();
  const d = await new Store.FolderStore(dir).read();
  assert.equal(d.cases.length, 2);
  assert.deepEqual(d.notices, []);
  assert.equal(dir.text("registro.json"), undefined);
  assert.ok([...dir.dirs.get("copias").files.keys()].some((n) => n.startsWith("registro-anterior-")));
});

test("files left in entrada/ are offered once and then consumed", async () => {
  const dir = new MemDir(), s = new Store.FolderStore(dir);
  await s.setup();
  const w = await (await dir.dirs.get("entrada").getFileHandle("aviso.eml", { create: true })).createWritable(); await w.write("Subject: x\r\n\r\nhola"); await w.close();
  assert.deepEqual((await s.incoming()).map((f) => f.name), ["aviso.eml"]);
  await s.consume("aviso.eml");
  assert.deepEqual(await s.incoming(), []);
});

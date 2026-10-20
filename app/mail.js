/* Reading the notices an organisation receives by e-mail: consultations as "persona interesada",
   notices of electronic notifications, letters scanned to PDF. Files are dropped on the inbox or
   left in the folder's entrada/ by a mailbox rule, and read here, in the browser: nothing is sent
   anywhere. Pure functions over bytes, no DOM, so the tests run them in Node.
   .eml is MIME text (RFC 5322, 2045-2047, 2231); .msg is Outlook's own format, a Compound File
   (MS-CFB) whose streams hold MAPI properties (MS-OXMSG). */

const Mail = (() => {
  // ---------- bytes and text ----------
  const latin1 = (u8) => { let s = ""; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return s; };
  const bytes = (s) => Uint8Array.from(s, (c) => c.charCodeAt(0) & 255);
  const CODEPAGES = { 65001: "utf-8", 1252: "windows-1252", 28591: "iso-8859-1", 28605: "iso-8859-15", 20127: "windows-1252", 932: "shift_jis", 1200: "utf-16le" };
  function decode(u8, charset = "utf-8") {
    const cs = String(charset || "utf-8").toLowerCase().replace(/^"|"$/g, "");
    try { return new TextDecoder(cs === "us-ascii" ? "windows-1252" : cs).decode(u8); } catch { return new TextDecoder("windows-1252").decode(u8); }
  }
  const utf16 = (u8) => new TextDecoder("utf-16le").decode(u8).replace(/\0+$/, "");

  function base64(s) {
    let clean = s.replace(/[^A-Za-z0-9+/]/g, ""); // padding goes too: it is put back below
    if (clean.length % 4 === 1) clean = clean.slice(0, -1);
    return bytes(atob(clean + "==".slice(0, (4 - (clean.length % 4)) % 4)));
  }
  const quotedPrintable = (s) => bytes(s.replace(/=\r?\n/g, "").replace(/=([0-9A-Fa-f]{2})/g, (m, h) => String.fromCharCode(parseInt(h, 16))));

  // RFC 2047: =?charset?B|Q?text?= inside headers; spaces between two encoded words vanish.
  function words(s) {
    return String(s || "").replace(/(=\?[^?]+\?[BbQq]\?[^?]*\?=)\s+(?==\?)/g, "$1").replace(/=\?([^?*]+)(?:\*[^?]*)?\?([BbQq])\?([^?]*)\?=/g, (m, cs, enc, text) => {
      try { return decode(enc.toUpperCase() === "B" ? base64(text) : quotedPrintable(text.replace(/_/g, " ")), cs); } catch { return m; }
    });
  }

  function htmlToText(html) {
    return html.replace(/<(style|script|head)[\s\S]*?<\/\1>/gi, "").replace(/<br\s*\/?>|<\/(p|div|tr|li|h\d)>/gi, "\n").replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#(\d+);/g, (m, n) => String.fromCodePoint(Number(n)))
      .replace(/&([a-z]+);/gi, (m, n) => ({ aacute: "á", eacute: "é", iacute: "í", oacute: "ó", uacute: "ú", ntilde: "ñ", Aacute: "Á", Eacute: "É", Iacute: "Í", Oacute: "Ó", Uacute: "Ú", Ntilde: "Ñ", ordm: "º", ordf: "ª", euro: "€", amp: "&" })[n] || m)
      .replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  }

  function address(s) {
    const v = words(s).trim();
    const m = /^(.*?)\s*<([^>]+)>\s*$/.exec(v);
    return m ? { name: m[1].replace(/^"|"$/g, "").trim(), email: m[2].trim() } : { name: "", email: v };
  }

  // ---------- .eml ----------
  function headers(block) {
    const out = {};
    for (const line of block.replace(/\r?\n[ \t]+/g, " ").split(/\r?\n/)) {
      const i = line.indexOf(":");
      if (i > 0) { const k = line.slice(0, i).trim().toLowerCase(); if (!(k in out)) out[k] = line.slice(i + 1).trim(); }
    }
    return out;
  }

  // "text/plain; charset=utf-8; name*=utf-8''Informe%20t%C3%A9cnico.pdf" -> {value, params}; RFC 2231 continuations too.
  function params(v) {
    const [value, ...rest] = String(v || "").split(/;(?=(?:[^"]*"[^"]*")*[^"]*$)/);
    const raw = {};
    for (const p of rest) {
      const i = p.indexOf("=");
      if (i > 0) raw[p.slice(0, i).trim().toLowerCase()] = p.slice(i + 1).trim().replace(/^"|"$/g, "");
    }
    const out = {};
    for (const base of new Set(Object.keys(raw).map((k) => k.replace(/\*.*$/, "")))) {
      const parts = Object.keys(raw).filter((k) => k === base || k.startsWith(`${base}*`)).sort((a, b) => (parseInt(a.split("*")[1], 10) || 0) - (parseInt(b.split("*")[1], 10) || 0));
      let text = parts.map((k) => raw[k]).join("");
      if (parts.some((k) => k.endsWith("*"))) {
        const m = /^([^']*)'[^']*'(.*)$/.exec(text);
        const cs = m ? m[1] || "utf-8" : "utf-8";
        text = decode(bytes((m ? m[2] : text).replace(/%([0-9A-Fa-f]{2})/g, (x, h) => String.fromCharCode(parseInt(h, 16)))), cs);
      }
      out[base] = words(text);
    }
    return { value: value.trim().toLowerCase(), params: out };
  }

  function walk(raw, msg, depth = 0) {
    const cut = raw.search(/\r?\n\r?\n/);
    const h = headers(cut < 0 ? raw : raw.slice(0, cut));
    const body = cut < 0 ? "" : raw.slice(cut).replace(/^\r?\n\r?\n/, "");
    const ct = params(h["content-type"] || "text/plain; charset=us-ascii");
    if (ct.value.startsWith("multipart/") && ct.params.boundary && depth < 8) {
      const b = `--${ct.params.boundary}`;
      body.split(b).slice(1).forEach((part) => { if (!part.startsWith("--")) walk(part.replace(/^\r?\n/, ""), msg, depth + 1); });
      return h;
    }
    const enc = (h["content-transfer-encoding"] || "").toLowerCase();
    const data = enc === "base64" ? base64(body) : enc === "quoted-printable" ? quotedPrintable(body) : bytes(body);
    const disp = params(h["content-disposition"] || "");
    const name = disp.params.filename || ct.params.name || "";
    if (name || disp.value === "attachment" || !ct.value.startsWith("text/")) {
      msg.attachments.push({ name: name || (ct.value === "message/rfc822" ? "mensaje-adjunto.eml" : "adjunto"), type: ct.value, data });
    } else if (ct.value === "text/html") msg.html.push(decode(data, ct.params.charset));
    else msg.text.push(decode(data, ct.params.charset));
    return h;
  }

  function parseEml(u8) {
    const msg = { text: [], html: [], attachments: [] };
    const h = walk(latin1(u8), msg);
    const date = h.date ? new Date(h.date.replace(/\s*\([^)]*\)\s*$/, "")) : null;
    return {
      format: "eml", subject: words(h.subject || ""), from: address(h.from || ""),
      date: date && !isNaN(date) ? date.toISOString() : "",
      text: (msg.text.join("\n").trim() || htmlToText(msg.html.join("\n"))).replace(/\r\n/g, "\n"),
      attachments: msg.attachments,
    };
  }

  // ---------- .msg: Compound File Binary ----------
  const END = 0xFFFFFFFA; // sector numbers at or above this mark the end of a chain or free space
  function compoundFile(u8) {
    const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
    if (dv.getUint32(0, true) !== 0xE011CFD0 || dv.getUint32(4, true) !== 0xE11AB1A1) throw new Error("No es un fichero de Outlook (.msg)");
    const ss = 1 << dv.getUint16(0x1E, true), mss = 1 << dv.getUint16(0x20, true);
    const nFat = dv.getUint32(0x2C, true), dirStart = dv.getUint32(0x30, true), cutoff = dv.getUint32(0x38, true);
    const miniFatStart = dv.getUint32(0x3C, true), difatStart = dv.getUint32(0x44, true), nDifat = dv.getUint32(0x48, true);
    const off = (s) => (s + 1) * ss;
    const u32 = (o) => (o + 4 <= u8.length ? dv.getUint32(o, true) : END);

    const fatSectors = [];
    for (let i = 0; i < 109 && fatSectors.length < nFat; i++) { const s = u32(0x4C + i * 4); if (s < END) fatSectors.push(s); }
    for (let d = difatStart, k = 0; k < nDifat && d < END; k++) {
      const per = ss / 4 - 1;
      for (let i = 0; i < per && fatSectors.length < nFat; i++) { const s = u32(off(d) + i * 4); if (s < END) fatSectors.push(s); }
      d = u32(off(d) + per * 4);
    }
    const fat = [];
    for (const s of fatSectors) for (let j = 0; j < ss / 4; j++) fat.push(u32(off(s) + j * 4));
    const chain = (start, table) => { const out = []; const seen = new Set(); for (let s = start; s < END && !seen.has(s); s = table[s]) { seen.add(s); out.push(s); } return out; };
    const readChain = (start, size) => {
      const secs = chain(start, fat), buf = new Uint8Array(secs.length * ss);
      secs.forEach((s, i) => buf.set(u8.subarray(off(s), off(s) + ss), i * ss));
      return size == null ? buf : buf.subarray(0, size);
    };

    const dir = readChain(dirStart), ddv = new DataView(dir.buffer, dir.byteOffset, dir.byteLength);
    const entries = [];
    for (let o = 0; o + 128 <= dir.length; o += 128) {
      const nameLen = ddv.getUint16(o + 0x40, true);
      entries.push({ name: utf16(dir.subarray(o, o + Math.max(0, nameLen - 2))), type: dir[o + 0x42],
        left: ddv.getUint32(o + 0x44, true), right: ddv.getUint32(o + 0x48, true), child: ddv.getUint32(o + 0x4C, true),
        start: ddv.getUint32(o + 0x74, true), size: ddv.getUint32(o + 0x78, true) });
    }
    const root = entries[0];
    const mini = readChain(root.start, root.size);
    const miniFatBytes = miniFatStart < END ? readChain(miniFatStart) : new Uint8Array(0);
    const miniFat = []; const mdv = new DataView(miniFatBytes.buffer, miniFatBytes.byteOffset, miniFatBytes.byteLength);
    for (let o = 0; o + 4 <= miniFatBytes.length; o += 4) miniFat.push(mdv.getUint32(o, true));

    function read(e) {
      if (e.size >= cutoff) return readChain(e.start, e.size);
      const secs = chain(e.start, miniFat), buf = new Uint8Array(secs.length * mss);
      secs.forEach((s, i) => buf.set(mini.subarray(s * mss, s * mss + mss), i * mss));
      return buf.subarray(0, e.size);
    }
    // Children of a storage hang from a red-black tree of siblings; names are case-insensitive.
    function children(e) {
      const out = {}, stack = [e.child], seen = new Set();
      while (stack.length) {
        const i = stack.pop();
        if (i >= END || i >= entries.length || seen.has(i)) continue;
        seen.add(i);
        const c = entries[i];
        out[c.name.toUpperCase()] = c;
        stack.push(c.left, c.right);
      }
      return out;
    }
    return { root, read, children };
  }

  const FILETIME_EPOCH = 11644473600000; // ms between 1601-01-01 and 1970-01-01
  function fixedProps(cf, kids, headerSize) {
    const e = kids["__PROPERTIES_VERSION1.0"];
    const out = {};
    if (!e) return out;
    const u8 = cf.read(e), dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
    for (let o = headerSize; o + 16 <= u8.length; o += 16) {
      const type = dv.getUint16(o, true), id = dv.getUint16(o + 2, true);
      if (type === 0x0040) out[id] = new Date((dv.getUint32(o + 12, true) * 4294967296 + dv.getUint32(o + 8, true)) / 10000 - FILETIME_EPOCH);
      if (type === 0x0003) out[id] = dv.getInt32(o + 8, true);
    }
    return out;
  }

  function parseMsg(u8) {
    const cf = compoundFile(u8);
    const kids = cf.children(cf.root);
    const fixed = fixedProps(cf, kids, 32);
    const charset = CODEPAGES[fixed[0x3FFD]] || CODEPAGES[fixed[0x3FDE]] || "windows-1252";
    const str = (k, id) => {
      const w = k[`__SUBSTG1.0_${id}001F`];
      if (w) return utf16(cf.read(w));
      const a = k[`__SUBSTG1.0_${id}001E`];
      return a ? decode(cf.read(a), charset).replace(/\0+$/, "") : "";
    };
    const bin = (k, id) => { const e = k[`__SUBSTG1.0_${id}0102`]; return e ? cf.read(e) : null; };

    let text = str(kids, "1000");
    if (!text) { const html = bin(kids, "1013"); if (html) text = htmlToText(decode(html, charset)); }
    const transport = headers(str(kids, "007D"));
    const when = fixed[0x0E06] || fixed[0x0039] || (transport.date ? new Date(transport.date) : null);
    const attachments = [];
    for (const [name, e] of Object.entries(kids)) {
      if (!name.startsWith("__ATTACH_VERSION1.0_#") || e.type !== 1) continue;
      const k = cf.children(e);
      const data = bin(k, "3701");
      if (!data) continue; // embedded messages and OLE objects: not documents to keep
      attachments.push({ name: str(k, "3707") || str(k, "3704") || "adjunto", type: str(k, "370E") || "application/octet-stream", data });
    }
    return {
      format: "msg", subject: str(kids, "0037"),
      from: { name: str(kids, "0C1A") || str(kids, "0042"), email: str(kids, "5D01") || str(kids, "0C1F") || str(kids, "0065") },
      date: when && !isNaN(when) ? when.toISOString() : "", text: text.replace(/\r\n/g, "\n").trim(), attachments,
    };
  }

  // ---------- any dropped file ----------
  /* -> {format, subject, from, date, text, attachments}. A PDF is a notice of its own: the file is
     the document and its name the subject. */
  function read(name, u8, lastModified) {
    const isCfb = u8.length > 8 && u8[0] === 0xD0 && u8[1] === 0xCF && u8[2] === 0x11 && u8[3] === 0xE0;
    if (isCfb || /\.msg$/i.test(name)) return parseMsg(u8);
    if (/\.(eml|mht|txt)$/i.test(name) || /^(?:[\w-]+:.*\r?\n)+/.test(latin1(u8.subarray(0, 2000)))) return parseEml(u8);
    return { format: /\.pdf$/i.test(name) ? "pdf" : "file", subject: name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim(), from: { name: "", email: "" },
      date: lastModified ? new Date(lastModified).toISOString() : "", text: "", attachments: [] };
  }

  // ---------- what the notice is about ----------
  /* Which consultation it is, from the words the administrations use. Order matters: the strategic
     (plans) and scoping cases are checked before the generic ones. Only a suggestion: the team
     confirms it when it opens the case. */
  function classify(subject, text) {
    const t = `${subject}\n${text}`.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
    if (/notific@|notifica\.gob|dehu|direccion electronica habilitada|carpeta ciudadana|puesta a (su )?disposicion|tiene (una|1) (nueva )?notificacion|notificacion electronica/.test(t)) return "notification";
    if (/documento inicial estrategico|borrador del plan|evaluacion ambiental estrategica ordinaria|articulo 19\b/.test(t)) return "eae_ordinaria";
    if (/documento ambiental estrategico|evaluacion ambiental estrategica simplificada|articulo 30\b/.test(t)) return "eae_simplificada";
    if (/documento de alcance|alcance del estudio|consultas previas|articulo 34\b/.test(t)) return "eia_alcance";
    if (/simplificada|documento ambiental|articulo 46\b|art\. ?46\b/.test(t)) return "eia_simplificada";
    if (/estudio de impacto|evaluacion de impacto ambiental ordinaria|articulo 37\b|art\. ?37\b|informacion publica/.test(t)) return "eia_ordinaria";
    if (/consulta|informe|alegaciones|persona interesada/.test(t)) return "otra";
    return "";
  }

  // Reference numbers the bodies quote ("Expediente: 20230145", "Ref.: SGEA/IPR/2026/0012").
  function fileNumber(text) {
    const m = /\b(?:n[ºo°]\.?\s*(?:de\s+)?expediente|expediente|exp\.|ref(?:erencia)?\.?)\s*(?:n[ºo°]\.?)?\s*[:.]?\s*([A-Z0-9][A-Z0-9/._-]{4,40})/i.exec(text || "");
    return m ? m[1].replace(/[.,;]+$/, "") : "";
  }

  // "RE: RV: Notificación: Consulta …" -> "Consulta …"
  const cleanSubject = (s) => String(s || "").replace(/^\s*((re|rv|fw|fwd|reenv|aw)\s*:\s*)+/i, "").trim();

  return { read, parseEml, parseMsg, classify, fileNumber, cleanSubject, htmlToText };
})();

if (typeof module !== "undefined") module.exports = Mail;

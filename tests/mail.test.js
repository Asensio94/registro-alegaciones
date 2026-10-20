// node --test tests/mail.test.js
// A synthetic e-mail built here; set MSG_FIXTURES to a folder of Outlook .msg files with the
// msgreader-style .json next to each one to also check the .msg reader against them.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Mail = require("../app/mail.js");

const b64 = (s) => Buffer.from(s, "utf8").toString("base64");
const pdf = "%PDF-1.4\n% documento de prueba\n";
const eml = [
  "From: =?UTF-8?B?" + b64("Área de Evaluación Ambiental (demo)") + "?= <buzon@organo.example>",
  "To: alegaciones@ong.example",
  "Subject: =?UTF-8?Q?RV:_Consulta_sobre_el_documento_ambiental_del_proyecto_?=",
  " =?UTF-8?B?" + b64("«Parque solar Demo» (evaluación simplificada)") + "?=",
  "Date: Mon, 5 Oct 2026 09:12:00 +0200",
  "MIME-Version: 1.0",
  'Content-Type: multipart/mixed; boundary="mix"',
  "",
  "--mix",
  'Content-Type: multipart/alternative; boundary="alt"',
  "",
  "--alt",
  "Content-Type: text/plain; charset=utf-8",
  "Content-Transfer-Encoding: quoted-printable",
  "",
  "En virtud del art=C3=ADculo 46 de la Ley 21/2013 se le consulta como persona inte=",
  "resada. Expediente: 20260145. Puede pronunciarse en el plazo de veinte d=C3=ADas.",
  "--alt",
  "Content-Type: text/html; charset=utf-8",
  "",
  "<p>HTML version</p>",
  "--alt--",
  "--mix",
  "Content-Type: application/pdf",
  "Content-Disposition: attachment; filename*=utf-8''Documento%20ambiental%20t%C3%A9cnico.pdf",
  "Content-Transfer-Encoding: base64",
  "",
  b64(pdf).replace(/(.{20})/g, "$1\r\n"),
  "--mix--",
  "",
].join("\r\n");

test("an .eml gives subject, sender, date, plain text and attachments", () => {
  const m = Mail.read("aviso.eml", new Uint8Array(Buffer.from(eml, "latin1")));
  assert.equal(m.format, "eml");
  assert.equal(m.subject, "RV: Consulta sobre el documento ambiental del proyecto «Parque solar Demo» (evaluación simplificada)");
  assert.deepEqual(m.from, { name: "Área de Evaluación Ambiental (demo)", email: "buzon@organo.example" });
  assert.equal(m.date, "2026-10-05T07:12:00.000Z");
  assert.match(m.text, /artículo 46 de la Ley 21\/2013 se le consulta como persona interesada/);
  assert.equal(m.attachments.length, 1);
  assert.equal(m.attachments[0].name, "Documento ambiental técnico.pdf");
  assert.equal(Buffer.from(m.attachments[0].data).toString("utf8"), pdf);
});

test("the notice is classified and its file number found", () => {
  const m = Mail.read("aviso.eml", new Uint8Array(Buffer.from(eml, "latin1")));
  assert.equal(Mail.classify(m.subject, m.text), "eia_simplificada");
  assert.equal(Mail.fileNumber(m.text), "20260145");
  assert.equal(Mail.cleanSubject(m.subject).slice(0, 8), "Consulta");
  assert.equal(Mail.classify("Tiene una nueva notificación en la Dirección Electrónica Habilitada única", ""), "notification");
  assert.equal(Mail.classify("Consulta sobre el documento de alcance", ""), "eia_alcance");
  assert.equal(Mail.classify("Consulta", "documento inicial estratégico del plan"), "eae_ordinaria");
});

test("a PDF is a notice of its own", () => {
  const m = Mail.read("Oficio_consulta-2026.pdf", new Uint8Array(Buffer.from(pdf)), Date.UTC(2026, 9, 5));
  assert.equal(m.format, "pdf");
  assert.equal(m.subject, "Oficio consulta 2026");
  assert.equal(m.date.slice(0, 10), "2026-10-05");
});

test("Outlook .msg files match their reference reading", { skip: !process.env.MSG_FIXTURES }, () => {
  const dir = process.env.MSG_FIXTURES;
  let n = 0;
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(".msg"))) {
    const ref = path.join(dir, f.replace(/\.msg$/, ".json"));
    if (!fs.existsSync(ref)) continue;
    const exp = JSON.parse(fs.readFileSync(ref, "utf8"));
    const m = Mail.read(f, new Uint8Array(fs.readFileSync(path.join(dir, f))));
    assert.equal(m.subject, exp.subject, f);
    if (exp.messageDeliveryTime) assert.equal(new Date(m.date).toUTCString(), exp.messageDeliveryTime, f);
    const files = (exp.attachments || []).filter((a) => a.fileName).map((a) => `${a.fileName}:${a.contentLength}`);
    assert.deepEqual(m.attachments.map((a) => `${a.name}:${a.data.length}`), files, f);
    n++;
  }
  assert.ok(n > 0);
});

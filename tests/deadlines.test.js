// node --test tests/deadlines.test.js
const test = require("node:test");
const assert = require("node:assert/strict");
const D = require("../app/deadlines.js");

const cal = D.calendar();

test("30 business days skip weekends and national holidays", () => {
  // Published Monday 2026-09-28: 12 October (Monday) is a national holiday.
  assert.equal(D.addBusinessDays("2026-09-28", 30, cal), "2026-11-10");
});

test("counting starts the day after publication", () => {
  assert.equal(D.addBusinessDays("2026-10-16", 1, cal), "2026-10-19"); // Friday -> Monday
});

test("a regional holiday of either party is not a business day (art. 30.6)", () => {
  const cantabria = D.calendar({ regions: ["Cantabria"] });
  assert.equal(D.addBusinessDays("2026-09-14", 1, cal), "2026-09-15");
  assert.equal(D.addBusinessDays("2026-09-14", 1, cantabria), "2026-09-16");
});

test("team-added local holidays count", () => {
  assert.equal(D.addBusinessDays("2026-10-16", 1, D.calendar({ extra: ["2026-10-19"] })), "2026-10-20");
});

test("months run date to date and fall back to the month's last day (art. 30.4)", () => {
  assert.equal(D.addCalendarMonths("2026-01-31", 1), "2026-02-28");
  assert.equal(D.addCalendarMonths("2026-11-15", 2), "2027-01-15");
});

test("a month deadline ending on a weekend moves to the next business day (art. 30.5)", () => {
  assert.equal(D.addMonths("2026-10-17", 1, cal), "2026-11-17");
  assert.equal(D.addMonths("2026-10-14", 1, cal), "2026-11-16"); // 14 Nov is Saturday
});

test("contencioso: August does not run", () => {
  assert.equal(D.courtAppeal("2026-06-15", cal), "2026-09-15");
  assert.equal(D.courtAppeal("2026-08-10", cal), "2026-11-02"); // 31 Oct Saturday
  assert.equal(D.courtAppeal("2026-03-10", cal), "2026-05-11"); // 10 May Sunday
});

test("contencioso: 24-31 December are not judicial business days", () => {
  assert.equal(D.courtAppeal("2026-10-26", cal), "2027-01-04");
});

test("deadlines derive from events and close on the answering event", () => {
  const c = {
    stage: "filed",
    events: [
      { id: "e1", type: "publication", date: "2026-09-28" },
      { id: "e2", type: "filing", date: "2026-11-05T10:12" },
      { id: "e3", type: "info_request", date: "2026-11-05" },
    ],
  };
  const ps = D.derive(c, cal);
  const obj = ps.find((p) => p.kind === "objections");
  assert.equal(obj.due, "2026-11-10");
  assert.equal(obj.done.by, "e2");
  const info = ps.find((p) => p.kind === "info_reply");
  assert.equal(info.due, "2026-12-07"); // 5 Dec Saturday -> Monday 7
  assert.equal(info.done, undefined);
  assert.equal(D.light(info, "2026-12-20"), "late");
  assert.equal(D.light(info, "2027-01-20"), "very_late");
});

test("an extension notice moves the information reply to two months", () => {
  const c = { events: [
    { id: "a", type: "info_request", date: "2026-09-01" },
    { id: "b", type: "extension", date: "2026-09-20" },
  ] };
  assert.equal(D.derive(c, cal)[0].due, "2026-11-02");
});

test("an authorisation with alzada opens our appeal deadline", () => {
  const c = { events: [{ id: "r", type: "resolution", subtype: "autorizacion", date: "2026-10-01", remedies: ["alzada"] }] };
  const [p] = D.derive(c, cal);
  assert.equal(p.kind, "alzada");
  assert.equal(p.ours, true);
  assert.equal(p.due, "2026-11-02"); // 1 Nov Sunday -> Monday 2
  assert.equal(D.light(p, "2026-11-03"), "missed");
});

test("a discarded case closes the objection deadline; manual closes keep their reason", () => {
  const c = { stage: "discarded", events: [{ id: "e1", type: "publication", date: "2026-10-01" }] };
  assert.ok(D.derive(c, cal)[0].done.manual);
  const c2 = { events: [{ id: "r", type: "resolution", date: "2026-10-01", remedies: ["alzada"] }],
    closed_deadlines: { "r:alzada": { reason: "no se recurre" } } };
  assert.equal(D.derive(c2, cal)[0].done.reason, "no se recurre");
});

test("a simplified-EIA consultation gives 20 business days from receipt (art. 46.2)", () => {
  const c = { events: [{ id: "n", type: "consultation", subtype: "eia_simplificada", date: "2026-10-05T09:12" }] };
  const [p] = D.derive(c, cal);
  assert.equal(p.kind, "consultation");
  assert.equal(p.due, "2026-11-03"); // 12 October and 1 November (Sunday) are not business days
  assert.match(p.basis, /46\.2/);
});

test("a consultation closes when we file, and the days on the notice win", () => {
  const c = { events: [
    { id: "n", type: "consultation", subtype: "eia_ordinaria", date: "2026-10-05", days: 45 },
    { id: "f", type: "filing", date: "2026-10-30T12:00" },
  ] };
  const [p] = D.derive(c, cal);
  assert.equal(p.due, D.addBusinessDays("2026-10-05", 45, cal));
  assert.equal(p.done.by, "f");
});

test("an electronic notification must be opened within 10 calendar days (art. 43.2)", () => {
  const open = D.derive({ events: [{ id: "a", type: "notification", date: "2026-10-16" }] }, cal)[0];
  assert.equal(open.due, "2026-10-26");
  assert.ok(open.ours && !open.done);
  const read = D.derive({ events: [
    { id: "a", type: "notification", date: "2026-10-16" },
    { id: "b", type: "requirement", date: "2026-10-19" },
  ] }, cal).find((p) => p.kind === "notification_access");
  assert.equal(read.done.by, "b");
});

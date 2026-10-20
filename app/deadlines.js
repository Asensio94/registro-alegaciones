/* Deadline engine. Pure functions: dates in, dates out, no DOM.
   Every deadline is derived from the events of a case, so moving a trigger date moves every
   deadline that hangs from it (the "deadline chain" of legal case managers).
   Dates are "YYYY-MM-DD" strings; arithmetic runs in UTC to dodge DST shifts.
   Spanish legal instruments keep their Spanish names as values (alzada, reposicion, dia…):
   they have no exact English equivalent. */

const Deadlines = (() => {
  // National holidays: the same list as observatorio-alegaciones (plazos.py), so both tools agree.
  const NATIONAL = {
    2026: ["01-01", "01-06", "04-03", "05-01", "08-15", "10-12", "11-01", "12-06", "12-08", "12-25"],
    2027: ["01-01", "01-06", "03-26", "05-01", "08-15", "10-12", "11-01", "12-06", "12-08", "12-25"],
    2028: ["01-01", "01-06", "04-14", "05-01", "08-15", "10-12", "11-01", "12-06", "12-08", "12-25"],
  };
  // Fixed regional holidays known for sure; teams add the rest (moveable, local) in Ajustes.
  const REGIONAL = {
    "Cantabria": ["07-28", "09-15"],
  };

  const toDate = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(Date.UTC(y, m - 1, d)); };
  const toStr = (d) => d.toISOString().slice(0, 10);
  const addDays = (s, n) => { const d = toDate(s); d.setUTCDate(d.getUTCDate() + n); return toStr(d); };
  const diffDays = (a, b) => Math.round((toDate(b) - toDate(a)) / 86400000);
  const lastDayOfMonth = (y, m) => new Date(Date.UTC(y, m + 1, 0)).getUTCDate();

  /* Calendar: national + the regions involved + what the team adds.
     Art. 30.6 Ley 39/2015: a holiday where the filer lives OR where the body sits is not a
     business day, so a case passes both regions. */
  function calendar({ regions = [], extra = [] } = {}) {
    const holidays = new Set(extra.filter(Boolean));
    const years = Object.keys(NATIONAL);
    for (const y of years) NATIONAL[y].forEach((md) => holidays.add(`${y}-${md}`));
    for (const r of regions) for (const md of REGIONAL[r] || []) years.forEach((y) => holidays.add(`${y}-${md}`));
    return { holidays, covers: (s) => years.includes(s.slice(0, 4)) };
  }

  function isBusinessDay(s, cal) {
    const wd = toDate(s).getUTCDay();
    return wd !== 0 && wd !== 6 && !cal.holidays.has(s);
  }

  const nextBusinessDay = (s, cal) => { while (!isBusinessDay(s, cal)) s = addDays(s, 1); return s; };

  // Art. 30.2-30.3: business days, counted from the day after publication or notification.
  function addBusinessDays(from, n, cal) {
    let d = from, left = n;
    while (left > 0) { d = addDays(d, 1); if (isBusinessDay(d, cal)) left--; }
    return d;
  }

  // Art. 30.4: months run date to date; with no matching day, the last day of the month.
  function addCalendarMonths(from, n) {
    const d = toDate(from);
    const m = d.getUTCMonth() + n;
    const ty = d.getUTCFullYear() + Math.floor(m / 12), tm = ((m % 12) + 12) % 12;
    return toStr(new Date(Date.UTC(ty, tm, Math.min(d.getUTCDate(), lastDayOfMonth(ty, tm)))));
  }

  // Art. 30.5: a deadline ending on a non-business day moves to the next business day.
  const addMonths = (from, n, cal) => nextBusinessDay(addCalendarMonths(from, n), cal);

  /* Court appeal (art. 46 LJCA): two months, and August does not run (art. 128.2 LJCA).
     A notice received in August starts counting on 1 September; a period that crosses August
     is pushed one month. 24-31 December are not judicial business days (art. 183 LOPJ). */
  function courtAppeal(from, cal) {
    const y = Number(from.slice(0, 4));
    const base = from.slice(5, 7) === "08" ? `${y}-08-31` : from;
    let end = addCalendarMonths(base, 2);
    for (const yy of [y, y + 1]) if (base < `${yy}-08-01` && end >= `${yy}-08-01`) end = addCalendarMonths(end, 1);
    const judicial = { holidays: new Set(cal.holidays), covers: cal.covers };
    for (const yy of [y, y + 1]) for (let d = 24; d <= 31; d++) judicial.holidays.add(`${yy}-12-${d}`);
    return nextBusinessDay(end, judicial);
  }

  /* Consultations: the environmental body asks "personas interesadas" (an NGO among them) for an
     opinion. They reach the mailbox before, or instead of, a BOE announcement: a simplified EIA
     has no public information period at all. "Veinte días" in art. 46.2 are business days
     because art. 30.2 Ley 39/2015 makes every period in days a business-day one unless the law
     says otherwise. */
  const CONSULTATIONS = {
    eia_alcance: { label: "Consulta sobre el alcance del estudio de impacto (EIA ordinaria)", days: 20, basis: "art. 34.4 Ley 21/2013", procedure: "eia_ordinaria" },
    eia_ordinaria: { label: "Consulta sobre el proyecto y el estudio de impacto (EIA ordinaria)", days: 30, basis: "art. 37.4 Ley 21/2013", procedure: "eia_ordinaria" },
    eia_simplificada: { label: "Consulta sobre el documento ambiental (EIA simplificada)", days: 20, basis: "art. 46.2 Ley 21/2013", procedure: "eia_simplificada" },
    eae_ordinaria: { label: "Consulta sobre el borrador del plan (EAE ordinaria)", days: 30, basis: "art. 19.1 Ley 21/2013", procedure: "plan" },
    eae_simplificada: { label: "Consulta sobre el plan (EAE simplificada)", days: 20, basis: "art. 30.2 Ley 21/2013", procedure: "plan" },
    otra: { label: "Otra consulta o petición de informe", days: 10, basis: "lo que diga la consulta · art. 30 Ley 39/2015", procedure: "otro" },
  };

  /* Rules by deadline kind: each returns {due, rule, basis} for a trigger date. */
  const RULES = {
    objections: (from, cal, o = {}) => {
      const n = o.days || 30, calendarDays = o.unit === "naturales";
      return { due: calendarDays ? addDays(from, n) : addBusinessDays(from, n, cal),
        rule: `${n} días ${calendarDays ? "naturales" : "hábiles"} desde el día siguiente a la publicación`,
        basis: "art. 36.1 Ley 21/2013 · art. 30 Ley 39/2015" };
    },
    consultation: (from, cal, o = {}) => {
      const k = CONSULTATIONS[o.kind] || CONSULTATIONS.otra;
      const n = o.days || k.days, calendarDays = o.unit === "naturales";
      return { due: calendarDays ? addDays(from, n) : addBusinessDays(from, n, cal),
        rule: `${n} días ${calendarDays ? "naturales" : "hábiles"} desde el día siguiente a la recepción`,
        basis: `${k.basis} · art. 30 Ley 39/2015` };
    },
    // A notification left unopened for 10 calendar days counts as rejected and the procedure goes on.
    notification_access: (from) => ({ due: addDays(from, 10),
      rule: "10 días naturales desde la puesta a disposición; si no se abre, se tiene por rechazada", basis: "art. 43.2 Ley 39/2015" }),
    cure: (from, cal) => ({ due: addBusinessDays(from, 10, cal),
      rule: "10 días hábiles desde la notificación", basis: "art. 68.1 Ley 39/2015" }),
    info_reply: (from, cal, o = {}) => ({ due: addMonths(from, o.extended ? 2 : 1, cal),
      rule: o.extended ? "2 meses desde la entrada en registro (ampliado)" : "1 mes desde la entrada en registro",
      basis: "art. 10.2.c Ley 27/2006" }),
    alzada: (from, cal) => ({ due: addMonths(from, 1, cal),
      rule: "1 mes desde el día siguiente a la publicación o notificación", basis: "art. 122.1 Ley 39/2015" }),
    reposicion: (from, cal) => ({ due: addMonths(from, 1, cal),
      rule: "1 mes desde el día siguiente a la publicación o notificación", basis: "art. 124.1 Ley 39/2015" }),
    contencioso: (from, cal) => ({ due: courtAppeal(from, cal),
      rule: "2 meses; agosto no corre; si vence en día inhábil, el siguiente hábil", basis: "arts. 46 y 128.2 LJCA" }),
    decide_alzada: (from) => ({ due: addCalendarMonths(from, 3),
      rule: "3 meses para resolver; después, silencio desestimatorio", basis: "art. 122.2 Ley 39/2015" }),
    decide_reposicion: (from) => ({ due: addCalendarMonths(from, 1),
      rule: "1 mes para resolver; después, silencio desestimatorio", basis: "art. 124.2 Ley 39/2015" }),
    dia_expiry: (from) => ({ due: addCalendarMonths(from, 48),
      rule: "4 años desde la publicación si no empieza la ejecución (prorrogable 2)", basis: "art. 43.1 Ley 21/2013" }),
  };

  const LABELS = {
    objections: "Fin del plazo de alegaciones",
    consultation: "Responder a la consulta",
    notification_access: "Abrir la notificación electrónica",
    cure: "Atender el requerimiento",
    info_reply: "La Administración debe responder",
    alzada: "Recurso de alzada",
    reposicion: "Recurso de reposición",
    contencioso: "Recurso contencioso-administrativo",
    decide_alzada: "Resolución del recurso de alzada",
    decide_reposicion: "Resolución del recurso de reposición",
    dia_expiry: "Caducidad de la DIA si no empieza la obra",
  };
  // Whose move it is when time runs out: ours (we must act) or theirs (we wait and chase).
  const OURS = new Set(["objections", "consultation", "notification_access", "cure", "alzada", "reposicion", "contencioso"]);

  /* Derive a case's deadlines from its events. A deadline closes by itself when the event that
     answers it arrives (MuckRock: status follows communications), or by hand with a reason. */
  function derive(c, cal) {
    const evs = [...(c.events || [])].sort((a, b) => (a.date < b.date ? -1 : 1));
    const out = [];
    const add = (ev, kind, from, o) => {
      const r = RULES[kind](from, cal, o);
      out.push({ key: `${ev.id}:${kind}`, kind, label: LABELS[kind], from, source: ev.id,
        ours: OURS.has(kind), ...r, estimated: !cal.covers(r.due) || !!o?.estimated });
    };
    for (const ev of evs) {
      const d = ev.date.slice(0, 10);
      if (ev.type === "publication") add(ev, "objections", d, { days: ev.days, unit: ev.unit, estimated: ev.days_estimated });
      if (ev.type === "consultation") add(ev, "consultation", d, { kind: ev.subtype, days: ev.days, unit: ev.unit });
      if (ev.type === "notification") add(ev, "notification_access", d);
      if (ev.type === "requirement") add(ev, "cure", d);
      if (ev.type === "info_request") {
        const extended = evs.some((e) => e.type === "extension" && e.date >= ev.date);
        add(ev, "info_reply", d, { extended });
      }
      if (ev.type === "resolution") {
        if (ev.subtype === "dia") add(ev, "dia_expiry", d);
        for (const k of ev.remedies || []) if (["alzada", "reposicion", "contencioso"].includes(k)) add(ev, k, d);
      }
      if (ev.type === "appeal" && ev.subtype === "alzada") add(ev, "decide_alzada", d);
      if (ev.type === "appeal" && ev.subtype === "reposicion") add(ev, "decide_reposicion", d);
    }
    const closedByHand = c.closed_deadlines || {};
    for (const p of out) {
      const later = evs.filter((e) => e.date.slice(0, 10) >= p.from && e.id !== p.source);
      const answers = {
        objections: (e) => e.type === "filing",
        consultation: (e) => e.type === "filing",
        // Opening the notification shows up as whatever it contained being added to the timeline.
        notification_access: (e) => ["consultation", "publication", "requirement", "resolution", "reply"].includes(e.type),
        cure: (e) => e.type === "filing",
        info_reply: (e) => e.type === "reply" || (e.type === "resolution" && e.subtype === "acceso"),
        alzada: (e) => e.type === "appeal" && e.subtype === "alzada",
        reposicion: (e) => e.type === "appeal" && e.subtype === "reposicion",
        contencioso: (e) => e.type === "appeal" && e.subtype === "contencioso",
        decide_alzada: (e) => e.type === "resolution",
        decide_reposicion: (e) => e.type === "resolution",
        dia_expiry: () => false,
      }[p.kind];
      const hit = later.find(answers);
      if (hit) p.done = { by: hit.id, date: hit.date.slice(0, 10) };
      else if (closedByHand[p.key]) p.done = { manual: true, ...closedByHand[p.key] };
      else if (["objections", "consultation"].includes(p.kind) && ["discarded", "closed"].includes(c.stage)) p.done = { manual: true, reason: "expediente cerrado" };
    }
    return out;
  }

  // Overdue and very overdue, after Alaveteli: theirs late by >0 days and by >30.
  function light(p, today) {
    if (p.done) return "done";
    const d = diffDays(today, p.due);
    if (d < 0) return p.ours ? "missed" : (d < -30 ? "very_late" : "late");
    if (d === 0) return "today";
    if (d <= 7) return "week";
    return "later";
  }

  return { calendar, isBusinessDay, addBusinessDays, addMonths, addCalendarMonths, courtAppeal, derive,
    light, addDays, diffDays, LABELS, REGIONAL, CONSULTATIONS };
})();

if (typeof module !== "undefined") module.exports = Deadlines;

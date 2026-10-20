/* Registro de alegaciones: the private case log of an organisation that files objections.
   Interaction model after Linear (triage inbox, "my deadlines", list/board/calendar views of one
   dataset, a detail page with an activity timeline, command palette, keyboard shortcuts with a
   visible button for every action). Domain model after MuckRock/Alaveteli (one timeline per case,
   status that follows events, overdue states) and Filevine (deadline chains on a business-day
   calendar). UI text in Spanish; identifiers in English. */

const App = (() => {
  // ---------- constants ----------
  const STAGES = [
    { id: "study", label: "En estudio", hint: "Decidir si se alega" },
    { id: "drafting", label: "Redacción", hint: "Escribiendo el escrito" },
    { id: "review", label: "Revisión", hint: "Técnica y jurídica" },
    { id: "filed", label: "Presentada", hint: "Esperando respuesta o resolución" },
    { id: "followup", label: "Seguimiento", hint: "Recurso, solicitud de información o vigilancia" },
    { id: "closed", label: "Cerrada", hint: "Con resultado" },
    { id: "discarded", label: "Descartada", hint: "No se alega" },
  ];
  const STAGE = Object.fromEntries(STAGES.map((s) => [s.id, s]));
  const ACTIVE = new Set(["study", "drafting", "review", "filed", "followup"]);
  const PROCEDURES = {
    eia_ordinaria: "EIA ordinaria", eia_simplificada: "EIA simplificada", autorizacion: "Autorización (sin EIA propia)",
    aai: "Autorización ambiental integrada", plan: "Plan o programa (EAE)", costas: "Costas y dominio público", otro: "Otro",
  };
  const CATEGORIES = {
    eolica: "Eólica", fotovoltaica: "Fotovoltaica", red_electrica: "Red eléctrica", hidraulica: "Hidráulica",
    puertos_costas: "Puertos y costas", transporte: "Transporte", mineria: "Minería", hidrogeno_baterias: "Hidrógeno y baterías",
    agua_concesion: "Concesión de aguas", urbanismo_industria: "Urbanismo e industria", hidrocarburos_gas: "Hidrocarburos y gas", otro: "Otra",
  };
  const EVENTS = {
    publication: { label: "Publicación e inicio de plazo", dir: "in" },
    consultation: { label: "Consulta recibida como persona interesada", dir: "in" },
    notification: { label: "Aviso de notificación electrónica", dir: "in" },
    filing: { label: "Presentación en registro", dir: "out" },
    info_request: { label: "Solicitud de información (Ley 27/2006)", dir: "out" },
    extension: { label: "Aviso de ampliación del plazo de respuesta", dir: "in" },
    reply: { label: "Respuesta de la Administración", dir: "in" },
    requirement: { label: "Requerimiento de subsanación", dir: "in" },
    resolution: { label: "Resolución", dir: "in" },
    appeal: { label: "Recurso presentado", dir: "out" },
    note: { label: "Nota interna", dir: "internal" },
    stage: { label: "Cambio de fase", dir: "system" },
  };
  const RESOLUTION_TYPES = { dia: "Declaración de impacto ambiental", iia: "Informe de impacto ambiental", autorizacion: "Autorización sustantiva", acceso: "Respuesta a la solicitud de información", denegacion: "Denegación o archivo", otra: "Otra" };
  const APPEAL_TYPES = { alzada: "Alzada", reposicion: "Reposición", contencioso: "Contencioso-administrativo" };
  const DOC_KINDS = { notice: "Aviso recibido", draft: "Borrador", filed: "Escrito presentado", receipt: "Justificante de registro", evidence: "Informe o prueba", annex: "Anexo", reply: "Respuesta recibida", resolution: "Resolución", other: "Otro" };
  const OUTCOMES = { "": "Sin resultado aún", accepted: "Acogida", partial: "Acogida en parte", rejected: "No acogida", no_reply: "Sin respuesta" };
  const CHANNELS = ["REC (Registro Electrónico General)", "Sede electrónica del órgano", "Registro autonómico", "Oficina de registro (ORVE/SIR)", "Correos", "Otro"];
  const DISCARD_REASONS = ["Sin afección relevante a aves o hábitats", "Fuera de nuestro ámbito territorial", "Sin capacidad este mes", "Alega otra entidad con la que coordinamos", "Duplicado de otro anuncio", "Corrección de errores sin novedad"];
  const REGIONS = ["Andalucía", "Aragón", "Asturias", "Illes Balears", "Canarias", "Cantabria", "Castilla y León", "Castilla-La Mancha", "Cataluña", "Comunitat Valenciana", "Extremadura", "Galicia", "Madrid", "Murcia", "Navarra", "País Vasco", "La Rioja", "Ceuta", "Melilla"];
  const PROVINCE_REGION = {
    "Almería": 0, "Cádiz": 0, "Córdoba": 0, "Granada": 0, "Huelva": 0, "Jaén": 0, "Málaga": 0, "Sevilla": 0,
    "Huesca": 1, "Teruel": 1, "Zaragoza": 1, "Asturias": 2, "Illes Balears": 3, "Baleares": 3, "Las Palmas": 4, "Santa Cruz de Tenerife": 4,
    "Cantabria": 5, "Ávila": 6, "Burgos": 6, "León": 6, "Palencia": 6, "Salamanca": 6, "Segovia": 6, "Soria": 6, "Valladolid": 6, "Zamora": 6,
    "Albacete": 7, "Ciudad Real": 7, "Cuenca": 7, "Guadalajara": 7, "Toledo": 7, "Barcelona": 8, "Girona": 8, "Lleida": 8, "Tarragona": 8,
    "Alicante": 9, "Castellón": 9, "Valencia": 9, "Badajoz": 10, "Cáceres": 10, "A Coruña": 11, "Lugo": 11, "Ourense": 11, "Pontevedra": 11,
    "Madrid": 12, "Murcia": 13, "Navarra": 14, "Álava": 15, "Araba/Álava": 15, "Bizkaia": 15, "Gipuzkoa": 15, "La Rioja": 16, "Ceuta": 17, "Melilla": 18,
  };
  const CHECKLISTS = {
    eia_ordinaria: ["Descargar el estudio de impacto ambiental y sus anexos", "Cruzar con IBA, ZEPA y planes de recuperación", "Pedir el expediente completo si falta documentación (Ley 27/2006)", "Redactar el escrito de alegaciones", "Revisión técnica", "Revisión jurídica", "Presentar en registro electrónico", "Guardar el justificante en esta ficha", "Pedir la condición de interesado (art. 4 Ley 39/2015)"],
    eia_simplificada: ["Leer el documento ambiental", "Valorar si pedir evaluación ordinaria", "Redactar el escrito", "Revisión", "Presentar en registro electrónico", "Guardar el justificante en esta ficha"],
    plan: ["Leer el estudio ambiental estratégico", "Localizar suelos que afectan a IBA o ZEPA", "Redactar el escrito", "Revisión", "Presentar en registro electrónico", "Guardar el justificante en esta ficha"],
  };
  const DEFAULT_CHECKLIST = ["Redactar el escrito", "Revisión", "Presentar en registro electrónico", "Guardar el justificante en esta ficha"];
  const FEED_URL = "https://raw.githubusercontent.com/Asensio94/observatorio-alegaciones/main/data/estado.json";
  // What starts the clock of a new case. Consultations reach the organisation by e-mail, often
  // before (or instead of) any announcement in the BOE; a notice of an electronic notification
  // gives 10 calendar days to open it.
  const TRIGGERS = { publication: "Anuncio de información pública", consultation: "Consulta a la organización como persona interesada", notification: "Aviso de notificación electrónica (DEHú o sede)" };
  const DATE_LABEL = { publication: "Fecha de publicación", consultation: "Fecha de recepción", notification: "Fecha del aviso", none: "Fecha de recepción" };
  const noticeKindLabel = (k) => (k === "notification" ? "Aviso de notificación electrónica" : Deadlines.CONSULTATIONS[k]?.label || "Sin clasificar");

  // ---------- small helpers ----------
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const pad = (n) => String(n).padStart(2, "0");
  const today = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
  const nowStr = () => { const d = new Date(); return `${today()}T${pad(d.getHours())}:${pad(d.getMinutes())}`; };
  const uid = (p = "") => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const D = Deadlines;
  const fmt = new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  const fmtShort = new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short", timeZone: "UTC" });
  const asDate = (s) => new Date(`${s.slice(0, 10)}T00:00:00Z`);
  const dateLabel = (s, short) => (s ? (short ? fmtShort : fmt).format(asDate(s)) : "—");
  const dateTimeLabel = (s) => (s ? dateLabel(s) + (s.length > 10 ? ` · ${s.slice(11, 16)} h` : "") : "—");
  const rel = (s) => {
    const d = D.diffDays(today(), s.slice(0, 10));
    if (d === 0) return "hoy";
    if (d === 1) return "mañana";
    if (d === -1) return "ayer";
    return d > 0 ? `en ${d} días` : `hace ${-d} días`;
  };
  const num = (n) => new Intl.NumberFormat("es-ES").format(n);
  /* BOE titles open with the same boilerplate ("Anuncio de la Dependencia de Industria y Energía de la
     Subdelegación… por el que se somete a información pública…"). The project is what follows:
     cut there, and start at the first word that names a thing. The full title is kept in the case. */
  const THING = /\b(proyecto|parque|planta|instalaci[oó]n|m[oó]dulo|l[ií]nea|subestaci[oó]n|central|almacenamiento|hibridaci[oó]n|concesi[oó]n|aprovechamiento|ampliaci[oó]n|explotaci[oó]n|autorizaci[oó]n de vertido|plan|modificaci[oó]n|documento|obras?)\b/i;
  function shortTitle(t) {
    const i = t.search(/informaci[oó]n p[uú]blica/i);
    if (i < 0) return t;
    const rest = t.slice(i).replace(/^informaci[oó]n p[uú]blica\S*\s*/i, "");
    const m = rest.search(THING);
    const s = (m >= 0 ? rest.slice(m) : rest.replace(/^(?:y definitiva|a efectos|de|del|la|el|los|las|una?|sobre)\s+/gi, "")).trim();
    return s.length > 25 ? s.charAt(0).toUpperCase() + s.slice(1) : t;
  }
  const regionOfProvince = (p) => (p in PROVINCE_REGION ? REGIONS[PROVINCE_REGION[p]] : "");

  // ---------- state ----------
  const S = {
    store: null, data: null, feed: null, feedError: null, feedLoading: false,
    route: { view: "hoy" }, sel: 0, saving: false, savedAt: null, focus: null,
    filters: { q: "", stage: "", owner: "", category: "", tag: "", closed: false, preset: "" }, filtersOpen: false,
    inbox: { envOnly: true, q: "", tab: "" },
    mine: false, month: null, gPressed: false,
  };
  const me = () => { try { return localStorage.getItem("registro-me") || S.data?.people?.[0]?.id || ""; } catch { return S.data?.people?.[0]?.id || ""; } };
  const setMe = (id) => { try { localStorage.setItem("registro-me", id); } catch { /* ignore */ } };
  const person = (id) => S.data.people.find((p) => p.id === id);
  const personName = (id) => person(id)?.name || "—";
  // "Marta (delegación territorial)" -> "M": the role in brackets is not part of the name.
  const initials = (id) => (person(id)?.name || "?").replace(/\(.*?\)/g, "").split(/\s+/).filter((w) => /^\p{L}/u.test(w)).map((w) => w[0]).join("").slice(0, 2).toUpperCase() || "?";
  const caseById = (id, d = S.data) => d.cases.find((c) => c.id === id);

  // ---------- derived data ----------
  function calendarFor(c) {
    const org = S.data.org || {};
    return D.calendar({ regions: [org.region, c?.region].filter(Boolean), extra: (org.extra_holidays || []).map((h) => h.date) });
  }
  function deadlinesOf(c) { return D.derive(c, calendarFor(c)).map((p) => ({ ...p, light: D.light(p, today()), caseId: c.id })); }
  function allDeadlines() { return S.data.cases.flatMap((c) => (c.stage === "discarded" ? [] : deadlinesOf(c))); }
  function nextDeadline(c) {
    const open = deadlinesOf(c).filter((p) => !p.done && p.kind !== "dia_expiry");
    open.sort((a, b) => (a.due < b.due ? -1 : 1));
    return open[0] || null;
  }
  function receiptsOf(c, ev) {
    return (c.docs || []).filter((d) => d.kind === "receipt" && (d.event === ev.id || (ev.docs || []).includes(d.id)));
  }
  function filingsWithoutReceipt() {
    return S.data.cases.flatMap((c) => c.events.filter((e) => ["filing", "appeal", "info_request"].includes(e.type) && !receiptsOf(c, e).length).map((e) => ({ c, e })));
  }
  function feedItems() {
    const known = new Set(S.data.cases.map((c) => c.boe_id).filter(Boolean));
    const t = today();
    const all = Object.values(S.feed?.anuncios || {}).filter((a) => (a.fecha_limite || "") >= t && !known.has(a.identificador));
    const pending = [], decided = [];
    for (const a of all) {
      const tri = S.data.triage[a.identificador];
      const snoozed = tri?.decision === "snoozed" && tri.until > t;
      if (tri && (tri.decision === "discarded" || snoozed)) decided.push({ a, tri });
      else pending.push(a);
    }
    pending.sort((x, y) => (y.prioridad - x.prioridad) || (x.fecha_limite < y.fecha_limite ? -1 : 1));
    return { pending, decided };
  }
  // estado.json has no build date: the newest announcement it holds says how fresh it is.
  const latestFeedDate = () => Object.values(S.feed?.anuncios || {}).reduce((m, a) => (a.fecha > m ? a.fecha : m), "") || today();
  function inboxCount() {
    const items = S.feed ? feedItems().pending : [];
    return (S.inbox.envOnly ? items.filter((a) => a.tramite_ambiental).length : items.length) + noticeItems().pending.length;
  }
  // Notices received by e-mail and not yet in a case: they wait in the inbox like the BOE ones.
  function noticeItems() {
    const t = today(), pending = [], decided = [];
    for (const n of S.data.notices) {
      if (n.case_id) continue;
      const tri = S.data.triage[n.id];
      if (tri && (tri.decision === "discarded" || (tri.decision === "snoozed" && tri.until > t))) decided.push({ n, tri });
      else pending.push(n);
    }
    const due = (n) => noticeDeadline(n)?.due || "9";
    pending.sort((a, b) => (due(a) < due(b) ? -1 : 1));
    return { pending, decided };
  }
  // The clock runs from receipt, before anyone opens a case.
  function noticeDeadline(n) {
    if (!n.received) return null;
    const ev = n.kind === "notification" ? { id: n.id, type: "notification", date: n.received }
      : D.CONSULTATIONS[n.kind] ? { id: n.id, type: "consultation", date: n.received, subtype: n.kind } : null;
    const p = ev && D.derive({ events: [ev] }, calendarFor(null))[0];
    return p ? { ...p, light: D.light(p, today()) } : null;
  }
  /* Which case a notice or an announcement belongs to: the same file number, or enough distinctive
     words in common with the title, towns and developer. Only ever a suggestion. */
  const norm = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  // Words that say what kind of thing it is, not which one: two solar plants share them all.
  const STOP = new Set(("para por del los las una con sus que este esta sobre entre como demo anuncio informacion publica consulta " +
    "proyecto expediente tramite ambiental evaluacion impacto documento estudio alcance ordinaria simplificada personas interesadas " +
    "municipio municipios termino terminos municipal provincia planta parque solar fotovoltaica fotovoltaico eolico eolica " +
    "instalacion instalada potencia infraestructura infraestructuras evacuacion linea electrica subestacion hibridacion modulo").split(" "));
  const words = (s) => new Set((norm(s).match(/[a-z0-9]{4,}/g) || []).filter((w) => !STOP.has(w)));
  const fileKey = (s) => norm(s).replace(/[^a-z0-9]/g, "");
  function matchCase(text, fileNo, { withoutBoe = false } = {}) {
    const fk = fileKey(fileNo), w = words(text);
    let best = null;
    for (const c of S.data.cases) {
      if (c.stage === "discarded" || (withoutBoe && c.boe_id)) continue;
      if (fk.length >= 5 && fileKey(c.file_no) === fk) return { c, why: `mismo número de expediente (${c.file_no})` };
      const cw = words(`${c.title} ${c.official_title || ""} ${(c.towns || []).join(" ")} ${c.developer || ""}`);
      const shared = [...cw].filter((x) => w.has(x)).length;
      const score = shared / Math.max(1, Math.min(cw.size, w.size));
      if (shared >= 2 && score >= 0.5 && (!best || score > best.score)) best = { c, score, why: `${shared} palabras en común con el título` };
    }
    return best;
  }
  function news() {
    const out = [];
    for (const r of Object.values(S.feed?.resoluciones || {})) {
      if (!r.emparejado_con) continue;
      const c = S.data.cases.find((x) => x.boe_id === r.emparejado_con);
      if (!c || c.events.some((e) => e.source_id === r.identificador) || (c.dismissed_news || []).includes(r.identificador)) continue;
      out.push({ c, r });
    }
    return out;
  }

  // ---------- persistence ----------
  /* A change is a function on the data. It is applied at once on screen and queued; the store
     saves only the records that changed. If someone else saved one of those records meanwhile,
     nothing is written: the folder is re-read and every queued change is applied again on top of
     the other person's version. Changes to different records never collide. */
  const pending = [];
  let flushing = null;
  function mutate(fn) {
    fn(S.data); pending.push(fn);
    render();
    return (flushing ||= flush().finally(() => { flushing = null; }));
  }
  async function flush() {
    S.saving = true; renderStatus();
    try {
      for (let tries = 0; pending.length; ) {
        const batch = pending.length;
        const r = await S.store.save(S.data, me());
        if (r.conflicts.length) {
          if (++tries > 4) throw new Error("la carpeta cambia sin parar; vuelve a intentarlo en un momento");
          const fresh = await S.store.read();
          if (!fresh) throw new Error("la carpeta ya no tiene el registro");
          normalize(fresh);
          for (const f of pending) f(fresh);
          S.data = fresh; render();
          toast("Otra persona había cambiado lo mismo: tu cambio se ha aplicado sobre su versión.");
          continue;
        }
        pending.splice(0, batch);
      }
      S.savedAt = new Date();
    } catch (e) {
      pending.length = 0;
      toast(`No se pudo guardar: ${e.message}`, true);
    }
    S.saving = false; renderStatus();
  }
  const onCase = (id, f) => (d) => { const c = caseById(id, d); if (c) { f(c, d); c.updated = nowStr(); } };
  const sysEvent = (title, extra = {}) => ({ id: uid("s"), type: "stage", date: nowStr(), at: nowStr(), by: me(), title, ...extra });

  function setStage(id, stage, extra = {}) {
    const c = caseById(id);
    if (!c || c.stage === stage) return;
    const ev = sysEvent(`Fase: ${STAGE[c.stage].label} → ${STAGE[stage].label}`, extra.reason ? { note: extra.reason } : {});
    mutate(onCase(id, (c) => {
      c.stage = stage; c.stage_since = today();
      if (extra.reason) c.discard_reason = extra.reason;
      c.events.push(ev);
    }));
  }

  // ---------- feed ----------
  async function loadFeed() {
    S.feedLoading = true; S.feedError = null; render();
    const url = S.data.org?.feed_url || FEED_URL;
    try {
      const r = await fetch(url, { cache: "no-cache" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      S.feed = await r.json();
    } catch (e) {
      S.feedError = e.message;
      if (S.store.kind === "demo") S.feed = Demo.feed();
    }
    S.feedLoading = false; render();
  }

  // ---------- rendering: shell ----------
  function render() {
    // The method section is reference material: it shows on the landing page and in the guide.
    document.body.classList.toggle("show-method", S.route.view === "guia");
    if (!S.data) { if (S.route.view === "guia") renderGuideAlone(); else renderWelcome(); return; }
    document.body.classList.add("ready");
    renderFigures(); renderNav(); renderStatus();
    const r = S.route, main = $("#main");
    const views = { hoy: viewToday, bandeja: viewInbox, plazos: viewDeadlines, cases: viewCases, case: viewCase, informe: viewReport, ajustes: viewSettings, guia: viewGuide };
    main.innerHTML = (views[r.view] || viewToday)();
    main.dataset.view = r.view;
    if (S.focus) { const el = $(S.focus); if (el) el.focus(); S.focus = null; }
    markSelection();
  }

  function renderFigures() {
    const ds = allDeadlines();
    const urgent = ds.filter((p) => p.ours && ["missed", "today", "week"].includes(p.light)).length;
    const year = today().slice(0, 4);
    const filed = S.data.cases.reduce((n, c) => n + c.events.filter((e) => e.type === "filing" && e.date.startsWith(year)).length, 0);
    const open = S.data.cases.filter((c) => ACTIVE.has(c.stage)).length;
    const fig = (n, l, href, warn) => `<div><b class="${warn && n ? "warn" : ""}"><a href="${href}">${num(n)}</a></b><span>${l}</span></div>`;
    $("#figures").innerHTML =
      fig(inboxCount(), "en la bandeja", "#/bandeja") +
      fig(open, "expedientes abiertos", "#/expedientes") +
      fig(urgent, "plazos nuestros en 7 días", "#/plazos", true) +
      fig(filed, `presentadas en ${year}`, "#/informe") +
      fig(filingsWithoutReceipt().length, "envíos sin justificante", "#/expedientes/lista?sin-justificante", true);
  }

  function renderNav() {
    const r = S.route, ds = allDeadlines();
    const urgent = ds.filter((p) => p.ours && ["missed", "today", "week"].includes(p.light)).length;
    // Four places, each with a line saying what it is for; the rest is secondary.
    const link = (href, label, count, on, sub = "") => `<a href="${href}" class="${on ? "on" : ""}"${on ? ' aria-current="page"' : ""}><span>${label}${sub ? `<small>${sub}</small>` : ""}</span>${count != null ? `<em>${count}</em>` : ""}</a>`;
    $("#nav").innerHTML = `
      ${link("#/hoy", "Hoy", null, r.view === "hoy", "Qué hay que hacer")}
      ${link("#/bandeja", "Bandeja", S.feed || S.data.notices.length ? inboxCount() : "…", r.view === "bandeja", "Lo que ha llegado")}
      ${link("#/plazos", "Plazos", urgent || null, r.view === "plazos", "Qué vence y cuándo")}
      ${link("#/expedientes", "Expedientes", S.data.cases.filter((c) => ACTIVE.has(c.stage)).length, r.view === "cases" || r.view === "case", "Cada proyecto seguido")}
      <button type="button" class="btn primary nav-new" data-action="new-case">Nuevo expediente</button>
      <div class="nav-more">
        ${link("#/informe", "Informe", null, r.view === "informe")}
        ${link("#/ajustes", "Ajustes", null, r.view === "ajustes")}
        ${link("#/guia", "Guía", null, r.view === "guia")}
        <button type="button" class="btn ghost nav-k" data-action="palette">Buscar <kbd>Ctrl K</kbd></button>
      </div>`;
  }

  function renderStatus() {
    const el = $("#status");
    if (!el || !S.data) return;
    const who = `<label class="me">Soy <select data-action="set-me">${S.data.people.map((p) => `<option value="${p.id}"${p.id === me() ? " selected" : ""}>${esc(p.name)}</option>`).join("")}</select></label>`;
    const where = S.store.kind === "demo"
      ? `<span class="pill demo">Demostración</span> datos sintéticos en este navegador`
      : `Carpeta <b>${esc(S.store.name)}</b>`;
    const state = S.saving ? "guardando…" : S.savedAt ? `guardado ${S.savedAt.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}` : "sin cambios";
    const clash = S.store.conflicted?.length ? ` · <a class="warn" href="#/ajustes">${S.store.conflicted.length} ${S.store.conflicted.length === 1 ? "copia" : "copias"} en conflicto</a>` : "";
    el.innerHTML = `${who}<span>${where} · ${state}${clash}</span>`;
  }

  // ---------- chips ----------
  const LIGHT_LABEL = { missed: "vencido", today: "vence hoy", week: "esta semana", later: "", done: "cumplido", late: "fuera de plazo", very_late: "muy fuera de plazo" };
  function chip(p, withLabel) {
    if (!p) return `<span class="chip none">sin plazos</span>`;
    const txt = p.light === "done" ? "cumplido" : `${rel(p.due)} · ${dateLabel(p.due, true)}`;
    return `<span class="chip ${p.light}${p.ours ? " ours" : " theirs"}" title="${esc(`${p.label}: ${p.rule} (${p.basis})${p.estimated ? ". Estimado: revisa festivos." : ""}`)}">${withLabel ? `${esc(p.label)} · ` : ""}${txt}${p.estimated ? " *" : ""}</span>`;
  }
  const prio = (n) => `<span class="prio p${n || 0}" title="Prioridad ${["sin", "baja", "media", "alta"][n || 0]}"><i></i><i></i><i></i></span>`;
  const avatar = (id) => (id ? `<span class="avatar" title="${esc(personName(id))}">${esc(initials(id))}</span>` : `<span class="avatar empty" title="Sin responsable">·</span>`);
  const stageBadge = (s) => `<span class="stage st-${s}">${STAGE[s]?.label || s}</span>`;

  // ---------- view: welcome ----------
  function renderWelcome(setup) {
    document.body.classList.remove("ready");
    $("#figures").innerHTML = "";
    $("#nav").innerHTML = "";
    const folders = Store.supportsFolders();
    $("#main").innerHTML = setup ? `
      <section class="welcome card">
        <h2>Carpeta nueva: «${esc(S.store.name)}»</h2>
        <p>Esta carpeta todavía no tiene un registro. Lo creamos con estos datos; se pueden cambiar luego en Ajustes.</p>
        <form id="setup" class="form">
          <label>Organización <input name="name" required placeholder="Nombre de la organización"></label>
          <label>Comunidad de la sede <select name="region">${REGIONS.map((r) => `<option>${r}</option>`).join("")}</select></label>
          <label>Tu nombre o rol <input name="me" required placeholder="Por ejemplo: Ana (conservación)"></label>
          <button class="btn primary">Crear el registro</button>
        </form>
      </section>` : `
      <section class="welcome">
        <div class="card">
          <h2>Trabajar con la carpeta del equipo</h2>
          <p>Elige la carpeta compartida donde vivirá el registro: una unidad de red, OneDrive, SharePoint o Google Drive para escritorio. La herramienta guarda ahí un fichero por expediente, los documentos y los correos recibidos, y una copia completa cada día. <b>Nada sale de esa carpeta.</b></p>
          ${folders ? `<p class="actions"><button class="btn primary" data-action="pick-folder">Abrir carpeta…</button>
            ${S.pendingFolder ? `<button class="btn" data-action="reopen-folder">Volver a abrir «${esc(S.pendingFolder.name)}»</button>` : ""}</p>`
            : `<p class="note">Este navegador no permite abrir carpetas. Usa Chrome o Edge para trabajar con la carpeta compartida; aquí puedes probar la demostración.</p>`}
        </div>
        <div class="card">
          <h2>Probar con datos de demostración</h2>
          <p>Siete expedientes inventados en distintas fases, con plazos que vencen esta semana, una presentación sin justificante, una autorización recurrible y dos avisos llegados por correo. La bandeja lee el estado real del Observatorio de alegaciones.</p>
          <p class="actions"><button class="btn" data-action="demo">Abrir la demostración</button></p>
        </div>
      </section>
      <p class="welcome-guide">¿Primera vez? <a href="#/guia">Lee la guía rápida</a>: qué es cada parte, los primeros pasos y cómo leer los colores.</p>`;
  }
  function renderGuideAlone() {
    document.body.classList.remove("ready");
    $("#figures").innerHTML = "";
    $("#nav").innerHTML = "";
    $("#main").innerHTML = `<nav class="crumbs note"><a href="#/">← Volver al inicio</a></nav>${viewGuide()}`;
  }

  // ---------- view: today ----------
  /* The landing view answers one question: what needs doing. Our moves first, then what is waiting
     for a decision, then what the Administration owes us. Each card links to the full view. */
  const introHidden = () => { try { return localStorage.getItem("registro-intro") === "hidden"; } catch { return false; } };
  const plural = (n, one, many) => `${num(n)} ${n === 1 ? one : many}`;
  function viewToday() {
    const ds = allDeadlines().filter((p) => !p.done && p.kind !== "dia_expiry").sort((a, b) => (a.due < b.due ? -1 : 1));
    const ours = ds.filter((p) => p.ours && ["missed", "today", "week"].includes(p.light));
    const missed = ours.filter((p) => p.light === "missed").length;
    const theirs = ds.filter((p) => !p.ours && ["late", "very_late"].includes(p.light));
    const waitingOk = ds.filter((p) => !p.ours && !["late", "very_late"].includes(p.light)).length;
    const notices = noticeItems().pending;
    const toDecide = inboxCount();
    const boe = S.feed ? toDecide - notices.length : null;
    const noReceipt = filingsWithoutReceipt();
    const nw = news();

    const parts = [];
    if (missed) parts.push(`<b>${plural(missed, "plazo nuestro vencido", "plazos nuestros vencidos")}</b>`);
    if (ours.length - missed) parts.push(`<b>${plural(ours.length - missed, "plazo nuestro", "plazos nuestros")}</b> esta semana`);
    if (toDecide) parts.push(`<b>${plural(toDecide, "cosa", "cosas")}</b> por decidir en la bandeja`);
    if (noReceipt.length) parts.push(`<b>${plural(noReceipt.length, "envío", "envíos")} sin justificante</b>`);
    if (theirs.length) parts.push(`<b>${plural(theirs.length, "respuesta", "respuestas")}</b> de la Administración fuera de plazo`);
    const list = parts.length > 1 ? `${parts.slice(0, -1).join(", ")} y ${parts.at(-1)}` : parts[0];
    const day = new Intl.DateTimeFormat("es-ES", { weekday: "long", day: "numeric", month: "long" }).format(new Date());
    const summary = list ? `Hay ${list}.` : "Nada urgente: ningún plazo nuestro esta semana y la bandeja está al día.";

    const intro = introHidden() ? "" : `<section class="intro card">
      <h3 class="label">Primeros pasos</h3>
      <ol class="steps">
        <li><b>Di quién eres</b> en «Soy», encima del menú. Cada cambio queda firmado con ese nombre.</li>
        <li><b>Decide lo que hay en la bandeja</b>: abre expediente, descarta con motivo o pospón cada aviso y anuncio.</li>
        <li><b>Anota los hechos</b> en la cronología de cada expediente según ocurren. Los plazos se calculan solos.</li>
        <li><b>Al presentar</b>, pulsa «Anotar presentación», pon el número de registro y sube el justificante.</li>
        <li><b>Vuelve a esta página</b> cada mañana: aquí está lo que hay que hacer.</li>
      </ol>
      <p class="actions"><a class="btn small" href="#/guia">Leer la guía</a><button class="btn small ghost" data-action="intro-hide">Entendido, ocultar</button></p></section>`;

    const alerts = [
      noReceipt.length ? `<div class="alert warn"><div><b>Falta el justificante</b> de ${noReceipt.length === 1 ? "un envío" : `${noReceipt.length} envíos`}: ${noReceipt.slice(0, 4).map(({ c, e }) => `<a href="#/e/${esc(c.id)}">${esc(c.title)}</a> (${dateLabel(e.date, true)})`).join(", ")}${noReceipt.length > 4 ? "…" : ""}. Es la única prueba de que se presentó y de cuándo.</div></div>` : "",
      nw.length ? `<div class="alert info"><div>El observatorio ha publicado ${nw.length === 1 ? "una resolución que parece" : `${nw.length} resoluciones que parecen`} de vuestros expedientes.</div><a class="btn small" href="#/bandeja">Revisar</a></div>` : "",
    ].join("");

    let i = 0;
    const MAX = 6;
    const caseRowMini = (p) => {
      const c = caseById(p.caseId);
      return `<li class="row sel-row" data-idx="${i++}" data-href="#/e/${esc(c.id)}" tabindex="-1">
        <div class="row-main"><p class="row-title"><a href="#/e/${esc(c.id)}">${esc(c.title)}</a></p><p class="row-meta">${chip(p)} ${esc(p.label)}</p></div>
        ${avatar(c.owner)}</li>`;
    };
    const card = (cls, title, count, explain, rows, more, empty) => `<section class="tcard card ${cls}">
      <h3 class="label">${title} <em>${count}</em></h3><p class="note">${explain}</p>
      ${rows ? `<ol class="rows">${rows}</ol>` : `<p class="tempty">${empty}</p>`}
      ${more ? `<p class="tmore">${more}</p>` : ""}</section>`;

    const noticeRows = notices.slice(0, MAX).map((n) => {
      const p = noticeDeadline(n);
      return `<li class="row sel-row" data-idx="${i++}" data-href="#/bandeja" tabindex="-1">
        <div class="row-main"><p class="row-title"><a href="#/bandeja">${esc(n.subject)}</a></p><p class="row-meta">${p ? `${chip(p)} ` : ""}${esc(noticeKindLabel(n.kind))}, sin expediente todavía</p></div></li>`;
    }).join("");
    const cards = `<div class="today-grid">
      ${card("t-ours", "Nos toca actuar", ours.length, "Plazos nuestros vencidos, de hoy o de esta semana.",
        ours.slice(0, MAX).map(caseRowMini).join(""),
        `<a href="#/plazos">${ours.length > MAX ? `Ver los ${ours.length} y el resto de plazos` : "Ver todos los plazos"} →</a>`,
        "Nada que presentar esta semana.")}
      ${card("t-decide", "Por decidir", toDecide, "Avisos llegados por correo y anuncios del BOE que aún no tienen expediente ni descarte.",
        noticeRows,
        `${boe != null && boe > 0 ? `${plural(boe, "anuncio del BOE", "anuncios del BOE")} con plazo abierto. ` : ""}<a href="#/bandeja">Ir a la bandeja →</a>`,
        "No hay avisos del correo sin decidir.")}
      ${card("t-theirs", "Esperando a la Administración", theirs.length, "Respuestas y resoluciones que ya deberían haber llegado.",
        theirs.slice(0, MAX).map(caseRowMini).join(""),
        waitingOk ? `${plural(waitingOk, "respuesta más", "respuestas más")} aún en plazo. <a href="#/plazos">Ver plazos →</a>` : "",
        "Ninguna fuera de plazo.")}
    </div>`;

    return `<header class="view-h today-h"><p class="label today-day">${esc(day)}</p><h2>Hoy</h2><p class="today-sum">${summary}</p></header>
      ${intro}${alerts}${cards}`;
  }

  // ---------- view: guide ----------
  function viewGuide() {
    const ex = (light, ours, n, label) => chip({ light, ours, due: D.addDays(today(), n), label, rule: "ejemplo", basis: "" });
    const legend = [
      [ex("missed", true, -2, "Alegaciones"), "Nos tocaba y el plazo ya pasó."],
      [ex("today", true, 0, "Alegaciones"), "Nos toca y vence hoy."],
      [ex("week", true, 4, "Alegaciones"), "Nos toca y vence esta semana."],
      [ex("later", true, 20, "Alegaciones"), "Nos toca, con tiempo."],
      [ex("later", false, 15, "Respuesta"), "Esperamos a la Administración y aún está en plazo."],
      [ex("late", false, -10, "Respuesta"), "Debería haber respondido: conviene reclamar."],
      [ex("very_late", false, -40, "Respuesta"), "Más de 30 días fuera de plazo: cabe recurrir el silencio."],
      [`<span class="chip done ours">cumplido</span>`, "Plazo cerrado por el hecho que lo contesta."],
    ].map(([c, t]) => `<tr><th>${c}</th><td>${t}</td></tr>`).join("");
    return `<header class="view-h"><h2>Guía rápida</h2>
      <p class="guide-lede">El registro sirve para tres cosas: que no se pase ningún plazo, saber qué se ha enviado y con qué papeles, y poder demostrarlo.</p></header>
      <div class="guide">
        <section><h3 class="label">Qué es cada parte</h3>
          <dl class="parts">
            <dt>Hoy</dt><dd>Lo que hay que hacer hoy y esta semana. Es la página de inicio.</dd>
            <dt>Bandeja</dt><dd>Lo que ha llegado y nadie ha decidido: avisos que llegan por correo (consultas, notificaciones) y anuncios del BOE con plazo abierto.</dd>
            <dt>Plazos</dt><dd>Todos los plazos abiertos, del más urgente al más lejano, de todo el equipo o solo los tuyos.</dd>
            <dt>Expedientes</dt><dd>Un expediente por proyecto: su cronología, sus documentos y sus tareas. Se ven en lista, en tablero por fases o en calendario.</dd>
            <dt>Informe y Ajustes</dt><dd>El resumen del año para la memoria, y la configuración: personas del equipo, festivos, instalar la aplicación.</dd>
          </dl></section>
        <section><h3 class="label">Primeros pasos</h3>
          <ol class="steps">
            <li><b>Abre la carpeta del equipo</b> (o la demostración, para curiosear sin miedo).</li>
            <li><b>Di quién eres</b> en «Soy», encima del menú. Cada cambio queda firmado con ese nombre.</li>
            <li><b>Decide lo que hay en la bandeja.</b> Para cada aviso o anuncio: <i>Abrir expediente</i>, <i>Descartar</i> (con motivo, para saber luego por qué no se alegó) o <i>Posponer</i> hasta una fecha.</li>
            <li><b>Anota los hechos</b> en la cronología de cada expediente según ocurren: la consulta recibida, la presentación, la respuesta, la resolución. Los plazos se calculan solos a partir de ellos.</li>
            <li><b>Al presentar</b>, pulsa «Anotar presentación», pon el número de registro y sube el justificante. Sin justificante, el expediente queda marcado en rojo.</li>
          </ol></section>
        <section><h3 class="label">Cómo leer los colores</h3>
          <p><b>Relleno: nos toca a nosotros. Contorno: le toca a la Administración.</b> Un asterisco (*) indica un plazo estimado: compruébalo con el anuncio.</p>
          <table class="params legend"><tbody>${legend}</tbody></table></section>
        <section><h3 class="label">La rutina</h3>
          <ul>
            <li><b>Cada mañana</b>, abre «Hoy» y empieza por lo rojo.</li>
            <li><b>Cuando llega un correo</b> de un órgano ambiental, arrástralo a la página: entra en la bandeja con su plazo.</li>
            <li><b>El día que se presenta algo</b>, anótalo y sube el justificante.</li>
            <li><b>Una vez a la semana</b>, deja la bandeja a cero y repasa lo que espera respuesta de la Administración.</li>
          </ul></section>
        <section><h3 class="label">Atajos de teclado</h3>
          <p class="note">Opcionales: todo tiene también su botón.</p>
          <table class="params"><tbody>
            <tr><th><kbd>Ctrl K</kbd> o <kbd>/</kbd></th><td>Buscar un expediente o ir a cualquier sitio</td></tr>
            <tr><th><kbd>N</kbd></th><td>Nuevo expediente</td></tr>
            <tr><th><kbd>J</kbd> <kbd>K</kbd> o flechas</th><td>Moverse por una lista; <kbd>Intro</kbd> abre</td></tr>
            <tr><th><kbd>A</kbd> <kbd>D</kbd> <kbd>S</kbd></th><td>En la bandeja: abrir expediente, descartar, posponer</td></tr>
            <tr><th><kbd>G</kbd> y luego <kbd>H</kbd> <kbd>B</kbd> <kbd>P</kbd> <kbd>E</kbd></th><td>Ir a Hoy, Bandeja, Plazos, Expedientes</td></tr>
          </tbody></table></section>
        <section><h3 class="label">Preguntas frecuentes</h3>
          <dl class="faq">
            <dt>¿Dónde están los datos?</dt><dd>En la carpeta del equipo: un fichero por expediente, los documentos y los correos, y una copia completa cada día. La página solo trae el código; nada sale de la carpeta. En la demostración, todo se queda en este navegador.</dd>
            <dt>¿Qué pasa si dos personas lo usan a la vez?</dt><dd>Cada una ve los cambios de la otra en unos segundos. Si tocan el mismo expediente, el segundo cambio se aplica encima del primero: no se pierde ninguno.</dd>
            <dt>¿Cómo meto un correo de Outlook?</dt><dd>Desde Outlook de escritorio, arrástralo primero al escritorio y desde ahí a la página. Desde Outlook web o Gmail, descárgalo como .eml. También vale el PDF.</dd>
            <dt>El plazo no coincide con el del anuncio</dt><dd>Manda el anuncio. Revisa los festivos en Ajustes (los locales no vienen de serie) y la fecha del hecho en la cronología. Si el plazo ya no aplica, «Cerrar sin actuar» lo deja cerrado con el motivo.</dd>
            <dt>¿Se puede instalar?</dt><dd>Sí, en Chrome o Edge: desde Ajustes o con el icono de instalar de la barra de direcciones. Se abre en su propia ventana.</dd>
          </dl></section>
        <p class="note">Debajo está <button class="link" data-action="to-method">cómo se calcula cada plazo</button>, con su base legal.</p>
      </div>`;
  }

  // ---------- view: inbox (triage) ----------
  function viewInbox() {
    const head = `<header class="view-h"><h2>Bandeja</h2>
      <p class="note">Lo que ha llegado y nadie ha decidido todavía. Para cada cosa, una decisión: <b>abrir expediente</b> (o añadirla a uno que ya existe), <b>descartar</b> con motivo o <b>posponer</b>.</p></header>`;
    let body = "", i = 0;
    const nw = news();
    if (nw.length) {
      body += `<section class="news card"><h3 class="label">Novedades en tus expedientes</h3>${nw.map(({ c, r }) => `
        <div class="news-row"><div><a href="#/e/${esc(c.id)}">${esc(c.title)}</a>
          <p class="note">El observatorio ha publicado ${esc((r.tipo_etiqueta || r.tipo || "una resolución").toLowerCase())}${r.sentido_etiqueta ? ` (${esc(r.sentido_etiqueta)})` : ""} el ${dateLabel(r.fecha)}${r.firme ? "" : " · emparejamiento no confirmado"}: ${esc(r.titulo.slice(0, 160))}…</p></div>
          <div class="row-actions"><button class="btn small primary" data-action="news-add" data-case="${esc(c.id)}" data-res="${esc(r.identificador)}">Añadir a la cronología</button>
          <button class="btn small ghost" data-action="news-dismiss" data-case="${esc(c.id)}" data-res="${esc(r.identificador)}">No es de este expediente</button></div></div>`).join("")}</section>`;
    }

    // Three tabs: e-mail notices (few, urgent), BOE announcements (many), and what was decided.
    const notices = noticeItems();
    const feed = S.feed ? feedItems() : null;
    const feedCount = feed ? feed.pending.filter((a) => !S.inbox.envOnly || a.tramite_ambiental).length : null;
    const decided = [
      ...notices.decided.map(({ n, tri }) => ({ id: n.id, title: n.subject, tri })),
      ...(feed ? feed.decided.map(({ a, tri }) => ({ id: a.identificador, title: shortTitle(a.titulo), tri })) : []),
    ];
    const tab = S.inbox.tab || (notices.pending.length ? "avisos" : "boe");
    const tabBtn = (id, label, n) => `<button role="tab" aria-selected="${tab === id}" class="${tab === id ? "on" : ""}" data-action="inbox-tab" data-tab="${id}">${label} <em>${n ?? "…"}</em></button>`;
    body += `<div class="tabs" role="tablist" aria-label="Qué ver">
      ${tabBtn("avisos", "Avisos del correo", notices.pending.length)}${tabBtn("boe", "Anuncios del BOE", feedCount)}${tabBtn("decididos", "Decididos", decided.length)}</div>`;

    if (tab === "avisos") {
      body += `<div class="dropzone">
        <p><b>Arrastra aquí</b> correos (.eml, .msg de Outlook) o PDF de consultas y notificaciones, o
          <button class="btn small" data-action="notice-pick">elige ficheros…</button> <button class="btn small ghost" data-action="notice-manual">Anotar a mano</button></p>
        <p class="note">Se leen en este navegador y se guardan en ${S.store.kind === "folder" ? "la carpeta" : "la demostración"} con sus adjuntos. Desde Outlook de escritorio, arrastra antes el correo al escritorio.${S.store.kind === "folder" ? " Los que deje una regla del buzón en <code>entrada/</code> entran solos." : ""}</p>
      </div>
      ${notices.pending.length ? `<ol class="rows inbox" role="listbox" aria-label="Avisos pendientes">${notices.pending.map((n) => noticeRow(n, i++)).join("")}</ol>` : `<p class="empty">No hay avisos sin decidir.</p>`}`;
      return head + body;
    }
    if (tab === "decididos") {
      body += decided.length ? `<p class="note">Descartados y pospuestos. Lo pospuesto vuelve solo a la bandeja el día indicado.</p><ul class="rows">${decided.map(({ id, title, tri }) => `
        <li class="row"><div class="row-main"><p class="row-title">${esc(title)}</p>
        <p class="row-meta">${tri.decision === "discarded" ? `Descartado: ${esc(tri.reason)}` : `Pospuesto hasta el ${dateLabel(tri.until)}`} · ${esc(personName(tri.by))} · ${dateLabel(tri.at)}</p></div>
        <div class="row-actions"><button class="btn small ghost" data-action="triage-undo" data-id="${esc(id)}">Deshacer</button></div></li>`).join("")}</ul>` : `<p class="empty">Todavía no se ha descartado ni pospuesto nada.</p>`;
      return head + body;
    }

    // Announcements from the observatory.
    let feedHtml;
    if (S.feedLoading && !S.feed) feedHtml = `<p class="empty">Leyendo el observatorio…</p>`;
    else if (!S.feed) feedHtml = `<p class="empty">No se pudo leer el observatorio (${esc(S.feedError || "sin conexión")}). <button class="btn small" data-action="reload-feed">Reintentar</button></p>`;
    else {
      const { pending } = feedItems();
      const q = S.inbox.q.toLowerCase();
      const items = pending.filter((a) => (!S.inbox.envOnly || a.tramite_ambiental) &&
        (!q || `${a.titulo} ${(a.provincias || []).join(" ")} ${(a.municipios || []).join(" ")}`.toLowerCase().includes(q)));
      feedHtml = `<div class="toolbar">
        <input type="search" placeholder="Filtrar por texto, provincia o municipio" value="${esc(S.inbox.q)}" data-action="inbox-q" aria-label="Filtrar la bandeja">
        <label class="check"><input type="checkbox" data-action="inbox-env" ${S.inbox.envOnly ? "checked" : ""}> Solo con trámite ambiental</label>
        ${S.feedError ? `<span class="note">Observatorio no disponible (${esc(S.feedError)}): se muestran anuncios de ejemplo.</span>` : `<span class="note">${num(items.length)} pendientes · último anuncio leído del ${dateLabel(latestFeedDate())}</span>`}
      </div>`;
      feedHtml += items.length ? `<ol class="rows inbox" role="listbox" aria-label="Anuncios pendientes">${items.map((a) => {
        const left = D.diffDays(today(), a.fecha_limite);
        const cls = left <= 7 ? "week" : "later";
        const m = matchCase(`${a.titulo} ${(a.municipios || []).join(" ")} ${a.promotor || ""}`, a.expediente, { withoutBoe: true });
        return `<li class="row sel-row" data-idx="${i++}" data-feed="${esc(a.identificador)}" tabindex="-1">
          <div class="row-main">
            <p class="row-title clamp" title="${esc(a.titulo)}">${esc(shortTitle(a.titulo))}</p>
            <p class="row-meta">${esc(CATEGORIES[a.categoria] || a.categoria || "")} · ${esc((a.provincias || []).join(", "))}${a.natura?.length ? ` · <b class="natura">${a.natura.length} Natura 2000</b>` : ""}${a.n_aves ? ` · ${a.n_aves} aves amenazadas en el municipio` : ""}${a.url_html ? ` · <a href="${esc(a.url_html)}" target="_blank" rel="noopener">anuncio</a>` : ""}</p>
            ${m ? `<p class="row-meta match">Parece del expediente <a href="#/e/${esc(m.c.id)}">${esc(m.c.title)}</a> (${esc(m.why)}), abierto antes de que saliera en el BOE. <button class="btn small" data-action="feed-join" data-id="${esc(a.identificador)}" data-case="${esc(m.c.id)}">Es ese: añadir la publicación</button></p>` : ""}
          </div>
          <span class="chip ${cls} ours" title="Fecha límite ${a.plazo_estimado ? "estimada (30 días hábiles por defecto)" : "calculada por el observatorio"}">${rel(a.fecha_limite)} · ${dateLabel(a.fecha_limite, true)}${a.plazo_estimado ? " *" : ""}</span>
          <div class="row-actions">
            <button class="btn small primary" data-action="triage-accept" data-id="${esc(a.identificador)}">Abrir expediente</button>
            <button class="btn small ghost" data-action="triage-discard" data-id="${esc(a.identificador)}">Descartar</button>
            <button class="btn small ghost" data-action="triage-snooze" data-id="${esc(a.identificador)}">Posponer</button>
          </div></li>`;
      }).join("")}</ol>` : `<p class="empty">Ningún anuncio pendiente: todo lo abierto está decidido.</p>`;
    }
    return head + body + feedHtml;
  }

  function noticeRow(n, i) {
    const p = noticeDeadline(n);
    const m = matchCase(`${n.subject} ${n.excerpt}`, n.file_no);
    const files = [n.original, ...(n.attachments || [])].filter(Boolean);
    const source = { eml: "Correo", msg: "Correo de Outlook", pdf: "PDF", manual: "Anotado a mano" }[n.format] || "Fichero";
    return `<li class="row sel-row notice" data-idx="${i}" data-notice="${esc(n.id)}" tabindex="-1">
      <div class="row-main">
        <p class="row-title">${esc(n.subject)}</p>
        <p class="row-meta"><span class="tag">${esc(noticeKindLabel(n.kind))}</span> ${esc(source)}${n.from?.name || n.from?.email ? ` de ${esc(n.from.name || n.from.email)}` : ""} · recibido el ${dateLabel(n.received)}${n.file_no ? ` · <span class="data">${esc(n.file_no)}</span>` : ""}</p>
        ${m ? `<p class="row-meta match">Parece del expediente <a href="#/e/${esc(m.c.id)}">${esc(m.c.title)}</a> (${esc(m.why)}).</p>` : ""}
        ${n.excerpt || files.length ? `<details class="excerpt"><summary>Ver el texto${files.length ? ` y ${files.length} ${files.length === 1 ? "fichero" : "ficheros"}` : ""}</summary>
          ${n.excerpt ? `<p>${esc(n.excerpt)}${n.excerpt.length >= 900 ? "…" : ""}</p>` : ""}
          ${files.length ? `<p class="ev-docs">${files.map((f) => `<button class="link" data-action="open-doc" data-path="${esc(f.path)}">${esc(f.name)}</button>`).join(" · ")}</p>` : ""}</details>` : ""}
      </div>
      ${p ? chip(p) : `<span class="chip none" title="Sin tipo: el plazo lo dirá el propio aviso">sin plazo</span>`}
      <div class="row-actions">
        ${m ? `<button class="btn small primary" data-action="notice-join" data-id="${esc(n.id)}" data-case="${esc(m.c.id)}">Añadir a ese expediente</button>
        <button class="btn small" data-action="notice-open" data-id="${esc(n.id)}">Abrir uno nuevo</button>`
        : `<button class="btn small primary" data-action="notice-open" data-id="${esc(n.id)}">Abrir expediente</button>
        <button class="btn small" data-action="notice-join" data-id="${esc(n.id)}">Añadir a uno existente</button>`}
        <button class="btn small ghost" data-action="triage-discard" data-id="${esc(n.id)}">Descartar</button>
        <button class="btn small ghost" data-action="triage-snooze" data-id="${esc(n.id)}">Posponer</button>
      </div></li>`;
  }

  // ---------- view: my deadlines ----------
  function viewDeadlines() {
    const all = allDeadlines().filter((p) => !p.done && (!S.mine || caseById(p.caseId).owner === me()));
    all.sort((a, b) => (a.due < b.due ? -1 : 1));
    const groups = [
      ["missed", "Vencidos sin respuesta nuestra", (p) => p.ours && p.light === "missed"],
      ["today", "Vencen hoy", (p) => p.light === "today"],
      ["week", "Esta semana", (p) => p.light === "week"],
      ["chase", "Les toca a ellos y no han respondido", (p) => !p.ours && ["late", "very_late"].includes(p.light)],
      ["later", "Más adelante", (p) => p.light === "later" && p.kind !== "dia_expiry"],
      ["watch", "Vigilancia a largo plazo", (p) => p.kind === "dia_expiry"],
    ];
    let i = 0;
    const rows = (list) => list.map((p) => {
      const c = caseById(p.caseId);
      return `<li class="row sel-row" data-idx="${i++}" data-href="#/e/${esc(c.id)}" tabindex="-1">
        ${prio(c.priority)}
        <div class="row-main"><p class="row-title"><a href="#/e/${esc(c.id)}">${esc(c.title)}</a></p>
          <p class="row-meta">${esc(p.label)} · ${esc(p.rule)} <span class="basis">${esc(p.basis)}</span>${p.light === "very_late" ? " · <b>cabe reclamar o recurrir el silencio</b>" : ""}</p></div>
        ${chip(p)} ${avatar(c.owner)}</li>`;
    }).join("");
    // Consultations still in the inbox already have a clock running.
    const waiting = S.mine ? [] : noticeItems().pending.map((n) => ({ n, p: noticeDeadline(n) })).filter((x) => x.p);
    const inboxHtml = waiting.length ? `<section class="group g-inbox"><h3 class="label">Avisos en la bandeja sin decidir <em>${waiting.length}</em></h3><ol class="rows">${waiting.map(({ n, p }) => `
      <li class="row sel-row" data-idx="${i++}" data-href="#/bandeja" tabindex="-1">${prio(0)}
        <div class="row-main"><p class="row-title"><a href="#/bandeja">${esc(n.subject)}</a></p>
          <p class="row-meta">${esc(p.label)} · ${esc(p.rule)} <span class="basis">${esc(p.basis)}</span> · sin expediente todavía</p></div>
        ${chip(p)} ${avatar("")}</li>`).join("")}</ol></section>` : "";
    const sections = inboxHtml + groups.map(([id, title, f]) => {
      const list = all.filter(f);
      return list.length ? `<section class="group g-${id}"><h3 class="label">${title} <em>${list.length}</em></h3><ol class="rows">${rows(list)}</ol></section>` : "";
    }).join("");
    return `<header class="view-h"><h2>Plazos</h2>
      <p class="note">Salen de la cronología de cada expediente y se cierran solos cuando llega el hecho que los contesta. <b>Relleno</b>: nos toca a nosotros; <b>contorno</b>: esperamos a la Administración.</p></header>
      <div class="toolbar"><div class="seg" role="group" aria-label="De quién">
        <button class="${S.mine ? "" : "on"}" data-action="mine" data-v="0">Todo el equipo</button>
        <button class="${S.mine ? "on" : ""}" data-action="mine" data-v="1">Solo los míos</button></div>
        <a class="btn small ghost" href="#/expedientes/calendario">Ver en calendario</a></div>
      ${sections || `<p class="empty">Nada pendiente. Cuando entre un anuncio en un expediente, su plazo aparecerá aquí.</p>`}`;
  }

  // ---------- view: cases (list, board, calendar) ----------
  function filteredCases() {
    const f = S.filters, q = f.q.toLowerCase();
    const noReceipt = new Set(filingsWithoutReceipt().map((x) => x.c.id));
    return S.data.cases.filter((c) => {
      if (f.preset === "mine" && c.owner !== me()) return false;
      if (f.preset === "noreceipt" && !noReceipt.has(c.id)) return false;
      if (f.preset === "priority" && (c.priority || 0) < 3) return false;
      if (f.preset === "followup" && c.stage !== "followup") return false;
      if (!f.closed && !f.stage && !ACTIVE.has(c.stage) && f.preset !== "noreceipt") return false;
      if (f.stage && c.stage !== f.stage) return false;
      if (f.owner && c.owner !== f.owner) return false;
      if (f.category && c.category !== f.category) return false;
      if (f.tag && !(c.tags || []).includes(f.tag)) return false;
      if (q && !`${c.title} ${c.file_no || ""} ${c.boe_id || ""} ${(c.provinces || []).join(" ")} ${(c.towns || []).join(" ")} ${c.developer || ""} ${(c.tags || []).join(" ")}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }

  function viewCases() {
    const mode = S.route.mode || "lista";
    const f = S.filters;
    const tags = [...new Set(S.data.cases.flatMap((c) => c.tags || []))].sort();
    const presets = [["", "Todos los abiertos"], ["mine", "Los míos"], ["noreceipt", "Sin justificante"], ["priority", "Prioridad alta"], ["followup", "En seguimiento"]];
    const sel = (name, opts, val, all) => `<select data-filter="${name}" aria-label="${all}"><option value="">${all}</option>${Object.entries(opts).map(([k, v]) => `<option value="${esc(k)}"${val === k ? " selected" : ""}>${esc(v)}</option>`).join("")}</select>`;
    const filtering = !!(f.stage || f.owner || f.category || f.tag || f.closed);
    const bar = `<div class="toolbar">
      <div class="seg" role="group" aria-label="Vista">${["lista", "tablero", "calendario"].map((m) => `<a href="#/expedientes/${m}" class="${mode === m ? "on" : ""}">${m[0].toUpperCase() + m.slice(1)}</a>`).join("")}</div>
      <input type="search" data-filter="q" value="${esc(f.q)}" placeholder="Buscar título, expediente, municipio, promotor…" aria-label="Buscar expedientes">
    </div>
    <div class="toolbar">
      <div class="chipbar" role="group" aria-label="Vistas rápidas">${presets.map(([id, label]) => `<button type="button" class="${f.preset === id ? "on" : ""}" data-action="preset" data-preset="${id}">${label}</button>`).join("")}</div>
      <details class="more-filters"${filtering || S.filtersOpen ? " open" : ""}><summary>Más filtros${filtering ? " (activos)" : ""}</summary><div class="toolbar">
        ${sel("stage", Object.fromEntries(STAGES.map((s) => [s.id, s.label])), f.stage, "Todas las fases")}
        ${sel("owner", Object.fromEntries(S.data.people.map((p) => [p.id, p.name])), f.owner, "Cualquier responsable")}
        ${sel("category", CATEGORIES, f.category, "Cualquier tipo")}
        ${tags.length ? sel("tag", Object.fromEntries(tags.map((t) => [t, t])), f.tag, "Cualquier etiqueta") : ""}
        <label class="check"><input type="checkbox" data-filter="closed" ${f.closed ? "checked" : ""}> Incluir cerrados y descartados</label>
      </div></details>
    </div>`;
    const list = filteredCases();
    const head = `<header class="view-h"><h2>Expedientes</h2>
      <p class="note">Un expediente por proyecto al que se sigue la pista, desde que se estudia si alegar hasta la resolución. Ábrelo para ver su cronología, sus plazos y sus documentos.</p></header>`;
    if (mode === "tablero") return head + bar + board(list);
    if (mode === "calendario") return head + bar + calendarView(list);
    return head + bar + listView(list);
  }

  function caseRow(c, i) {
    const nd = nextDeadline(c);
    const days = c.stage_since ? D.diffDays(c.stage_since, today()) : null;
    return `<li class="row sel-row" data-idx="${i}" data-href="#/e/${esc(c.id)}" tabindex="-1">
      ${prio(c.priority)}
      <div class="row-main"><p class="row-title"><a href="#/e/${esc(c.id)}">${esc(c.title)}</a></p>
        <p class="row-meta">${esc(CATEGORIES[c.category] || "")}${c.provinces?.length ? ` · ${esc(c.provinces.join(", "))}` : ""}${c.file_no ? ` · <span class="data">${esc(c.file_no)}</span>` : ""}${(c.tags || []).map((t) => ` <span class="tag">${esc(t)}</span>`).join("")}</p></div>
      ${c.outcome ? `<span class="outcome o-${c.outcome}">${OUTCOMES[c.outcome]}</span>` : ""}
      ${ACTIVE.has(c.stage) ? chip(nd) : ""}
      <span class="age note" title="Días en esta fase">${days != null ? `${days} d` : ""}</span>
      ${avatar(c.owner)}</li>`;
  }

  function listView(list) {
    if (!list.length) return `<p class="empty">Ningún expediente con estos filtros. <button class="btn small" data-action="new-case">Nuevo expediente</button></p>`;
    let i = 0;
    return STAGES.map((s) => {
      const cs = list.filter((c) => c.stage === s.id);
      cs.sort((a, b) => ((nextDeadline(a)?.due || "9") < (nextDeadline(b)?.due || "9") ? -1 : 1));
      return cs.length ? `<section class="group"><h3 class="label">${stageBadge(s.id)} <em>${cs.length}</em> <span class="note">${s.hint}</span></h3><ol class="rows">${cs.map((c) => caseRow(c, i++)).join("")}</ol></section>` : "";
    }).join("");
  }

  function board(list) {
    const cols = STAGES.filter((s) => s.id !== "discarded" && (S.filters.closed || s.id !== "closed" || list.some((c) => c.stage === "closed")));
    return `<div class="board">${cols.map((s) => {
      const cs = list.filter((c) => c.stage === s.id);
      return `<section class="col" data-drop="${s.id}" aria-label="${s.label}"><h3 class="label">${s.label} <em>${cs.length}</em></h3>
        ${cs.map((c) => {
          const nd = nextDeadline(c), days = c.stage_since ? D.diffDays(c.stage_since, today()) : 0;
          return `<a class="card bcard" draggable="true" data-drag="${esc(c.id)}" href="#/e/${esc(c.id)}">
            <span class="bcard-top">${prio(c.priority)}<span class="note">${esc(CATEGORIES[c.category] || "")}</span>${avatar(c.owner)}</span>
            <span class="bcard-title">${esc(c.title)}</span>
            <span class="bcard-foot">${ACTIVE.has(c.stage) ? chip(nd) : c.outcome ? `<span class="outcome o-${c.outcome}">${OUTCOMES[c.outcome]}</span>` : ""}<span class="note" title="Días en esta fase">${days} d en la fase</span></span></a>`;
        }).join("") || `<p class="note drop-hint">Arrastra aquí</p>`}</section>`;
    }).join("")}</div><p class="note">Arrastra una tarjeta para cambiarla de fase; el cambio queda en su cronología.</p>`;
  }

  function calendarView(list) {
    const m = S.month || today().slice(0, 7);
    const [y, mo] = m.split("-").map(Number);
    const first = `${m}-01`;
    const startWd = (asDate(first).getUTCDay() + 6) % 7;
    const daysIn = new Date(Date.UTC(y, mo, 0)).getUTCDate();
    const cal = calendarFor(null);
    const ids = new Set(list.map((c) => c.id));
    const ds = allDeadlines().filter((p) => ids.has(p.caseId) && p.due.startsWith(m));
    const title = new Intl.DateTimeFormat("es-ES", { month: "long", year: "numeric", timeZone: "UTC" }).format(asDate(first));
    let cells = "";
    for (let i = 0; i < startWd; i++) cells += `<div class="day out"></div>`;
    for (let d = 1; d <= daysIn; d++) {
      const s = `${m}-${pad(d)}`;
      const off = !D.isBusinessDay(s, cal);
      const items = ds.filter((p) => p.due === s);
      cells += `<div class="day${off ? " off" : ""}${s === today() ? " now" : ""}"><span class="dnum">${d}</span>${items.map((p) => {
        const c = caseById(p.caseId);
        return `<a href="#/e/${esc(c.id)}" class="cal-item ${p.light}${p.ours ? " ours" : " theirs"}" title="${esc(`${p.label} — ${c.title}`)}">${esc(p.label.replace("Fin del plazo de ", ""))}: ${esc(c.title.slice(0, 40))}</a>`;
      }).join("")}</div>`;
    }
    const shift = (n) => { const d = new Date(Date.UTC(y, mo - 1 + n, 1)); return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`; };
    return `<div class="cal-h"><button class="btn small" data-action="month" data-m="${shift(-1)}" aria-label="Mes anterior">←</button><h3>${title}</h3><button class="btn small" data-action="month" data-m="${shift(1)}" aria-label="Mes siguiente">→</button><button class="btn small ghost" data-action="month" data-m="">Hoy</button>
      <span class="note">En gris, días inhábiles (fines de semana y festivos del calendario de la organización). Relleno: nos toca actuar; contorno: esperamos a la Administración.</span></div>
      <div class="calendar"><div class="wd">L</div><div class="wd">M</div><div class="wd">X</div><div class="wd">J</div><div class="wd">V</div><div class="wd">S</div><div class="wd">D</div>${cells}</div>`;
  }

  // ---------- view: case detail ----------
  function viewCase() {
    const c = caseById(S.route.id);
    if (!c) return `<p class="empty">Este expediente no existe en el registro. <a href="#/expedientes">Volver</a></p>`;
    const ds = deadlinesOf(c).sort((a, b) => (a.due < b.due ? -1 : 1));
    const missing = c.events.filter((e) => ["filing", "appeal", "info_request"].includes(e.type) && !receiptsOf(c, e).length);
    const nw = news().filter((n) => n.c.id === c.id);
    const opt = (o, v) => Object.entries(o).map(([k, l]) => `<option value="${esc(k)}"${v === k ? " selected" : ""}>${esc(l)}</option>`).join("");
    const people = (v) => `<option value="">—</option>` + S.data.people.map((p) => `<option value="${p.id}"${v === p.id ? " selected" : ""}>${esc(p.name)}</option>`).join("");
    const field = (label, html) => `<div class="prop"><span class="label">${label}</span>${html}</div>`;
    const input = (k, v, ph = "") => `<input data-field="${k}" value="${esc(v)}" placeholder="${esc(ph)}">`;

    const alerts = [
      ...missing.map((e) => `<div class="alert warn">Falta el justificante de «${esc(e.title || EVENTS[e.type].label)}» del ${dateLabel(e.date)}. Es la única prueba de que se presentó y de cuándo. <button class="btn small" data-action="upload-for" data-ev="${esc(e.id)}">Subir justificante</button></div>`),
      ...nw.map(({ r }) => `<div class="alert info">El observatorio ha detectado una resolución que parece de este expediente: ${esc(r.tipo_etiqueta || r.tipo)}${r.sentido_etiqueta ? `, ${esc(r.sentido_etiqueta)}` : ""}, ${dateLabel(r.fecha)}. <button class="btn small primary" data-action="news-add" data-case="${esc(c.id)}" data-res="${esc(r.identificador)}">Añadir a la cronología</button></div>`),
    ].join("");

    const deadlinesHtml = ds.length ? `<ol class="deadlines">${ds.map((p) => `<li class="${p.light}">
        <div><b>${esc(p.label)}</b> ${chip(p)}<p class="note">${esc(p.rule)} · <span class="basis">${esc(p.basis)}</span>${p.done ? ` · ${p.done.manual ? `cerrado a mano: ${esc(p.done.reason || "")}` : `cumplido el ${dateLabel(p.done.date)}`}` : ""}</p></div>
        ${!p.done ? `<button class="btn small ghost" data-action="close-deadline" data-key="${esc(p.key)}">Cerrar sin actuar</button>` : p.done.manual && c.closed_deadlines?.[p.key] ? `<button class="btn small ghost" data-action="reopen-deadline" data-key="${esc(p.key)}">Reabrir</button>` : ""}
      </li>`).join("")}</ol>` : `<p class="note">Sin plazos todavía. Añade a la cronología la publicación del anuncio o la consulta recibida para abrir el de alegaciones.</p>`;

    const checklist = `<ul class="checklist">${(c.checklist || []).map((k) => `<li><label class="check"><input type="checkbox" data-action="check" data-id="${esc(k.id)}" ${k.done ? "checked" : ""}> <span class="${k.done ? "done" : ""}">${esc(k.text)}</span></label><button class="x" data-action="check-del" data-id="${esc(k.id)}" aria-label="Quitar tarea">×</button></li>`).join("")}</ul>
      <form class="inline-add" data-form="check-add"><input name="text" placeholder="Añadir tarea y pulsar Intro" aria-label="Nueva tarea"></form>`;

    const groups = {};
    for (const d of c.docs || []) (groups[`${d.kind}|${d.name}`] ||= []).push(d);
    const docRows = Object.values(groups).map((vs) => {
      vs.sort((a, b) => b.version - a.version);
      const d = vs[0];
      return `<tr><td><span class="dk dk-${d.kind}">${DOC_KINDS[d.kind] || d.kind}</span></td>
        <td><button class="link" data-action="open-doc" data-path="${esc(d.path)}">${esc(d.name)}</button>${vs.length > 1 ? `<details class="versions"><summary>v${d.version} · ${vs.length} versiones</summary>${vs.slice(1).map((o) => `<button class="link" data-action="open-doc" data-path="${esc(o.path)}">v${o.version} · ${dateLabel(o.at)} · ${esc(personName(o.by))}</button>`).join("")}</details>` : ""}</td>
        <td class="note">${dateLabel(d.at)} · ${esc(personName(d.by))}</td>
        <td class="data note" title="Huella SHA-256: prueba de qué fichero exacto se guardó">${d.sha256 ? esc(d.sha256.slice(0, 10)) : ""}</td></tr>`;
    }).join("");
    const docs = `${docRows ? `<table class="docs"><tbody>${docRows}</tbody></table>` : `<p class="note">Sin documentos.</p>`}
      <form class="upload" data-form="upload"><select name="kind" aria-label="Tipo de documento">${opt(DOC_KINDS, "draft")}</select>
        <input name="name" placeholder="Nombre (se versiona si se repite)" aria-label="Nombre del documento">
        <input type="file" name="file" required aria-label="Fichero"><button class="btn small">Subir</button></form>`;

    const evs = [...c.events].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    const timeline = `<ol class="timeline">${evs.map((e) => {
      const meta = EVENTS[e.type] || { label: e.type, dir: "internal" };
      const sub = e.type === "resolution" ? RESOLUTION_TYPES[e.subtype] : e.type === "appeal" ? APPEAL_TYPES[e.subtype] : e.type === "consultation" ? D.CONSULTATIONS[e.subtype]?.label : "";
      const opened = ds.filter((p) => p.source === e.id);
      const r = e.registry;
      const docsHere = (c.docs || []).filter((d) => d.event === e.id || (e.docs || []).includes(d.id));
      return `<li class="ev dir-${meta.dir} t-${e.type}">
        <span class="ev-dot" aria-hidden="true"></span>
        <div class="ev-body">
          <p class="ev-h"><span class="ev-kind label">${{ in: "Recibido", out: "Enviado", internal: "Interno", system: "Sistema" }[meta.dir]}</span> <b>${esc(e.title || meta.label)}</b>${sub ? ` <span class="note">· ${esc(sub)}</span>` : ""}
            <span class="ev-when data">${dateTimeLabel(e.date)}</span></p>
          ${e.note ? `<p class="ev-note">${esc(e.note)}</p>` : ""}
          ${r ? `<dl class="registry"><dt>Registro</dt><dd>${esc(r.channel || "")}</dd><dt>Número</dt><dd class="data">${esc(r.number || "—")}</dd>${r.datetime ? `<dt>Fecha oficial</dt><dd class="data">${dateTimeLabel(r.datetime)}</dd>` : ""}${r.body ? `<dt>Destino</dt><dd>${esc(r.body)}${r.dir3 ? ` <span class="data">(${esc(r.dir3)})</span>` : ""}</dd>` : ""}${r.csv ? `<dt>CSV</dt><dd class="data">${esc(r.csv)}</dd>` : ""}</dl>` : ""}
          ${e.remedies?.length ? `<p class="note">Pie de recursos: ${e.remedies.map((k) => APPEAL_TYPES[k]).join(", ")}</p>` : ""}
          ${docsHere.length ? `<p class="ev-docs">${docsHere.map((d) => `<button class="link" data-action="open-doc" data-path="${esc(d.path)}">${esc(DOC_KINDS[d.kind])}: ${esc(d.name)}</button>`).join(" · ")}</p>` : ""}
          ${opened.length ? `<p class="ev-opens">${opened.map((p) => `Abre plazo: <b>${esc(p.label)}</b>, ${dateLabel(p.due)}`).join(" · ")}</p>` : ""}
          ${e.url ? `<p class="note"><a href="${esc(e.url)}" target="_blank" rel="noopener">Ver publicación</a></p>` : ""}
          <p class="ev-foot note">${esc(personName(e.by))}${e.type !== "stage" ? ` · <button class="link subtle" data-action="del-event" data-id="${esc(e.id)}">eliminar</button>` : ""}</p>
        </div></li>`;
    }).join("")}</ol>`;

    // One obvious action (what we file) and the rest grouped by who does it.
    const group = (label, types) => `<optgroup label="${label}">${types.map((t) => `<option value="${t}">${EVENTS[t].label}</option>`).join("")}</optgroup>`;
    const addEvent = `<div class="add-ev">
      <button class="btn small primary" data-action="add-event" data-type="filing">Anotar presentación</button>
      <select data-action="add-event-select" aria-label="Anotar otro hecho"><option value="">Anotar otro hecho…</option>
        ${group("Lo que hacemos", ["info_request", "appeal", "note"])}
        ${group("Lo que llega", ["publication", "consultation", "notification", "reply", "requirement", "extension", "resolution"])}</select>
      <span class="note">Cada hecho con su fecha: los plazos salen de aquí.</span></div>`;

    return `<nav class="crumbs note"><a href="#/expedientes">Expedientes</a> / ${stageBadge(c.stage)}</nav>
      <div class="detail">
        <div class="detail-main">
          <textarea class="title-edit" data-field="title" rows="1" aria-label="Título">${esc(c.title)}</textarea>
          <textarea class="summary-edit" data-field="summary" rows="2" placeholder="Resumen: por qué importa, qué se pide…" aria-label="Resumen">${esc(c.summary || "")}</textarea>
          ${c.official_title ? `<details class="official note"><summary>Título oficial del anuncio</summary><p>${esc(c.official_title)}</p></details>` : ""}
          ${alerts}
          <section class="block"><h3 class="label">Plazos</h3>${deadlinesHtml}</section>
          <section class="block"><h3 class="label">Cronología</h3>${addEvent}${timeline}</section>
          <section class="block"><h3 class="label">Documentos</h3>${docs}</section>
          <section class="block"><h3 class="label">Tareas <em>${(c.checklist || []).filter((k) => k.done).length}/${(c.checklist || []).length}</em></h3>${checklist}</section>
        </div>
        <aside class="props card">
          ${field("Fase", `<select data-field="stage">${opt(Object.fromEntries(STAGES.map((s) => [s.id, s.label])), c.stage)}</select>`)}
          ${c.stage === "discarded" && c.discard_reason ? `<p class="note">Motivo: ${esc(c.discard_reason)}</p>` : ""}
          ${field("Responsable", `<select data-field="owner">${people(c.owner)}</select>`)}
          ${field("Prioridad", `<select data-field="priority">${opt({ 0: "Sin prioridad", 1: "Baja", 2: "Media", 3: "Alta" }, String(c.priority || 0))}</select>`)}
          ${c.outcome || ["followup", "closed"].includes(c.stage) ? field("Resultado", `<select data-field="outcome">${opt(OUTCOMES, c.outcome || "")}</select>`) : ""}
          <details class="more-props"${S.propsOpen ? " open" : ""}><summary>Datos del expediente</summary>
          ${field("Revisa", `<select data-field="reviewer">${people(c.reviewer)}</select>`)}
          ${c.outcome || ["followup", "closed"].includes(c.stage) ? "" : field("Resultado", `<select data-field="outcome">${opt(OUTCOMES, c.outcome || "")}</select>`)}
          ${field("Procedimiento", `<select data-field="procedure">${opt(PROCEDURES, c.procedure)}</select>`)}
          ${field("Tipo de proyecto", `<select data-field="category">${opt(CATEGORIES, c.category)}</select>`)}
          ${field("Órgano sustantivo", input("body", c.body))}
          ${field("Órgano ambiental", input("env_body", c.env_body))}
          ${field("Comunidad del órgano", `<select data-field="region"><option value="">—</option>${REGIONS.map((r) => `<option${c.region === r ? " selected" : ""}>${r}</option>`).join("")}</select>`)}
          ${field("Nº de expediente", input("file_no", c.file_no, "Del órgano"))}
          ${field("Promotor (empresa)", input("developer", c.developer))}
          ${field("Provincias", input("provinces", (c.provinces || []).join(", ")))}
          ${field("Municipios", input("towns", (c.towns || []).join(", ")))}
          ${field("Etiquetas", input("tags", (c.tags || []).join(", "), "ZEPA, esteparias…"))}
          ${field("Anuncio", c.boe_id ? `<span class="data">${esc(c.boe_id)}</span>${c.url ? ` · <a href="${esc(c.url)}" target="_blank" rel="noopener">abrir</a>` : ""}` : input("boe_id", "", "BOE-B-2026-…"))}
          </details>
          <hr>
          <p class="note">Creado ${dateLabel(c.created)} · actualizado ${dateTimeLabel(c.updated)}</p>
          <p class="note">Plazos con el calendario de ${esc([S.data.org?.region, c.region].filter(Boolean).join(" y ") || "festivos nacionales")} (art. 30.6 Ley 39/2015).</p>
          <p class="actions"><button class="btn small ghost" data-action="export-case">Exportar ficha</button></p>
        </aside>
      </div>`;
  }

  // ---------- view: report ----------
  function viewReport() {
    const years = [...new Set(S.data.cases.flatMap((c) => c.events.map((e) => e.date.slice(0, 4))))].sort().reverse();
    const y = S.reportYear || years[0] || today().slice(0, 4);
    const inYear = (e) => e.date.startsWith(y);
    const filings = S.data.cases.flatMap((c) => c.events.filter((e) => e.type === "filing" && inYear(e)).map((e) => ({ c, e })));
    const infos = S.data.cases.flatMap((c) => c.events.filter((e) => e.type === "info_request" && inYear(e)));
    const appeals = S.data.cases.flatMap((c) => c.events.filter((e) => e.type === "appeal" && inYear(e)));
    const filedCases = [...new Set(filings.map((x) => x.c))];
    const out = {}; for (const c of filedCases) out[c.outcome || ""] = (out[c.outcome || ""] || 0) + 1;
    const byCat = {}; for (const c of filedCases) byCat[c.category] = (byCat[c.category] || 0) + 1;
    const triaged = Object.values(S.data.triage).filter((t) => (t.at || "").startsWith(y));
    const reasons = {}; for (const t of triaged.filter((t) => t.decision === "discarded")) reasons[t.reason] = (reasons[t.reason] || 0) + 1;
    for (const c of S.data.cases.filter((c) => c.stage === "discarded" && (c.updated || "").startsWith(y))) reasons[c.discard_reason || "Sin motivo"] = (reasons[c.discard_reason || "Sin motivo"] || 0) + 1;
    const tbl = (o, labels = {}) => Object.entries(o).sort((a, b) => b[1] - a[1]).map(([k, n]) => `<tr><th>${esc(labels[k] || k)}</th><td class="num">${n}</td></tr>`).join("") || `<tr><td class="note">—</td></tr>`;
    return `<header class="view-h"><h2>Informe ${esc(y)}</h2>
      <p class="note">Lo que el equipo ha hecho en el año, para la memoria y para rendir cuentas. Cuenta eventos de la cronología, no estimaciones.</p></header>
      <div class="toolbar"><select data-action="report-year" aria-label="Año">${(years.length ? years : [y]).map((v) => `<option${v === y ? " selected" : ""}>${v}</option>`).join("")}</select>
        <button class="btn small" data-action="csv-cases">Exportar expedientes (CSV)</button>
        <button class="btn small" data-action="csv-filings">Exportar presentaciones (CSV)</button>
        <button class="btn small ghost" data-action="json-export">Copia completa (JSON)</button></div>
      <div class="figures report-figs">
        <div><b>${filings.length}</b><span>escritos de alegaciones</span></div>
        <div><b>${infos.length}</b><span>solicitudes de información</span></div>
        <div><b>${appeals.length}</b><span>recursos</span></div>
        <div><b>${(out.accepted || 0) + (out.partial || 0)}</b><span>acogidas total o parcialmente</span></div>
        <div><b>${triaged.length}</b><span>anuncios decididos en la bandeja</span></div>
      </div>
      <div class="report-grid">
        <section class="card"><h3 class="label">Resultado de lo presentado</h3><table class="params"><tbody>${tbl(out, OUTCOMES)}</tbody></table></section>
        <section class="card"><h3 class="label">Por tipo de proyecto</h3><table class="params"><tbody>${tbl(byCat, CATEGORIES)}</tbody></table></section>
        <section class="card"><h3 class="label">Por qué no se alegó</h3><table class="params"><tbody>${tbl(reasons)}</tbody></table></section>
      </div>
      <section class="block"><h3 class="label">Presentaciones del año</h3>
        <div class="table-scroll"><table class="params wide"><thead><tr><th>Fecha oficial</th><th>Expediente</th><th>Registro</th><th>Justificante</th><th>Resultado</th></tr></thead><tbody>
        ${filings.map(({ c, e }) => `<tr><td class="data">${dateTimeLabel(e.registry?.datetime || e.date)}</td><td><a href="#/e/${esc(c.id)}">${esc(c.title)}</a></td><td class="data">${esc(e.registry?.number || "—")}</td><td>${receiptsOf(c, e).length ? "sí" : `<b class="warn">falta</b>`}</td><td>${OUTCOMES[c.outcome || ""]}</td></tr>`).join("") || `<tr><td colspan="5" class="note">Ninguna este año.</td></tr>`}
        </tbody></table></div></section>`;
  }

  // ---------- view: settings ----------
  function viewSettings() {
    const o = S.data.org || {};
    return `<header class="view-h"><h2>Ajustes</h2></header>
      <div class="settings">
        <section class="card"><h3 class="label">Organización</h3>
          <form class="form" data-form="org">
            <label>Nombre <input name="name" value="${esc(o.name)}"></label>
            <label>Comunidad de la sede <select name="region">${REGIONS.map((r) => `<option${o.region === r ? " selected" : ""}>${r}</option>`).join("")}</select></label>
            <label>Festivos autonómicos y locales que no trae la herramienta <textarea name="holidays" rows="5" placeholder="2026-11-09 Almudena (Madrid capital)">${esc((o.extra_holidays || []).map((h) => `${h.date} ${h.label || ""}`.trim()).join("\n"))}</textarea>
              <span class="note">Una línea por día: fecha AAAA-MM-DD y, si quieres, el nombre. Cuentan para todos los plazos (art. 30.6 Ley 39/2015: el festivo de la sede del interesado o del órgano no es hábil).</span></label>
            <label>Fuente de la bandeja <input name="feed_url" value="${esc(o.feed_url || FEED_URL)}"></label>
            <button class="btn primary">Guardar</button>
          </form></section>
        <section class="card"><h3 class="label">Equipo</h3>
          <p class="note">Nombres o roles de quienes llevan expedientes. Se guardan solo en la carpeta de la organización.</p>
          <ul class="people">${S.data.people.map((p) => `<li><input data-person="${p.id}" value="${esc(p.name)}" aria-label="Nombre"> <button class="x" data-action="person-del" data-id="${p.id}" aria-label="Quitar">×</button></li>`).join("")}</ul>
          <form class="inline-add" data-form="person-add"><input name="name" placeholder="Añadir persona y pulsar Intro" aria-label="Nueva persona"></form></section>
        <section class="card"><h3 class="label">Dónde están los datos</h3>
          ${S.store.kind === "demo"
            ? `<p>Estás en la <b>demostración</b>: datos sintéticos guardados solo en este navegador.</p><p class="actions"><button class="btn" data-action="demo-reset">Restablecer la demostración</button> <button class="btn" data-action="leave">Salir de la demostración</button></p>`
            : `<p>Carpeta <b>${esc(S.store.name)}</b>. Cada cosa en su fichero, para que varias personas trabajen a la vez sin pisarse: <code>organizacion.json</code> (organización y equipo), <code>expedientes/</code>, <code>bandeja/</code> (decisiones) y <code>avisos/</code>, un JSON por registro. Además, <code>documentos/</code>, <code>copias/</code> (una copia completa por día) y <code>entrada/</code>.</p>
              <p class="note">Para que los avisos lleguen solos, una regla del buzón puede guardar los correos en <code>entrada/</code>: en Microsoft 365, un flujo de Power Automate «Cuando llega un correo nuevo» → «Crear archivo» en la carpeta de OneDrive o SharePoint. La herramienta los lee al abrirse y cada 20 segundos, los pasa a la bandeja y los quita de <code>entrada/</code>; el original queda en <code>documentos/</code>.</p>
              ${S.store.conflicted.length ? `<div class="alert warn"><span>El programa de sincronización ha dejado ${S.store.conflicted.length === 1 ? "una copia" : "copias"} en conflicto, que no se han leído: ${S.store.conflicted.map((x) => `<code>${esc(x)}</code>`).join(", ")}. Ábrelas, pasa a mano lo que falte al registro y bórralas.</span></div>` : ""}
              <p class="actions"><button class="btn" data-action="leave">Cambiar de carpeta</button></p>`}
          <p class="actions"><button class="btn small ghost" data-action="json-export">Descargar copia completa (JSON)</button></p></section>
        <section class="card"><h3 class="label">Instalar como aplicación</h3>
          <p>En Chrome o Edge se puede instalar en el ordenador: se abre en su propia ventana, desde el menú de inicio, y funciona sin conexión. Los datos siguen en la carpeta del equipo.</p>
          ${S.installPrompt ? `<p class="actions"><button class="btn" data-action="install">Instalar</button></p>` : `<p class="note">${matchMedia("(display-mode: standalone)").matches ? "Ya está instalada." : "Usa el icono de instalar de la barra de direcciones o el menú del navegador («Instalar Registro de alegaciones»)."}</p>`}</section>
      </div>`;
  }

  // ---------- dialogs ----------
  function dialog(html, onSubmit) {
    const dlg = $("#dlg");
    dlg.innerHTML = `<form method="dialog" class="form dlg-form">${html}<p class="actions"><button class="btn primary" value="ok">Guardar</button> <button class="btn ghost" value="cancel" formnovalidate>Cancelar</button></p></form>`;
    const form = $("form", dlg);
    form.addEventListener("submit", async (ev) => {
      if (ev.submitter?.value === "cancel") return;
      ev.preventDefault();
      const fd = new FormData(form);
      const ok = await onSubmit(fd, form);
      if (ok !== false) dlg.close();
    });
    dlg.showModal();
    const first = $("input:not([type=hidden]),select,textarea", dlg);
    if (first) first.focus();
    return form;
  }

  /* The fields that say what starts the clock: an announcement, a consultation (its kind sets the
     days, which the consultation itself can override) or a notice of an electronic notification. */
  function triggerFields(p = {}, withNone = false) {
    const t = p.trigger || "publication", k = D.CONSULTATIONS[p.kind] ? p.kind : "eia_simplificada";
    const opts = { ...TRIGGERS, ...(withNone ? { none: "Nada: solo guardar el aviso y sus ficheros" } : {}) };
    return `<div class="two"><label>Qué abre el plazo <select name="trigger">${Object.entries(opts).map(([v, l]) => `<option value="${v}"${t === v ? " selected" : ""}>${esc(l)}</option>`).join("")}</select></label>
      <label data-for="consultation">Tipo de consulta <select name="kind">${Object.entries(D.CONSULTATIONS).map(([v, c]) => `<option value="${v}"${k === v ? " selected" : ""}>${esc(c.label)}</option>`).join("")}</select></label></div>
      <div class="two"><label><span data-date-label>${DATE_LABEL[t]}</span> <input type="date" name="pub" value="${esc(p.pub || "")}"></label>
      <label data-for="publication consultation">Plazo <span class="inline"><input type="number" name="days" min="1" value="${esc(p.days || (t === "consultation" ? D.CONSULTATIONS[k].days : 30))}" style="width:5em"> <select name="unit"><option value="habiles">días hábiles</option><option value="naturales"${p.unit === "naturales" ? " selected" : ""}>días naturales</option></select></span></label></div>
      <p class="note" data-basis></p>`;
  }
  function wireTrigger(form, estimatedNote = "") {
    const f = form.elements;
    const sync = (changed) => {
      const t = f.trigger.value, k = D.CONSULTATIONS[f.kind.value];
      for (const el of form.querySelectorAll("[data-for]")) el.hidden = !el.dataset.for.split(" ").includes(t);
      form.querySelector("[data-date-label]").textContent = DATE_LABEL[t];
      if (changed && t === "consultation") { f.days.value = k.days; f.unit.value = "habiles"; }
      if (changed === "trigger" && t === "publication") { f.days.value = 30; f.unit.value = "habiles"; }
      form.querySelector("[data-basis]").textContent =
        t === "consultation" ? `Por defecto, ${k.days} días hábiles desde el día siguiente a la recepción (${k.basis}). Si la consulta da otro plazo, vale el suyo.`
        : t === "notification" ? "10 días naturales para abrirla en la sede o en DEHú; si no se abre, se da por rechazada y el procedimiento sigue (art. 43.2 Ley 39/2015). Al abrirla, añade a la cronología lo que contenía."
        : t === "publication" ? estimatedNote : "";
    };
    form.addEventListener("change", (ev) => { if (ev.target.name === "trigger" || ev.target.name === "kind") sync(ev.target.name); });
    sync(false);
  }
  function triggerEvent(fd, extra = {}) {
    const date = fd.get("pub"), t = fd.get("trigger");
    if (!date || !t) return null;
    const base = { id: uid("e"), type: t, date, at: nowStr(), by: me() };
    const days = Number(fd.get("days")) || 30, unit = fd.get("unit");
    if (t === "none") return { ...base, type: "note", title: "Aviso recibido", ...extra };
    if (t === "notification") return { ...base, title: EVENTS.notification.label, ...extra };
    if (t === "consultation") return { ...base, title: "Consulta recibida", subtype: fd.get("kind"), days, unit, ...extra };
    return { ...base, title: "Publicación", days, unit, ...extra };
  }
  // How a notice prefills those fields.
  function noticeTrigger(n) {
    if (n.kind === "notification") return { trigger: "notification", pub: n.received };
    const kind = D.CONSULTATIONS[n.kind] ? n.kind : "otra";
    return { trigger: "consultation", kind, pub: n.received, days: D.CONSULTATIONS[kind].days };
  }
  // The notice's files become documents of the case, hanging from the event they started.
  function noticeDocs(n, evId) {
    return [n.original, ...(n.attachments || [])].filter((f) => f?.path).map((f, i) => ({
      id: uid("d"), kind: "notice", name: i ? f.name : `Aviso: ${n.subject}`.slice(0, 140), version: 1, at: nowStr(), by: me(),
      event: evId, file: f.name, path: f.path, sha256: f.sha256, size: f.size }));
  }
  function linkNotice(d, n, c, ev, docs) {
    if (!c.events.some((e) => e.notice_id === n.id)) {
      c.events.push(structuredClone(ev));
      c.docs.push(...structuredClone(docs));
      (c.notice_ids ||= []).push(n.id);
      if (!c.file_no && n.file_no) c.file_no = n.file_no;
      c.updated = nowStr();
    }
    const x = d.notices.find((y) => y.id === n.id);
    if (x) x.case_id = c.id;
  }
  const notice = (id) => S.data.notices.find((n) => n.id === id);
  // "Consulta a personas interesadas: proyecto X" -> "proyecto X"
  const noticeTitle = (n) => {
    const t = n.subject.replace(/^(?:consulta(?: a (?:las )?(?:personas|administraciones)[\p{L} ]*?interesadas)?|notificaci[oó]n|aviso|solicitud de informe|informaci[oó]n p[uú]blica)\s*[:–-]\s*/iu, "");
    return t.charAt(0).toUpperCase() + t.slice(1);
  };

  function newCaseDialog(prefill = {}) {
    const p = prefill, n = p.notice;
    const trig = n ? noticeTrigger(n) : { trigger: "publication", pub: p.pub, days: p.days };
    const form = dialog(`<h2>${p.boe_id ? "Abrir expediente desde la bandeja" : n ? "Abrir expediente desde un aviso" : "Nuevo expediente"}</h2>
      ${n ? `<p class="note">${esc(noticeKindLabel(n.kind))} recibido el ${dateLabel(n.received)}${n.from?.name ? ` de ${esc(n.from.name)}` : ""}. Revisa el tipo y la fecha: el plazo sale de ahí.</p>` : ""}
      <label>Título <textarea name="title" rows="2" required>${esc(p.title || (n ? noticeTitle(n) : ""))}</textarea></label>
      <div class="two"><label>Procedimiento <select name="procedure">${Object.entries(PROCEDURES).map(([k, v]) => `<option value="${k}"${(p.procedure || (n && D.CONSULTATIONS[n.kind]?.procedure) || "eia_ordinaria") === k ? " selected" : ""}>${v}</option>`).join("")}</select></label>
      <label>Tipo de proyecto <select name="category">${Object.entries(CATEGORIES).map(([k, v]) => `<option value="${k}"${p.category === k ? " selected" : ""}>${v}</option>`).join("")}</select></label></div>
      ${triggerFields(trig)}
      <div class="two"><label>Órgano sustantivo <input name="body" value="${esc(p.body || "")}"></label>
      <label>Comunidad del órgano <select name="region"><option value="">—</option>${REGIONS.map((r) => `<option${p.region === r ? " selected" : ""}>${r}</option>`).join("")}</select></label></div>
      <div class="two"><label>Provincias <input name="provinces" value="${esc((p.provinces || []).join(", "))}"></label>
      <label>Responsable <select name="owner">${S.data.people.map((x) => `<option value="${x.id}"${x.id === me() ? " selected" : ""}>${esc(x.name)}</option>`).join("")}</select></label></div>
      <label class="check"><input type="checkbox" name="template" checked> Añadir la lista de tareas tipo del procedimiento</label>
      <input type="hidden" name="boe_id" value="${esc(p.boe_id || "")}">`, (fd) => {
      const id = uid("c-");
      const procedure = fd.get("procedure");
      const c = {
        id, title: fd.get("title").trim(), boe_id: fd.get("boe_id") || "", url: p.url || "", procedure, category: fd.get("category"),
        provinces: splitList(fd.get("provinces")), towns: p.towns || [], region: fd.get("region"), body: fd.get("body"), env_body: "",
        official_title: p.official_title || "", file_no: p.file_no || n?.file_no || "", developer: p.developer || "", power_mw: p.power_mw || null,
        stage: "study", stage_since: today(), owner: fd.get("owner"), reviewer: "", priority: p.priority || 0, tags: [], outcome: "", summary: p.summary || "",
        checklist: fd.get("template") ? (CHECKLISTS[procedure] || DEFAULT_CHECKLIST).map((t, i) => ({ id: `k${i}`, text: t, done: false })) : [],
        docs: [], events: [], notice_ids: [], created: nowStr(), updated: nowStr(),
      };
      const ev = triggerEvent(fd, p.boe_id ? { title: "Anuncio de información pública", days_estimated: !!p.days_estimated && Number(fd.get("days")) === Number(p.days), url: p.url || "", source_id: p.boe_id } : {});
      if (n && !ev) { toast("Falta la fecha de recepción del aviso.", true); return false; }
      const docs = n && ev ? noticeDocs(n, ev.id) : [];
      if (ev && n) { ev.notice_id = n.id; ev.docs = docs.map((d) => d.id); if (n.excerpt) ev.note = n.excerpt.slice(0, 400); }
      c.events.push(sysEvent(p.boe_id ? `Abierto desde la bandeja (${p.boe_id})` : n ? "Abierto desde un aviso recibido" : "Expediente creado"));
      mutate((d) => {
        if (caseById(id, d)) return;
        const x = structuredClone(c);
        d.cases.push(x);
        if (ev && n) linkNotice(d, n, x, ev, docs);
        else if (ev) x.events.push(structuredClone(ev));
      });
      location.hash = `#/e/${id}`;
    });
    wireTrigger(form, p.days_estimated ? "El anuncio no dice el plazo: se asumen 30 días hábiles. Compruébalo en el anuncio." : "");
  }

  function noticeJoinDialog(nid, suggested) {
    const n = notice(nid);
    if (!n) return;
    const cases = [...S.data.cases].sort((a, b) => (ACTIVE.has(b.stage) - ACTIVE.has(a.stage)) || (a.title < b.title ? -1 : 1));
    const form = dialog(`<h2>Añadir el aviso a un expediente</h2><p class="note">${esc(n.subject)}</p>
      <label>Expediente <select name="case" required>${cases.map((c) => `<option value="${esc(c.id)}"${c.id === suggested ? " selected" : ""}>${esc(c.title)}${ACTIVE.has(c.stage) ? "" : ` (${STAGE[c.stage].label.toLowerCase()})`}</option>`).join("")}</select></label>
      ${suggested ? `<p class="note">Sugerido: ${esc(matchCase(`${n.subject} ${n.excerpt}`, n.file_no)?.why || "")}.</p>` : ""}
      ${triggerFields(noticeTrigger(n), true)}`, (fd) => {
      const caseId = fd.get("case");
      const ev = triggerEvent(fd, fd.get("trigger") === "none" ? { title: `Aviso recibido: ${n.subject}`.slice(0, 160) } : {});
      if (!ev) { toast("Falta la fecha.", true); return false; }
      const docs = noticeDocs(n, ev.id);
      ev.notice_id = n.id; ev.docs = docs.map((d) => d.id);
      if (n.excerpt) ev.note = n.excerpt.slice(0, 400);
      mutate((d) => { const c = caseById(caseId, d); if (c) linkNotice(d, n, c, ev, docs); });
      location.hash = `#/e/${caseId}`;
    });
    wireTrigger(form);
  }

  function manualNoticeDialog() {
    dialog(`<h2>Anotar un aviso</h2><p class="note">Para lo que llega por otra vía: una carta, una llamada, un aviso visto en la sede electrónica.</p>
      <label>Asunto <input name="subject" required placeholder="Consulta sobre el documento ambiental de…"></label>
      <div class="two"><label>Quién lo envía <input name="from" placeholder="Órgano o unidad"></label><label>Recibido el <input type="date" name="received" required value="${today()}"></label></div>
      <div class="two"><label>Qué es <select name="kind"><option value="">Sin clasificar</option><option value="notification">Aviso de notificación electrónica</option>${Object.entries(D.CONSULTATIONS).map(([v, c]) => `<option value="${v}">${esc(c.label)}</option>`).join("")}</select></label>
      <label>Nº de expediente <input name="file_no"></label></div>
      <label>Texto o resumen <textarea name="text" rows="3"></textarea></label>
      <label>Documento (opcional) <input type="file" name="file"></label>`, async (fd) => {
      const id = uid("n-"), f = fd.get("file");
      const original = f?.size ? { name: f.name, ...(await S.store.attach(id, f, "original")) } : null;
      const n = { id, format: "manual", subject: fd.get("subject").trim(), from: fd.get("from") ? { name: fd.get("from").trim(), email: "" } : null,
        received: fd.get("received"), excerpt: String(fd.get("text") || "").trim().slice(0, 900), kind: fd.get("kind"), file_no: fd.get("file_no").trim(),
        original, attachments: [], by: me(), at: nowStr() };
      mutate((d) => { if (!d.notices.some((x) => x.id === id)) d.notices.push(structuredClone(n)); });
    });
  }

  function eventDialog(caseId, type, prefill = {}) {
    const c = caseById(caseId);
    const t = EVENTS[type];
    const p = prefill;
    const needsRegistry = ["filing", "info_request", "appeal"].includes(type);
    const dt = type === "filing" || type === "appeal";
    let html = `<h2>${esc(t.label)}</h2><p class="note">${esc(c.title)}</p>
      <label>Título <input name="title" value="${esc(p.title || (type === "filing" ? "Alegaciones presentadas" : t.label))}"></label>`;
    if (type === "resolution") html += `<label>Tipo <select name="subtype">${Object.entries(RESOLUTION_TYPES).map(([k, v]) => `<option value="${k}"${p.subtype === k ? " selected" : ""}>${v}</option>`).join("")}</select></label>
      <fieldset><legend class="label">Pie de recursos (lo que dice la propia resolución)</legend>
        ${Object.entries(APPEAL_TYPES).map(([k, v]) => `<label class="check"><input type="checkbox" name="remedies" value="${k}"> ${v}</label>`).join("")}
        <p class="note">Cada recurso marcado abre su plazo. La DIA y el informe de impacto no se recurren por separado: se recurre la autorización (arts. 41.4 y 47.5 Ley 21/2013).</p></fieldset>`;
    if (type === "appeal") html += `<label>Tipo de recurso <select name="subtype">${Object.entries(APPEAL_TYPES).map(([k, v]) => `<option value="${k}">${v}</option>`).join("")}</select></label>`;
    html += `<label>${dt ? "Fecha" : type === "publication" ? "Fecha de publicación" : type === "requirement" || type === "resolution" ? "Fecha de publicación o notificación" : type === "consultation" ? "Fecha de recepción" : type === "notification" ? "Fecha del aviso" : "Fecha"} <input type="date" name="date" required value="${esc(p.date || today())}"></label>`;
    const defKind = { eia_simplificada: "eia_simplificada", plan: "eae_ordinaria" }[c.procedure] || "eia_ordinaria";
    if (type === "consultation") html += `<label>Tipo de consulta <select name="subtype" data-kind>${Object.entries(D.CONSULTATIONS).map(([k, v]) => `<option value="${k}"${k === defKind ? " selected" : ""}>${esc(v.label)}</option>`).join("")}</select></label>`;
    if (type === "publication" || type === "consultation") html += `<div class="two"><label>Plazo <input type="number" name="days" min="1" value="${type === "consultation" ? D.CONSULTATIONS[defKind].days : 30}"></label><label>Unidad <select name="unit"><option value="habiles">días hábiles</option><option value="naturales">días naturales</option></select></label></div>`;
    if (type === "consultation") html += `<p class="note">Desde el día siguiente a la recepción. Si la consulta da otro plazo, vale el suyo.</p>`;
    if (type === "notification") html += `<p class="note">Abre un plazo de 10 días naturales para acceder a la notificación; si no se abre, se da por rechazada y el procedimiento sigue (art. 43.2 Ley 39/2015). Al abrirla, añade a la cronología lo que contenía y el plazo se cerrará.</p>`;
    if (needsRegistry) html += `<fieldset><legend class="label">Registro de entrada</legend>
      <div class="two"><label>Canal <select name="channel">${CHANNELS.map((ch) => `<option>${ch}</option>`).join("")}</select></label>
      <label>Número de registro <input name="number" required placeholder="REGAGE…"></label></div>
      <div class="two"><label>Fecha y hora oficial del justificante <input type="datetime-local" name="datetime" value="${nowStr()}"></label>
      <label>Órgano de destino <input name="body" value="${esc(c.body || "")}"></label></div>
      <div class="two"><label>Código DIR3 (opcional) <input name="dir3"></label><label>CSV (opcional) <input name="csv"></label></div></fieldset>`;
    html += `<label>Nota <textarea name="note" rows="2">${esc(p.note || "")}</textarea></label>`;
    if (p.url) html += `<input type="hidden" name="url" value="${esc(p.url)}">`;
    if (needsRegistry) html += `<fieldset><legend class="label">Documentos</legend>
      <label>Escrito presentado <input type="file" name="file_filed"></label>
      <label>Justificante de registro <input type="file" name="file_receipt"></label>
      <p class="note">Se guarda la huella SHA-256 de cada fichero: prueba de qué se presentó exactamente.</p></fieldset>`;
    else if (type !== "note" && type !== "extension") html += `<label>Documento <input type="file" name="file_doc"></label>`;

    const form = dialog(html, async (fd) => {
      const id = uid("e");
      const ev = { id, type, date: fd.get("datetime") && dt ? fd.get("datetime") : fd.get("date"), at: nowStr(), by: me(), title: fd.get("title"), note: fd.get("note") || "" };
      if (fd.get("subtype")) ev.subtype = fd.get("subtype");
      if (type === "resolution") ev.remedies = fd.getAll("remedies");
      if (type === "publication" || type === "consultation") { ev.days = Number(fd.get("days")) || 30; ev.unit = fd.get("unit"); }
      if (fd.get("url")) ev.url = fd.get("url");
      if (p.source_id) ev.source_id = p.source_id;
      if (needsRegistry) ev.registry = { channel: fd.get("channel"), number: fd.get("number"), datetime: fd.get("datetime"), body: fd.get("body"), dir3: fd.get("dir3"), csv: fd.get("csv") };
      const files = [["file_filed", "filed", "Escrito presentado"], ["file_receipt", "receipt", "Justificante de presentación"], ["file_doc", type === "resolution" ? "resolution" : type === "reply" ? "reply" : ["consultation", "notification"].includes(type) ? "notice" : "other", ev.title]];
      const docs = [];
      for (const [field, kind, name] of files) {
        const f = fd.get(field);
        if (f && f.size) {
          const meta = await S.store.attach(caseId, f, `${ev.date.slice(0, 10)}_${kind}`);
          docs.push({ id: uid("d"), kind, name: name || f.name, version: 1, at: nowStr(), by: me(), event: id, file: f.name, ...meta });
        }
      }
      ev.docs = docs.map((d) => d.id);
      // Status follows events: filing moves an open case to «Presentada», a resolution to «Seguimiento».
      const next = type === "filing" && ["study", "drafting", "review"].includes(c.stage) ? "filed"
        : type === "resolution" && c.stage === "filed" ? "followup" : null;
      const sys = next ? sysEvent(`Fase: ${STAGE[c.stage].label} → ${STAGE[next].label} (automático)`) : null;
      mutate(onCase(caseId, (x) => {
        x.events.push(structuredClone(ev));
        for (const d of docs) x.docs.push({ ...d });
        if (next && x.stage !== next) { x.stage = next; x.stage_since = today(); x.events.push({ ...sys }); }
        if (type === "filing") for (const k of x.checklist || []) if (/presentar|justificante/i.test(k.text)) k.done = docs.some((d) => d.kind === "receipt") || /presentar/i.test(k.text) ? true : k.done;
      }));
      if (type === "filing" && !docs.some((d) => d.kind === "receipt")) toast("Presentación anotada. Falta subir el justificante: queda marcado en la ficha.", true);
      else if (next) toast(`Fase cambiada a «${STAGE[next].label}».`);
    });
    const kind = $("[data-kind]", form);
    if (kind) kind.addEventListener("change", () => { form.elements.days.value = D.CONSULTATIONS[kind.value].days; form.elements.unit.value = "habiles"; });
  }

  function uploadForEvent(caseId, evId) {
    dialog(`<h2>Subir justificante</h2><label>Justificante de registro <input type="file" name="f" required></label>`, async (fd) => {
      const f = fd.get("f");
      const meta = await S.store.attach(caseId, f, `${today()}_receipt`);
      const doc = { id: uid("d"), kind: "receipt", name: "Justificante de presentación", version: 1, at: nowStr(), by: me(), event: evId, file: f.name, ...meta };
      mutate(onCase(caseId, (c) => { c.docs.push({ ...doc }); const e = c.events.find((x) => x.id === evId); if (e) (e.docs ||= []).push(doc.id); }));
    });
  }

  function reasonDialog(title, reasons, onOk) {
    dialog(`<h2>${esc(title)}</h2><div class="reasons">${reasons.map((r, i) => `<label class="check"><input type="radio" name="r" value="${esc(r)}"${i === 0 ? " checked" : ""}> ${esc(r)}</label>`).join("")}
      <label class="check"><input type="radio" name="r" value="__other"> Otro: <input name="other" placeholder="Motivo"></label></div>`, (fd) => {
      const r = fd.get("r") === "__other" ? (fd.get("other") || "Otro") : fd.get("r");
      onOk(r);
    });
  }

  // ---------- actions ----------
  const splitList = (s) => String(s || "").split(",").map((x) => x.trim()).filter(Boolean);

  function triageAccept(id) {
    const a = S.feed.anuncios[id];
    if (!a) return;
    const isState = /^MINISTERIO|^DIRECCI[OÓ]N GENERAL|DEMARCACI[OÓ]N|CONFEDERACI[OÓ]N/i.test(a.departamento || "");
    const procedure = a.categoria === "puertos_costas" ? "costas" : a.tramite_ambiental ? "eia_ordinaria" : "autorizacion";
    newCaseDialog({
      title: shortTitle(a.titulo).slice(0, 220), official_title: a.titulo, boe_id: id, url: a.url_html || "", category: CATEGORIES[a.categoria] ? a.categoria : "otro", procedure,
      provinces: a.provincias || [], towns: a.municipios || [], pub: a.fecha, days: a.plazo_dias || 30, days_estimated: !a.plazo_dias,
      region: regionOfBody(a, isState), body: a.departamento ? titleCase(a.departamento) : "",
      file_no: a.expediente || "", developer: a.promotor || "", power_mw: a.potencia_mw || null, priority: a.prioridad >= 6 ? 3 : a.prioridad >= 4 ? 2 : 1,
      summary: a.natura?.length ? `Natura 2000 en el municipio: ${a.natura.map((n) => n.nombre).slice(0, 3).join("; ")}.` : "",
    });
  }
  // Art. 30.6 looks at where the body sits: a Subdelegación del Gobierno sits in its province,
  // a ministry or a national directorate in Madrid, a regional body in the project's region.
  function regionOfBody(a, isState) {
    const m = /(?:Sub)?[Dd]elegaci[oó]n del Gobierno en ([\p{L} ]+?)(?:,| por | para |$)/u.exec(a.titulo || "");
    const place = m?.[1].trim();
    if (place && REGIONS.includes(place)) return place;
    if (place && regionOfProvince(place)) return regionOfProvince(place);
    return isState ? "Madrid" : regionOfProvince((a.provincias || [])[0]);
  }
  const titleCase = (s) => s.toLowerCase().replace(/(^|\s)(\p{L})/gu, (m, sp, ch) => sp + ch.toUpperCase()).replace(/\b(De|Del|La|Las|Los|Y|E|El|Para)\b/g, (w) => w.toLowerCase());

  function triageDecide(id, decision, extra) {
    const entry = { decision, by: me(), at: nowStr(), ...extra };
    mutate((d) => { d.triage[id] = { ...entry }; });
  }

  function newsAdd(caseId, resId) {
    const r = S.feed.resoluciones[resId];
    const sub = { dia: "dia", iia: "iia", autorizacion: "autorizacion" }[r.tipo] || (r.sentido === "denegada" || r.sentido === "caducidad" ? "denegacion" : "otra");
    eventDialog(caseId, "resolution", { title: r.titulo.slice(0, 180), subtype: sub, date: r.fecha, url: r.url_html, source_id: r.identificador,
      note: `Detectada por el observatorio${r.sentido_etiqueta ? `: ${r.sentido_etiqueta}` : ""}${r.firme ? "" : " (emparejamiento no confirmado: compruébalo)"}. Marca el pie de recursos que diga la resolución.` });
  }

  // The announcement of a case that was opened from a consultation, before it reached the BOE.
  function feedJoin(id, caseId) {
    const a = S.feed?.anuncios?.[id];
    if (!a) return;
    const ev = { id: uid("e"), type: "publication", date: a.fecha, at: nowStr(), by: me(), title: "Anuncio de información pública",
      days: a.plazo_dias || 30, unit: "habiles", days_estimated: !a.plazo_dias, url: a.url_html || "", source_id: id };
    mutate(onCase(caseId, (c) => {
      if (c.boe_id) return;
      Object.assign(c, { boe_id: id, url: a.url_html || c.url || "", official_title: a.titulo });
      c.events.push({ ...ev });
    }));
    toast("Publicación añadida: el plazo de alegaciones del anuncio ya cuenta en el expediente.");
  }

  /* E-mails and PDFs dropped on the page, picked, or left in entrada/ by a mailbox rule. They are
     read here, in the browser; the original and its attachments are saved with the data. The id
     comes from the file's hash, so the same e-mail read twice (or by two people at once from
     entrada/) is one notice, not two. */
  const localDay = (iso) => { const d = new Date(iso); return isNaN(d) ? "" : `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
  async function importFiles(files, source) {
    const added = [], dups = [], failed = [];
    for (const f of files) {
      try {
        const id = `n-${(await Store.sha256(f)).slice(0, 16)}`;
        if (S.data.notices.some((n) => n.id === id) || added.some((n) => n.id === id)) { dups.push(f.name); continue; }
        const m = Mail.read(f.name, new Uint8Array(await f.arrayBuffer()), f.lastModified);
        const original = { name: f.name, ...(await S.store.attach(id, f, "original")) };
        const attachments = [];
        for (const a of m.attachments || []) {
          const file = new File([a.data], a.name || "adjunto", { type: a.type || "application/octet-stream" });
          attachments.push({ name: file.name, ...(await S.store.attach(id, file, "adjunto")) });
        }
        const text = (m.text || "").replace(/\s+/g, " ").trim();
        added.push({
          id, source, format: m.format, subject: Mail.cleanSubject(m.subject) || f.name,
          from: m.from?.name || m.from?.email ? m.from : null, received: localDay(m.date) || today(),
          excerpt: text.slice(0, 900), kind: Mail.classify(m.subject, m.text), file_no: Mail.fileNumber(`${m.subject}\n${m.text}`),
          original, attachments, by: me(), at: nowStr(),
        });
      } catch (e) {
        failed.push({ name: f.name, error: e.message });
      }
    }
    if (added.length) await mutate((d) => { for (const n of added) if (!d.notices.some((x) => x.id === n.id)) d.notices.push(structuredClone(n)); });
    return { added, dups, failed };
  }
  async function importAndReport(files) {
    if (!S.data || !files.length) return;
    const r = await importFiles(files, "arrastrado");
    const parts = [];
    if (r.added.length) parts.push(r.added.length === 1 ? "1 aviso nuevo en la bandeja" : `${r.added.length} avisos nuevos en la bandeja`);
    if (r.dups.length) parts.push(r.dups.length === 1 ? "1 ya estaba" : `${r.dups.length} ya estaban`);
    if (r.failed.length) parts.push(`no se pudo leer ${r.failed.map((x) => `«${x.name}» (${x.error})`).join(", ")}`);
    toast(parts.join(" · ") || "Nada que añadir.", !!r.failed.length);
    if (r.added.length && S.route.view !== "bandeja") location.hash = "#/bandeja";
  }
  async function importIncoming() {
    if (S.store?.kind !== "folder") return;
    const files = await S.store.incoming();
    if (!files.length) return;
    const r = await importFiles(files, "entrada");
    for (const f of files) if (!r.failed.some((x) => x.name === f.name)) await S.store.consume(f.name);
    if (r.added.length) toast(r.added.length === 1 ? "Ha llegado 1 aviso a la bandeja desde entrada/." : `Han llegado ${r.added.length} avisos a la bandeja desde entrada/.`);
    if (r.failed.length) toast(`No se pudo leer de entrada/: ${r.failed.map((x) => x.name).join(", ")}`, true);
  }

  function download(name, text, type = "text/plain") {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([text], { type }));
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  const csv = (rows) => "﻿" + rows.map((r) => r.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(";")).join("\r\n");

  const actions = {
    demo: async () => {
      S.store = new Store.DemoStore();
      const old = await S.store.read();
      S.data = old?.schema === Store.SCHEMA ? old : Demo.data();
      await S.store.save(S.data); remember("demo"); start();
    },
    "demo-reset": async () => { if (!confirm("¿Volver a los datos de demostración iniciales?")) return; S.store.reset(); S.data = Demo.data(); await S.store.save(S.data); render(); },
    "pick-folder": async () => { try { await openFolder(await Store.FolderStore.pick()); } catch (e) { if (e.name !== "AbortError") toast(e.message, true); } },
    "reopen-folder": async () => { await openFolder(S.pendingFolder, true); },
    leave: async () => { if (S.store.kind === "folder") await Store.forget(); remember(""); S.data = null; S.store = null; S.pendingFolder = null; location.hash = ""; render(); },
    "new-case": () => S.data && newCaseDialog(),
    palette: () => openPalette(),
    preset: (el) => { S.filters = { q: "", stage: "", owner: "", category: "", tag: "", closed: false, preset: el.dataset.preset }; if (location.hash.startsWith("#/expedientes")) render(); else location.hash = "#/expedientes/lista"; },
    mine: (el) => { S.mine = el.dataset.v === "1"; render(); },
    month: (el) => { S.month = el.dataset.m || null; render(); },
    "reload-feed": () => loadFeed(),
    "triage-accept": (el) => triageAccept(el.dataset.id),
    "notice-open": (el) => { const n = notice(el.dataset.id); if (n) newCaseDialog({ notice: n }); },
    "notice-join": (el) => noticeJoinDialog(el.dataset.id, el.dataset.case),
    "notice-manual": () => manualNoticeDialog(),
    "notice-pick": () => {
      const input = document.createElement("input");
      input.type = "file"; input.multiple = true; input.accept = ".eml,.msg,.pdf,message/rfc822,application/vnd.ms-outlook,application/pdf";
      input.onchange = () => importAndReport([...input.files]);
      input.click();
    },
    "feed-join": (el) => feedJoin(el.dataset.id, el.dataset.case),
    install: async () => { if (!S.installPrompt) return; S.installPrompt.prompt(); await S.installPrompt.userChoice; S.installPrompt = null; render(); },
    "triage-discard": (el) => reasonDialog("Descartar este anuncio", DISCARD_REASONS, (reason) => triageDecide(el.dataset.id, "discarded", { reason })),
    "triage-snooze": (el) => dialog(`<h2>Posponer</h2><p class="note">Vuelve a la bandeja ese día.</p><label>Hasta <input type="date" name="until" required value="${D.addDays(today(), 7)}"></label>`, (fd) => triageDecide(el.dataset.id, "snoozed", { until: fd.get("until") })),
    "triage-undo": (el) => mutate((d) => { delete d.triage[el.dataset.id]; }),
    "inbox-tab": (el) => { S.inbox.tab = el.dataset.tab; S.sel = 0; render(); },
    "intro-hide": () => { try { localStorage.setItem("registro-intro", "hidden"); } catch { /* ignore */ } render(); toast("Oculto. La guía sigue en el menú."); },
    "to-method": () => $("#como-se-calcula").scrollIntoView({ behavior: "smooth" }),
    "news-add": (el) => newsAdd(el.dataset.case, el.dataset.res),
    "news-dismiss": (el) => mutate(onCase(el.dataset.case, (c) => { (c.dismissed_news ||= []).push(el.dataset.res); })),
    "add-event": (el) => eventDialog(S.route.id, el.dataset.type),
    "upload-for": (el) => uploadForEvent(S.route.id, el.dataset.ev),
    "del-event": (el) => {
      const c = caseById(S.route.id), e = c.events.find((x) => x.id === el.dataset.id);
      if (!confirm(`¿Eliminar «${e.title || EVENTS[e.type].label}» de la cronología? Quedará anotado que se eliminó.`)) return;
      const trace = sysEvent(`Eliminado de la cronología: ${e.title || EVENTS[e.type].label} (${dateLabel(e.date)})`);
      mutate(onCase(c.id, (x) => { x.events = x.events.filter((y) => y.id !== e.id); x.events.push({ ...trace }); }));
    },
    "close-deadline": (el) => reasonDialog("Cerrar el plazo sin actuar", ["No se recurre", "No se alega", "Se ha pedido por otra vía", "Ya no aplica"], (reason) => {
      const entry = { reason, by: me(), at: nowStr() };
      mutate(onCase(S.route.id, (c) => { (c.closed_deadlines ||= {})[el.dataset.key] = { ...entry }; }));
    }),
    "reopen-deadline": (el) => mutate(onCase(S.route.id, (c) => { delete c.closed_deadlines[el.dataset.key]; })),
    check: (el) => mutate(onCase(S.route.id, (c) => { const k = c.checklist.find((x) => x.id === el.dataset.id); if (k) { k.done = el.checked; k.by = me(); } })),
    "check-del": (el) => mutate(onCase(S.route.id, (c) => { c.checklist = c.checklist.filter((x) => x.id !== el.dataset.id); })),
    "open-doc": async (el) => {
      if (!el.dataset.path) { toast("Documento de ejemplo: en la demostración no hay fichero detrás."); return; }
      try { const f = await S.store.open(el.dataset.path); window.open(URL.createObjectURL(f), "_blank", "noopener"); } catch (e) { toast(e.message, true); }
    },
    "person-del": (el) => {
      if (S.data.cases.some((c) => c.owner === el.dataset.id || c.reviewer === el.dataset.id)) { toast("Tiene expedientes asignados: reasígnalos antes.", true); return; }
      mutate((d) => { d.people = d.people.filter((p) => p.id !== el.dataset.id); });
    },
    "csv-cases": () => download("expedientes.csv", csv([["id", "titulo", "fase", "procedimiento", "tipo", "provincias", "organo", "expediente", "responsable", "resultado", "proximo_plazo", "vence"],
      ...S.data.cases.map((c) => { const n = nextDeadline(c); return [c.id, c.title, STAGE[c.stage].label, PROCEDURES[c.procedure], CATEGORIES[c.category], (c.provinces || []).join(", "), c.body, c.file_no, personName(c.owner), OUTCOMES[c.outcome || ""], n?.label || "", n?.due || ""]; })]), "text/csv"),
    "csv-filings": () => download("presentaciones.csv", csv([["fecha_oficial", "tipo", "expediente", "registro", "numero", "organo", "justificante", "sha256_justificante"],
      ...S.data.cases.flatMap((c) => c.events.filter((e) => e.registry).map((e) => { const r = receiptsOf(c, e)[0]; return [e.registry.datetime || e.date, EVENTS[e.type].label, c.title, e.registry.channel, e.registry.number, e.registry.body, r ? "sí" : "no", r?.sha256 || ""]; }))]), "text/csv"),
    "json-export": () => download(`registro-${today()}.json`, JSON.stringify(S.data, null, 1), "application/json"),
    "export-case": () => { const c = caseById(S.route.id); download(`${c.id}.json`, JSON.stringify({ ...c, deadlines: deadlinesOf(c) }, null, 1), "application/json"); },
  };

  // ---------- events ----------
  function bind() {
    document.addEventListener("click", (ev) => {
      const el = ev.target.closest("[data-action]");
      if (!el || el.tagName === "SELECT" || el.tagName === "INPUT" && el.type !== "button" && el.type !== "checkbox") return;
      if (el.type === "checkbox") return; // handled on change
      const fn = actions[el.dataset.action];
      if (fn) { ev.preventDefault(); fn(el); }
    });
    document.addEventListener("change", (ev) => {
      const el = ev.target;
      if (el.dataset.action === "set-me") { setMe(el.value); render(); return; }
      if (el.dataset.action === "check") { actions.check(el); return; }
      if (el.dataset.action === "inbox-env") { S.inbox.envOnly = el.checked; render(); return; }
      if (el.dataset.action === "report-year") { S.reportYear = el.value; render(); return; }
      if (el.dataset.action === "add-event-select") { const t = el.value; el.value = ""; if (t) eventDialog(S.route.id, t); return; }
      if (el.dataset.filter) { S.filters[el.dataset.filter] = el.type === "checkbox" ? el.checked : el.value; render(); return; }
      if (el.dataset.person) { const id = el.dataset.person, v = el.value.trim(); if (v) mutate((d) => { const p = d.people.find((x) => x.id === id); if (p) p.name = v; }); return; }
      if (el.dataset.field && S.route.view === "case") {
        const k = el.dataset.field, id = S.route.id;
        let v = el.value;
        if (k === "stage") { if (v === "discarded") { reasonDialog("Descartar el expediente", DISCARD_REASONS, (reason) => setStage(id, v, { reason })); render(); } else setStage(id, v); return; }
        if (["provinces", "towns", "tags"].includes(k)) v = splitList(v);
        if (k === "priority") v = Number(v);
        if (k === "title" || k === "summary") v = v.trim();
        mutate(onCase(id, (c) => { c[k] = v; }));
      }
    });
    document.addEventListener("input", (ev) => {
      const el = ev.target;
      if (el.dataset.filter === "q") { S.filters.q = el.value; S.focus = '[data-filter="q"]'; render(); restoreCaret(el); }
      if (el.dataset.action === "inbox-q") { S.inbox.q = el.value; S.focus = '[data-action="inbox-q"]'; render(); restoreCaret(el); }
      if (el.classList.contains("title-edit") || el.classList.contains("summary-edit")) autosize(el);
    });
    document.addEventListener("submit", async (ev) => {
      const f = ev.target, kind = f.dataset.form;
      if (!kind) return;
      ev.preventDefault();
      const fd = new FormData(f);
      if (kind === "check-add" && fd.get("text").trim()) {
        const item = { id: uid("k"), text: fd.get("text").trim(), done: false };
        S.focus = '[data-form="check-add"] input';
        mutate(onCase(S.route.id, (c) => { (c.checklist ||= []).push({ ...item }); }));
      }
      if (kind === "person-add" && fd.get("name").trim()) {
        const p = { id: uid("p"), name: fd.get("name").trim() };
        S.focus = '[data-form="person-add"] input';
        mutate((d) => { d.people.push({ ...p }); });
      }
      if (kind === "upload") {
        const file = fd.get("file");
        if (!file?.size) return;
        const caseId = S.route.id, kindDoc = fd.get("kind"), name = fd.get("name").trim() || file.name.replace(/\.[^.]+$/, "");
        const c = caseById(caseId);
        const version = 1 + Math.max(0, ...(c.docs || []).filter((d) => d.kind === kindDoc && d.name === name).map((d) => d.version));
        const meta = await S.store.attach(caseId, file, `${today()}_${kindDoc}_v${version}`);
        const doc = { id: uid("d"), kind: kindDoc, name, version, at: nowStr(), by: me(), file: file.name, ...meta };
        mutate(onCase(caseId, (x) => { x.docs.push({ ...doc }); }));
        toast(version > 1 ? `Guardada la versión ${version} de «${name}».` : `Documento «${name}» guardado.`);
      }
      if (kind === "org") {
        const extra = String(fd.get("holidays") || "").split("\n").map((l) => l.trim()).filter(Boolean).map((l) => ({ date: l.slice(0, 10), label: l.slice(10).trim() })).filter((h) => /^\d{4}-\d{2}-\d{2}$/.test(h.date));
        const org = { name: fd.get("name"), region: fd.get("region"), extra_holidays: extra, feed_url: fd.get("feed_url") || FEED_URL };
        await mutate((d) => { d.org = { ...d.org, ...org }; });
        toast("Ajustes guardados. Los plazos se han recalculado.");
      }
      if (f.id === "setup") {
        const pid = uid("p");
        S.data = { schema: Store.SCHEMA, org: { name: fd.get("name"), region: fd.get("region"), extra_holidays: [], feed_url: FEED_URL },
          people: [{ id: pid, name: fd.get("me") }], triage: {}, cases: [], notices: [] };
        setMe(pid);
        await S.store.setup();
        await S.store.save(S.data, pid);
        start();
      }
    });
    // Files dropped anywhere become notices; cards dragged on the board change stage.
    const hasFiles = (ev) => [...(ev.dataTransfer?.types || [])].includes("Files");
    document.addEventListener("dragstart", (ev) => { const el = ev.target.closest?.("[data-drag]"); if (el) { ev.dataTransfer.setData("text/plain", el.dataset.drag); el.classList.add("dragging"); } });
    document.addEventListener("dragover", (ev) => {
      if (hasFiles(ev)) { if (S.data) { ev.preventDefault(); document.body.classList.add("dropping"); } return; }
      const col = ev.target.closest?.("[data-drop]"); if (col) { ev.preventDefault(); col.classList.add("over"); }
    });
    document.addEventListener("dragleave", (ev) => {
      if (!ev.relatedTarget) document.body.classList.remove("dropping");
      const col = ev.target.closest?.("[data-drop]"); if (col) col.classList.remove("over");
    });
    document.addEventListener("drop", (ev) => {
      if (hasFiles(ev)) { ev.preventDefault(); document.body.classList.remove("dropping"); importAndReport([...ev.dataTransfer.files]); return; }
      const col = ev.target.closest?.("[data-drop]");
      if (!col) return;
      ev.preventDefault();
      const id = ev.dataTransfer.getData("text/plain");
      setStage(id, col.dataset.drop);
    });
    // <details> toggles don't bubble; listen in the capture phase to keep them open across renders.
    document.addEventListener("toggle", (ev) => {
      if (ev.target.classList?.contains("more-filters")) S.filtersOpen = ev.target.open;
      if (ev.target.classList?.contains("more-props")) S.propsOpen = ev.target.open;
    }, true);
    document.addEventListener("keydown", onKey);
    window.addEventListener("hashchange", () => { S.route = parseRoute(); S.sel = 0; render(); window.scrollTo({ top: $("#app").offsetTop - 8 }); });
    // While the tab is visible: pick up other people's saves and e-mails left in entrada/.
    setInterval(async () => {
      if (!S.data || !S.store || S.store.kind !== "folder" || document.hidden || $("#dlg").open || S.saving || pending.length) return;
      try {
        if (await S.store.changedOnDisk()) {
          const fresh = await S.store.read();
          if (fresh && !pending.length) { S.data = normalize(fresh); render(); toast("Actualizado con cambios de otra persona."); }
        }
        await importIncoming();
      } catch (e) { console.warn(e); }
    }, 20000);
    // Install as an app (Chrome, Edge): keep the browser's prompt for the button in Ajustes.
    window.addEventListener("beforeinstallprompt", (ev) => { ev.preventDefault(); S.installPrompt = ev; if (S.route.view === "ajustes") render(); });
    if ("serviceWorker" in navigator && location.protocol !== "file:") navigator.serviceWorker.register("sw.js").catch(() => {});
  }

  function restoreCaret(old) {
    const el = $(S.focus || "") || document.activeElement;
    if (el && el.setSelectionRange && old.value != null) { const n = old.value.length; try { el.setSelectionRange(n, n); } catch { /* ignore */ } }
  }
  function autosize(el) { el.style.height = "auto"; el.style.height = `${el.scrollHeight}px`; }

  // ---------- keyboard ----------
  function onKey(ev) {
    const typing = ev.target.closest?.("input, textarea, select, [contenteditable]");
    if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === "k") { ev.preventDefault(); if (S.data) openPalette(); return; }
    if (typing || $("#dlg").open || !$("#palette").hidden || !S.data) return;
    const k = ev.key;
    if (S.gPressed) {
      S.gPressed = false;
      const go = { h: "#/hoy", b: "#/bandeja", p: "#/plazos", e: "#/expedientes/lista", t: "#/expedientes/tablero", c: "#/expedientes/calendario", i: "#/informe", a: "#/ajustes" }[k.toLowerCase()];
      if (go) { location.hash = go; ev.preventDefault(); }
      return;
    }
    if (k === "g") { S.gPressed = true; setTimeout(() => (S.gPressed = false), 1200); return; }
    if (k === "n" || k === "N") { ev.preventDefault(); newCaseDialog(); return; }
    if (k === "/") { ev.preventDefault(); openPalette(); return; }
    if (k === "?") { ev.preventDefault(); showShortcuts(); return; }
    const rows = $$(".sel-row");
    if (!rows.length) return;
    if (k === "j" || k === "ArrowDown") { S.sel = Math.min(rows.length - 1, S.sel + 1); markSelection(true); ev.preventDefault(); }
    if (k === "k" || k === "ArrowUp") { S.sel = Math.max(0, S.sel - 1); markSelection(true); ev.preventDefault(); }
    const row = rows[S.sel];
    if (!row) return;
    if (k === "Enter" && row.dataset.href) location.hash = row.dataset.href;
    if (S.route.view === "bandeja" && row.dataset.notice) {
      const id = row.dataset.notice;
      if (k === "a") actions["notice-open"]({ dataset: { id } });
      if (k === "d") actions["triage-discard"]({ dataset: { id } });
      if (k === "s") actions["triage-snooze"]({ dataset: { id } });
    }
    if (S.route.view === "bandeja" && row.dataset.feed) {
      const id = row.dataset.feed;
      if (k === "a") triageAccept(id);
      if (k === "d") actions["triage-discard"]({ dataset: { id } });
      if (k === "s") actions["triage-snooze"]({ dataset: { id } });
    }
  }
  function markSelection(scroll) {
    const rows = $$(".sel-row");
    rows.forEach((r, i) => r.classList.toggle("selected", i === S.sel));
    if (scroll && rows[S.sel]) rows[S.sel].scrollIntoView({ block: "nearest" });
  }
  function showShortcuts() {
    dialog(`<h2>Atajos de teclado</h2><table class="params"><tbody>
      <tr><th><kbd>Ctrl K</kbd> o <kbd>/</kbd></th><td>Buscar expedientes o ir a cualquier sitio</td></tr>
      <tr><th><kbd>N</kbd></th><td>Nuevo expediente</td></tr>
      <tr><th><kbd>J</kbd> <kbd>K</kbd> / flechas</th><td>Moverse por la lista; <kbd>Intro</kbd> abre</td></tr>
      <tr><th><kbd>A</kbd> <kbd>D</kbd> <kbd>S</kbd></th><td>En la bandeja: abrir expediente, descartar, posponer</td></tr>
      <tr><th><kbd>G</kbd> y luego <kbd>H</kbd> <kbd>B</kbd> <kbd>P</kbd> <kbd>E</kbd> <kbd>T</kbd> <kbd>C</kbd> <kbd>I</kbd> <kbd>A</kbd></th><td>Ir a hoy, bandeja, plazos, expedientes, tablero, calendario, informe, ajustes</td></tr>
      </tbody></table><p class="note">Todo lo que hace un atajo tiene también su botón.</p>`, () => true);
  }

  // ---------- command palette ----------
  function openPalette() {
    const pal = $("#palette");
    pal.hidden = false;
    const input = $("input", pal);
    input.value = "";
    let idx = 0;
    const cmds = [
      { t: "Nuevo expediente", k: "N", run: () => newCaseDialog() },
      { t: "Ir a hoy", k: "G H", run: () => (location.hash = "#/hoy") },
      { t: "Ir a la bandeja", k: "G B", run: () => (location.hash = "#/bandeja") },
      { t: "Ir a los plazos", k: "G P", run: () => (location.hash = "#/plazos") },
      { t: "Ver expedientes en lista", k: "G E", run: () => (location.hash = "#/expedientes/lista") },
      { t: "Ver el tablero por fases", k: "G T", run: () => (location.hash = "#/expedientes/tablero") },
      { t: "Ver el calendario de plazos", k: "G C", run: () => (location.hash = "#/expedientes/calendario") },
      { t: "Informe del año", k: "G I", run: () => (location.hash = "#/informe") },
      { t: "Ajustes", k: "G A", run: () => (location.hash = "#/ajustes") },
      { t: "Exportar presentaciones (CSV)", run: () => actions["csv-filings"]() },
      { t: "Guía rápida", run: () => (location.hash = "#/guia") },
      { t: "Atajos de teclado", k: "?", run: () => showShortcuts() },
    ];
    const draw = () => {
      const q = input.value.toLowerCase().trim();
      const cs = S.data.cases.filter((c) => !q || `${c.title} ${c.file_no || ""} ${c.boe_id || ""} ${(c.towns || []).join(" ")} ${(c.provinces || []).join(" ")}`.toLowerCase().includes(q)).slice(0, 8)
        .map((c) => ({ t: c.title, sub: STAGE[c.stage].label, run: () => (location.hash = `#/e/${c.id}`) }));
      const as = cmds.filter((c) => !q || c.t.toLowerCase().includes(q));
      const items = [...as, ...cs];
      idx = Math.min(idx, Math.max(0, items.length - 1));
      $("ul", pal).innerHTML = items.map((it, i) => `<li class="${i === idx ? "on" : ""}" data-i="${i}"><span>${esc(it.t)}</span>${it.sub ? `<em>${esc(it.sub)}</em>` : ""}${it.k ? `<kbd>${it.k}</kbd>` : ""}</li>`).join("") || `<li class="note">Nada coincide</li>`;
      pal._items = items;
    };
    const close = () => { pal.hidden = true; input.onkeydown = null; };
    input.oninput = () => { idx = 0; draw(); };
    input.onkeydown = (ev) => {
      if (ev.key === "Escape") { close(); }
      if (ev.key === "ArrowDown") { idx++; draw(); ev.preventDefault(); }
      if (ev.key === "ArrowUp") { idx = Math.max(0, idx - 1); draw(); ev.preventDefault(); }
      if (ev.key === "Enter") { const it = pal._items[idx]; close(); if (it) it.run(); }
    };
    $("ul", pal).onclick = (ev) => { const li = ev.target.closest("li[data-i]"); if (!li) return; const it = pal._items[Number(li.dataset.i)]; close(); it.run(); };
    pal.onclick = (ev) => { if (ev.target === pal) close(); };
    draw();
    input.focus();
  }

  // ---------- toast ----------
  let toastTimer;
  function toast(msg, warn) {
    const t = $("#toast");
    t.textContent = msg;
    t.className = `show${warn ? " warn" : ""}`;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (t.className = ""), 5000);
  }

  // ---------- routing and boot ----------
  function parseRoute() {
    const h = location.hash.replace(/^#\/?/, "");
    const [path, query] = h.split("?");
    const [a, b] = path.split("/");
    if (a === "e" && b) return { view: "case", id: decodeURIComponent(b) };
    if (a === "expedientes") {
      if (query === "sin-justificante") S.filters = { ...S.filters, preset: "noreceipt" };
      return { view: "cases", mode: b || "lista" };
    }
    return { view: ["hoy", "bandeja", "plazos", "informe", "ajustes", "guia"].includes(a) ? a : "hoy" };
  }

  async function openFolder(store, ask = true) {
    if (!(await store.permitted(ask))) { toast("Sin permiso para la carpeta.", true); return; }
    S.store = store;
    remember("");
    const data = await store.read();
    if (!data) { renderWelcome(true); return; }
    S.data = data;
    start();
  }

  function normalize(d) {
    for (const c of d.cases) { c.events ||= []; c.docs ||= []; c.checklist ||= []; }
    d.triage ||= {}; d.notices ||= []; d.people ||= [];
    return d;
  }
  function start() {
    S.pendingFolder = null;
    S.route = parseRoute();
    normalize(S.data);
    render();
    loadFeed();
    importIncoming().catch((e) => toast(`No se pudo leer entrada/: ${e.message}`, true));
  }

  // Reloading the page should land where the user was, in the demo too.
  const remember = (mode) => { try { mode ? localStorage.setItem("registro-mode", mode) : localStorage.removeItem("registro-mode"); } catch { /* ignore */ } };
  const lastMode = () => { try { return localStorage.getItem("registro-mode"); } catch { return null; } };

  async function boot() {
    bind();
    S.route = parseRoute();
    if (lastMode() === "demo") { await actions.demo(); return; }
    if (Store.supportsFolders()) {
      const prev = await Store.FolderStore.reopen();
      if (prev) {
        if (await prev.permitted(false)) { await openFolder(prev, false); return; }
        S.pendingFolder = prev; // the browser needs a click to grant access again
      }
    }
    render();
  }

  return { boot };
})();

App.boot();

/* Synthetic demo data. Every project, company and person here is invented; dates are relative to
   today so the demo always has something due this week. Nothing here comes from real cases. */

const Demo = (() => {
  const day = (n) => Deadlines.addDays(new Date().toISOString().slice(0, 10), n);
  const at = (n, hm = "10:00") => `${day(n)}T${hm}`;

  function data() {
    const people = [
      { id: "p1", name: "Lucía (técnica de conservación)" },
      { id: "p2", name: "Javier (jurídico)" },
      { id: "p3", name: "Marta (delegación territorial)" },
    ];
    const ev = (id, type, n, extra = {}) => ({ id, type, date: at(n, extra.hm), by: extra.by || "p1", at: at(n, extra.hm), ...extra });
    const cases = [
      {
        id: "c-llanos", title: "Parque eólico «Los Llanos» (demo), 49,5 MW y su línea de evacuación",
        boe_id: "DEMO-B-0001", url: "", procedure: "eia_ordinaria", category: "eolica",
        provinces: ["Zaragoza"], towns: ["Municipio A", "Municipio B"], region: "Aragón",
        body: "Dirección General de Energía y Minas (demo)", env_body: "Instituto ambiental autonómico (demo)",
        file_no: "G-EO-Z-000/2026", developer: "Renovables Ejemplo S.L.", power_mw: 49.5,
        stage: "drafting", stage_since: day(-6), owner: "p1", reviewer: "p2", priority: 3,
        tags: ["ZEPA", "esteparias", "acumulativos"], outcome: "",
        summary: "Siete aerogeneradores a 1,2 km de una ZEPA de aves esteparias. Tercer parque en el mismo cerro: hay que plantear efectos acumulativos.",
        checklist: [
          { id: "k1", text: "Descargar el estudio de impacto y los anexos de avifauna", done: true },
          { id: "k2", text: "Cruzar con IBA, ZEPA y áreas críticas de planes de recuperación", done: true },
          { id: "k3", text: "Redactar el escrito de alegaciones", done: false },
          { id: "k4", text: "Revisión jurídica", done: false },
          { id: "k5", text: "Presentar en registro electrónico y guardar el justificante", done: false },
        ],
        docs: [
          { id: "d1", kind: "draft", name: "Escrito de alegaciones", version: 2, path: "", sha256: "", at: at(-1), by: "p1" },
          { id: "d0", kind: "draft", name: "Escrito de alegaciones", version: 1, path: "", sha256: "", at: at(-4), by: "p1" },
          { id: "d2", kind: "evidence", name: "Informe técnico de avifauna", version: 1, path: "", sha256: "", at: at(-3), by: "p1" },
        ],
        events: [
          ev("e1", "publication", -18, { title: "Anuncio de información pública", days: 30, unit: "habiles", note: "Boletín autonómico (demo)." }),
          ev("e2", "note", -6, { title: "Decidimos alegar", note: "Afecta a un núcleo reproductor conocido; se publica solo el agregado.", by: "p3" }),
        ],
        created: at(-17), updated: at(-1),
      },
      {
        id: "c-solar", title: "Planta fotovoltaica «Vega Alta» (demo), 120 MW",
        boe_id: "DEMO-B-0002", procedure: "eia_ordinaria", category: "fotovoltaica",
        provinces: ["Toledo"], towns: ["Municipio C"], region: "Castilla-La Mancha",
        body: "Dirección General de Política Energética y Minas (demo)", env_body: "Subdirección de Evaluación Ambiental (demo)",
        file_no: "PFot-000", developer: "Solar Demo Energía S.A.", power_mw: 120,
        stage: "review", stage_since: day(-2), owner: "p3", reviewer: "p2", priority: 2,
        tags: ["esteparias"], outcome: "", summary: "Ocupa 240 ha de cereal de secano con sisón y ganga ortega.",
        checklist: [
          { id: "k1", text: "Redactar el escrito", done: true },
          { id: "k2", text: "Revisión jurídica", done: false },
          { id: "k3", text: "Presentar en registro", done: false },
        ],
        docs: [{ id: "d1", kind: "draft", name: "Escrito de alegaciones", version: 1, path: "", sha256: "", at: at(-2), by: "p3" }],
        events: [ev("e1", "publication", -38, { title: "Anuncio en el BOE", days: 30, unit: "habiles" })],
        created: at(-30), updated: at(-2),
      },
      {
        id: "c-linea", title: "Línea aérea de alta tensión 400 kV (demo), tramo norte",
        boe_id: "DEMO-B-0003", procedure: "autorizacion", category: "red_electrica",
        provinces: ["León"], towns: ["Municipio D"], region: "Castilla y León",
        body: "Área de Industria y Energía (demo)", env_body: "", file_no: "LAT-000",
        developer: "Transporte Eléctrico Demo S.A.", stage: "filed", stage_since: day(-40), owner: "p2", reviewer: "p1", priority: 2,
        tags: ["electrocución", "colisión"], outcome: "",
        summary: "Cruza un corredor migratorio. Pedimos salvapájaros y aislamiento en todos los apoyos.",
        checklist: [], docs: [
          { id: "d1", kind: "filed", name: "Escrito de alegaciones presentado", version: 1, path: "", sha256: "9f2c…demo", at: at(-40), by: "p2", event: "e2" },
          { id: "d2", kind: "receipt", name: "Justificante de presentación", version: 1, path: "", sha256: "41ab…demo", at: at(-40), by: "p2", event: "e2" },
        ],
        events: [
          ev("e1", "publication", -60, { title: "Anuncio en el BOE", days: 30, unit: "habiles" }),
          ev("e2", "filing", -40, { title: "Alegaciones presentadas", hm: "13:42", by: "p2", docs: ["d1", "d2"],
            registry: { channel: "REC", number: "REGAGE26e00000000000", datetime: at(-40, "13:42"), body: "Área de Industria y Energía (demo)", dir3: "" } }),
          ev("e3", "info_request", -36, { title: "Solicitud del expediente completo (Ley 27/2006)", by: "p2",
            registry: { channel: "REC", number: "REGAGE26e00000000001", datetime: at(-36, "09:10") } }),
        ],
        created: at(-58), updated: at(-36),
      },
      {
        id: "c-mina", title: "Ampliación de explotación minera a cielo abierto (demo)",
        boe_id: "DEMO-B-0004", procedure: "eia_ordinaria", category: "mineria",
        provinces: ["Huelva"], towns: ["Municipio E"], region: "Andalucía",
        body: "Delegación de Industria (demo)", env_body: "Delegación de Medio Ambiente (demo)", file_no: "AAU/HU/000/26",
        developer: "Minerales Demo S.L.", stage: "followup", stage_since: day(-12), owner: "p2", reviewer: "p1", priority: 3,
        tags: ["humedal"], outcome: "partial",
        summary: "Autorizada con condiciones. Se acogió la balsa de lixiviados; no, el seguimiento del humedal.",
        checklist: [{ id: "k1", text: "Decidir si se recurre la autorización", done: false }],
        docs: [
          { id: "d1", kind: "filed", name: "Escrito de alegaciones presentado", version: 1, path: "", sha256: "c0de…demo", at: at(-150), by: "p2", event: "e2" },
          { id: "d2", kind: "receipt", name: "Justificante de presentación", version: 1, path: "", sha256: "beef…demo", at: at(-150), by: "p2", event: "e2" },
          { id: "d3", kind: "resolution", name: "Autorización y condicionado", version: 1, path: "", sha256: "", at: at(-12), by: "p1", event: "e4" },
        ],
        events: [
          ev("e1", "publication", -175, { title: "Anuncio de información pública", days: 30, unit: "habiles" }),
          ev("e2", "filing", -150, { title: "Alegaciones presentadas", by: "p2", docs: ["d1", "d2"],
            registry: { channel: "Registro autonómico", number: "2026/000000", datetime: at(-150, "11:05") } }),
          ev("e3", "reply", -60, { title: "Respuesta razonada a las alegaciones", note: "Acoge 2 de 5 puntos." }),
          ev("e4", "resolution", -12, { subtype: "autorizacion", title: "Autorización publicada", remedies: ["alzada"], docs: ["d3"] }),
        ],
        created: at(-170), updated: at(-12),
      },
      {
        id: "c-presa", title: "Recrecimiento de azud y escala de peces (demo)",
        boe_id: "DEMO-B-0005", procedure: "eia_simplificada", category: "hidraulica",
        provinces: ["Cuenca"], towns: ["Municipio F"], region: "Castilla-La Mancha",
        body: "Confederación Hidrográfica (demo)", stage: "study", stage_since: day(-1), owner: "p1", priority: 1,
        tags: [], outcome: "", summary: "", checklist: [], docs: [],
        events: [ev("e1", "publication", -3, { title: "Anuncio en el BOE", days: 20, unit: "habiles" })],
        created: at(-1), updated: at(-1),
      },
      {
        id: "c-puerto", title: "Dragado y ampliación de dársena deportiva (demo)",
        boe_id: "DEMO-B-0006", procedure: "eia_simplificada", category: "puertos_costas",
        provinces: ["Cantabria"], towns: ["Municipio G"], region: "Cantabria",
        body: "Demarcación de Costas (demo)", stage: "closed", stage_since: day(-90), owner: "p3", priority: 1,
        tags: ["limícolas"], outcome: "accepted",
        summary: "Se pidió evaluación ordinaria y el órgano ambiental la exigió.",
        checklist: [], docs: [
          { id: "d1", kind: "receipt", name: "Justificante de presentación", version: 1, path: "", sha256: "a11c…demo", at: at(-200), by: "p3", event: "e2" },
        ],
        events: [
          ev("e1", "consultation", -230, { title: "Consulta a personas interesadas", subtype: "eia_simplificada", days: 20, unit: "habiles" }),
          ev("e2", "filing", -200, { title: "Alegaciones presentadas", by: "p3", docs: ["d1"],
            registry: { channel: "REC", number: "REGAGE26e00000000002", datetime: at(-200, "17:20") } }),
          ev("e3", "resolution", -90, { subtype: "iia", title: "Informe de impacto: se somete a evaluación ordinaria" }),
        ],
        created: at(-228), updated: at(-90),
      },
      {
        id: "c-urb", title: "Modificación puntual del plan general en suelo rústico (demo)",
        boe_id: "", procedure: "plan", category: "urbanismo_industria",
        provinces: ["Madrid"], towns: ["Municipio H"], region: "Madrid",
        body: "Ayuntamiento (demo)", stage: "discarded", stage_since: day(-20), owner: "p3", priority: 0,
        tags: [], outcome: "", summary: "", discard_reason: "Sin afección a aves amenazadas",
        checklist: [], docs: [],
        events: [ev("e1", "publication", -25, { title: "Anuncio en el boletín autonómico", days: 45, unit: "habiles" })],
        created: at(-22), updated: at(-20),
      },
    ];
    // Two e-mails as the mailbox receives them: a consultation sent to the organisation as an
    // interested party (before any BOE announcement) and a notice of an electronic notification.
    const notices = [
      {
        id: "n-demo-consulta", format: "eml", source: "demo", kind: "eia_alcance", received: day(-6), by: "p3", at: at(-6),
        subject: "Consulta sobre el alcance del estudio de impacto: parque eólico «Cerro Ventoso» (demo)",
        from: { name: "Órgano ambiental (demo)", email: "evaluacion@demo.invalid" }, file_no: "SGEA/EO/0000/2026",
        excerpt: "En cumplimiento del artículo 34 de la Ley 21/2013, de evaluación ambiental, se le consulta como persona interesada sobre el documento inicial del proyecto de parque eólico «Cerro Ventoso» (demo), 60 MW, en el Municipio I. Puede formular las observaciones que estime oportunas en el plazo de veinte días hábiles. Expediente: SGEA/EO/0000/2026.",
        original: null, attachments: [],
      },
      {
        id: "n-demo-dehu", format: "eml", source: "demo", kind: "notification", received: day(-1), by: "p2", at: at(-1),
        subject: "Tiene una nueva notificación en la Dirección Electrónica Habilitada única (demo)",
        from: { name: "Notificaciones (demo)", email: "no-reply@demo.invalid" }, file_no: "",
        excerpt: "Organismo emisor: Confederación Hidrográfica (demo). Concepto: recrecimiento de azud y escala de peces, requerimiento de documentación. Dispone de diez días naturales para acceder a su contenido; transcurrido el plazo, se entenderá rechazada.",
        original: null, attachments: [],
      },
    ];
    return {
      schema: 2,
      org: { name: "Organización de demostración", region: "Madrid", town: "", extra_holidays: [],
        feed_url: "https://raw.githubusercontent.com/Asensio94/observatorio-alegaciones/main/data/estado.json" },
      people, triage: {}, cases, notices,
    };
  }

  // A tiny synthetic feed for when the observatory cannot be reached. Like the real one, each
  // announcement carries its term (or none, and then 30 business days are assumed).
  function feed() {
    const cal = Deadlines.calendar();
    const due = (from, n) => Deadlines.addBusinessDays(from, n, cal);
    return {
      anuncios: {
        "DEMO-B-0101": { identificador: "DEMO-B-0101", fecha: day(-4), titulo: "Anuncio de información pública del proyecto de parque eólico «Cerro Ventoso» (demo), 60 MW", categoria: "eolica", prioridad: 6, tramite_ambiental: true, provincias: ["Cuenca"], municipios: ["Municipio I"], fecha_limite: due(day(-4), 30), plazo_dias: 30, plazo_estimado: false, natura: [{ nombre: "ZEPA de demostración" }], n_aves: 7, url_html: "" },
        "DEMO-B-0102": { identificador: "DEMO-B-0102", fecha: day(-35), titulo: "Anuncio de información pública de la línea de evacuación de la planta solar «Llano Seco» (demo)", categoria: "red_electrica", prioridad: 4, tramite_ambiental: true, provincias: ["Badajoz"], municipios: ["Municipio J"], fecha_limite: due(day(-35), 30), plazo_dias: null, plazo_estimado: true, natura: [], n_aves: 3, url_html: "" },
        "DEMO-B-0103": { identificador: "DEMO-B-0103", fecha: day(-2), titulo: "Anuncio de concesión de aguas subterráneas para regadío (demo)", categoria: "agua_concesion", prioridad: 3, tramite_ambiental: false, provincias: ["Ciudad Real"], municipios: ["Municipio K"], fecha_limite: due(day(-2), 20), plazo_dias: 20, plazo_estimado: false, natura: [{ nombre: "Humedal de demostración" }], n_aves: 11, url_html: "" },
      },
      resoluciones: {},
    };
  }

  return { data, feed };
})();

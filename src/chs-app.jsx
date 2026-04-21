import { useState, useEffect, useRef } from "react";
// ─── SUPABASE CLIENT (inline — no external dependency) ───────────────────────
const SUPA_URL = "https://jsffepzvyqurzkzbmzzj.supabase.co";
const SUPA_KEY = "sb_publishable_d2kXxGL7xCMSNDdThc8yDw_dLKu54cJ";

const supabase = (() => {
  let _session = null;
  let _listeners = [];

  const _tryLS = (fn, fallback = null) => { try { return fn(); } catch { return fallback; } };

  const _headers = (extra = {}) => {
    const h = { "Content-Type": "application/json", "apikey": SUPA_KEY, ...extra };
    if (_session?.access_token) h["Authorization"] = `Bearer ${_session.access_token}`;
    return h;
  };

  const _notify = (session) => _listeners.forEach(fn => fn(null, session ? { user: session.user } : null));

  const _q = async (method, url, body, opts = {}) => {
    const { single = false, returnData = false } = opts;
    const prefer = returnData || single ? "return=representation" : "return=minimal";
    try {
      const res = await fetch(url, {
        method,
        headers: _headers({ Prefer: prefer }),
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
      const text = await res.text();
      if (!res.ok) {
        const err = _tryLS(() => JSON.parse(text), {});
        return { data: null, error: { message: err.message || err.error_description || "Request failed" } };
      }
      if (!text) return { data: null, error: null };
      const json = _tryLS(() => JSON.parse(text));
      return { data: single && Array.isArray(json) ? (json[0] ?? null) : json, error: null };
    } catch (e) { return { data: null, error: { message: e.message } }; }
  };

  const auth = {
    async signUp({ email, password }) {
      const res = await fetch(`${SUPA_URL}/auth/v1/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "apikey": SUPA_KEY },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) return { data: null, error: { message: data.msg || data.error_description || "Signup failed" } };
      if (data.access_token) {
        _session = data;
        _tryLS(() => localStorage.setItem("chs_sess", JSON.stringify(data)));
        _notify(data);
      }
      return { data, error: null };
    },

    async signInWithPassword({ email, password }) {
      const res = await fetch(`${SUPA_URL}/auth/v1/token?grant_type=password`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "apikey": SUPA_KEY },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) return { data: null, error: { message: data.error_description || data.msg || "Sign in failed" } };
      _session = data;
      _tryLS(() => localStorage.setItem("chs_sess", JSON.stringify(data)));
      _notify(data);
      return { data: { user: data.user, session: data }, error: null };
    },

    async signOut() {
      try { await fetch(`${SUPA_URL}/auth/v1/logout`, { method: "POST", headers: _headers() }); } catch {}
      _session = null;
      _tryLS(() => localStorage.removeItem("chs_sess"));
      _notify(null);
      return { error: null };
    },

    async getSession() {
      if (_session) return { data: { session: _session }, error: null };
      const stored = _tryLS(() => JSON.parse(localStorage.getItem("chs_sess") || "null"));
      if (stored) { _session = stored; return { data: { session: stored }, error: null }; }
      return { data: { session: null }, error: null };
    },

    onAuthStateChange(callback) {
      _listeners.push(callback);
      return { data: { subscription: { unsubscribe: () => { _listeners = _listeners.filter(fn => fn !== callback); } } } };
    },

    signInWithOAuth({ provider, options = {} }) {
      const redirectTo = options.redirectTo || window.location.origin;
      const params = new URLSearchParams({ provider, redirect_to: redirectTo });
      window.location.href = `${SUPA_URL}/auth/v1/authorize?${params}`;
      return Promise.resolve({ data: { url: `${SUPA_URL}/auth/v1/authorize?${params}` }, error: null });
    },
  };

  const from = (table) => ({
    select: (cols = "*") => {
      const filters = [];
      const builder = {
        eq: (col, val) => { filters.push(`${col}=eq.${val}`); return builder; },
        neq: (col, val) => { filters.push(`${col}=neq.${val}`); return builder; },
        order: (col, { ascending = true } = {}) => { filters.push(`order=${col}.${ascending ? "asc" : "desc"}`); return builder; },
        limit: (n) => { filters.push(`limit=${n}`); return builder; },
        single: () => {
          const qs = [...filters, "limit=1"].join("&");
          return _q("GET", `${SUPA_URL}/rest/v1/${table}?select=${cols}&${qs}`, undefined, { single: true });
        },
        execute: () => {
          const qs = filters.join("&");
          return _q("GET", `${SUPA_URL}/rest/v1/${table}?select=${cols}${qs ? "&" + qs : ""}`, undefined, {});
        },
        then: (resolve, reject) => {
          const qs = filters.join("&");
          return _q("GET", `${SUPA_URL}/rest/v1/${table}?select=${cols}${qs ? "&" + qs : ""}`, undefined, {}).then(resolve, reject);
        },
      };
      return builder;
    },
    insert: (body) => ({
      select: () => ({
        single: () => _q("POST", `${SUPA_URL}/rest/v1/${table}`, body, { single: true, returnData: true }),
      }),
      then: (resolve, reject) => _q("POST", `${SUPA_URL}/rest/v1/${table}`, body, {}).then(resolve, reject),
    }),
    update: (body) => ({
      eq: (col, val) => ({
        select: () => ({
          single: () => _q("PATCH", `${SUPA_URL}/rest/v1/${table}?${col}=eq.${val}`, body, { single: true, returnData: true }),
        }),
        then: (resolve, reject) => _q("PATCH", `${SUPA_URL}/rest/v1/${table}?${col}=eq.${val}`, body, {}).then(resolve, reject),
      }),
    }),
    delete: () => ({
      eq: (col, val) => _q("DELETE", `${SUPA_URL}/rest/v1/${table}?${col}=eq.${val}`, undefined, {}),
    }),
  });

  return { auth, from };
})();

// ─── STYLES ───────────────────────────────────────────────────────────────────
const ENV_STYLES = {
  Controlled: { bg: "#000", text: "#fff", border: "#000" },
  Uncontrolled: { bg: "#fff", text: "#000", border: "#000" },
  "Uncontrolled, Real World": { bg: "#555", text: "#fff", border: "#555" },
};
const INEX_STYLES = {
  Internal: { bg: "#000", text: "#fff" },
  External: { bg: "#e8e8e8", text: "#000" },
};
const SECTION_ICONS = {
  Apps: "⬡", Data: "◈", Dev: "⟨/⟩", Infrastructure: "▣", Systems: "⊕",
  BizOps: "✦", Logistics: "⬢", Inventory: "▤", Production: "⚙", Sales: "◎",
};

const TIER_TOKEN_COST = { compact: 1, midsize: 3, executive: 5, luxury: 10 };
const BP_TOKEN_COST = 0.25;

// ─── STRIPE PAYMENT LINKS ─────────────────────────────────────────────────────
// Replace each URL with your real Stripe Payment Link after creating them in
// your Stripe Dashboard → Payment Links → Create Link
const STRIPE_LINKS = {
  25:   "https://buy.stripe.com/8x23cuh0fevfekS0sm4Vy00",
  50:   "https://buy.stripe.com/dRmcN49xN9aVfoW1wq4Vy01",
  100:  "https://buy.stripe.com/dRmdR8aBRfzjekS4IC4Vy02",
  250:  "https://buy.stripe.com/aFa7sK4dt9aV2Ca3Ey4Vy03",
  500:  "https://buy.stripe.com/cNi5kC6lB0Ep6Sq3Ey4Vy04",
  1000: "https://buy.stripe.com/14A9ASeS7bj30u27UO4Vy05",
};
const getNearestStripeLink = (amount) => {
  const tiers = [25, 50, 100, 250, 500, 1000];
  const nearest = tiers.reduce((prev, curr) => Math.abs(curr - amount) < Math.abs(prev - amount) ? curr : prev);
  return { url: STRIPE_LINKS[nearest], tier: nearest };
};


// ─── RESPONSIVE HOOK ─────────────────────────────────────────────────────────
function useResponsive() {
  const [width, setWidth] = useState(typeof window !== "undefined" ? window.innerWidth : 1024);
  useEffect(() => {
    const handler = () => setWidth(window.innerWidth);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);
  return {
    isMobile: width < 640,
    isTablet: width >= 640 && width < 1024,
    isDesktop: width >= 1024,
    width,
  };
}

// ─── LANGUAGES ────────────────────────────────────────────────────────────────
const LANGUAGES = [
  { code: "EN", label: "English" },
  { code: "ES", label: "Español" },
  { code: "FR", label: "Français" },
  { code: "PT", label: "Português" },
];

function detectLanguage() {
  const nav = (navigator.language || "en").toLowerCase().slice(0, 2);
  if (nav === "es") return "ES";
  if (nav === "fr") return "FR";
  if (nav === "pt") return "PT";
  return "EN";
}

// ─── TRANSLATIONS ─────────────────────────────────────────────────────────────
const T = {
  EN: {
    tagline: "BUSINESS OBSERVABILITY FRAMEWORK",
    bossLink: "a Boss.Technology",
    pageTitle: "Build a Chassis.",
    inputInstruction: "BUSINESS TYPE, COMPANY NAME, LOCATION, WEBSITE,\nOR ANY COMBINATION — SEPARATED BY COMMAS.",
    deployHint: "⌘ + ENTER TO DEPLOY · OPENS IN NEW TAB",
    startBtn: "START FABRICATING",
    whatIsChs: "WHAT IS CHASS1S?",
    chsDescription: "CHASS1S is the world's first and only Business Observability Framework — with the power to Architect, Build, and Tune any new or existing business, from an ice cream shop to an airline. For the first time, technology and business are unified into a single powerful vehicle — where every decision, every change, and every insight cascades with full awareness of the whole. Through Business Observability, powered by Applied AI, CHASS1S turns the complexity of running a business into something observable, measurable, and actionable. It is not a platform. It is not a tool. It is the Framework upon which true Business Observability is built.",
    chsCreditBoss: { prefix: "Chassis is brought to you by ", name: "Boss.Technology", suffix: " — a Latin American high-end Business Observability Builder, Tuner, and Brand." },
    chsCreditFederico: { prefix: "Created by ", name: "Federico Lara", suffix: " — Business Observability thought leader, author of Six Steps to Achieve Business Observability, creator of Metric Monetization, and former executive at New Relic and Dynatrace." },
    selectDepth: "SELECT CHASSIS DEPTH",
    tabs: { intro: "INTRO", introSub: "Business Overview", addis: "ADDIS", addisSub: "Technology Layer", blips: "BLIPS", blipsSub: "Business Layer", kbrs: "KBRs", kbrsSub: "Key Business Results" },
    expandAll: "EXPAND ALL", collapseAll: "COLLAPSE ALL",
    sections: "SECTIONS", items: "ITEMS",
    businessProfile: "BUSINESS PROFILE", whyChassis: "CHASSIS", keyValuePoints: "KEY VALUE POINTS", frameworkApplied: "CHASSIS APPLIED",
    addisDesc: "Maps every technology tool, platform, system, and infrastructure component this business depends on.",
    blipsDesc: "Maps every business function and the observable tools and data sources that connect technology performance to business outcomes.",
    kbrTitle: "Key Business Results", kbrsAcross: "KBRs ACROSS", businessAreas: "BUSINESS AREAS",
    metric: "METRIC", target: "TARGET",
    newChassis: "NEW CHASSIS",
    loadingTitle: "PROCESSING",
    loadingSteps: ["ANALYZING BUSINESS TYPE...", "MAPPING ADDIS TECHNOLOGY LAYER...", "BUILDING BLIPS BUSINESS CHASSIS...", "GENERATING KEY BUSINESS RESULTS...", "FABRICATING CHASSIS..."],
    errorTitle: "Something went wrong.", tryAgain: "TRY AGAIN",
    tableHeaders: ["Item", "Type", "Description", "In/Ex", "Environment", "Data"],
    tableHeadersBlips: ["Item", "Source", "Type", "Description", "In/Ex", "Environment", "Data"],
    noItems: "No items generated.",
    tiers: [
      { id: "compact", label: "Compact", description: "Essential overview. Core ADDIS & BLIPS items with focused KBRs. Ideal for quick assessments." },
      { id: "midsize", label: "Mid-Size", description: "Enhanced depth with richer context. More items, fuller descriptions, and expanded real-world factors." },
      { id: "executive", label: "Executive", description: "Comprehensive analysis with detailed context, real-world coverage, and rich KBR targets with industry benchmarks." },
      { id: "luxury", label: "Luxury", description: "Enterprise-grade intelligence. Maximum depth, narrative impact analysis, risk register, quick wins, and full industry context." },
    ],
    examples: ["Airline", "Independent Bookstore, Greenwich CT", "Law Firm, New York, M&A specialists", "High-end NYC Salon", "Regional Coffee Chain, Colombia, 10 locations", "Enterprise SaaS company, B2B software", "Ice cream shop, Miami Beach", "Regional restaurant chain, Texas"],
    beyondProfit: "BEYOND PROFIT",
    beyondProfitSub: "Optional",
    beyondProfitDesc: "Select any initiatives relevant to this business. Results will appear as a dedicated tab.",
    beyondProfitTab: "Beyond Profit",
    beyondProfitTabSub: "Legal, Social & Regulatory Insights",
    bpOptions: { CSR: "CSR", ESG: "ESG", DEI: "DEI", TBL: "TBL", Sustainability: "Sust" },
    bpLabels: { legal: "LEGAL", social: "SOCIAL", regulatory: "REGULATORY", news: "NEWS & DEVELOPMENTS", suggestions: "SUGGESTIONS" },
    pdfControlled: "CONTROLLED",
    pdfUncontrolled: "UNCONTROLLED",
  },
  ES: {
    tagline: "BUSINESS OBSERVABILITY FRAMEWORK",
    bossLink: "una Boss.Technology",
    pageTitle: "Construir un Chassis.",
    inputInstruction: "INGRESE UN TIPO DE NEGOCIO, NOMBRE, UBICACIÓN, SITIO WEB,\nO CUALQUIER COMBINACIÓN — SEPARADOS POR COMAS.",
    deployHint: "⌘ + ENTER PARA DESPLEGAR · SE ABRE EN NUEVA PESTAÑA",
    startBtn: "INICIAR FABRICACIÓN",
    whatIsChs: "¿QUÉ ES CHASS1S?",
    chsDescription: "CHASS1S es el primer y único Business Observability Framework del mundo — con el poder de Arquitectar, Construir y Afinar cualquier negocio nuevo o existente, desde una heladería hasta una aerolínea. Por primera vez, la tecnología y el negocio se unifican en un solo vehículo poderoso — donde cada decisión, cada cambio y cada insight resuena con plena consciencia del conjunto. A través de Business Observability, impulsada por Applied AI, CHASS1S convierte la complejidad de dirigir un negocio en algo observable, medible y accionable. No es una plataforma. No es una herramienta. Es el Framework sobre el cual se construye la verdadera Business Observability.",
    chsCreditBoss: { prefix: "Chassis es traído a ti por ", name: "Boss.Technology", suffix: " — un Business Observability Builder, Tuner y Brand latinoamericano de alta gama." },
    chsCreditFederico: { prefix: "Creado por ", name: "Federico Lara", suffix: " — líder de pensamiento en Business Observability, autor de Six Steps to Achieve Business Observability, creador de Metric Monetization, y ex ejecutivo en New Relic y Dynatrace." },
    selectDepth: "SELECCIONAR PROFUNDIDAD DEL CHASSIS",
    tabs: { intro: "INTRO", introSub: "Perfil del Negocio", addis: "ADDIS", addisSub: "Capa Tecnológica", blips: "BLIPS", blipsSub: "Capa Empresarial", kbrs: "KBRs", kbrsSub: "Key Business Results" },
    expandAll: "EXPANDIR TODO", collapseAll: "COLAPSAR TODO",
    sections: "SECCIONES", items: "ELEMENTOS",
    businessProfile: "PERFIL DEL NEGOCIO", whyChassis: "CHASSIS", keyValuePoints: "PUNTOS DE VALOR CLAVE", frameworkApplied: "CHASSIS APLICADO",
    addisDesc: "Mapea cada herramienta tecnológica, plataforma, sistema y componente de infraestructura del que depende este negocio.",
    blipsDesc: "Mapea cada función empresarial y las fuentes de datos observables que conectan el rendimiento tecnológico con los resultados del negocio.",
    kbrTitle: "Key Business Results", kbrsAcross: "KBRs ACROSS", businessAreas: "BUSINESS AREAS",
    metric: "MÉTRICA", target: "OBJETIVO",
    newChassis: "NUEVO CHASSIS",
    loadingTitle: "PROCESANDO",
    loadingSteps: ["ANALIZANDO TIPO DE NEGOCIO...", "MAPEANDO CAPA TECNOLÓGICA ADDIS...", "CONSTRUYENDO CHASSIS EMPRESARIAL BLIPS...", "GENERANDO RESULTADOS CLAVE DEL NEGOCIO...", "FABRICANDO CHASSIS..."],
    errorTitle: "Algo salió mal.", tryAgain: "INTENTAR DE NUEVO",
    tableHeaders: ["Elemento", "Tipo", "Descripción", "Int/Ext", "Entorno", "Datos"],
    tableHeadersBlips: ["Elemento", "Fuente", "Tipo", "Descripción", "Int/Ext", "Entorno", "Datos"],
    noItems: "No se generaron elementos.",
    tiers: [
      { id: "compact", label: "Compacto", description: "Visión esencial. Elementos básicos de ADDIS y BLIPS con KBRs enfocados. Ideal para evaluaciones rápidas." },
      { id: "midsize", label: "Mediano", description: "Mayor profundidad con más contexto. Más elementos, descripciones completas y factores del mundo real ampliados." },
      { id: "executive", label: "Ejecutivo", description: "Análisis exhaustivo con contexto detallado, cobertura del mundo real y KBRs enriquecidos con benchmarks de la industria." },
      { id: "luxury", label: "Lujo", description: "Inteligencia empresarial de nivel superior. Máxima profundidad, análisis de impacto narrativo, registro de riesgos y victorias rápidas." },
    ],
    examples: ["Aerolínea", "Librería independiente, Greenwich CT", "Firma de abogados, Nueva York, M&A", "Salón de lujo en NYC", "Cadena de café regional, Colombia, 10 ubicaciones", "Empresa SaaS empresarial, software B2B", "Heladería, Miami Beach", "Cadena de restaurantes regional, Texas"],
    beyondProfit: "BEYOND PROFIT",
    beyondProfitSub: "Opcional",
    beyondProfitDesc: "Seleccione las iniciativas relevantes para este negocio. Los resultados aparecerán como una pestaña dedicada.",
    beyondProfitTab: "Beyond Profit",
    beyondProfitTabSub: "Perspectivas Legales, Sociales y Regulatorias",
    bpOptions: { CSR: "RSC", ESG: "ESG", DEI: "DEI", TBL: "TBL", Sustainability: "Sust" },
    bpLabels: { legal: "LEGAL", social: "SOCIAL", regulatory: "REGULATORIO", news: "NOTICIAS Y DESARROLLOS", suggestions: "SUGERENCIAS" },
    pdfControlled: "CONTROLADO",
    pdfUncontrolled: "NO CONTROLADO",
  },
  FR: {
    tagline: "BUSINESS OBSERVABILITY FRAMEWORK",
    bossLink: "une Boss.Technology",
    pageTitle: "Construire un Chassis.",
    inputInstruction: "SAISISSEZ UN TYPE D'ENTREPRISE, NOM, LIEU, SITE WEB,\nOU TOUTE COMBINAISON — SÉPARÉS PAR DES VIRGULES.",
    deployHint: "⌘ + ENTRÉE POUR DÉPLOYER · OUVRE DANS UN NOUVEL ONGLET",
    startBtn: "COMMENCER LA FABRICATION",
    whatIsChs: "QU'EST-CE QUE CHASS1S?",
    chsDescription: "CHASS1S est le premier et unique Business Observability Framework au monde — avec le pouvoir d'Architecturer, Construire et Ajuster toute entreprise nouvelle ou existante, d'un glacier à une compagnie aérienne. Pour la première fois, la technologie et l'entreprise sont unifiées en un seul véhicule puissant — où chaque décision, chaque changement et chaque insight se répercute avec une pleine conscience de l'ensemble. À travers Business Observability, propulsée par Applied AI, CHASS1S transforme la complexité de gérer une entreprise en quelque chose d'observable, mesurable et actionnable. Ce n'est pas une plateforme. Ce n'est pas un outil. C'est le Framework sur lequel repose le véritable Business Observability.",
    chsCreditBoss: { prefix: "Chassis vous est proposé par ", name: "Boss.Technology", suffix: " — un Business Observability Builder, Tuner et Brand latino-américain haut de gamme." },
    chsCreditFederico: { prefix: "Créé par ", name: "Federico Lara", suffix: " — leader d'opinion en Business Observability, auteur de Six Steps to Achieve Business Observability, créateur de Metric Monetization, et ancien dirigeant chez New Relic et Dynatrace." },
    selectDepth: "SÉLECTIONNER LA PROFONDEUR DU CHASSIS",
    tabs: { intro: "INTRO", introSub: "Profil de l'Entreprise", addis: "ADDIS", addisSub: "Couche Technologique", blips: "BLIPS", blipsSub: "Couche Métier", kbrs: "KBRs", kbrsSub: "Key Business Results" },
    expandAll: "TOUT DÉVELOPPER", collapseAll: "TOUT RÉDUIRE",
    sections: "SECTIONS", items: "ÉLÉMENTS",
    businessProfile: "PROFIL DE L'ENTREPRISE", whyChassis: "CHASSIS", keyValuePoints: "POINTS DE VALEUR CLÉS", frameworkApplied: "CHASSIS APPLIQUÉ",
    addisDesc: "Cartographie chaque outil technologique, plateforme, système et composant d'infrastructure dont dépend cette entreprise.",
    blipsDesc: "Cartographie chaque fonction métier et les sources de données observables qui relient la performance technologique aux résultats commerciaux.",
    kbrTitle: "Key Business Results", kbrsAcross: "KBRs ACROSS", businessAreas: "BUSINESS AREAS",
    metric: "MÉTRIQUE", target: "OBJECTIF",
    newChassis: "NOUVEAU CHASSIS",
    loadingTitle: "TRAITEMENT EN COURS",
    loadingSteps: ["ANALYSE DU TYPE D'ENTREPRISE...", "CARTOGRAPHIE DE LA COUCHE ADDIS...", "CONSTRUCTION DU CHASSIS BLIPS...", "GÉNÉRATION DES RÉSULTATS CLÉS...", "FABRICATION DU CHASSIS..."],
    errorTitle: "Une erreur s'est produite.", tryAgain: "RÉESSAYER",
    tableHeaders: ["Élément", "Type", "Description", "Int/Ext", "Environnement", "Données"],
    tableHeadersBlips: ["Élément", "Source", "Type", "Description", "Int/Ext", "Environnement", "Données"],
    noItems: "Aucun élément généré.",
    tiers: [
      { id: "compact", label: "Compact", description: "Vue d'ensemble essentielle. Éléments ADDIS et BLIPS principaux avec des KBRs ciblés. Idéal pour les évaluations rapides." },
      { id: "midsize", label: "Moyen", description: "Profondeur enrichie avec plus de contexte. Plus d'éléments, descriptions complètes et facteurs réels élargis." },
      { id: "executive", label: "Exécutif", description: "Analyse complète avec contexte détaillé, couverture approfondie et KBRs enrichis avec des benchmarks sectoriels." },
      { id: "luxury", label: "Luxe", description: "Intelligence de niveau entreprise. Profondeur maximale, analyse narrative, registre des risques et gains rapides." },
    ],
    examples: ["Compagnie aérienne", "Librairie indépendante, Greenwich CT", "Cabinet d'avocats, New York, M&A", "Salon haut de gamme à NYC", "Chaîne de café régionale, Colombie, 10 sites", "Entreprise SaaS, logiciel B2B", "Glacier, Miami Beach", "Chaîne de restaurants régionale, Texas"],
    beyondProfit: "BEYOND PROFIT",
    beyondProfitSub: "Optionnel",
    beyondProfitDesc: "Sélectionnez les initiatives pertinentes pour cette entreprise. Les résultats apparaîtront dans un onglet dédié.",
    beyondProfitTab: "Beyond Profit",
    beyondProfitTabSub: "Perspectives Juridiques, Sociales et Réglementaires",
    bpOptions: { CSR: "RSE", ESG: "ESG", DEI: "DEI", TBL: "TBL", Sustainability: "Sust" },
    bpLabels: { legal: "JURIDIQUE", social: "SOCIAL", regulatory: "RÉGLEMENTAIRE", news: "ACTUALITÉS", suggestions: "SUGGESTIONS" },
    pdfControlled: "CONTRÔLÉ",
    pdfUncontrolled: "NON CONTRÔLÉ",
  },
  PT: {
    tagline: "BUSINESS OBSERVABILITY FRAMEWORK",
    bossLink: "uma Boss.Technology",
    pageTitle: "Construa um Chassis.",
    inputInstruction: "INSIRA UM TIPO DE NEGÓCIO, NOME DE EMPRESA, LOCALIZAÇÃO, SITE,\nOU QUALQUER COMBINAÇÃO — SEPARADOS POR VÍRGULAS.",
    deployHint: "⌘ + ENTER PARA IMPLANTAR · ABRE EM NOVA ABA",
    startBtn: "INICIAR FABRICAÇÃO",
    whatIsChs: "O QUE É CHASS1S?",
    chsDescription: "CHASS1S é o primeiro e único Business Observability Framework do mundo — com o poder de Arquitetar, Construir e Afinar qualquer negócio novo ou existente, de uma sorveteria a uma companhia aérea. Pela primeira vez, tecnologia e negócio são unificados em um único veículo poderoso — onde cada decisão, cada mudança e cada insight reverbera com plena consciência do todo. Através de Business Observability, impulsionado por Applied AI, CHASS1S transforma a complexidade de gerir um negócio em algo observável, mensurável e acionável. Não é uma plataforma. Não é uma ferramenta. É o Framework sobre o qual se constrói o verdadeiro Business Observability.",
    chsCreditBoss: { prefix: "Chassis é trazido a você pela ", name: "Boss.Technology", suffix: " — uma Business Observability Builder, Tuner e Brand latino-americana de alto padrão." },
    chsCreditFederico: { prefix: "Criado por ", name: "Federico Lara", suffix: " — líder de pensamento em Business Observability, autor de Six Steps to Achieve Business Observability, criador de Metric Monetization, e ex-executivo na New Relic e Dynatrace." },
    selectDepth: "SELECIONAR PROFUNDIDADE DO CHASSIS",
    tabs: { intro: "INTRO", introSub: "Perfil do Negócio", addis: "ADDIS", addisSub: "Camada Tecnológica", blips: "BLIPS", blipsSub: "Camada de Negócio", kbrs: "KBRs", kbrsSub: "Key Business Results" },
    expandAll: "EXPANDIR TUDO", collapseAll: "RECOLHER TUDO",
    sections: "SEÇÕES", items: "ITENS",
    businessProfile: "PERFIL DO NEGÓCIO", whyChassis: "CHASSIS", keyValuePoints: "PONTOS-CHAVE DE VALOR", frameworkApplied: "CHASSIS APLICADO",
    addisDesc: "Mapeia cada ferramenta tecnológica, plataforma, sistema e componente de infraestrutura dos quais este negócio depende.",
    blipsDesc: "Mapeia cada função de negócio e as fontes de dados observáveis que conectam o desempenho tecnológico aos resultados de negócio.",
    kbrTitle: "Key Business Results", kbrsAcross: "KBRs ACROSS", businessAreas: "BUSINESS AREAS",
    metric: "MÉTRICA", target: "META",
    newChassis: "NOVO CHASSIS",
    loadingTitle: "PROCESSANDO",
    loadingSteps: ["ANALISANDO TIPO DE NEGÓCIO...", "MAPEANDO CAMADA TECNOLÓGICA ADDIS...", "CONSTRUINDO CHASSIS DE NEGÓCIO BLIPS...", "GERANDO RESULTADOS-CHAVE DE NEGÓCIO...", "FABRICANDO CHASSIS..."],
    errorTitle: "Algo deu errado.", tryAgain: "TENTAR NOVAMENTE",
    tableHeaders: ["Item", "Tipo", "Descrição", "Int/Ext", "Ambiente", "Dados"],
    tableHeadersBlips: ["Item", "Fonte", "Tipo", "Descrição", "Int/Ext", "Ambiente", "Dados"],
    noItems: "Nenhum item gerado.",
    tiers: [
      { id: "compact", label: "Compacto", description: "Visão essencial. Itens principais de ADDIS e BLIPS com KBRs focados. Ideal para avaliações rápidas." },
      { id: "midsize", label: "Médio", description: "Profundidade aprimorada com contexto mais rico. Mais itens, descrições completas e fatores do mundo real ampliados." },
      { id: "executive", label: "Executivo", description: "Análise abrangente com contexto detalhado, cobertura do mundo real e KBRs enriquecidos com benchmarks setoriais." },
      { id: "luxury", label: "Luxo", description: "Inteligência de nível empresarial. Profundidade máxima, análise narrativa de impacto, registro de riscos e vitórias rápidas." },
    ],
    examples: ["Companhia aérea", "Livraria independente, Greenwich CT", "Escritório de advocacia, Nova York, M&A", "Salão de alto padrão em NYC", "Rede regional de cafés, Colômbia, 10 unidades", "Empresa SaaS empresarial, software B2B", "Sorveteria, Miami Beach", "Rede regional de restaurantes, Texas"],
    beyondProfit: "BEYOND PROFIT",
    beyondProfitSub: "Opcional",
    beyondProfitDesc: "Selecione as iniciativas relevantes para este negócio. Os resultados aparecerão em uma aba dedicada.",
    beyondProfitTab: "Beyond Profit",
    beyondProfitTabSub: "Insights Jurídicos, Sociais e Regulatórios",
    bpOptions: { CSR: "RSC", ESG: "ESG", DEI: "DEI", TBL: "TBL", Sustainability: "Sust" },
    bpLabels: { legal: "JURÍDICO", social: "SOCIAL", regulatory: "REGULATÓRIO", news: "NOTÍCIAS E DESENVOLVIMENTOS", suggestions: "SUGESTÕES" },
    pdfControlled: "CONTROLADO",
    pdfUncontrolled: "NÃO CONTROLADO",
  },
};

// ─── TIER CONFIG ──────────────────────────────────────────────────────────────
const TIER_CONFIG = [
  { id: "compact", tokens: 16000, addisCount: "5–7", blipsCount: "4–6", kbrCount: "3–4", descLength: "1 sentence max per field", extras: "" },
  { id: "midsize", tokens: 20000, addisCount: "8–10", blipsCount: "6–8", kbrCount: "4–5", descLength: "1–2 sentences per field", extras: "Include 2–3 real-world factors per relevant BLIPS section." },
  { id: "executive", tokens: 28000, addisCount: "10–12", blipsCount: "8–10", kbrCount: "5–6", descLength: "2 sentences per field", extras: "Include 3–4 real-world factors per relevant BLIPS section. Add industry-specific benchmarks to KBR targets." },
  { id: "luxury", tokens: 40000, addisCount: "12–15", blipsCount: "10–12", kbrCount: "6–7", descLength: "2–3 sentences per field with specific business context", extras: `Include 4–5 real-world factors per relevant BLIPS section with detailed impact descriptions.\nAlso add these extra top-level JSON fields:\n"benefits": { "BizOps": "paragraph", "Logistics": "paragraph", "Inventory": "paragraph", "Production": "paragraph", "Sales": "paragraph" },\n"risks": [{ "title": "Risk title", "area": "ADDIS or BLIPS area", "severity": "High/Medium/Low", "description": "What this risk is and how Chassis detects it" }],\n"quickWins": [{ "title": "Quick win title", "description": "Specific immediate observability improvement", "impact": "Expected business impact" }]\nGenerate 5 risks and 5 quick wins.` },
];

function getTiers(lang) {
  return TIER_CONFIG.map((cfg, i) => ({ ...cfg, ...T[lang].tiers[i] }));
}

// ─── PROMPT ───────────────────────────────────────────────────────────────────
function buildPrompt(userInput, tier, lang) {
  const langName = LANGUAGES.find(l => l.code === lang)?.label || "English";
  const langInstruction = lang === "PT" ? "Brazilian Portuguese (Português do Brasil) — use Brazilian spelling and vocabulary, not European Portuguese" : langName;
  return `You are a business observability expert building a CHASS1S Chassis analysis. The user has provided: "${userInput}"

CRITICAL: Generate ALL text content in ${langInstruction}. Every description, value point, KBR title, and narrative must be written natively in ${langInstruction}.

Tier: ${tier.label} — ${tier.description}

Respond ONLY with a valid JSON object — no markdown, no backticks, no preamble, no trailing text:

{
  "business": {
    "name": "Business name",
    "type": "Business type",
    "location": "Location or empty string",
    "website": "Website or empty string",
    "established": "Year or empty string",
    "description": "2-3 sentence description in ${langInstruction}",
    "whyChassis": "2-3 concise, goal-driven sentences in ${langInstruction} describing specifically how this business can use Chassis to Architect, Build, and Tune its operations. Focus on outcomes and business goals, not generic benefits. Reference the actual business type throughout.",
    "chassisValue": ["point 1", "point 2", "point 3", "point 4", "point 5"],
    "about": [
      { "label": "Business Type", "value": "..." },
      { "label": "Location", "value": "..." },
      { "label": "Industry", "value": "..." },
      { "label": "Key Operations", "value": "..." },
      { "label": "Digital Presence", "value": "..." },
      { "label": "Key Dependencies", "value": "..." }
    ]
  },
  "addis": {
    "Apps": [{ "item": "...", "type": "...", "description": "...", "inEx": "Internal or External", "env": "Controlled or Uncontrolled", "data": "..." }],
    "Data": [{ "item": "...", "type": "...", "description": "...", "inEx": "Internal or External", "env": "Controlled or Uncontrolled", "data": "..." }],
    "Dev": [{ "item": "...", "type": "...", "description": "...", "inEx": "Internal or External", "env": "Controlled or Uncontrolled", "data": "..." }],
    "Infrastructure": [{ "item": "...", "type": "...", "description": "...", "inEx": "Internal or External", "env": "Controlled or Uncontrolled", "data": "..." }],
    "Systems": [{ "item": "...", "type": "...", "description": "...", "inEx": "Internal or External", "env": "Controlled or Uncontrolled", "data": "..." }]
  },
  "blips": {
    "BizOps": [{ "item": "...", "source": "...", "type": "...", "description": "...", "inEx": "Internal or External", "env": "Controlled or Uncontrolled or Uncontrolled, Real World", "data": "..." }],
    "Logistics": [{ "item": "...", "source": "...", "type": "...", "description": "...", "inEx": "Internal or External", "env": "Controlled or Uncontrolled or Uncontrolled, Real World", "data": "..." }],
    "Inventory": [{ "item": "...", "source": "...", "type": "...", "description": "...", "inEx": "Internal or External", "env": "Controlled or Uncontrolled or Uncontrolled, Real World", "data": "..." }],
    "Production": [{ "item": "...", "source": "...", "type": "...", "description": "...", "inEx": "Internal or External", "env": "Controlled or Uncontrolled or Uncontrolled, Real World", "data": "..." }],
    "Sales": [{ "item": "...", "source": "...", "type": "...", "description": "...", "inEx": "Internal or External", "env": "Controlled or Uncontrolled or Uncontrolled, Real World", "data": "..." }]
  },
  "kbrs": [
    { "area": "BizOps", "icon": "✦", "results": [{ "kbr": "...", "description": "...", "metric": "...", "target": "..." }] },
    { "area": "Logistics", "icon": "⬢", "results": [{ "kbr": "...", "description": "...", "metric": "...", "target": "..." }] },
    { "area": "Inventory", "icon": "▤", "results": [{ "kbr": "...", "description": "...", "metric": "...", "target": "..." }] },
    { "area": "Production", "icon": "⚙", "results": [{ "kbr": "...", "description": "...", "metric": "...", "target": "..." }] },
    { "area": "Sales", "icon": "◎", "results": [{ "kbr": "...", "description": "...", "metric": "...", "target": "..." }] }
  ]
}

Rules:
- ALL text values in ${langInstruction}
- ${tier.addisCount} items per ADDIS section, ${tier.blipsCount} per BLIPS section, ${tier.kbrCount} KBRs per area
- Descriptions: ${tier.descLength}
- Be highly specific to this exact business type
- env: ONLY "Controlled", "Uncontrolled", or "Uncontrolled, Real World"
- inEx: ONLY "Internal" or "External"
- ${tier.extras || "Include 1–2 real-world factors tagged 'Uncontrolled, Real World' in relevant BLIPS sections."}
- BLIPS data = business observability data. ADDIS data = tech metrics.

═══════════════════════════════════════════════════════════════════════
CRITICAL ADDIS DEFINITIONS — ADDIS IS STRICTLY THE TECHNOLOGY LAYER
═══════════════════════════════════════════════════════════════════════
ADDIS must ONLY contain actual technology products, platforms, tools, and infrastructure — NEVER business processes, business datasets described in technical words, or business capabilities. If the entry could be something this business *does*, it belongs in BLIPS, not ADDIS. If the entry is a tool/product/platform this business *uses*, it belongs in ADDIS.

The "item" field in ADDIS must be the ACTUAL NAME of a real product, tool, or platform — never a generic business concept. Prefer specific brand names where reasonable to infer (e.g., "Shopify," "Salesforce," "AWS RDS," "GitHub," "Datadog"). If a generic name must be used, it must refer to a concrete technology category (e.g., "PostgreSQL Database," not "Customer Data").

── Apps ────────────────────────────────────────────────────────────────
DEFINITION: Specific software applications this business uses day-to-day — SaaS platforms, mobile/web apps, productivity tools, industry-specific applications.
EXAMPLES OF VALID ITEMS: "Shopify," "Salesforce CRM," "QuickBooks Online," "Slack," "WhatsApp Business," "Microsoft 365," "HubSpot," "SAP Business One," "Toast POS," "Mailchimp"
EXAMPLES OF INVALID ITEMS: "Sales Management App" (too generic — name the actual tool), "Order Processing Application" (describe the actual product), "Customer Portal" (unless it's the literal product name)

── Data ────────────────────────────────────────────────────────────────
DEFINITION: Databases, data warehouses, data lakes, data pipelines, BI tools, and data storage platforms — the TECHNOLOGY that holds or processes data. NEVER business datasets described in technical words.
EXAMPLES OF VALID ITEMS: "PostgreSQL Database," "Snowflake Data Warehouse," "AWS S3 Storage," "Google BigQuery," "Tableau," "Power BI," "Airflow Data Pipeline," "MongoDB," "Redis Cache," "Elasticsearch"
EXAMPLES OF INVALID ITEMS: "Sales History Data" (that's a dataset, not a technology — use the platform that holds it), "Customer Database" (be specific: is it PostgreSQL? Salesforce data? MySQL?), "Inventory Data Records," "Production Cost Data," "Quality Certification Data"

── Dev ─────────────────────────────────────────────────────────────────
DEFINITION: Development tools, version control, CI/CD pipelines, APIs consumed, coding platforms, testing frameworks, deployment tools. The technology used to BUILD and MAINTAIN software.
EXAMPLES OF VALID ITEMS: "GitHub," "GitLab CI/CD," "Docker," "Kubernetes," "Visual Studio Code," "Weather API (OpenWeather)," "Stripe API," "Postman," "Jenkins," "Jira," "Terraform"
EXAMPLES OF INVALID ITEMS: "Export Documentation Portal" (this is an application, not a dev tool — belongs in Apps or Systems), "Demand Forecasting Tool" (belongs in Apps if it's a product, or in BLIPS as a business capability), "Automated Reporting Workflow" (describe the actual tool: Zapier? n8n? Power Automate?)

── Infrastructure ─────────────────────────────────────────────────────
DEFINITION: Servers, cloud platforms, networks, databases hardware, IoT devices, hosting providers, CDNs, hardware equipment, backup systems. The physical and virtual foundation.
EXAMPLES OF VALID ITEMS: "AWS EC2," "Azure App Service," "Cloudflare CDN," "Cisco Meraki Network," "NVIDIA GPU Cluster," "IoT Temperature Sensors," "On-premises Dell Servers," "Linksys Wi-Fi Infrastructure"
EXAMPLES OF INVALID ITEMS: "Electrical Grid and Backup Power" (utilities belong in BLIPS BizOps, not Infrastructure), "Cold Storage Chambers" (that's operational equipment/production, not tech infrastructure), "Production Equipment"

── Systems ────────────────────────────────────────────────────────────
DEFINITION: Enterprise-scale technology platforms that orchestrate operations. ERP, SCM, WMS, MES, SIEM, CRM platforms at enterprise scale. NEVER business methodologies or business processes.
EXAMPLES OF VALID ITEMS: "SAP S/4HANA," "Oracle NetSuite," "Microsoft Dynamics 365," "Salesforce Enterprise," "Manhattan WMS," "Siemens MES," "Splunk SIEM," "ServiceNow"
EXAMPLES OF INVALID ITEMS: "HACCP Quality System" (HACCP is a methodology/certification, not a technology platform — the tech would be the software that implements it), "Export Management System" (too vague — name the actual platform), "Traceability System" (name the platform: is it SAP ATTP? A custom system?)

═══════════════════════════════════════════════════════════════════════
BLIPS "source" FIELD: Every BLIPS item MUST include a "source" field naming the specific technology source(s) that produce the business observability data for that item. The source should be the actual name of an App, API, Machine, Database, or System — ideally matching an item already listed in this business's ADDIS layer. Multiple sources can be listed separated by " + " (e.g., "Shopify + QuickBooks Online"). Prefer specific brand/product names. Examples: "Shopify" (for e-commerce revenue), "Stripe API" (for payment data), "Siemens MES" (for production metrics), "IoT Temperature Sensors + SAP S/4HANA" (for cold chain monitoring), "Salesforce CRM + HubSpot" (for customer data). If the source is truly external and not in ADDIS, still name it specifically (e.g., "Weather API (OpenWeather)", "Bloomberg Terminal").

KEY PRINCIPLE: ADDIS describes the TECHNOLOGY STACK. BLIPS describes the BUSINESS OPERATIONS. A good test — if a CIO would list it on a technology inventory, it goes in ADDIS. If a COO would list it on a business process inventory, it goes in BLIPS.
═══════════════════════════════════════════════════════════════════════

- AI TOOLS & INITIATIVES: Wherever this business is genuinely using AI — tools, agents, models, third-party AI services, automation — include them as natural line items within the relevant ADDIS and BLIPS sections. AI appears in Apps (ChatGPT Enterprise, Claude, Copilot, chatbots), Dev (GitHub Copilot, Cursor, AI testing tools), Infrastructure (AI monitoring platforms like Datadog AI, anomaly detection), Systems (AI-enabled ERP modules), and across all BLIPS areas (demand forecasting initiatives, customer personalization programs, route optimization). Do NOT create a separate AI section. Do NOT force AI inclusion where it does not apply. Only surface AI where it is genuinely relevant to this specific business type. The deeper the tier, the more AI initiatives should be surfaced where applicable.
- Return ONLY the JSON object.`;
}


// ─── BEYOND PROFIT PROMPT ────────────────────────────────────────────────────
const BP_FULL_NAMES = {
  CSR: "Corporate Social Responsibility (CSR)",
  ESG: "Environmental, Social, and Governance (ESG)",
  DEI: "Diversity, Equity, and Inclusion (DEI)",
  TBL: "Triple Bottom Line (TBL)",
  Sustainability: "Sustainability",
};

function buildBeyondProfitPrompt(userInput, tier, lang, selectedOptions) {
  const langName = LANGUAGES.find(l => l.code === lang)?.label || "English";
  const langInstruction = lang === "PT" ? "Brazilian Portuguese (Português do Brasil) — use Brazilian spelling and vocabulary, not European Portuguese" : langName;
  const optionNames = selectedOptions.map(o => BP_FULL_NAMES[o] || o).join(", ");
  const itemCount = tier.id === "compact" ? "2-3" : tier.id === "midsize" ? "3-4" : tier.id === "executive" ? "4-5" : "5-6";

  const optionBlocks = selectedOptions.map(opt => {
    const fullName = BP_FULL_NAMES[opt] || opt;
    return [
      '"' + opt + '": {',
      '  "title": "' + fullName + '",',
      '  "summary": "2-3 sentence overview of what ' + opt + ' means specifically for this business type and why it matters",',
      '  "legal": [{ "title": "Legal requirement or framework title", "description": "Specific legal obligation, standard, or framework relevant to this business in its jurisdiction" }],',
      '  "social": [{ "title": "Social consideration title", "description": "Specific community, stakeholder, or social impact consideration for this business" }],',
      '  "regulatory": [{ "title": "Regulatory body or regulation", "description": "Specific current or emerging regulation this business must be aware of" }],',
      '  "news": [{ "title": "Recent development headline", "description": "Recent industry news, trend, or development relevant to ' + opt + ' for this business type" }],',
      '  "suggestions": [{ "title": "Actionable suggestion", "description": "Specific, practical recommendation for this business to improve its ' + opt + ' performance" }]',
      '}'
    ].join("\n");
  }).join(",\n");

  return "You are a business observability and corporate responsibility expert. The business is: \"" + userInput + "\"\n\n" +
    "CRITICAL: Generate ALL text content in " + langInstruction + ".\n\n" +
    "The user has selected these Beyond Profit initiatives: " + optionNames + "\n\n" +
    "For each selected initiative, provide contextual, specific, and actionable insights relevant to THIS specific business type, location, and industry. Tier: " + tier.label + ".\n\n" +
    "Respond ONLY with a valid JSON object — no markdown, no backticks, no preamble:\n\n" +
    "{\n" + optionBlocks + "\n}\n\n" +
    "Rules:\n" +
    "- ALL text in " + langInstruction + "\n" +
    "- Be highly specific to this exact business type and location\n" +
    "- Legal: actual laws, standards (ISO, GRI, etc.), compliance requirements\n" +
    "- Social: real stakeholder groups, community impact, employee considerations\n" +
    "- Regulatory: actual regulatory bodies and real regulations (SEC, EU taxonomy, local laws)\n" +
    "- News: real recent trends and developments in this industry for " + optionNames + "\n" +
    "- Suggestions: practical, achievable, specific to this business — not generic platitudes\n" +
    "- Each section must have exactly " + itemCount + " items\n" +
    "- Return ONLY the JSON object.";
}

// ─── AUTH MODAL ───────────────────────────────────────────────────────────────
const SOCIAL_PROVIDERS = [
  {
    id: "google", label: "Continue with Google",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24">
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
      </svg>
    ),
  },
  {
    id: "linkedin_oidc", label: "Continue with LinkedIn",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="#0A66C2">
        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
      </svg>
    ),
  },
  {
    id: "facebook", label: "Continue with Facebook",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="#1877F2">
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
      </svg>
    ),
  },
  {
    id: "github", label: "Continue with GitHub",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="#24292F">
        <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/>
      </svg>
    ),
  },
];

function AuthModal({ onClose, onSuccess, initialMode = "signin" }) {
  const [mode, setMode] = useState(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const overlayRef = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  const handleOAuth = async (provider) => {
    setOauthLoading(provider); setError("");
    await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: window.location.origin },
    });
    setOauthLoading(null);
  };

  const handleSubmit = async () => {
    if (!email || !password) return;
    setLoading(true); setError(""); setSuccess("");
    if (mode === "signin") {
      const { data, error: err } = await supabase.auth.signInWithPassword({ email, password });
      if (err) setError(err.message);
      else { onSuccess(data.user); onClose(); }
    } else {
      const { error: err } = await supabase.auth.signUp({ email, password });
      if (err) setError(err.message);
      else setSuccess("Account created! Check your email to confirm, then sign in.");
    }
    setLoading(false);
  };

  const inputStyle = {
    width: "100%", padding: "12px 14px", fontFamily: "'Georgia', serif", fontSize: 14,
    border: "1px solid #d0d0d0", outline: "none", boxSizing: "border-box",
    background: "#fff", color: "#000", borderRadius: 2, marginBottom: 14,
  };
  const labelStyle = {
    fontFamily: "'Courier New', monospace", fontSize: 10, color: "#888",
    letterSpacing: "0.12em", display: "block", marginBottom: 6,
  };

  return (
    <div ref={overlayRef}
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", zIndex: 1000,
        display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
        overflowY: "auto" }}>
      <div style={{ background: "#fff", width: "100%", maxWidth: 400, padding: "36px 32px",
        position: "relative", boxShadow: "0 20px 60px rgba(0,0,0,0.3)", margin: "auto" }}>

        {/* Close */}
        <button onClick={onClose}
          style={{ position: "absolute", top: 14, right: 14, background: "none", border: "none",
            cursor: "pointer", fontSize: 18, color: "#aaa", lineHeight: 1, padding: 4 }}>✕</button>

        {/* Header */}
        <div style={{ fontFamily: "'Courier New', monospace", fontSize: 9, color: "#aaa",
          letterSpacing: "0.2em", marginBottom: 6 }}>CHASS1S · BUSINESS OBSERVABILITY FRAMEWORK</div>
        <h2 style={{ fontSize: 20, fontWeight: 900, margin: "0 0 24px", fontFamily: "'Georgia', serif", color: "#000" }}>
          {mode === "signin" ? "Sign In to CHASS1S" : "Create Your Account"}
        </h2>

        {/* ── Social Login Buttons ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
          {SOCIAL_PROVIDERS.map(({ id, label, icon }) => (
            <button key={id} onClick={() => handleOAuth(id)}
              disabled={!!oauthLoading}
              style={{ display: "flex", alignItems: "center", gap: 12, width: "100%",
                padding: "11px 14px", background: "#fff", border: "1px solid #d0d0d0",
                cursor: "pointer", borderRadius: 2, transition: "all 0.15s",
                opacity: oauthLoading && oauthLoading !== id ? 0.5 : 1 }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = "#000"; e.currentTarget.style.background = "#f8f8f8"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = "#d0d0d0"; e.currentTarget.style.background = "#fff"; }}>
              <span style={{ flexShrink: 0, display: "flex", alignItems: "center" }}>{icon}</span>
              <span style={{ fontFamily: "'Courier New', monospace", fontSize: 11, fontWeight: 700,
                color: "#000", letterSpacing: "0.04em", flex: 1, textAlign: "left" }}>
                {oauthLoading === id ? "REDIRECTING..." : label}
              </span>
            </button>
          ))}
        </div>

        {/* ── OR Divider ── */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
          <div style={{ flex: 1, height: 1, background: "#e0e0e0" }} />
          <span style={{ fontFamily: "'Courier New', monospace", fontSize: 10, color: "#bbb",
            letterSpacing: "0.1em" }}>OR</span>
          <div style={{ flex: 1, height: 1, background: "#e0e0e0" }} />
        </div>

        {/* ── Mode tabs ── */}
        <div style={{ display: "flex", marginBottom: 20, borderBottom: "2px solid #e0e0e0" }}>
          {[["signin", "SIGN IN"], ["signup", "CREATE ACCOUNT"]].map(([m, label]) => (
            <button key={m} onClick={() => { setMode(m); setError(""); setSuccess(""); }}
              style={{ padding: "7px 16px", border: "none", background: "none", cursor: "pointer",
                fontFamily: "'Courier New', monospace", fontSize: 11, fontWeight: 900,
                color: mode === m ? "#000" : "#bbb", letterSpacing: "0.08em",
                borderBottom: mode === m ? "2px solid #000" : "2px solid transparent", marginBottom: -2 }}>
              {label}
            </button>
          ))}
        </div>

        {/* ── Email / Password fields ── */}
        <label style={labelStyle}>EMAIL ADDRESS</label>
        <input type="email" value={email} onChange={e => setEmail(e.target.value)}
          style={inputStyle} placeholder="your@email.com"
          onKeyDown={e => { if (e.key === "Enter") handleSubmit(); }} />
        <label style={labelStyle}>PASSWORD</label>
        <input type="password" value={password} onChange={e => setPassword(e.target.value)}
          style={inputStyle} placeholder="••••••••"
          onKeyDown={e => { if (e.key === "Enter") handleSubmit(); }} />

        {/* Messages */}
        {error && (
          <div style={{ background: "#fff5f5", border: "1px solid #ffcccc", padding: "10px 14px",
            marginBottom: 14, fontFamily: "'Courier New', monospace", fontSize: 11, color: "#cc0000",
            lineHeight: 1.5, borderRadius: 2 }}>{error}</div>
        )}
        {success && (
          <div style={{ background: "#f0fff4", border: "1px solid #b2f5c8", padding: "10px 14px",
            marginBottom: 14, fontFamily: "'Courier New', monospace", fontSize: 11, color: "#006633",
            lineHeight: 1.5, borderRadius: 2 }}>{success}</div>
        )}

        {/* Submit */}
        <button onClick={handleSubmit} disabled={loading || !email || !password}
          style={{ width: "100%", padding: "13px", border: "none",
            cursor: email && password ? "pointer" : "not-allowed",
            background: email && password ? "#000" : "#e8e8e8",
            color: email && password ? "#fff" : "#aaa",
            fontFamily: "'Courier New', monospace", fontSize: 12, fontWeight: 900,
            letterSpacing: "0.15em", transition: "all 0.15s", borderRadius: 2 }}>
          {loading ? "PROCESSING..." : mode === "signin" ? "SIGN IN" : "CREATE ACCOUNT"}
        </button>

        {mode === "signup" && (
          <p style={{ fontFamily: "'Courier New', monospace", fontSize: 10, color: "#888",
            textAlign: "center", lineHeight: 1.8, margin: "14px 0 0" }}>
            New accounts receive{" "}
            <strong style={{ color: "#000" }}>5 FREE TOKENS</strong>
            {" "}— no credit card required.
          </p>
        )}
      </div>
    </div>
  );
}

// ─── TOKEN PURCHASE MODAL ─────────────────────────────────────────────────────
function TokenPurchaseModal({ user, profile, onClose, onTokensAdded }) {
  const [amountStr, setAmountStr] = useState("25.00");
  const [promoCode, setPromoCode] = useState("");
  const [promoApplied, setPromoApplied] = useState(false);
  const [promoError, setPromoError] = useState("");
  const [promoBonus, setPromoBonus] = useState(0);
  const [success, setSuccess] = useState("");
  const overlayRef = useRef(null);

  useEffect(() => {
    const h = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);

  const amountNum = parseFloat(amountStr) || 0;
  const isValid = amountNum >= 25 && amountNum <= 1000;

  const getVolumeBonus = (amt) => {
    if (amt >= 500) return 0.30;
    if (amt >= 250) return 0.25;
    if (amt >= 100) return 0.20;
    if (amt >= 50) return 0.10;
    return 0;
  };

  const volumeBonusPct = getVolumeBonus(amountNum);
  const baseTokens = isValid ? amountNum : 0;
  const volumeBonusTokens = Math.round(baseTokens * volumeBonusPct * 100) / 100;
  const promoTokens = promoApplied ? promoBonus : 0;
  const totalTokens = Math.round((baseTokens + volumeBonusTokens + promoTokens) * 100) / 100;

  const PROMO_CODES = { "WELCOME20": 20, "BOSS10": 10, "CHS50": 50 };

  const handleApplyPromo = () => {
    const code = promoCode.trim().toUpperCase();
    if (PROMO_CODES[code]) {
      setPromoBonus(PROMO_CODES[code]); setPromoApplied(true); setPromoError("");
    } else {
      setPromoError("Invalid promo code."); setPromoApplied(false); setPromoBonus(0);
    }
  };

  const handleProceed = () => {
    if (!isValid || !user) return;
    const { url, tier } = getNearestStripeLink(amountNum);
    // Store pending purchase so user can see it after returning from Stripe
    _tryLS(() => localStorage.setItem("chs_pending_purchase", JSON.stringify({
      userId: user.id, amount: amountNum, totalTokens, timestamp: Date.now(),
      promoCode: promoApplied ? promoCode.trim().toUpperCase() : null,
    })));
    window.open(url, "_blank");
    setSuccess(`Payment page opened for $${tier.toFixed(2)}. Complete payment on Stripe, then return here and click Refresh Balance in your profile.`);
  };

  const rowS = { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 0", borderBottom: "1px solid #f0f0f0" };
  const lbl = { fontFamily: "'Courier New', monospace", fontSize: 11, color: "#888" };
  const val = { fontFamily: "'Courier New', monospace", fontSize: 13, fontWeight: 900, color: "#000" };

  return (
    <div ref={overlayRef} onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.72)", zIndex: 1100,
        display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: "#fff", width: "100%", maxWidth: 460, maxHeight: "92vh",
        overflowY: "auto", position: "relative", boxShadow: "0 20px 60px rgba(0,0,0,0.35)" }}>

        {/* Header bar */}
        <div style={{ background: "#000", padding: "24px 28px", position: "sticky", top: 0 }}>
          <button onClick={onClose}
            style={{ position: "absolute", top: 14, right: 14, background: "none", border: "none",
              cursor: "pointer", color: "#666", fontSize: 18, lineHeight: 1 }}>✕</button>
          <div style={{ fontFamily: "'Courier New', monospace", fontSize: 9, color: "#555",
            letterSpacing: "0.2em", marginBottom: 8 }}>CHASS1S · TOKEN PURCHASE</div>
          <div style={{ fontSize: 22, fontWeight: 900, color: "#fff", fontFamily: "'Georgia', serif",
            marginBottom: 6 }}>Buy Tokens</div>
          <div style={{ fontFamily: "'Courier New', monospace", fontSize: 11, color: "#555" }}>
            Current balance:{" "}
            <span style={{ color: "#fff", fontWeight: 900 }}>
              {typeof profile?.token_balance === "number" ? profile.token_balance : "—"} tokens
            </span>
          </div>
        </div>

        <div style={{ padding: "28px 28px 32px" }}>

          {/* Amount input */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontFamily: "'Courier New', monospace", fontSize: 10, color: "#888",
              letterSpacing: "0.12em", marginBottom: 8 }}>DEPOSIT AMOUNT (USD)</div>
            <div style={{ display: "flex", alignItems: "center",
              border: `2px solid ${isValid ? "#000" : "#e0e0e0"}`, transition: "border-color 0.15s" }}>
              <span style={{ padding: "12px 14px", fontFamily: "'Courier New', monospace", fontWeight: 900,
                fontSize: 20, color: "#000", background: "#f8f8f8", borderRight: "1px solid #e0e0e0" }}>$</span>
              <input type="number" min="25" max="1000" step="0.01" value={amountStr}
                onChange={e => setAmountStr(e.target.value)}
                style={{ flex: 1, padding: "12px 14px", fontFamily: "'Courier New', monospace",
                  fontSize: 20, fontWeight: 900, border: "none", outline: "none", color: "#000" }} />
              <span style={{ padding: "12px 14px", fontFamily: "'Courier New', monospace",
                fontSize: 10, color: "#aaa" }}>USD</span>
            </div>
            <div style={{ fontFamily: "'Courier New', monospace", fontSize: 10, color: "#aaa", marginTop: 6 }}>
              Minimum $25.00 · Maximum $1,000.00
            </div>
          </div>

          {/* Quick amount buttons */}
          <div style={{ display: "flex", gap: 8, marginBottom: 24, flexWrap: "wrap" }}>
            {["25", "50", "100", "250", "500"].map(amt => (
              <button key={amt} onClick={() => setAmountStr(amt)}
                style={{ padding: "6px 14px", border: `1px solid ${amountStr === amt ? "#000" : "#d0d0d0"}`,
                  background: amountStr === amt ? "#000" : "#fff",
                  color: amountStr === amt ? "#fff" : "#555",
                  fontFamily: "'Courier New', monospace", fontSize: 11, fontWeight: 700,
                  cursor: "pointer", borderRadius: 2 }}>
                ${amt}
              </button>
            ))}
          </div>

          {/* Token breakdown */}
          {isValid && (
            <div style={{ border: "1px solid #e0e0e0", marginBottom: 24 }}>
              <div style={{ background: "#f8f8f8", padding: "10px 16px", fontFamily: "'Courier New', monospace",
                fontSize: 10, fontWeight: 900, letterSpacing: "0.12em", color: "#888" }}>TOKEN BREAKDOWN</div>
              <div style={{ padding: "4px 16px 12px" }}>
                <div style={rowS}>
                  <span style={lbl}>Base tokens ($1 = 1 token)</span>
                  <span style={val}>{baseTokens.toFixed(2)}</span>
                </div>
                {volumeBonusPct > 0 && (
                  <div style={rowS}>
                    <span style={{ ...lbl, color: "#2d7a2d" }}>Volume bonus (+{Math.round(volumeBonusPct * 100)}%)</span>
                    <span style={{ ...val, color: "#2d7a2d" }}>+{volumeBonusTokens.toFixed(2)}</span>
                  </div>
                )}
                {promoApplied && promoBonus > 0 && (
                  <div style={rowS}>
                    <span style={{ ...lbl, color: "#2d7a2d" }}>Promo: {promoCode.trim().toUpperCase()}</span>
                    <span style={{ ...val, color: "#2d7a2d" }}>+{promoBonus.toFixed(2)}</span>
                  </div>
                )}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
                  paddingTop: 12, marginTop: 4, borderTop: "2px solid #000" }}>
                  <span style={{ fontFamily: "'Courier New', monospace", fontSize: 12, fontWeight: 900 }}>TOTAL TOKENS</span>
                  <span style={{ fontFamily: "'Courier New', monospace", fontSize: 24, fontWeight: 900, color: "#000" }}>
                    {totalTokens.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Promo code */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontFamily: "'Courier New', monospace", fontSize: 10, color: "#888",
              letterSpacing: "0.12em", marginBottom: 8 }}>PROMO CODE (OPTIONAL)</div>
            <div style={{ display: "flex", gap: 8 }}>
              <input type="text" value={promoCode} placeholder="Enter code"
                onChange={e => { setPromoCode(e.target.value); setPromoApplied(false); setPromoError(""); }}
                style={{ flex: 1, padding: "10px 12px", fontFamily: "'Courier New', monospace", fontSize: 13,
                  border: `1px solid ${promoApplied ? "#2d7a2d" : "#d0d0d0"}`, outline: "none" }} />
              <button onClick={handleApplyPromo} disabled={!promoCode.trim()}
                style={{ padding: "10px 16px", background: promoCode.trim() ? "#000" : "#e0e0e0",
                  color: promoCode.trim() ? "#fff" : "#aaa", border: "none",
                  fontFamily: "'Courier New', monospace", fontSize: 11, fontWeight: 900,
                  cursor: promoCode.trim() ? "pointer" : "not-allowed" }}>APPLY</button>
            </div>
            {promoError && <div style={{ fontFamily: "'Courier New', monospace", fontSize: 10,
              color: "#cc0000", marginTop: 6 }}>{promoError}</div>}
            {promoApplied && <div style={{ fontFamily: "'Courier New', monospace", fontSize: 10,
              color: "#2d7a2d", marginTop: 6 }}>✓ {promoBonus} bonus tokens applied</div>}
          </div>

          {/* Success */}
          {success && (
            <div style={{ background: "#f0fff4", border: "1px solid #b2f5c8", padding: "14px 16px",
              marginBottom: 16, fontFamily: "'Courier New', monospace", fontSize: 12,
              color: "#006633", fontWeight: 700 }}>{success}</div>
          )}

          {/* CTA */}
          {!success && (
            <button onClick={handleProceed} disabled={!isValid}
              style={{ width: "100%", padding: "16px", border: "none",
                background: isValid ? "#000" : "#e0e0e0", color: isValid ? "#fff" : "#aaa",
                fontFamily: "'Courier New', monospace", fontSize: 12, fontWeight: 900,
                letterSpacing: "0.15em", cursor: isValid ? "pointer" : "not-allowed",
                marginBottom: 20 }}>
              {`PROCEED TO STRIPE — $${amountNum.toFixed(2)}`}
            </button>
          )}

          {/* Chassis cost reference */}
          <div style={{ padding: "16px", background: "#f8f8f8", border: "1px solid #e8e8e8" }}>
            <div style={{ fontFamily: "'Courier New', monospace", fontSize: 10, fontWeight: 900,
              letterSpacing: "0.12em", color: "#888", marginBottom: 10 }}>CHASSIS COST REFERENCE</div>
            {[["Compact", "1 token", "$1.00"], ["Mid-Size", "3 tokens", "$3.00"],
              ["Executive", "5 tokens", "$5.00"], ["Luxury", "10 tokens", "$10.00"],
              ["Beyond Profit", "0.25 / initiative", "$0.25"]].map(([tier, tokens, price]) => (
              <div key={tier} style={{ display: "flex", justifyContent: "space-between",
                fontFamily: "'Courier New', monospace", fontSize: 11, padding: "5px 0",
                borderBottom: "1px solid #eeeeee" }}>
                <span style={{ color: "#555" }}>{tier}</span>
                <span style={{ fontWeight: 700, color: "#000" }}>{tokens}</span>
                <span style={{ color: "#888" }}>{price}</span>
              </div>
            ))}
          </div>

          <div style={{ fontFamily: "'Courier New', monospace", fontSize: 9, color: "#ccc",
            textAlign: "center", marginTop: 16, lineHeight: 1.8 }}>
            Payments processed securely by Stripe · Tokens never expire · Non-refundable
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── WORKSPACE CREATE MODAL ───────────────────────────────────────────────────
function WorkspaceCreateModal({ user, onClose, onCreated }) {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const overlayRef = useRef(null);
  useEffect(() => {
    const h = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setLoading(true); setError("");
    try {
      const { data: ws, error: wsErr } = await supabase
        .from("workspaces").insert({ name: name.trim(), created_by: user.id, token_balance: 0 })
        .select().single();
      if (wsErr) throw new Error(wsErr.message || "Failed to create workspace");
      await supabase.from("workspace_members").insert({
        workspace_id: ws.id, user_id: user.id, role: "owner", invited_by: user.id,
      });
      onCreated({ ...ws, role: "owner" });
    } catch (e) { setError(e.message); }
    setLoading(false);
  };

  return (
    <div ref={overlayRef} onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 1200,
        display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: "#fff", width: "100%", maxWidth: 420, padding: "36px 32px",
        position: "relative", boxShadow: "0 20px 60px rgba(0,0,0,0.35)" }}>
        <button onClick={onClose} style={{ position: "absolute", top: 14, right: 14,
          background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "#aaa" }}>✕</button>
        <div style={{ fontFamily: "'Courier New', monospace", fontSize: 9, color: "#aaa",
          letterSpacing: "0.2em", marginBottom: 8 }}>CHASS1S · WORKSPACE</div>
        <h2 style={{ fontSize: 20, fontWeight: 900, margin: "0 0 8px", fontFamily: "'Georgia', serif" }}>
          Create Workspace
        </h2>
        <p style={{ fontSize: 13, color: "#666", margin: "0 0 24px", lineHeight: 1.6, fontFamily: "'Georgia', serif" }}>
          Collaborate with your team and share a token pool. You'll be the Owner.
        </p>
        <div style={{ fontFamily: "'Courier New', monospace", fontSize: 10, color: "#888",
          letterSpacing: "0.12em", marginBottom: 8 }}>WORKSPACE NAME</div>
        <input value={name} onChange={e => setName(e.target.value)}
          placeholder="e.g. Acme Corp, Marketing Team..."
          onKeyDown={e => { if (e.key === "Enter") handleCreate(); }}
          style={{ width: "100%", padding: "12px 14px", fontFamily: "'Georgia', serif", fontSize: 14,
            border: "1px solid #d0d0d0", outline: "none", boxSizing: "border-box",
            marginBottom: 16, borderRadius: 2 }} />
        {error && <div style={{ background: "#fff5f5", border: "1px solid #ffcccc", padding: "10px 14px",
          marginBottom: 14, fontFamily: "'Courier New', monospace", fontSize: 11,
          color: "#cc0000", borderRadius: 2 }}>{error}</div>}
        <button onClick={handleCreate} disabled={!name.trim() || loading}
          style={{ width: "100%", padding: "13px", border: "none",
            background: name.trim() ? "#000" : "#e8e8e8", color: name.trim() ? "#fff" : "#aaa",
            fontFamily: "'Courier New', monospace", fontSize: 12, fontWeight: 900,
            letterSpacing: "0.15em", cursor: name.trim() ? "pointer" : "not-allowed" }}>
          {loading ? "CREATING..." : "CREATE WORKSPACE"}
        </button>
        <p style={{ fontFamily: "'Courier New', monospace", fontSize: 10, color: "#aaa",
          margin: "14px 0 0", textAlign: "center", lineHeight: 1.7 }}>
          Co-owners & Members can be invited from workspace settings after creation.
        </p>
      </div>
    </div>
  );
}

// ─── CHASSIS HISTORY MODAL ────────────────────────────────────────────────────
const TIER_LABELS = { compact: "Compact", midsize: "Mid-Size", executive: "Executive", luxury: "Luxury" };

function ChassisHistoryModal({ user, onClose, onOpenChassis }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const overlayRef = useRef(null);
  useEffect(() => {
    const h = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase.from("chassis_history")
        .select("id, business_name, business_input, tier, tokens_consumed, lang, created_at, chassis_data, beyond_profit_data, beyond_profit_selections")
        .eq("user_id", user.id).order("created_at", { ascending: false }).limit(50);
      setHistory(data || []);
      setLoading(false);
    })();
  }, [user.id]);

  return (
    <div ref={overlayRef} onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 1200,
        display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: "#fff", width: "100%", maxWidth: 580,
        maxHeight: "88vh", display: "flex", flexDirection: "column",
        boxShadow: "0 20px 60px rgba(0,0,0,0.35)" }}>
        {/* Header */}
        <div style={{ background: "#000", padding: "22px 28px", flexShrink: 0, position: "relative" }}>
          <button onClick={onClose} style={{ position: "absolute", top: 14, right: 14,
            background: "none", border: "none", cursor: "pointer", color: "#555", fontSize: 18 }}>✕</button>
          <div style={{ fontFamily: "'Courier New', monospace", fontSize: 9, color: "#555",
            letterSpacing: "0.2em", marginBottom: 6 }}>CHASS1S · CHASSIS HISTORY</div>
          <div style={{ fontSize: 20, fontWeight: 900, color: "#fff", fontFamily: "'Georgia', serif" }}>My Chassis</div>
          <div style={{ fontFamily: "'Courier New', monospace", fontSize: 11, color: "#555", marginTop: 4 }}>
            {history.length > 0 ? `${history.length} Chassis generated` : ""}
          </div>
        </div>
        {/* List */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: "center", fontFamily: "'Courier New', monospace",
              fontSize: 11, color: "#aaa", letterSpacing: "0.1em" }}>LOADING...</div>
          ) : history.length === 0 ? (
            <div style={{ padding: 48, textAlign: "center" }}>
              <div style={{ fontSize: 36, marginBottom: 16 }}>◎</div>
              <div style={{ fontFamily: "'Courier New', monospace", fontSize: 12, color: "#aaa",
                letterSpacing: "0.1em" }}>NO CHASSIS YET</div>
              <p style={{ fontFamily: "'Georgia', serif", fontSize: 13, color: "#888", marginTop: 10, lineHeight: 1.6 }}>
                Generate your first Chassis and it will appear here.
              </p>
            </div>
          ) : history.map((ch, i) => (
            <div key={ch.id || i}
              style={{ padding: "16px 24px", borderBottom: "1px solid #f0f0f0",
                display: "flex", alignItems: "center", gap: 14,
                background: i % 2 === 0 ? "#fff" : "#fafafa" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: "#000", marginBottom: 5,
                  whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {ch.business_name || ch.business_input || "Unnamed Chassis"}
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                  <span style={{ fontFamily: "'Courier New', monospace", fontSize: 9, fontWeight: 900,
                    border: "1px solid #000", padding: "2px 7px", color: "#000" }}>
                    {TIER_LABELS[ch.tier] || ch.tier}
                  </span>
                  <span style={{ fontFamily: "'Courier New', monospace", fontSize: 10, color: "#888" }}>
                    {ch.tokens_consumed} tkn
                  </span>
                  <span style={{ fontFamily: "'Courier New', monospace", fontSize: 10, color: "#bbb" }}>
                    {ch.lang || "EN"}
                  </span>
                  <span style={{ fontFamily: "'Courier New', monospace", fontSize: 10, color: "#bbb" }}>
                    {ch.created_at ? new Date(ch.created_at).toLocaleDateString() : ""}
                  </span>
                </div>
              </div>
              <button onClick={() => { onOpenChassis(ch); onClose(); }}
                style={{ padding: "7px 14px", background: "#000", color: "#fff", border: "none",
                  fontFamily: "'Courier New', monospace", fontSize: 10, fontWeight: 900,
                  cursor: "pointer", flexShrink: 0, letterSpacing: "0.06em", whiteSpace: "nowrap" }}>
                OPEN →
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── WORKSPACE MEMBERS MODAL ──────────────────────────────────────────────────
function WorkspaceMembersModal({ workspace, user, userRole, onClose }) {
  const [members, setMembers] = useState([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("member");
  const [fetchLoading, setFetchLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const overlayRef = useRef(null);
  const canManage = userRole === "owner" || userRole === "co-owner";

  useEffect(() => {
    const h = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);

  useEffect(() => { loadMembers(); }, []);

  const loadMembers = async () => {
    setFetchLoading(true);
    const { data: mems } = await supabase.from("workspace_members").select("*").eq("workspace_id", workspace.id);
    if (mems?.length) {
      const withEmails = await Promise.all(mems.map(async (m) => {
        const { data: p } = await supabase.from("profiles").select("email").eq("id", m.user_id).single();
        return { ...m, email: p?.email || "Unknown" };
      }));
      setMembers(withEmails);
    } else { setMembers([]); }
    setFetchLoading(false);
  };

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;
    setLoading(true); setError(""); setSuccess("");
    const { data: p } = await supabase.from("profiles").select("id,email").eq("email", inviteEmail.trim().toLowerCase()).single();
    if (!p?.id) { setError("No CHASS1S account found with that email. Ask them to sign up first."); setLoading(false); return; }
    const { data: existing } = await supabase.from("workspace_members").select("id").eq("workspace_id", workspace.id).eq("user_id", p.id).single();
    if (existing?.id) { setError("That user is already a member of this workspace."); setLoading(false); return; }
    const { error: err } = await supabase.from("workspace_members").insert({ workspace_id: workspace.id, user_id: p.id, role: inviteRole, invited_by: user.id });
    if (err) { setError(err.message); }
    else { setSuccess(`${inviteEmail.trim()} added as ${inviteRole}.`); setInviteEmail(""); loadMembers(); }
    setLoading(false);
  };

  const handleRemove = async (memberId, memberUserId) => {
    if (memberUserId === user.id) return;
    await supabase.from("workspace_members").delete().eq("id", memberId);
    loadMembers();
  };

  return (
    <div ref={overlayRef} onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 1300,
        display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: "#fff", width: "100%", maxWidth: 480, maxHeight: "85vh",
        display: "flex", flexDirection: "column", boxShadow: "0 20px 60px rgba(0,0,0,0.35)" }}>
        {/* Header */}
        <div style={{ background: "#000", padding: "20px 24px", flexShrink: 0, position: "relative" }}>
          <button onClick={onClose} style={{ position: "absolute", top: 14, right: 14, background: "none",
            border: "none", cursor: "pointer", color: "#555", fontSize: 18 }}>✕</button>
          <div style={{ fontFamily: "'Courier New', monospace", fontSize: 9, color: "#555",
            letterSpacing: "0.2em", marginBottom: 6 }}>WORKSPACE · MEMBERS</div>
          <div style={{ fontSize: 18, fontWeight: 900, color: "#fff", fontFamily: "'Georgia', serif" }}>{workspace.name}</div>
          <div style={{ fontFamily: "'Courier New', monospace", fontSize: 10, color: "#555", marginTop: 3 }}>
            Your role: <span style={{ color: "#aaa" }}>{userRole?.toUpperCase()}</span>
          </div>
        </div>
        {/* Members list */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 24px" }}>
          <div style={{ fontFamily: "'Courier New', monospace", fontSize: 9, color: "#aaa",
            letterSpacing: "0.12em", marginBottom: 12 }}>
            MEMBERS {!fetchLoading && `(${members.length})`}
          </div>
          {fetchLoading ? (
            <div style={{ fontFamily: "'Courier New', monospace", fontSize: 11, color: "#aaa" }}>Loading...</div>
          ) : members.map(m => (
            <div key={m.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "10px 0", borderBottom: "1px solid #f0f0f0", gap: 12 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#000",
                  whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.email}</div>
                <div style={{ fontFamily: "'Courier New', monospace", fontSize: 9, color: "#aaa", marginTop: 2 }}>
                  {m.role?.toUpperCase()}{m.user_id === user.id ? " · YOU" : ""}
                </div>
              </div>
              {canManage && m.user_id !== user.id && m.role !== "owner" && (
                <button onClick={() => handleRemove(m.id, m.user_id)}
                  style={{ flexShrink: 0, background: "none", border: "1px solid #e0e0e0",
                    padding: "4px 10px", cursor: "pointer", fontFamily: "'Courier New', monospace",
                    fontSize: 9, color: "#888", fontWeight: 700, letterSpacing: "0.06em" }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = "#cc0000"; e.currentTarget.style.color = "#cc0000"; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = "#e0e0e0"; e.currentTarget.style.color = "#888"; }}>
                  REMOVE
                </button>
              )}
            </div>
          ))}
        </div>
        {/* Invite section */}
        {canManage && (
          <div style={{ padding: "16px 24px", borderTop: "1px solid #e0e0e0", flexShrink: 0 }}>
            <div style={{ fontFamily: "'Courier New', monospace", fontSize: 9, color: "#aaa",
              letterSpacing: "0.12em", marginBottom: 10 }}>INVITE MEMBER</div>
            <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              <input type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)}
                placeholder="email@example.com" onKeyDown={e => { if (e.key === "Enter") handleInvite(); }}
                style={{ flex: 1, padding: "9px 12px", fontFamily: "'Courier New', monospace", fontSize: 12,
                  border: "1px solid #d0d0d0", outline: "none", borderRadius: 2 }} />
              <select value={inviteRole} onChange={e => setInviteRole(e.target.value)}
                style={{ padding: "9px 10px", fontFamily: "'Courier New', monospace", fontSize: 11,
                  border: "1px solid #d0d0d0", outline: "none", cursor: "pointer", borderRadius: 2 }}>
                <option value="member">Member</option>
                <option value="co-owner">Co-Owner</option>
              </select>
            </div>
            {error && <div style={{ fontFamily: "'Courier New', monospace", fontSize: 10,
              color: "#cc0000", marginBottom: 8, lineHeight: 1.5 }}>{error}</div>}
            {success && <div style={{ fontFamily: "'Courier New', monospace", fontSize: 10,
              color: "#006633", marginBottom: 8 }}>✓ {success}</div>}
            <button onClick={handleInvite} disabled={loading || !inviteEmail.trim()}
              style={{ width: "100%", padding: "10px", border: "none",
                background: inviteEmail.trim() ? "#000" : "#e8e8e8",
                color: inviteEmail.trim() ? "#fff" : "#aaa", cursor: inviteEmail.trim() ? "pointer" : "not-allowed",
                fontFamily: "'Courier New', monospace", fontSize: 11, fontWeight: 900, letterSpacing: "0.12em",
                borderRadius: 2 }}>
              {loading ? "ADDING..." : "ADD MEMBER"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── ACCOUNT MENU ─────────────────────────────────────────────────────────────
function AccountMenu({ user, profile, onSignOut, onClose, onRefreshProfile, lang, setLang,
  workspaces, currentWorkspace, onSwitchWorkspace, onCreateWorkspace, onOpenHistory }) {
  const ref = useRef(null);
  const [buyOpen, setBuyOpen] = useState(false);
  const [workspaceExpanded, setWorkspaceExpanded] = useState(false);
  const [managingWorkspace, setManagingWorkspace] = useState(null);

  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [onClose]);

  const tokens = typeof profile?.token_balance === "number"
    ? profile.token_balance % 1 === 0
      ? profile.token_balance.toString()
      : profile.token_balance.toFixed(2)
    : "—";

  const wsTokens = currentWorkspace?.token_balance;
  const displayTokens = currentWorkspace
    ? (typeof wsTokens === "number" ? (wsTokens % 1 === 0 ? wsTokens : wsTokens.toFixed(2)) : "—")
    : tokens;
  const contextLabel = currentWorkspace ? currentWorkspace.name : "Personal Account";
  const roleLabel = currentWorkspace?.role?.toUpperCase() || "";

  if (buyOpen) return (
    <TokenPurchaseModal
      user={user} profile={profile}
      onClose={() => setBuyOpen(false)}
      onTokensAdded={() => { onRefreshProfile(); setBuyOpen(false); onClose(); }}
    />
  );

  if (managingWorkspace) return (
    <WorkspaceMembersModal
      workspace={managingWorkspace} user={user}
      userRole={workspaces.find(w => w.id === managingWorkspace.id)?.role}
      onClose={() => setManagingWorkspace(null)}
    />
  );

  return (
    <div ref={ref} style={{ position: "absolute", right: 0, top: "calc(100% + 8px)",
      background: "#fff", border: "1px solid #000", minWidth: 260, zIndex: 300,
      boxShadow: "0 8px 32px rgba(0,0,0,0.15)" }}>

      {/* User info */}
      <div style={{ padding: "14px 18px", borderBottom: "1px solid #e8e8e8" }}>
        <div style={{ fontFamily: "'Courier New', monospace", fontSize: 9, color: "#aaa",
          letterSpacing: "0.12em", marginBottom: 4 }}>SIGNED IN AS</div>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#000", wordBreak: "break-all",
          fontFamily: "'Georgia', serif" }}>{user.email}</div>
      </div>

      {/* Workspace switcher */}
      <div style={{ borderBottom: "1px solid #e8e8e8" }}>
        <button onClick={() => setWorkspaceExpanded(o => !o)}
          style={{ width: "100%", padding: "12px 18px", background: "none", border: "none",
            cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center",
            justifyContent: "space-between", gap: 8 }}>
          <div>
            <div style={{ fontFamily: "'Courier New', monospace", fontSize: 9, color: "#aaa",
              letterSpacing: "0.12em", marginBottom: 3 }}>CONTEXT</div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontFamily: "'Courier New', monospace", fontSize: 12, fontWeight: 900,
                color: "#000" }}>{contextLabel}</span>
              {roleLabel && <span style={{ fontFamily: "'Courier New', monospace", fontSize: 8,
                color: "#888", border: "1px solid #ddd", padding: "1px 5px" }}>{roleLabel}</span>}
            </div>
          </div>
          <span style={{ fontFamily: "monospace", fontSize: 11, color: "#888" }}>
            {workspaceExpanded ? "▲" : "▼"}
          </span>
        </button>
        {workspaceExpanded && (
          <div style={{ borderTop: "1px solid #f0f0f0" }}>
            {/* Personal account option */}
            <button onClick={() => { onSwitchWorkspace(null); setWorkspaceExpanded(false); }}
              style={{ width: "100%", padding: "9px 18px 9px 28px", background: !currentWorkspace ? "#f8f8f8" : "none",
                border: "none", cursor: "pointer", textAlign: "left", fontFamily: "'Courier New', monospace",
                fontSize: 11, color: "#000", fontWeight: !currentWorkspace ? 900 : 400,
                borderLeft: !currentWorkspace ? "3px solid #000" : "3px solid transparent" }}
              onMouseEnter={e => { if (currentWorkspace) e.currentTarget.style.background = "#f5f5f5"; }}
              onMouseLeave={e => { if (currentWorkspace) e.currentTarget.style.background = "none"; }}>
              Personal Account
            </button>
            {/* Workspace list */}
            {workspaces.map(ws => (
              <div key={ws.id} style={{ display: "flex", alignItems: "stretch" }}>
                <button onClick={() => { onSwitchWorkspace(ws); setWorkspaceExpanded(false); }}
                  style={{ flex: 1, padding: "9px 12px 9px 28px",
                    background: currentWorkspace?.id === ws.id ? "#f8f8f8" : "none",
                    border: "none", cursor: "pointer", textAlign: "left", fontFamily: "'Courier New', monospace",
                    fontSize: 11, color: "#000", fontWeight: currentWorkspace?.id === ws.id ? 900 : 400,
                    borderLeft: currentWorkspace?.id === ws.id ? "3px solid #000" : "3px solid transparent",
                    display: "flex", justifyContent: "space-between", alignItems: "center" }}
                  onMouseEnter={e => { if (currentWorkspace?.id !== ws.id) e.currentTarget.style.background = "#f5f5f5"; }}
                  onMouseLeave={e => { if (currentWorkspace?.id !== ws.id) e.currentTarget.style.background = "none"; }}>
                  <span>{ws.name}</span>
                  <span style={{ fontSize: 8, color: "#888", border: "1px solid #eee", padding: "1px 5px", marginLeft: 8 }}>
                    {ws.role?.toUpperCase()}
                  </span>
                </button>
                {(ws.role === "owner" || ws.role === "co-owner") && (
                  <button onClick={() => setManagingWorkspace(ws)}
                    title="Manage members"
                    style={{ padding: "9px 12px", background: "none", border: "none", borderLeft: "1px solid #f0f0f0",
                      cursor: "pointer", fontFamily: "monospace", fontSize: 13, color: "#aaa" }}
                    onMouseEnter={e => { e.currentTarget.style.background = "#f5f5f5"; e.currentTarget.style.color = "#000"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = "none"; e.currentTarget.style.color = "#aaa"; }}>
                    ⚙
                  </button>
                )}
              </div>
            ))}
            {/* Create workspace */}
            <button onClick={() => { onCreateWorkspace(); setWorkspaceExpanded(false); onClose(); }}
              style={{ width: "100%", padding: "9px 18px 9px 28px", background: "none", border: "none",
                borderTop: "1px solid #f0f0f0", cursor: "pointer", textAlign: "left",
                fontFamily: "'Courier New', monospace", fontSize: 11, color: "#888",
                display: "flex", alignItems: "center", gap: 6 }}
              onMouseEnter={e => e.currentTarget.style.background = "#f5f5f5"}
              onMouseLeave={e => e.currentTarget.style.background = "none"}>
              <span style={{ fontSize: 14 }}>+</span> Create Workspace
            </button>
          </div>
        )}
      </div>

      {/* Token balance */}
      <div style={{ padding: "14px 18px", borderBottom: "1px solid #e8e8e8", background: "#f8f8f8" }}>
        <div style={{ fontFamily: "'Courier New', monospace", fontSize: 9, color: "#aaa",
          letterSpacing: "0.12em", marginBottom: 6 }}>TOKEN BALANCE</div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
          <span style={{ fontSize: 32, fontWeight: 900, color: "#000", lineHeight: 1,
            fontFamily: "'Courier New', monospace" }}>{displayTokens}</span>
          <span style={{ fontFamily: "'Courier New', monospace", fontSize: 10, color: "#888" }}>TOKENS</span>
        </div>
      </div>

      {/* Language selector */}
      <div style={{ padding: "12px 18px", borderBottom: "1px solid #e8e8e8" }}>
        <div style={{ fontFamily: "'Courier New', monospace", fontSize: 9, color: "#aaa",
          letterSpacing: "0.12em", marginBottom: 8 }}>LANGUAGE</div>
        <div style={{ display: "flex", gap: 6 }}>
          {LANGUAGES.map(l => (
            <button key={l.code} onClick={() => setLang(l.code)}
              style={{ padding: "4px 9px", border: l.code === lang ? "2px solid #000" : "1px solid #d0d0d0",
                background: l.code === lang ? "#000" : "#fff", color: l.code === lang ? "#fff" : "#888",
                fontFamily: "'Courier New', monospace", fontSize: 10, fontWeight: 900,
                cursor: "pointer", borderRadius: 2, transition: "all 0.15s" }}>
              {l.code}
            </button>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div style={{ padding: "6px 0" }}>
        <button onClick={onOpenHistory}
          style={{ width: "100%", padding: "10px 18px", background: "none", border: "none",
            cursor: "pointer", textAlign: "left", fontFamily: "'Courier New', monospace",
            fontSize: 11, color: "#000", fontWeight: 700, letterSpacing: "0.08em" }}
          onMouseEnter={e => e.currentTarget.style.background = "#f0f0f0"}
          onMouseLeave={e => e.currentTarget.style.background = "none"}>
          MY CHASSIS
        </button>
        <button onClick={() => setBuyOpen(true)}
          style={{ width: "100%", padding: "10px 18px", background: "#000", border: "none",
            cursor: "pointer", textAlign: "left", fontFamily: "'Courier New', monospace",
            fontSize: 11, color: "#fff", fontWeight: 900, letterSpacing: "0.08em",
            display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 14 }}>+</span> BUY TOKENS
        </button>
        <button onClick={() => { onSignOut(); onClose(); }}
          style={{ width: "100%", padding: "10px 18px", background: "none", border: "none",
            cursor: "pointer", textAlign: "left", fontFamily: "'Courier New', monospace",
            fontSize: 11, color: "#000", fontWeight: 700, letterSpacing: "0.08em" }}
          onMouseEnter={e => e.currentTarget.style.background = "#f0f0f0"}
          onMouseLeave={e => e.currentTarget.style.background = "none"}>
          SIGN OUT
        </button>
      </div>
    </div>
  );
}

// ─── GUEST MENU (logged-out — language + auth options) ────────────────────────
function GuestMenu({ lang, setLang, onOpenAuth, onClose }) {
  const ref = useRef(null);
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [onClose]);

  return (
    <div ref={ref} style={{ position: "absolute", right: 0, top: "calc(100% + 8px)",
      background: "#fff", border: "1px solid #000", minWidth: 220, zIndex: 300,
      boxShadow: "0 8px 32px rgba(0,0,0,0.15)" }}>
      {/* Auth actions */}
      <div style={{ padding: "6px 0", borderBottom: "1px solid #e8e8e8" }}>
        <button onClick={() => { onOpenAuth("signin"); onClose(); }}
          style={{ width: "100%", padding: "12px 18px", background: "#000", border: "none",
            cursor: "pointer", textAlign: "left", fontFamily: "'Courier New', monospace",
            fontSize: 11, color: "#fff", fontWeight: 900, letterSpacing: "0.08em" }}>
          SIGN IN
        </button>
        <button onClick={() => { onOpenAuth("signup"); onClose(); }}
          style={{ width: "100%", padding: "11px 18px", background: "none", border: "none",
            cursor: "pointer", textAlign: "left", fontFamily: "'Courier New', monospace",
            fontSize: 11, color: "#000", fontWeight: 700, letterSpacing: "0.08em" }}
          onMouseEnter={e => e.currentTarget.style.background = "#f0f0f0"}
          onMouseLeave={e => e.currentTarget.style.background = "none"}>
          CREATE ACCOUNT
        </button>
      </div>
      {/* Language selector */}
      <div style={{ padding: "14px 18px" }}>
        <div style={{ fontFamily: "'Courier New', monospace", fontSize: 9, color: "#aaa",
          letterSpacing: "0.12em", marginBottom: 10 }}>LANGUAGE</div>
        <div style={{ display: "flex", gap: 6 }}>
          {LANGUAGES.map(l => (
            <button key={l.code} onClick={() => setLang(l.code)}
              style={{ padding: "5px 10px", border: l.code === lang ? "2px solid #000" : "1px solid #d0d0d0",
                background: l.code === lang ? "#000" : "#fff",
                color: l.code === lang ? "#fff" : "#888",
                fontFamily: "'Courier New', monospace", fontSize: 10, fontWeight: 900,
                cursor: "pointer", borderRadius: 2, transition: "all 0.15s" }}>
              {l.code}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── LANGUAGE DROPDOWN ────────────────────────────────────────────────────────
function LangDropdown({ lang, setLang }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  return (
    <div ref={ref} style={{ position: "relative", userSelect: "none" }}>
      <button onClick={() => setOpen(o => !o)}
        style={{ display: "flex", alignItems: "center", gap: 5, background: "transparent", border: "1px solid #d0d0d0", padding: "5px 10px", cursor: "pointer", fontFamily: "'Courier New', monospace", fontSize: 11, fontWeight: 900, letterSpacing: "0.12em", color: "#000", borderRadius: 2 }}>
        {lang} <span style={{ fontSize: 8, color: "#888" }}>{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div style={{ position: "absolute", right: 0, top: "calc(100% + 4px)", background: "#fff", border: "1px solid #000", borderRadius: 2, overflow: "hidden", zIndex: 100, minWidth: 90, boxShadow: "0 4px 16px rgba(0,0,0,0.1)" }}>
          {LANGUAGES.map(l => (
            <button key={l.code} onClick={() => { setLang(l.code); setOpen(false); }}
              style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", padding: "9px 14px", background: l.code === lang ? "#000" : "#fff", color: l.code === lang ? "#fff" : "#000", border: "none", cursor: "pointer", fontFamily: "'Courier New', monospace", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", gap: 10, textAlign: "left" }}>
              <span>{l.code}</span>
              <span style={{ fontSize: 10, opacity: 0.6, fontWeight: 400, letterSpacing: "0.04em" }}>{l.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── UI COMPONENTS ────────────────────────────────────────────────────────────
function EnvBadge({ env }) {
  const s = ENV_STYLES[env] || ENV_STYLES["Uncontrolled"];
  return <span style={{ background: s.bg, color: s.text, border: `1px solid ${s.border}`, borderRadius: 2, padding: "2px 8px", fontSize: 10, fontWeight: 700, whiteSpace: "nowrap", fontFamily: "'Courier New', monospace" }}>{env}</span>;
}
function InExBadge({ inEx }) {
  const s = INEX_STYLES[inEx] || INEX_STYLES["Internal"];
  return <span style={{ background: s.bg, color: s.text, border: "1px solid #000", borderRadius: 2, padding: "2px 8px", fontSize: 10, fontWeight: 700, whiteSpace: "nowrap", fontFamily: "'Courier New', monospace" }}>{inEx}</span>;
}
function DataTable({ items, t, isBlips }) {
  if (!items || items.length === 0) return <div style={{ padding: 20, color: "#888", fontFamily: "'Courier New', monospace", fontSize: 12 }}>{t.noItems}</div>;
  const headers = isBlips ? t.tableHeadersBlips : t.tableHeaders;
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={{ background: "#000", color: "#fff" }}>
            {headers.map(h => <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontWeight: 700, fontSize: 11, letterSpacing: "0.1em", whiteSpace: "nowrap", fontFamily: "'Courier New', monospace" }}>{h.toUpperCase()}</th>)}
          </tr>
        </thead>
        <tbody>
          {items.map((row, i) => (
            <tr key={i} style={{ background: i % 2 === 0 ? "#fff" : "#f7f7f7", borderBottom: "1px solid #e0e0e0" }}>
              <td style={{ padding: "11px 14px", fontWeight: 700, color: "#000", minWidth: 160, fontSize: 13 }}>{row.item}</td>
              {isBlips && <td style={{ padding: "11px 14px", color: "#000", minWidth: 140, fontSize: 12, fontFamily: "'Courier New', monospace", fontWeight: 700 }}>{row.source || "—"}</td>}
              <td style={{ padding: "11px 14px", color: "#555", minWidth: 120, fontStyle: "italic", fontSize: 12 }}>{row.type}</td>
              <td style={{ padding: "11px 14px", color: "#333", minWidth: 220, lineHeight: 1.5, fontSize: 12 }}>{row.description}</td>
              <td style={{ padding: "11px 14px", minWidth: 80 }}><InExBadge inEx={row.inEx} /></td>
              <td style={{ padding: "11px 14px", minWidth: 160 }}><EnvBadge env={row.env} /></td>
              <td style={{ padding: "11px 14px", color: "#333", minWidth: 220, fontSize: 12, lineHeight: 1.5 }}>{row.data}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
function Section({ title, items, isOpen, onToggle, t, isBlips }) {
  const icon = SECTION_ICONS[title] || "•";
  return (
    <div style={{ marginBottom: 2, border: "1px solid #000" }}>
      <button onClick={onToggle} style={{ width: "100%", display: "flex", alignItems: "center", gap: 14, padding: "16px 20px", background: isOpen ? "#000" : "#fff", color: isOpen ? "#fff" : "#000", border: "none", cursor: "pointer", textAlign: "left", transition: "background 0.15s" }}>
        <span style={{ fontSize: 18, fontFamily: "monospace", opacity: 0.7 }}>{icon}</span>
        <span style={{ fontWeight: 800, fontSize: 14, letterSpacing: "0.08em", flexGrow: 1, fontFamily: "'Courier New', monospace" }}>{title.toUpperCase()}</span>
        <span style={{ fontSize: 11, fontFamily: "monospace", opacity: 0.6 }}>{(items || []).length} {t.items}</span>
        <span style={{ fontSize: 12, marginLeft: 12, fontFamily: "monospace" }}>{isOpen ? "[ − ]" : "[ + ]"}</span>
      </button>
      {isOpen && <div style={{ borderTop: "1px solid #000" }}><DataTable items={items || []} t={t} isBlips={isBlips} /></div>}
    </div>
  );
}

// ─── SHARED HEADER / FOOTER ───────────────────────────────────────────────────
// ─── CHASS1S WORDMARK ─────────────────────────────────────────────────────────
function CHSLogo({ height = 42 }) {
  return (
    <img
      src="/logo.png"
      alt="CHASS1S"
      style={{ height: height, width: "auto", display: "block", imageRendering: "auto" }}
    />
  );
}

function AppHeader({ lang, setLang, children, user, profile, onOpenAuth, onSignOut, onRefreshProfile,
  workspaces, currentWorkspace, onSwitchWorkspace, onCreateWorkspace, onOpenHistory }) {
  const { isMobile } = useResponsive();
  const [menuOpen, setMenuOpen] = useState(false);
  const authRef = useRef(null);
  const initials = user ? (user.email || "?").slice(0, 2).toUpperCase() : null;

  return (
    <div style={{ borderBottom: "1px solid #e0e0e0", background: "#fff", padding: isMobile ? "0 16px" : "0 40px" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 0", flexWrap: "nowrap", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, overflow: "hidden" }}>
          <CHSLogo height={isMobile ? 32 : 42} />
          <div style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
            <span style={{ fontFamily: "'Courier New', monospace", fontSize: 11, color: "#111", letterSpacing: "0.08em", fontWeight: 700, whiteSpace: "nowrap" }}>Bo11y FRAMEWORK</span>
            <a href="http://boss.technology" target="_blank" rel="noopener noreferrer" style={{ fontFamily: "'Courier New', monospace", fontSize: isMobile ? 9 : 10, color: "#888", letterSpacing: "0.06em", fontWeight: 700, textDecoration: "none" }}>a Boss.Technology</a>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: isMobile ? 10 : 16, flexShrink: 0 }}>
          {children}
          {/* ── Profile / Guest Button ── */}
          <div ref={authRef} style={{ position: "relative" }}>
            {!user ? (
              <button onClick={() => setMenuOpen(o => !o)}
                title="Language & sign in"
                style={{ display: "flex", alignItems: "center", justifyContent: "center",
                  width: 34, height: 34, borderRadius: "50%", border: "1px solid #d0d0d0",
                  background: menuOpen ? "#000" : "#fff", cursor: "pointer", transition: "all 0.15s" }}
                onMouseEnter={e => { e.currentTarget.style.background = "#000"; e.currentTarget.querySelector("svg").style.stroke = "#fff"; }}
                onMouseLeave={e => { if (!menuOpen) { e.currentTarget.style.background = "#fff"; e.currentTarget.querySelector("svg").style.stroke = "#888"; } }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                  stroke={menuOpen ? "#fff" : "#888"} strokeWidth="2" strokeLinecap="round"
                  strokeLinejoin="round" style={{ transition: "stroke 0.15s" }}>
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                  <circle cx="12" cy="7" r="4"/>
                </svg>
              </button>
            ) : (
              <button onClick={() => setMenuOpen(o => !o)}
                title={user.email}
                style={{ display: "flex", alignItems: "center", gap: 8, background: "transparent",
                  border: "1px solid #d0d0d0", padding: "4px 10px 4px 6px", cursor: "pointer",
                  borderRadius: 2, transition: "all 0.15s" }}
                onMouseEnter={e => e.currentTarget.style.borderColor = "#000"}
                onMouseLeave={e => e.currentTarget.style.borderColor = "#d0d0d0"}>
                <div style={{ width: 24, height: 24, borderRadius: "50%", background: "#000",
                  display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <span style={{ fontFamily: "'Courier New', monospace", fontSize: 9,
                    fontWeight: 900, color: "#fff", lineHeight: 1 }}>{initials}</span>
                </div>
                {profile && (
                  <span style={{ fontFamily: "'Courier New', monospace", fontSize: 11,
                    fontWeight: 900, color: "#000", letterSpacing: "0.04em" }}>
                    {typeof profile.token_balance === "number"
                      ? profile.token_balance % 1 === 0
                        ? profile.token_balance
                        : profile.token_balance.toFixed(2)
                      : "—"}
                    <span style={{ fontSize: 9, color: "#888", marginLeft: 3, fontWeight: 400 }}>TKN</span>
                  </span>
                )}
              </button>
            )}
            {/* Menus */}
            {menuOpen && !user && (
              <GuestMenu
                lang={lang} setLang={setLang}
                onOpenAuth={(mode) => { onOpenAuth(mode); setMenuOpen(false); }}
                onClose={() => setMenuOpen(false)}
              />
            )}
            {menuOpen && user && (
              <AccountMenu
                user={user} profile={profile} lang={lang} setLang={setLang}
                onSignOut={onSignOut} onRefreshProfile={onRefreshProfile}
                workspaces={workspaces || []} currentWorkspace={currentWorkspace}
                onSwitchWorkspace={onSwitchWorkspace} onCreateWorkspace={onCreateWorkspace}
                onOpenHistory={() => { onOpenHistory(); setMenuOpen(false); }}
                onClose={() => setMenuOpen(false)}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
function AppFooter({ t }) {
  const { isMobile } = useResponsive();
  return (
    <div style={{ borderTop: "3px solid #000", background: "#000", padding: isMobile ? "14px 16px" : "18px 40px" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div style={{ fontFamily: "'Courier New', monospace", fontSize: 11, color: "#888", letterSpacing: "0.1em" }}>CHASS1S · BUSINESS OBSERVABILITY FRAMEWORK</div>
        <a href="http://boss.technology" target="_blank" rel="noopener noreferrer" style={{ fontFamily: "'Courier New', monospace", fontSize: 11, color: "#fff", letterSpacing: "0.1em", fontWeight: 700, textDecoration: "none" }}>a Boss.Technology</a>
      </div>
    </div>
  );
}

// ─── BEYOND PROFIT SELECTOR ──────────────────────────────────────────────────
function BeyondProfitSelector({ t, beyondProfitSelections, setBeyondProfitSelections, isMobile }) {
  const [tooltipOpen, setTooltipOpen] = useState(false);
  const tooltipRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (tooltipRef.current && !tooltipRef.current.contains(e.target)) setTooltipOpen(false);
    };
    if (tooltipOpen) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [tooltipOpen]);

  return (
    <div style={{ width: "100%", marginBottom: 16 }}>
      <div style={{ padding: "16px 20px", border: "1px solid #e0e0e0", borderRadius: 2 }}>

        {/* Title row with (i) */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
          <span style={{ fontFamily: "'Courier New', monospace", fontSize: 11, fontWeight: 900, letterSpacing: "0.15em", color: "#000" }}>
            {t.beyondProfit}
          </span>
          <span style={{ fontFamily: "'Courier New', monospace", fontSize: 9, color: "#aaa", fontWeight: 400, letterSpacing: "0.1em" }}>
            {t.beyondProfitSub.toUpperCase()}
          </span>

          {/* (i) button with floating tooltip */}
          <div ref={tooltipRef} style={{ position: "relative", display: "inline-flex" }}>
            <button
              onClick={() => setTooltipOpen(o => !o)}
              style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 16, height: 16, borderRadius: "50%", border: "1px solid #bbb", background: tooltipOpen ? "#000" : "#fff", color: tooltipOpen ? "#fff" : "#888", fontFamily: "'Courier New', monospace", fontSize: 9, fontWeight: 900, cursor: "pointer", lineHeight: 1, padding: 0, transition: "all 0.15s", flexShrink: 0 }}
              aria-label="More information"
            >
              i
            </button>
            {tooltipOpen && (
              <div style={{ position: "absolute", top: "calc(100% + 8px)", left: "50%", transform: "translateX(-50%)", background: "#fff", border: "1px solid #000", borderRadius: 2, padding: "12px 16px", width: 260, zIndex: 200, boxShadow: "0 4px 20px rgba(0,0,0,0.12)" }}>
                {/* Arrow */}
                <div style={{ position: "absolute", top: -6, left: "50%", transform: "translateX(-50%)", width: 10, height: 10, background: "#fff", border: "1px solid #000", borderBottom: "none", borderRight: "none", transform: "translateX(-50%) rotate(45deg)" }} />
                <p style={{ fontFamily: "'Courier New', monospace", fontSize: 10, color: "#333", lineHeight: 1.7, margin: 0, letterSpacing: "0.03em" }}>
                  {t.beyondProfitDesc}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Checkboxes row */}
        <div style={{ display: "flex", gap: isMobile ? 12 : 20, flexWrap: "wrap" }}>
          {Object.keys(t.bpOptions).map(opt => {
            const isChecked = beyondProfitSelections.includes(opt);
            return (
              <label key={opt} style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", userSelect: "none" }}
                onClick={() => setBeyondProfitSelections(prev => isChecked ? prev.filter(o => o !== opt) : [...prev, opt])}>
                <div style={{ width: 16, height: 16, border: isChecked ? "2px solid #000" : "2px solid #ccc", background: isChecked ? "#000" : "#fff", borderRadius: 2, display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s", flexShrink: 0 }}>
                  {isChecked && <span style={{ color: "#fff", fontSize: 10, lineHeight: 1 }}>✓</span>}
                </div>
                <span style={{ fontFamily: "'Courier New', monospace", fontSize: 11, fontWeight: isChecked ? 900 : 400, color: isChecked ? "#000" : "#888", letterSpacing: "0.06em", transition: "all 0.15s" }}>
                  {t.bpOptions[opt]}
                </span>
              </label>
            );
          })}
        </div>

      </div>
    </div>
  );
}

// ─── PAGE 1 ───────────────────────────────────────────────────────────────────
function Page1({ onSubmit, lang, setLang, user, profile, onOpenAuth, onSignOut, onRefreshProfile,
  workspaces, currentWorkspace, onSwitchWorkspace, onCreateWorkspace, onOpenHistory, onBuyTokens }) {
  const t = T[lang];
  const tiers = getTiers(lang);
  const { isMobile, isTablet } = useResponsive();
  const [input, setInput] = useState("");
  const [focused, setFocused] = useState(false);
  const [selectedTierId, setSelectedTierId] = useState("compact");
  const [beyondProfitSelections, setBeyondProfitSelections] = useState([]);
  const [exampleIndex, setExampleIndex] = useState(0);
  const [typedExample, setTypedExample] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const typingRef = useRef(null);

  useEffect(() => {
    if (focused || input) return;
    let i = 0;
    setIsTyping(true);
    setTypedExample("");
    const current = t.examples[exampleIndex % t.examples.length];
    const type = () => {
      if (i <= current.length) { setTypedExample(current.slice(0, i)); i++; typingRef.current = setTimeout(type, 42); }
      else {
        setIsTyping(false);
        typingRef.current = setTimeout(() => {
          let j = current.length;
          const erase = () => {
            if (j >= 0) { setTypedExample(current.slice(0, j)); j--; typingRef.current = setTimeout(erase, 22); }
            else setExampleIndex(p => (p + 1) % t.examples.length);
          };
          erase();
        }, 2200);
      }
    };
    typingRef.current = setTimeout(type, 600);
    return () => clearTimeout(typingRef.current);
  }, [exampleIndex, focused, input, lang]);

  const selectedTier = tiers.find(ti => ti.id === selectedTierId);
  const tokenCost = (TIER_TOKEN_COST[selectedTierId] || 1) + (beyondProfitSelections.length * BP_TOKEN_COST);
  const activeBalance = currentWorkspace
    ? (currentWorkspace.token_balance || 0)
    : (profile?.token_balance || 0);
  const hasEnoughTokens = user && activeBalance >= tokenCost;

  const handleFabricateClick = () => {
    if (!input.trim()) return;
    if (!user) { onOpenAuth("signup"); return; }
    if (!hasEnoughTokens) return; // handled via inline message
    onSubmit(input.trim(), selectedTier, beyondProfitSelections);
  };

  return (
    <div style={{ fontFamily: "'Georgia', serif", minHeight: "100vh", background: "#fff", display: "flex", flexDirection: "column" }}>
      <AppHeader lang={lang} setLang={setLang} user={user} profile={profile} onOpenAuth={onOpenAuth} onSignOut={onSignOut} onRefreshProfile={onRefreshProfile}
        workspaces={workspaces} currentWorkspace={currentWorkspace} onSwitchWorkspace={onSwitchWorkspace} onCreateWorkspace={onCreateWorkspace} onOpenHistory={onOpenHistory} />
      <main style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: isMobile ? "32px 20px" : isTablet ? "48px 32px" : "60px 48px" }}>
        <div style={{ width: "100%", maxWidth: 800, display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div style={{ textAlign: "center", marginBottom: isMobile ? 32 : 48 }}>
            <h1 style={{ fontSize: isMobile ? 32 : isTablet ? 40 : 48, fontWeight: 900, letterSpacing: "-0.03em", color: "#000", margin: 0, lineHeight: 1.05 }}>{t.pageTitle}</h1>
          </div>

          {/* Tier Cards */}
          <div style={{ width: "100%", marginBottom: 24 }}>
            {isMobile ? (
              /* ── Mobile slider ── */
              (() => {
                const sliderIdx = tiers.findIndex(t => t.id === selectedTierId);
                const tier = tiers[sliderIdx];
                const touchStartX = useRef(null);
                const handleTouchStart = (e) => { touchStartX.current = e.touches[0].clientX; };
                const handleTouchEnd = (e) => {
                  if (touchStartX.current === null) return;
                  const dx = e.changedTouches[0].clientX - touchStartX.current;
                  touchStartX.current = null;
                  if (Math.abs(dx) < 40) return;
                  if (dx < 0) setSelectedTierId(tiers[(sliderIdx + 1) % tiers.length].id);
                  else setSelectedTierId(tiers[(sliderIdx - 1 + tiers.length) % tiers.length].id);
                };
                return (
                  <div style={{ width: "100%" }}
                    onTouchStart={handleTouchStart}
                    onTouchEnd={handleTouchEnd}>
                    <div style={{ padding: "14px 12px", background: "#000", color: "#fff", border: "2px solid #000", borderRadius: 2, textAlign: "left", height: 160, boxSizing: "border-box", display: "flex", flexDirection: "column" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
                        <div style={{ fontFamily: "'Courier New', monospace", fontWeight: 900, fontSize: 12, letterSpacing: "0.1em" }}>{tier.label.toUpperCase()}</div>
                        <div style={{ fontFamily: "'Courier New', monospace", fontSize: 9, fontWeight: 700, color: "#888", letterSpacing: "0.06em" }}>{sliderIdx + 1} / {tiers.length}</div>
                      </div>
                      <div style={{ fontFamily: "'Courier New', monospace", fontSize: 10, fontWeight: 700, color: "#888", letterSpacing: "0.06em", marginBottom: 8 }}>
                        {TIER_TOKEN_COST[tier.id]} {TIER_TOKEN_COST[tier.id] === 1 ? "token" : "tokens"}
                      </div>
                      <div style={{ fontSize: 11, lineHeight: 1.6, color: "#ccc", fontFamily: "'Georgia', serif", flex: 1, overflow: "hidden" }}>{tier.description}</div>
                      {/* Dot indicators */}
                      <div style={{ display: "flex", gap: 5, marginTop: 10 }}>
                        {tiers.map((_, i) => (
                          <button key={i} onClick={() => setSelectedTierId(tiers[i].id)}
                            style={{ width: i === sliderIdx ? 16 : 6, height: 6, borderRadius: 3, background: i === sliderIdx ? "#fff" : "#555", border: "none", cursor: "pointer", padding: 0, transition: "all 0.2s" }} />
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })()
            ) : (
              /* ── Desktop grid ── */
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
                {tiers.map(tier => {
                  const isSel = selectedTierId === tier.id;
                  return (
                    <button key={tier.id} onClick={() => setSelectedTierId(tier.id)}
                      style={{ padding: "12px 12px", background: isSel ? "#000" : "#fff", color: isSel ? "#fff" : "#000", border: isSel ? "2px solid #000" : "2px solid #d8d8d8", borderRadius: 2, cursor: "pointer", textAlign: "left", transition: "all 0.15s ease" }}>
                      <div style={{ fontFamily: "'Courier New', monospace", fontWeight: 900, fontSize: 12, letterSpacing: "0.1em", marginBottom: 3 }}>{tier.label.toUpperCase()}</div>
                      <div style={{ fontFamily: "'Courier New', monospace", fontSize: 10, fontWeight: 700, color: isSel ? "#888" : "#aaa", letterSpacing: "0.06em", marginBottom: 6 }}>
                        {TIER_TOKEN_COST[tier.id]} {TIER_TOKEN_COST[tier.id] === 1 ? "token" : "tokens"}
                      </div>
                      <div style={{ fontSize: 11, lineHeight: 1.6, color: isSel ? "#ccc" : "#666", fontFamily: "'Georgia', serif" }}>{tier.description}</div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Input Instruction */}
          <div style={{ width: "100%", textAlign: "center", marginBottom: 14 }}>
            <p style={{ fontFamily: "'Courier New', monospace", fontSize: isMobile ? 10 : 12, color: "#888", letterSpacing: "0.06em", margin: 0, lineHeight: 1.8, whiteSpace: isMobile ? "normal" : "pre-line" }}>{t.inputInstruction}</p>
          </div>

          {/* Textarea */}
          <div style={{ width: "100%", marginBottom: 16 }}>
            <div style={{ position: "relative", border: focused ? "2px solid #000" : "2px solid #d0d0d0", borderRadius: 2, transition: "border-color 0.2s" }}>
              {!input && !focused && (
                <div style={{ position: "absolute", top: 20, left: 20, fontFamily: "'Courier New', monospace", fontSize: 14, color: "#bbb", pointerEvents: "none", zIndex: 1 }}>
                  {typedExample}{isTyping && <span style={{ borderRight: "2px solid #bbb", marginLeft: 1 }}>&nbsp;</span>}
                </div>
              )}
              <textarea value={input} onChange={e => setInput(e.target.value)} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
                onKeyDown={e => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); handleFabricateClick(); } }}
                rows={4} style={{ width: "100%", padding: "18px 20px", fontFamily: "'Georgia', serif", fontSize: 15, color: "#000", border: "none", outline: "none", resize: "none", background: "transparent", lineHeight: 1.7, boxSizing: "border-box", position: "relative", zIndex: 2 }} />
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
              <span style={{ fontFamily: "'Courier New', monospace", fontSize: 10, color: "#aaa", letterSpacing: "0.08em" }}>{t.deployHint}</span>
            </div>
          </div>


          {/* Beyond Profit */}
          <BeyondProfitSelector
            t={t}
            beyondProfitSelections={beyondProfitSelections}
            setBeyondProfitSelections={setBeyondProfitSelections}
            isMobile={isMobile}
          />

          {/* ── START FABRICATING button ── */}
          <button onClick={handleFabricateClick}
            disabled={!input.trim() || (user && !hasEnoughTokens)}
            style={{
              width: "100%", padding: "16px 32px", border: "none", borderRadius: 2,
              fontFamily: "'Courier New', monospace", fontSize: 13, fontWeight: 900,
              letterSpacing: "0.2em", transition: "all 0.2s",
              background: !input.trim() ? "#e8e8e8" : !user ? "#000" : hasEnoughTokens ? "#000" : "#e8e8e8",
              color: !input.trim() ? "#aaa" : !user ? "#fff" : hasEnoughTokens ? "#fff" : "#aaa",
              cursor: !input.trim() || (user && !hasEnoughTokens) ? "not-allowed" : "pointer",
            }}>
            {!user
              ? t.startBtn
              : !hasEnoughTokens
                ? `INSUFFICIENT TOKENS — ${tokenCost % 1 === 0 ? tokenCost : tokenCost.toFixed(2)} REQUIRED`
                : t.startBtn}
          </button>

          {/* ── Auth / Token nudge messages ── */}
          {!user && input.trim() && (
            <div style={{ width: "100%", marginTop: 12, padding: "16px 20px",
              background: "#f8f8f8", border: "1px solid #e0e0e0", borderRadius: 2,
              display: "flex", flexDirection: isMobile ? "column" : "row",
              alignItems: isMobile ? "flex-start" : "center",
              justifyContent: "space-between", gap: 12 }}>
              <div>
                <div style={{ fontFamily: "'Courier New', monospace", fontSize: 11, fontWeight: 900,
                  color: "#000", letterSpacing: "0.08em", marginBottom: 4 }}>
                  AN ACCOUNT IS REQUIRED TO GENERATE A CHASSIS
                </div>
                <div style={{ fontFamily: "'Georgia', serif", fontSize: 13, color: "#666", lineHeight: 1.6 }}>
                  All new accounts receive <strong style={{ color: "#000" }}>5 free tokens</strong> — no credit card required.
                  That's enough for a Compact or Mid-Size Chassis right away.
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                <button onClick={() => onOpenAuth("signup")}
                  style={{ padding: "9px 18px", background: "#000", color: "#fff", border: "none",
                    fontFamily: "'Courier New', monospace", fontSize: 11, fontWeight: 900,
                    letterSpacing: "0.1em", cursor: "pointer", whiteSpace: "nowrap", borderRadius: 2 }}>
                  CREATE ACCOUNT
                </button>
                <button onClick={() => onOpenAuth("signin")}
                  style={{ padding: "9px 18px", background: "#fff", color: "#000",
                    border: "1px solid #000", fontFamily: "'Courier New', monospace", fontSize: 11,
                    fontWeight: 700, letterSpacing: "0.1em", cursor: "pointer", whiteSpace: "nowrap", borderRadius: 2 }}>
                  SIGN IN
                </button>
              </div>
            </div>
          )}

          {user && !hasEnoughTokens && input.trim() && (
            <div style={{ width: "100%", marginTop: 12, padding: "16px 20px",
              background: "#f8f8f8", border: "1px solid #e0e0e0", borderRadius: 2,
              display: "flex", flexDirection: isMobile ? "column" : "row",
              alignItems: isMobile ? "flex-start" : "center",
              justifyContent: "space-between", gap: 12 }}>
              <div>
                <div style={{ fontFamily: "'Courier New', monospace", fontSize: 11, fontWeight: 900,
                  color: "#000", letterSpacing: "0.08em", marginBottom: 4 }}>
                  NOT ENOUGH TOKENS
                </div>
                <div style={{ fontFamily: "'Georgia', serif", fontSize: 13, color: "#666", lineHeight: 1.6 }}>
                  You have <strong style={{ color: "#000" }}>
                    {typeof activeBalance === "number" ? (activeBalance % 1 === 0 ? activeBalance : activeBalance.toFixed(2)) : 0} tokens
                  </strong> in your {currentWorkspace ? `${currentWorkspace.name} workspace` : "account"}.
                  {" "}This tier requires <strong style={{ color: "#000" }}>
                    {tokenCost % 1 === 0 ? tokenCost : tokenCost.toFixed(2)} tokens
                  </strong>.
                </div>
              </div>
              <button
                onClick={onBuyTokens}
                style={{ padding: "9px 18px", background: "#000", color: "#fff", border: "none",
                  fontFamily: "'Courier New', monospace", fontSize: 11, fontWeight: 900,
                  letterSpacing: "0.1em", cursor: "pointer", whiteSpace: "nowrap",
                  flexShrink: 0, borderRadius: 2 }}>
                BUY TOKENS
              </button>
            </div>
          )}

          <div style={{ marginTop: 72, maxWidth: 620, textAlign: "center", borderTop: "1px solid #e8e8e8", paddingTop: 48 }}>
            <div style={{ fontFamily: "'Courier New', monospace", fontSize: 10, letterSpacing: "0.2em", color: "#888", marginBottom: 20 }}>{t.whatIsChs}</div>
            <p style={{ fontSize: 14, lineHeight: 1.9, color: "#444", margin: "0 0 20px" }}>{t.chsDescription}</p>
            <p style={{ fontSize: 13, lineHeight: 1.8, color: "#555", margin: "0 0 12px" }}>
              {t.chsCreditBoss.prefix}<strong style={{ color: "#000", fontWeight: 900 }}>{t.chsCreditBoss.name}</strong>{t.chsCreditBoss.suffix}
            </p>
            <p style={{ fontSize: 13, lineHeight: 1.8, color: "#555", margin: 0 }}>
              {t.chsCreditFederico.prefix}<strong style={{ color: "#000", fontWeight: 900 }}>{t.chsCreditFederico.name}</strong>{t.chsCreditFederico.suffix}
            </p>
          </div>
        </div>
      </main>
      <AppFooter t={t} />
    </div>
  );
}

// ─── LOADING ──────────────────────────────────────────────────────────────────
function LoadingScreen({ input, tierLabel, t }) {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setStep(p => p < t.loadingSteps.length - 1 ? p + 1 : p), 900);
    return () => clearInterval(iv);
  }, []);
  return (
    <div style={{ minHeight: "100vh", background: "#000", display: "flex", alignItems: "center", justifyContent: "center", padding: "32px 20px" }}>
      <div style={{ textAlign: "center", maxWidth: 480 }}>
        <div style={{ fontFamily: "'Courier New', monospace", fontSize: 11, color: "#555", letterSpacing: "0.2em", marginBottom: 8 }}>CHASS1S · {t.tagline}</div>
        {tierLabel && <div style={{ fontFamily: "'Courier New', monospace", fontSize: 10, color: "#444", letterSpacing: "0.15em", marginBottom: 32 }}>{tierLabel.toUpperCase()} CHASSIS</div>}
        <div style={{ fontFamily: "'Courier New', monospace", fontSize: 13, color: "#888", marginBottom: 8, letterSpacing: "0.06em" }}>{t.loadingTitle}</div>
        <div style={{ fontFamily: "'Georgia', serif", fontSize: 18, color: "#fff", marginBottom: 48, lineHeight: 1.5, fontStyle: "italic" }}>"{input}"</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, alignItems: "flex-start", maxWidth: 360, margin: "0 auto" }}>
          {t.loadingSteps.map((s, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, opacity: i <= step ? 1 : 0.2, transition: "opacity 0.4s" }}>
              <span style={{ fontFamily: "monospace", color: i < step ? "#fff" : i === step ? "#888" : "#333", fontSize: 12 }}>{i < step ? "✓" : i === step ? "›" : "·"}</span>
              <span style={{ fontFamily: "'Courier New', monospace", fontSize: 11, color: i <= step ? "#fff" : "#333", letterSpacing: "0.08em" }}>{s}</span>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 48, display: "flex", gap: 6, justifyContent: "center" }}>
          {[0,1,2].map(i => <div key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: "#fff", opacity: 0.3, animation: `pulse 1.2s ease-in-out ${i*0.2}s infinite` }} />)}
        </div>
      </div>
      <style>{`@keyframes pulse{0%,100%{opacity:0.2;transform:scale(0.8)}50%{opacity:1;transform:scale(1)}}`}</style>
    </div>
  );
}

// ─── INTRO TAB ────────────────────────────────────────────────────────────────
function IntroTab({ business, t }) {
  const { isMobile, isTablet } = useResponsive();
  const pad = isMobile ? "24px 16px" : isTablet ? "36px 24px" : "48px 40px";
  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: pad }}>
      <div style={{ borderBottom: "3px solid #000", paddingBottom: 32, marginBottom: 40 }}>
        <p style={{ fontSize: isMobile ? 14 : 16, lineHeight: 1.8, color: "#333", maxWidth: 720, margin: 0 }}>{business.description}</p>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: isMobile ? 24 : 40, marginBottom: 40 }}>
        <div>
          <div style={{ fontFamily: "'Courier New', monospace", fontSize: 11, letterSpacing: "0.15em", color: "#888", marginBottom: 16, borderBottom: "1px solid #000", paddingBottom: 8 }}>{t.businessProfile}</div>
          {(business.about || []).map((item, i) => (
            <div key={i} style={{ display: "flex", borderBottom: "1px solid #eee", padding: "10px 0", flexWrap: isMobile ? "wrap" : "nowrap" }}>
              <span style={{ fontFamily: "'Courier New', monospace", fontSize: 11, color: "#888", minWidth: isMobile ? "100%" : 140, letterSpacing: "0.05em", marginBottom: isMobile ? 2 : 0 }}>{item.label.toUpperCase()}</span>
              <span style={{ fontSize: 13, color: "#000", lineHeight: 1.5 }}>{item.value}</span>
            </div>
          ))}
        </div>
        <div>
          <div style={{ fontFamily: "'Courier New', monospace", fontSize: 11, letterSpacing: "0.15em", color: "#888", marginBottom: 16, borderBottom: "1px solid #000", paddingBottom: 8 }}>{t.whyChassis}</div>
          <p style={{ fontSize: 13, lineHeight: 1.8, color: "#333", margin: "0 0 24px" }}>{business.whyChassis}</p>
          <div style={{ fontFamily: "'Courier New', monospace", fontSize: 11, letterSpacing: "0.15em", color: "#888", marginBottom: 12 }}>{t.keyValuePoints}</div>
          {(business.chassisValue || []).map((v, i) => (
            <div key={i} style={{ display: "flex", gap: 12, marginBottom: 10, alignItems: "flex-start" }}>
              <span style={{ fontFamily: "monospace", fontWeight: 900, fontSize: 14, color: "#000" }}>→</span>
              <span style={{ fontSize: 13, lineHeight: 1.6, color: "#333" }}>{v}</span>
            </div>
          ))}
        </div>
      </div>
      <div style={{ borderTop: "1px solid #000", paddingTop: 40 }}>
        <div style={{ fontFamily: "'Courier New', monospace", fontSize: 11, letterSpacing: "0.15em", color: "#888", marginBottom: 24 }}>{t.frameworkApplied}</div>
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 2 }}>
          {[
            { label: "ADDIS", sub: t.tabs.addisSub, items: "Apps · Data · Dev · Infrastructure · Systems", desc: t.addisDesc },
            { label: "BLIPS", sub: t.tabs.blipsSub, items: "BizOps · Logistics · Inventory · Production · Sales", desc: t.blipsDesc },
          ].map(f => (
            <div key={f.label} style={{ background: "#000", padding: isMobile ? "20px 20px" : "28px 32px", color: "#fff" }}>
              <div style={{ fontFamily: "'Courier New', monospace", fontSize: 22, fontWeight: 900, letterSpacing: "0.1em", marginBottom: 4 }}>{f.label}</div>
              <div style={{ fontFamily: "'Courier New', monospace", fontSize: 10, letterSpacing: "0.15em", color: "#888", marginBottom: 16 }}>{f.sub.toUpperCase()}</div>
              <div style={{ fontFamily: "'Courier New', monospace", fontSize: 11, color: "#aaa", marginBottom: 16 }}>{f.items}</div>
              <p style={{ fontSize: 13, lineHeight: 1.7, color: "#ccc", margin: 0 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── KBRS TAB ─────────────────────────────────────────────────────────────────
function KBRsTab({ kbrs, t }) {
  const { isMobile, isTablet } = useResponsive();
  const pad = isMobile ? "24px 16px" : isTablet ? "36px 24px" : "48px 40px";
  const [openKBR, setOpenKBR] = useState({});
  const toggle = (key) => setOpenKBR(p => ({ ...p, [key]: !p[key] }));
  const total = (kbrs || []).reduce((s, a) => s + (a.results || []).length, 0);
  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: pad }}>
      <div style={{ borderBottom: "3px solid #000", paddingBottom: 32, marginBottom: 40 }}>
        <h2 style={{ fontSize: isMobile ? 28 : 40, fontWeight: 900, margin: "0 0 8px", letterSpacing: "-0.02em", color: "#000" }}>Key Business Results</h2>
        <p style={{ fontFamily: "'Courier New', monospace", fontSize: 12, color: "#888", margin: 0 }}>{total} {t.kbrsAcross} {(kbrs || []).length} {t.businessAreas}</p>
      </div>
      {(kbrs || []).map(area => (
        <div key={area.area} style={{ marginBottom: 40 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16, borderBottom: "2px solid #000", paddingBottom: 12, marginBottom: 2 }}>
            <span style={{ fontSize: 20 }}>{area.icon}</span>
            <span style={{ fontFamily: "'Courier New', monospace", fontWeight: 900, fontSize: isMobile ? 13 : 16, letterSpacing: "0.1em" }}>{area.area.toUpperCase()}</span>
            <span style={{ fontFamily: "'Courier New', monospace", fontSize: 11, color: "#888", marginLeft: "auto" }}>{(area.results || []).length} KBRs</span>
          </div>
          {(area.results || []).map((kbr, i) => (
            <div key={i} style={{ borderBottom: "1px solid #e0e0e0" }}>
              <button onClick={() => toggle(`${area.area}-${i}`)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 16, padding: "16px 4px", background: "transparent", border: "none", cursor: "pointer", textAlign: "left" }}>
                <span style={{ fontFamily: "'Courier New', monospace", fontSize: 11, color: "#888", minWidth: 28 }}>{String(i+1).padStart(2,"0")}</span>
                <span style={{ fontWeight: 700, fontSize: isMobile ? 13 : 14, color: "#000", flexGrow: 1 }}>{kbr.kbr}</span>
                <span style={{ fontFamily: "monospace", fontSize: 14, color: "#000" }}>{openKBR[`${area.area}-${i}`] ? "−" : "+"}</span>
              </button>
              {openKBR[`${area.area}-${i}`] && (
                <div style={{ paddingLeft: isMobile ? 8 : 44, paddingBottom: 20 }}>
                  <p style={{ fontSize: 13, lineHeight: 1.7, color: "#444", margin: "0 0 16px" }}>{kbr.description}</p>
                  <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12 }}>
                    <div style={{ border: "1px solid #000", padding: "12px 16px" }}>
                      <div style={{ fontFamily: "'Courier New', monospace", fontSize: 10, letterSpacing: "0.15em", color: "#888", marginBottom: 6 }}>{t.metric}</div>
                      <div style={{ fontSize: 13, color: "#000", lineHeight: 1.5 }}>{kbr.metric}</div>
                    </div>
                    <div style={{ background: "#000", padding: "12px 16px" }}>
                      <div style={{ fontFamily: "'Courier New', monospace", fontSize: 10, letterSpacing: "0.15em", color: "#888", marginBottom: 6 }}>{t.target}</div>
                      <div style={{ fontSize: 13, color: "#fff", fontWeight: 700, lineHeight: 1.5 }}>{kbr.target}</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}


// ─── BEYOND PROFIT TAB ───────────────────────────────────────────────────────
const BP_ICONS = { CSR: "◈", ESG: "⬡", DEI: "✦", TBL: "▣", Sustainability: "⊕" };
const BP_COLORS = { CSR: "#1a5c3a", ESG: "#1a3a5c", DEI: "#5c1a4a", TBL: "#5c3a1a", Sustainability: "#2d5c1a" };

function BeyondProfitTab({ bpData, selectedOptions, bpLoading, bpError, t }) {
  const { isMobile, isTablet } = useResponsive();
  const pad = isMobile ? "24px 16px" : isTablet ? "36px 24px" : "48px 40px";
  const [openSections, setOpenSections] = useState({});
  const toggleSection = (key) => setOpenSections(p => ({ ...p, [key]: !p[key] }));

  if (bpLoading || !bpData) return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: pad }}>
      <div style={{ borderBottom: "3px solid #000", paddingBottom: 24, marginBottom: 36 }}>
        <h2 style={{ fontSize: isMobile ? 24 : 36, fontWeight: 900, margin: "0 0 8px", letterSpacing: "-0.02em" }}>Beyond Profit</h2>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 400 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#000", animation: "pulse 1.2s ease-in-out 0s infinite" }} />
          <span style={{ fontFamily: "'Courier New', monospace", fontSize: 11, color: "#888", letterSpacing: "0.1em" }}>ANALYZING {selectedOptions.join(" · ")}...</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#000", animation: "pulse 1.2s ease-in-out 0.3s infinite", opacity: 0.4 }} />
          <span style={{ fontFamily: "'Courier New', monospace", fontSize: 11, color: "#bbb", letterSpacing: "0.1em" }}>GATHERING LEGAL & REGULATORY CONTEXT...</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#000", animation: "pulse 1.2s ease-in-out 0.6s infinite", opacity: 0.3 }} />
          <span style={{ fontFamily: "'Courier New', monospace", fontSize: 11, color: "#bbb", letterSpacing: "0.1em" }}>GENERATING INSIGHTS & SUGGESTIONS...</span>
        </div>
      </div>
      <style>{`@keyframes pulse{0%,100%{opacity:0.2;transform:scale(0.8)}50%{opacity:1;transform:scale(1)}}`}</style>
    </div>
  );

  if (bpError) return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: pad }}>
      <div style={{ borderBottom: "3px solid #000", paddingBottom: 24, marginBottom: 36 }}>
        <h2 style={{ fontSize: isMobile ? 24 : 36, fontWeight: 900, margin: "0 0 8px", letterSpacing: "-0.02em" }}>Beyond Profit</h2>
      </div>
      <p style={{ fontFamily: "'Courier New', monospace", fontSize: 12, color: "#888" }}>Could not generate Beyond Profit insights. {bpError}</p>
    </div>
  );

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: pad }}>
      <div style={{ borderBottom: "3px solid #000", paddingBottom: 24, marginBottom: 36 }}>
        <h2 style={{ fontSize: isMobile ? 24 : 36, fontWeight: 900, margin: "0 0 8px", letterSpacing: "-0.02em" }}>{t.beyondProfitTab}</h2>
        <p style={{ fontFamily: "'Courier New', monospace", fontSize: 11, color: "#888", margin: 0, letterSpacing: "0.08em" }}>{t.beyondProfitTabSub.toUpperCase()}</p>
      </div>

      {selectedOptions.map(opt => {
        const data = bpData[opt];
        if (!data) return null;
        const color = BP_COLORS[opt] || "#000";
        const icon = BP_ICONS[opt] || "•";
        const isOpen = openSections[opt] !== false; // default open

        return (
          <div key={opt} style={{ marginBottom: 32, border: "1px solid #e0e0e0" }}>
            {/* Option Header */}
            <button onClick={() => toggleSection(opt)}
              style={{ width: "100%", display: "flex", alignItems: "center", gap: 14, padding: "18px 20px", background: isOpen ? "#000" : "#fff", color: isOpen ? "#fff" : "#000", border: "none", cursor: "pointer", textAlign: "left", transition: "background 0.15s" }}>
              <span style={{ fontSize: 18, opacity: 0.8 }}>{icon}</span>
              <div style={{ flexGrow: 1 }}>
                <div style={{ fontFamily: "'Courier New', monospace", fontWeight: 900, fontSize: 13, letterSpacing: "0.1em" }}>{opt}</div>
                <div style={{ fontFamily: "'Courier New', monospace", fontSize: 10, opacity: 0.6, marginTop: 2, letterSpacing: "0.06em" }}>{data.title}</div>
              </div>
              <span style={{ fontFamily: "monospace", fontSize: 12 }}>{isOpen ? "[ − ]" : "[ + ]"}</span>
            </button>

            {isOpen && (
              <div style={{ borderTop: "1px solid #000" }}>
                {/* Summary */}
                <div style={{ padding: "20px 20px 0" }}>
                  <p style={{ fontSize: 13, lineHeight: 1.8, color: "#333", margin: 0 }}>{data.summary}</p>
                </div>

                {/* Five sections */}
                {[
                  { key: "legal", label: t.bpLabels.legal, icon: "⚖" },
                  { key: "social", label: t.bpLabels.social, icon: "◎" },
                  { key: "regulatory", label: t.bpLabels.regulatory, icon: "▣" },
                  { key: "news", label: t.bpLabels.news, icon: "◈" },
                  { key: "suggestions", label: t.bpLabels.suggestions, icon: "→" },
                ].map(({ key, label, icon: sIcon }) => {
                  const items = data[key] || [];
                  if (!items.length) return null;
                  return (
                    <div key={key} style={{ padding: "16px 20px", borderTop: "1px solid #f0f0f0" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                        <span style={{ fontFamily: "monospace", fontSize: 14 }}>{sIcon}</span>
                        <span style={{ fontFamily: "'Courier New', monospace", fontSize: 10, fontWeight: 900, letterSpacing: "0.15em", color: "#888" }}>{label}</span>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        {items.map((item, i) => (
                          <div key={i} style={{ display: "flex", gap: 12, padding: "10px 14px", background: i % 2 === 0 ? "#fff" : "#f8f8f8", border: "1px solid #eee" }}>
                            <div style={{ minWidth: 4, background: "#000", borderRadius: 2, flexShrink: 0 }} />
                            <div>
                              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 3, color: "#000" }}>{item.title}</div>
                              <div style={{ fontSize: 12, lineHeight: 1.6, color: "#444" }}>{item.description}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── PAGE 2 ───────────────────────────────────────────────────────────────────
function Page2({ chassisData, tier, lang, setLang, beyondProfitSelections, beyondProfitData, setBeyondProfitData, userInput, onNewChassis, user, profile, onOpenAuth, onSignOut, onRefreshProfile,
  workspaces, currentWorkspace, onSwitchWorkspace, onCreateWorkspace, onOpenHistory }) {
  const t = T[lang];
  const { isMobile, isTablet } = useResponsive();
  const [activeTab, setActiveTab] = useState("intro");
  const [openSections, setOpenSections] = useState({});
  const [bpLoading, setBpLoading] = useState(false);
  const [bpError, setBpError] = useState(null);

  // Generate Beyond Profit data after Page2 mounts
  useEffect(() => {
    if (!beyondProfitSelections || beyondProfitSelections.length === 0) return;
    if (beyondProfitData) return; // already generated
    const generate = async () => {
      setBpLoading(true);
      setBpError(null);
      try {
        const res = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-api-key": import.meta.env.VITE_ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" },
          body: JSON.stringify({
            model: "claude-sonnet-4-6",
            max_tokens: 8000,
            messages: [{ role: "user", content: buildBeyondProfitPrompt(userInput, tier, lang, beyondProfitSelections) }],
          }),
        });
        if (!res.ok) throw new Error(`API error: ${res.status}`);
        const apiData = await res.json();
        const raw = apiData.content.filter(b => b.type === "text").map(b => b.text).join("");
        const f = raw.indexOf("{"), l = raw.lastIndexOf("}");
        if (f === -1 || l === -1) throw new Error("No valid JSON in response.");
        const parsed = JSON.parse(raw.slice(f, l + 1));
        setBeyondProfitData(parsed);
      } catch (err) {
        setBpError(err.message);
      } finally {
        setBpLoading(false);
      }
    };
    generate();
  }, []);
  const { business, addis, blips, kbrs } = chassisData;
  const addisKeys = ["Apps","Data","Dev","Infrastructure","Systems"];
  const blipsKeys = ["BizOps","Logistics","Inventory","Production","Sales"];
  const addisData = {}; addisKeys.forEach(k => { addisData[k] = (addis||{})[k]||[]; });
  const blipsData = {}; blipsKeys.forEach(k => { blipsData[k] = (blips||{})[k]||[]; });
  const addisTotal = Object.values(addisData).reduce((s,a)=>s+a.length,0);
  const blipsTotal = Object.values(blipsData).reduce((s,a)=>s+a.length,0);
  const kbrsTotal = (kbrs||[]).reduce((s,a)=>s+(a.results||[]).length,0);

  // Calculate Controlled / Uncontrolled percentages across ADDIS + BLIPS
  const allItems = [...Object.values(addisData).flat(), ...Object.values(blipsData).flat()];
  const controlledCount = allItems.filter(it => it.env === "Controlled").length;
  const uncontrolledCount = allItems.filter(it => it.env === "Uncontrolled" || it.env === "Uncontrolled, Real World").length;
  const totalEnvItems = controlledCount + uncontrolledCount;
  const controlledPct = totalEnvItems > 0 ? Math.round((controlledCount / totalEnvItems) * 100) : 0;
  const uncontrolledPct = totalEnvItems > 0 ? Math.round((uncontrolledCount / totalEnvItems) * 100) : 0;
  const currentSections = activeTab==="ADDIS" ? addisData : blipsData;
  const currentKeys = activeTab==="ADDIS" ? addisKeys : blipsKeys;
  const totalItems = Object.values(currentSections).reduce((s,a)=>s+a.length,0);
  const toggleSec = (key) => setOpenSections(p=>({...p,[key]:!p[key]}));
  const expandAll = () => { const all={}; currentKeys.forEach(s=>all[`${activeTab}-${s}`]=true); setOpenSections(p=>({...p,...all})); };
  const collapseAll = () => { const all={}; currentKeys.forEach(s=>all[`${activeTab}-${s}`]=false); setOpenSections(p=>({...p,...all})); };

  const handlePDF = () => {
    const date = new Date().toLocaleDateString();
    const metaLine = [business.location, business.established ? `EST. ${business.established}` : null, business.type?.toUpperCase(), tier?.label?.toUpperCase()].filter(Boolean).join(" · ");

    const rowsHTML = (items, isBlips) => (items || []).map((row, i) => `
      <tr style="background:${i%2===0?'#fff':'#f8f8f8'}">
        <td style="padding:5px 8px;font-weight:700;font-size:10px;border-bottom:1px solid #eee">${row.item||''}</td>
        ${isBlips ? `<td style="padding:5px 8px;color:#000;font-weight:700;font-family:monospace;font-size:9px;border-bottom:1px solid #eee">${row.source||'—'}</td>` : ''}
        <td style="padding:5px 8px;color:#555;font-style:italic;font-size:10px;border-bottom:1px solid #eee">${row.type||''}</td>
        <td style="padding:5px 8px;color:#333;font-size:10px;border-bottom:1px solid #eee;line-height:1.4">${row.description||''}</td>
        <td style="padding:5px 8px;font-size:9px;border-bottom:1px solid #eee;white-space:nowrap">${row.inEx||''}</td>
        <td style="padding:5px 8px;font-size:9px;border-bottom:1px solid #eee;white-space:nowrap">${row.env||''}</td>
        <td style="padding:5px 8px;color:#444;font-size:10px;border-bottom:1px solid #eee;line-height:1.4">${row.data||''}</td>
      </tr>`).join('');

    const tableHTML = (key, items, isBlips) => {
      const headers = isBlips ? t.tableHeadersBlips : t.tableHeaders;
      return `
      <div style="margin-bottom:16px">
        <div style="background:#000;color:#fff;font-family:monospace;font-size:9px;font-weight:900;letter-spacing:0.1em;padding:5px 10px">${key.toUpperCase()}</div>
        <table style="width:100%;border-collapse:collapse">
          <thead><tr style="background:#f0f0f0">
            ${headers.map(h => `<th style="padding:5px 8px;font-size:8px;font-family:monospace;letter-spacing:0.08em;border-bottom:1px solid #ccc;text-align:left">${h.toUpperCase()}</th>`).join('')}
          </tr></thead>
          <tbody>${rowsHTML(items, isBlips)}</tbody>
        </table>
      </div>`;
    };

    const kbrHTML = (kbrs || []).map(area => `
      <div style="margin-bottom:18px">
        <div style="display:flex;align-items:center;gap:8px;border-bottom:1px solid #000;padding-bottom:6px;margin-bottom:8px">
          <span style="font-size:14px">${area.icon}</span>
          <span style="font-family:monospace;font-weight:900;font-size:11px;letter-spacing:0.1em">${area.area.toUpperCase()}</span>
        </div>
        ${(area.results||[]).map(kbr => `
          <div style="display:grid;grid-template-columns:2fr 1fr 1fr;gap:10px;border-bottom:1px solid #eee;padding:7px 0">
            <div><div style="font-weight:700;font-size:11px;margin-bottom:2px">${kbr.kbr||''}</div><div style="color:#555;font-size:10px;line-height:1.4">${kbr.description||''}</div></div>
            <div><div style="font-family:monospace;font-size:8px;color:#888;letter-spacing:0.1em;margin-bottom:3px">${t.metric}</div><div style="font-size:10px">${kbr.metric||''}</div></div>
            <div><div style="font-family:monospace;font-size:8px;color:#888;letter-spacing:0.1em;margin-bottom:3px">${t.target}</div><div style="font-size:10px;font-weight:700">${kbr.target||''}</div></div>
          </div>`).join('')}
      </div>`).join('');

    const aboutHTML = (business.about||[]).map(item => `
      <div style="display:flex;border-bottom:1px solid #eee;padding:5px 0;font-size:11px">
        <span style="font-family:monospace;font-size:9px;color:#888;min-width:120px;letter-spacing:0.05em;padding-top:1px">${item.label.toUpperCase()}</span>
        <span>${item.value||''}</span>
      </div>`).join('');

    const valueHTML = (business.chassisValue||[]).map(v => `
      <div style="display:flex;gap:8px;margin-bottom:5px;font-size:11px"><span style="font-weight:900">→</span><span>${v}</span></div>`).join('');

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>CHASS1S — ${business.name}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: Georgia, serif; margin: 0; padding: 30px 36px; color: #000; background: #fff; font-size: 12px; }
  @media print {
    @page { margin: 12mm 14mm; size: A4; }
    body { padding: 0; }
    .pb { page-break-before: always; margin-top: 0; padding-top: 0; }
  }
  .label { font-family: monospace; font-size: 9px; letter-spacing: 0.15em; color: #888; margin-bottom: 10px; }
  .sec { font-family: monospace; font-size: 10px; font-weight: 900; letter-spacing: 0.15em; border-bottom: 2px solid #000; padding-bottom: 7px; margin-bottom: 14px; margin-top: 20px; }
</style></head><body>

<div style="border-bottom:3px solid #000;padding-bottom:14px;margin-bottom:28px;display:flex;justify-content:space-between;align-items:flex-end">
  <div>
    <div style="font-family:monospace;font-size:9px;color:#888;letter-spacing:0.15em;margin-bottom:5px">CHASS1S · BUSINESS OBSERVABILITY FRAMEWORK</div>
    <div style="font-size:22px;font-weight:900;letter-spacing:-0.02em;margin-bottom:3px">${business.name}</div>
    <div style="font-family:monospace;font-size:9px;color:#888;letter-spacing:0.06em">${metaLine}</div>
  </div>
  <div style="font-family:monospace;font-size:9px;color:#888;text-align:right">
    <div style="margin-bottom:3px">boss.technology</div>
    <div style="margin-bottom:3px">${date}</div>
    <div>${addisTotal} ADDIS · ${blipsTotal} BLIPS · ${kbrsTotal} KBRs</div>
    <div>${controlledPct}% ${t.pdfControlled} · ${uncontrolledPct}% ${t.pdfUncontrolled}</div>
  </div>
</div>

<div class="sec">${t.tabs.intro}</div>
<p style="font-size:12px;line-height:1.7;color:#333;margin:0 0 20px;max-width:680px">${business.description}</p>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:28px;margin-bottom:32px">
  <div>
    <div class="label">${t.businessProfile}</div>
    ${aboutHTML}
  </div>
  <div>
    <div class="label">${t.whyChassis}</div>
    <p style="font-size:11px;line-height:1.6;color:#333;margin:0 0 12px">${business.whyChassis}</p>
    <div class="label" style="margin-top:12px">${t.keyValuePoints}</div>
    ${valueHTML}
  </div>
</div>

<div class="pb">
  <div class="sec">ADDIS — ${t.tabs.addisSub.toUpperCase()}</div>
  ${addisKeys.map(k => tableHTML(k, addisData[k], false)).join('')}
</div>

<div class="pb">
  <div class="sec">BLIPS — ${t.tabs.blipsSub.toUpperCase()}</div>
  ${blipsKeys.map(k => tableHTML(k, blipsData[k], true)).join('')}
</div>

<div class="pb">
  <div class="sec">${t.kbrTitle.toUpperCase()}</div>
  ${kbrHTML}
</div>

<div style="border-top:2px solid #000;padding-top:10px;margin-top:28px;display:flex;justify-content:space-between;font-family:monospace;font-size:8px;color:#888">
  <span>CHASS1S · BUSINESS OBSERVABILITY FRAMEWORK</span>
  <span>boss.technology</span>
</div>

${(beyondProfitSelections && beyondProfitSelections.length > 0 && beyondProfitData) ? (() => {
    const bpLabels = { legal: t.bpLabels.legal, social: t.bpLabels.social, regulatory: t.bpLabels.regulatory, news: t.bpLabels.news, suggestions: t.bpLabels.suggestions };
    return '<div style="page-break-before:always"><div style="font-family:monospace;font-size:10px;font-weight:900;letter-spacing:0.15em;border-bottom:2px solid #000;padding-bottom:7px;margin-bottom:14px;margin-top:20px">BEYOND PROFIT</div>' +
      beyondProfitSelections.map(opt => {
        const data = beyondProfitData[opt];
        if (!data) return '';
        return '<div style="margin-bottom:20px">' +
          '<div style="background:#000;color:#fff;font-family:monospace;font-size:10px;font-weight:900;padding:6px 12px;margin-bottom:8px">' + opt.toUpperCase() + ' — ' + (data.title||'') + '</div>' +
          '<p style="font-size:11px;line-height:1.6;color:#333;margin:0 0 10px">' + (data.summary||'') + '</p>' +
          Object.entries(bpLabels).map(([key, label]) => {
            const items = data[key] || [];
            if (!items.length) return '';
            return '<div style="margin-bottom:8px"><div style="font-family:monospace;font-size:8px;font-weight:900;letter-spacing:0.15em;color:#888;margin-bottom:4px">' + label + '</div>' +
              items.map((item,i) => '<div style="border-bottom:1px solid #eee;padding:4px 0;font-size:10px;background:' + (i%2===0?'#fff':'#fafafa') + '"><b>' + (item.title||'') + '</b> — ' + (item.description||'') + '</div>').join('') +
              '</div>';
          }).join('') + '</div>';
      }).join('') + '</div>';
  })() : ''}

  <script>setTimeout(function(){ window.print(); }, 400);</script>
</body></html>`;

    // Encode as base64 data URI — works in all sandbox environments
    try {
      const encoded = btoa(unescape(encodeURIComponent(html)));
      const dataUri = `data:text/html;base64,${encoded}`;
      const win = window.open(dataUri, "_blank");
      if (!win) {
        // Fallback: create a temporary anchor and click it
        const a = document.createElement("a");
        a.href = dataUri;
        a.download = `CHASS1S-${business.name.replace(/\s+/g, "-")}.html`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
    } catch(e) {
      console.error("PDF generation error:", e);
    }
  };

  const hasBeyondProfit = beyondProfitSelections && beyondProfitSelections.length > 0;
  const TABS_DATA = [
    { id:"intro", label:t.tabs.intro, subtitle:t.tabs.introSub },
    { id:"ADDIS", label:t.tabs.addis, subtitle:t.tabs.addisSub },
    { id:"BLIPS", label:t.tabs.blips, subtitle:t.tabs.blipsSub },
    { id:"kbrs", label:t.tabs.kbrs, subtitle:t.tabs.kbrsSub },
    ...(hasBeyondProfit ? [{ id:"beyondProfit", label:t.beyondProfitTab, subtitle:t.beyondProfitTabSub }] : []),
  ];
  return (
    <div style={{ fontFamily:"'Georgia',serif", minHeight:"100vh", background:"#fff", display:"flex", flexDirection:"column" }}>
      {/* Shared Header — identical to Page 1 */}
      <AppHeader lang={lang} setLang={setLang} user={user} profile={profile} onOpenAuth={onOpenAuth} onSignOut={onSignOut} onRefreshProfile={onRefreshProfile}
        workspaces={workspaces} currentWorkspace={currentWorkspace} onSwitchWorkspace={onSwitchWorkspace} onCreateWorkspace={onCreateWorkspace} onOpenHistory={onOpenHistory}>
        <button onClick={handlePDF}
          className="no-print"
          title="Download PDF"
          style={{ display:"flex", alignItems:"center", justifyContent:"center", width:36, height:36, background:"transparent", border:"1px solid #d0d0d0", borderRadius:2, cursor:"pointer", transition:"all 0.15s", flexShrink:0 }}
          onMouseEnter={e=>{e.currentTarget.style.background="#000";e.currentTarget.style.borderColor="#000";e.currentTarget.querySelector("svg").style.stroke="#fff";}}
          onMouseLeave={e=>{e.currentTarget.style.background="transparent";e.currentTarget.style.borderColor="#d0d0d0";e.currentTarget.querySelector("svg").style.stroke="#000";}}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transition:"stroke 0.15s" }}>
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
        </button>
      </AppHeader>

      {/* Business name bar + tabs */}
      <div style={{ borderBottom:"1px solid #e0e0e0", background:"#fff", padding: isMobile ? "0 16px" : "0 40px" }}>
        <div style={{ maxWidth:1100, margin:"0 auto" }}>

          {/* Business name row: name + metadata left, counts right */}
          <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", padding:"16px 0 0", flexWrap:"wrap", gap:12 }}>
            <div>
              <div style={{ display:"flex", alignItems:"center", gap:12, flexWrap:"wrap" }}>
                <span style={{ fontSize:22, fontWeight:900, color:"#000", letterSpacing:"-0.02em" }}>{business.name}</span>
                {tier&&<span style={{ fontFamily:"'Courier New',monospace", fontSize:10, fontWeight:900, letterSpacing:"0.12em", background:"#000", color:"#fff", padding:"3px 8px" }}>{tier.label.toUpperCase()}</span>}
              </div>
              <div style={{ fontFamily:"'Courier New',monospace", fontSize:11, color:"#888", letterSpacing:"0.08em", marginTop:4 }}>
                {[business.location, business.established?`EST. ${business.established}`:null, business.type?.toUpperCase()].filter(Boolean).join(" · ")}
              </div>
            </div>
            {/* Counts */}
            <div style={{ display:"flex", alignItems:"center", gap: isMobile ? 14 : 20, flexWrap: "wrap" }}>
              {[{label:"ADDIS",value:addisTotal},{label:"BLIPS",value:blipsTotal},{label:"KBRs",value:kbrsTotal}].map(s=>(
                <div key={s.label} style={{ textAlign:"center" }}>
                  <div style={{ fontWeight:900, fontSize:20, color:"#000", lineHeight:1 }}>{s.value}</div>
                  <div style={{ fontFamily:"'Courier New',monospace", fontSize:10, color:"#888", marginTop:3, letterSpacing:"0.1em" }}>{s.label}</div>
                </div>
              ))}
              {/* Subtle separator */}
              <div style={{ width: 1, height: 36, background: "#e0e0e0" }} />
              {/* Controlled / Uncontrolled percentages */}
              {[{label:"CONTROLLED",value:controlledPct},{label:"UNCONTROLLED",value:uncontrolledPct}].map(s=>(
                <div key={s.label} style={{ textAlign:"center" }}>
                  <div style={{ fontWeight:900, fontSize:20, color:"#000", lineHeight:1 }}>{s.value}%</div>
                  <div style={{ fontFamily:"'Courier New',monospace", fontSize:10, color:"#888", marginTop:3, letterSpacing:"0.1em" }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Tabs */}
          <div style={{ display:"flex", gap:0, marginBottom:-1, overflowX:"auto", WebkitOverflowScrolling:"touch" }} className="no-print">
            {TABS_DATA.map(tab=>{
              const isActive=activeTab===tab.id;
              return (
                <button key={tab.id} onClick={()=>setActiveTab(tab.id)} style={{ padding:"14px 28px", border:"none", borderBottom:isActive?"3px solid #000":"3px solid transparent", background:"transparent", cursor:"pointer", textAlign:"left" }}>
                  <div style={{ fontFamily:"'Courier New',monospace", fontWeight:900, fontSize:13, color:isActive?"#000":"#aaa", letterSpacing:"0.1em" }}>{tab.label}</div>
                  <div style={{ fontFamily:"'Courier New',monospace", fontSize:10, color:isActive?"#555":"#ccc", marginTop:2, letterSpacing:"0.06em" }}>{tab.subtitle.toUpperCase()}</div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
      <div style={{ flex:1 }} className="no-print">
        {activeTab==="intro"&&<IntroTab business={business} t={t}/>}
        {activeTab==="kbrs"&&<KBRsTab kbrs={kbrs||[]} t={t}/>}
        {activeTab==="beyondProfit"&&<BeyondProfitTab bpData={beyondProfitData} selectedOptions={beyondProfitSelections||[]} bpLoading={bpLoading} bpError={bpError} t={t}/>}
        {(activeTab==="ADDIS"||activeTab==="BLIPS")&&(
          <>
            <div style={{ maxWidth:1100, margin:"0 auto", padding: isMobile ? "16px 16px 8px" : "20px 40px 12px", display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:8 }}>
              <span style={{ fontFamily:"'Courier New',monospace", fontSize:12, color:"#888", letterSpacing:"0.08em" }}>{activeTab} · {currentKeys.length} {t.sections} · {totalItems} {t.items}</span>
              <div style={{ display:"flex", gap:8 }}>
                <button onClick={expandAll} style={{ padding:"6px 16px", border:"1px solid #000", background:"#000", color:"#fff", fontFamily:"'Courier New',monospace", fontSize:11, fontWeight:700, cursor:"pointer", letterSpacing:"0.08em" }}>{t.expandAll}</button>
                <button onClick={collapseAll} style={{ padding:"6px 16px", border:"1px solid #ccc", background:"#fff", color:"#888", fontFamily:"'Courier New',monospace", fontSize:11, fontWeight:700, cursor:"pointer", letterSpacing:"0.08em" }}>{t.collapseAll}</button>
              </div>
            </div>
            <div style={{ maxWidth:1100, margin:"0 auto", padding: isMobile ? "0 16px 40px" : "0 40px 60px" }}>
              {currentKeys.map(sectionName=>{
                const key=`${activeTab}-${sectionName}`;
                return <Section key={key} title={sectionName} items={currentSections[sectionName]||[]} isOpen={!!openSections[key]} onToggle={()=>toggleSec(key)} t={t} isBlips={activeTab==="BLIPS"}/>;
              })}
            </div>
          </>
        )}
      </div>

      <AppFooter t={t}/>
    </div>
  );
}

// ─── ROOT APP ─────────────────────────────────────────────────────────────────
export default function App() {

  // ── Detect generation tab ──────────────────────────────────────────────────
  const pendingGenId = new URLSearchParams(window.location.search).get("chassis_gen");

  // ── Viewport meta ──────────────────────────────────────────────────────────
  useEffect(() => {
    let meta = document.querySelector('meta[name="viewport"]');
    if (!meta) { meta = document.createElement('meta'); meta.name = 'viewport'; document.head.appendChild(meta); }
    meta.content = 'width=device-width, initial-scale=1, maximum-scale=1';
  }, []);

  // ── Language ───────────────────────────────────────────────────────────────
  const [lang, setLang] = useState(() => {
    if (pendingGenId) {
      try { const s = JSON.parse(localStorage.getItem(pendingGenId) || "{}"); return s.lang || detectLanguage(); }
      catch { return detectLanguage(); }
    }
    return detectLanguage();
  });

  // ── App state ──────────────────────────────────────────────────────────────
  const [screen, setScreen] = useState(pendingGenId ? "loading" : "page1");
  const [userInput, setUserInput] = useState("");
  const [selectedTier, setSelectedTier] = useState(null);
  const [chassisData, setChassisData] = useState(null);
  const [beyondProfitSelections, setBeyondProfitSelections] = useState([]);
  const [beyondProfitData, setBeyondProfitData] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");

  // ── Auth state ─────────────────────────────────────────────────────────────
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const userRef = useRef(null);
  const profileRef = useRef(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState("signin");

  // ── Workspace state ────────────────────────────────────────────────────────
  const [workspaces, setWorkspaces] = useState([]);
  const [currentWorkspace, setCurrentWorkspace] = useState(null);
  const [workspaceCreateOpen, setWorkspaceCreateOpen] = useState(false);

  // ── History state ──────────────────────────────────────────────────────────
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyOpenChassis, setHistoryOpenChassis] = useState(null);

  const openAuth = (mode = "signin") => { setAuthModalMode(mode); setAuthModalOpen(true); };

  const t = T[lang];

  // ── Fetch user profile ─────────────────────────────────────────────────────
  const fetchProfile = async (userId) => {
    const { data } = await supabase.from("profiles").select("*").eq("id", userId).single();
    if (data) { setProfile(data); profileRef.current = data; }
  };

  // ── Fetch user workspaces ──────────────────────────────────────────────────
  const fetchWorkspaces = async (userId) => {
    const { data: memberships } = await supabase.from("workspace_members").select("*").eq("user_id", userId);
    if (!memberships?.length) { setWorkspaces([]); return; }
    const wsResults = await Promise.all(memberships.map(m => supabase.from("workspaces").select("*").eq("id", m.workspace_id).single()));
    const combined = wsResults.map((r, i) => r.data ? { ...r.data, role: memberships[i].role } : null).filter(Boolean);
    setWorkspaces(combined);
  };

  // ── Auth session listener ─────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) { setUser(session.user); userRef.current = session.user; fetchProfile(session.user.id); fetchWorkspaces(session.user.id); }
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user ?? null;
      setUser(u); userRef.current = u;
      if (u) { fetchProfile(u.id); fetchWorkspaces(u.id); }
      else { setProfile(null); setWorkspaces([]); setCurrentWorkspace(null); }
    });
    return () => subscription.unsubscribe();
  }, []);

  // ── Handle return from Stripe payment ─────────────────────────────────────
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("payment") !== "success" || !user) return;
    try {
      const pending = JSON.parse(localStorage.getItem("chs_pending_purchase") || "null");
      if (pending && pending.userId === user.id && Date.now() - pending.timestamp < 3600000) {
        const newBal = Math.round(((profile?.token_balance || 0) + pending.totalTokens) * 100) / 100;
        supabase.from("profiles").update({ token_balance: newBal }).eq("id", user.id).select().single().then(({ data }) => { if (data) setProfile(data); });
        supabase.from("token_transactions").insert({ user_id: user.id, type: "purchase", amount: pending.totalTokens, usd_amount: pending.amount, promo_code: pending.promoCode || null, description: `Token purchase — $${pending.amount}` });
        localStorage.removeItem("chs_pending_purchase");
      }
    } catch {}
    window.history.replaceState(null, "", window.location.pathname);
  }, [user]);

  // ── Sign out ───────────────────────────────────────────────────────────────
  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setUser(null); setProfile(null); setWorkspaces([]); setCurrentWorkspace(null);
  };

  // ── Save chassis to history ────────────────────────────────────────────────
  const saveChassis = async (parsed, tier, input, bpSelections, currentLang) => {
    const u = userRef.current;
    if (!u) return;
    const cost = (TIER_TOKEN_COST[tier.id] || 1) + (bpSelections.length * BP_TOKEN_COST);
    await supabase.from("chassis_history").insert({
      user_id: u.id,
      workspace_id: currentWorkspace?.id || null,
      business_name: parsed.business?.name || input,
      business_input: input,
      tier: tier.id,
      tokens_consumed: cost,
      chassis_data: parsed,
      beyond_profit_selections: bpSelections,
      lang: currentLang,
    });
  };

  // ── Deduct tokens (personal or workspace) ─────────────────────────────────
  const deductTokens = async (tier, bpSelections, parsed, input, currentLang) => {
    const u = userRef.current;
    const p = profileRef.current;
    if (!u) return;
    const cost = (TIER_TOKEN_COST[tier.id] || 1) + (bpSelections.length * BP_TOKEN_COST);
    if (currentWorkspace) {
      const newBal = Math.max(0, (currentWorkspace.token_balance || 0) - cost);
      const { data } = await supabase.from("workspaces").update({ token_balance: newBal }).eq("id", currentWorkspace.id).select().single();
      if (data) setCurrentWorkspace(prev => ({ ...prev, token_balance: newBal }));
    } else if (p) {
      const newBal = Math.max(0, (p.token_balance || 0) - cost);
      const { data } = await supabase.from("profiles").update({ token_balance: newBal }).eq("id", u.id).select().single();
      if (data) { setProfile(data); profileRef.current = data; }
    }
    await saveChassis(parsed, tier, input, bpSelections, currentLang);
  };

  // ── Core generation logic ─────────────────────────────────────────────────
  const runGeneration = async (input, tier, currentLang, bpSelections) => {
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": import.meta.env.VITE_ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: tier.tokens,
          messages: [{ role: "user", content: buildPrompt(input, tier, currentLang) }],
        }),
      });
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      const apiData = await res.json();
      const raw = apiData.content.filter(b => b.type === "text").map(b => b.text).join("");
      const f = raw.indexOf("{"), l = raw.lastIndexOf("}");
      if (f === -1 || l === -1) throw new Error("No valid JSON found.");
      const parsed = JSON.parse(raw.slice(f, l + 1));
      setChassisData(parsed);
      setScreen("page2");
      await deductTokens(tier, bpSelections, parsed, input, currentLang);
    } catch (err) {
      setErrorMsg(`${err.message}`);
      setScreen("error");
    }
  };

  // ── Auto-generate when this is a new generation tab ───────────────────────
  useEffect(() => {
    if (!pendingGenId) return;
    const stored = localStorage.getItem(pendingGenId);
    if (!stored) { setScreen("page1"); return; }
    let params;
    try { params = JSON.parse(stored); } catch { setScreen("page1"); return; }
    localStorage.removeItem(pendingGenId);
    const { input, tier, bpSelections, lang: storedLang } = params;
    setUserInput(input);
    setSelectedTier(tier);
    setBeyondProfitSelections(bpSelections || []);
    if (storedLang) setLang(storedLang);
    runGeneration(input, tier, storedLang || lang, bpSelections || []);
  }, []);

  // ── generateChassis — opens new tab, Page 1 stays ─────────────────────────
  const generateChassis = (input, tier, bpSelections = []) => {
    const genId = "chassis_gen_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
    localStorage.setItem(genId, JSON.stringify({ input, tier, bpSelections, lang }));
    const newTabUrl = window.location.origin + window.location.pathname + "?chassis_gen=" + genId;
    const newTab = window.open(newTabUrl, "_blank");
    if (!newTab) {
      localStorage.removeItem(genId);
      setUserInput(input); setSelectedTier(tier);
      setBeyondProfitSelections(bpSelections); setBeyondProfitData(null);
      setScreen("loading");
      runGeneration(input, tier, lang, bpSelections);
    }
  };

  // ── Reset to page1 ─────────────────────────────────────────────────────────
  const resetToPage1 = () => {
    setScreen("page1"); setChassisData(null); setUserInput("");
    setBeyondProfitSelections([]); setBeyondProfitData(null); setErrorMsg("");
    if (pendingGenId) window.history.replaceState(null, "", window.location.pathname);
  };

  const [buyTokensOpen, setBuyTokensOpen] = useState(false);

  const authProps = {
    user, profile,
    onOpenAuth: openAuth,
    onSignOut: handleSignOut,
    onRefreshProfile: () => user && fetchProfile(user.id),
    workspaces,
    currentWorkspace,
    onSwitchWorkspace: setCurrentWorkspace,
    onCreateWorkspace: () => setWorkspaceCreateOpen(true),
    onOpenHistory: () => setHistoryOpen(true),
    onBuyTokens: () => setBuyTokensOpen(true),
  };

  const Modals = () => (
    <>
      {authModalOpen && <AuthModal onClose={() => setAuthModalOpen(false)} onSuccess={setUser} initialMode={authModalMode} />}
      {workspaceCreateOpen && <WorkspaceCreateModal user={user} onClose={() => setWorkspaceCreateOpen(false)} onCreated={(ws) => { setWorkspaces(prev => [...prev, ws]); setWorkspaceCreateOpen(false); }} />}
      {buyTokensOpen && user && <TokenPurchaseModal user={user} profile={profile} onClose={() => setBuyTokensOpen(false)} onTokensAdded={() => { fetchProfile(user.id); setBuyTokensOpen(false); }} />}
      {historyOpen && user && <ChassisHistoryModal user={user} onClose={() => setHistoryOpen(false)}
        onOpenChassis={(ch) => {
          if (ch.chassis_data) {
            setChassisData(ch.chassis_data);
            setSelectedTier(getTiers(lang).find(t => t.id === ch.tier) || getTiers(lang)[0]);
            setBeyondProfitSelections(ch.beyond_profit_selections || []);
            setUserInput(ch.business_input || "");
            setScreen("page2");
          }
          setHistoryOpen(false);
        }} />}
    </>
  );

  if (screen === "page1") return (
    <>
      <Page1 onSubmit={generateChassis} lang={lang} setLang={setLang} {...authProps} />
      <Modals />
    </>
  );
  if (screen === "loading") return <LoadingScreen input={userInput} tierLabel={selectedTier?.label} t={t}/>;
  if (screen === "error") return (
    <>
      <div style={{ minHeight:"100vh", background:"#fff", display:"flex", flexDirection:"column", fontFamily:"'Georgia',serif" }}>
        <AppHeader lang={lang} setLang={setLang} {...authProps} />
        <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", padding:48 }}>
          <div style={{ textAlign:"center", maxWidth:480 }}>
            <div style={{ fontFamily:"'Courier New',monospace", fontSize:11, color:"#888", letterSpacing:"0.2em", marginBottom:24 }}>CHASS1S · {t.tagline}</div>
            <h2 style={{ fontSize:28, fontWeight:900, color:"#000", margin:"0 0 16px" }}>{t.errorTitle}</h2>
            <p style={{ fontSize:14, color:"#555", lineHeight:1.7, margin:"0 0 32px" }}>{errorMsg}</p>
            <button onClick={resetToPage1} style={{ padding:"12px 32px", background:"#000", color:"#fff", border:"none", fontFamily:"'Courier New',monospace", fontSize:12, fontWeight:900, letterSpacing:"0.15em", cursor:"pointer" }}>{t.tryAgain}</button>
          </div>
        </div>
        <AppFooter t={t}/>
      </div>
      <Modals />
    </>
  );
  if (screen === "page2" && chassisData) return (
    <>
      <Page2 chassisData={chassisData} tier={selectedTier} lang={lang} setLang={setLang}
        beyondProfitSelections={beyondProfitSelections} beyondProfitData={beyondProfitData}
        setBeyondProfitData={setBeyondProfitData} userInput={userInput} onNewChassis={resetToPage1}
        {...authProps} />
      <Modals />
    </>
  );
  return null;
}

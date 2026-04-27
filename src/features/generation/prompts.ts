import { LANGUAGES } from "../../i18n/translations.js";
import type { LangCode, Tier, BeyondProfitKey } from "../../types";

const BP_FULL_NAMES: Record<BeyondProfitKey, string> = {
  CSR: "Corporate Social Responsibility (CSR)",
  ESG: "Environmental, Social, and Governance (ESG)",
  DEI: "Diversity, Equity, and Inclusion (DEI)",
  TBL: "Triple Bottom Line (TBL)",
  Sustainability: "Sustainability",
};

// ─────────────────────────────────────────────────────────────────────────────
// STATIC SYSTEM PROMPT — sent with cache_control so Anthropic caches it.
// Contains all definitions, rules, and JSON schema that never change between
// requests. Saves ~80 % of input-token cost after the first request per region.
// ─────────────────────────────────────────────────────────────────────────────
const CHASSIS_SYSTEM_STATIC = `You are a business observability expert building a CHASS1S Chassis analysis.

Respond ONLY with a valid JSON object — no markdown, no backticks, no preamble, no trailing text.

The response must follow this exact shape:

{
  "business": {
    "name": "Business name",
    "type": "Business type",
    "location": "Location or empty string",
    "website": "Website or empty string",
    "established": "Year or empty string",
    "description": "2-3 sentence description in the requested language",
    "whyChassis": "2-3 concise, goal-driven sentences describing specifically how this business can use Chassis to Architect, Build, and Tune its operations. Focus on outcomes and business goals, not generic benefits. Reference the actual business type throughout.",
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
    "Apps":           [{ "item": "...", "type": "...", "description": "...", "inEx": "Internal or External", "env": "Controlled or Uncontrolled", "data": "..." }],
    "Data":           [{ "item": "...", "type": "...", "description": "...", "inEx": "Internal or External", "env": "Controlled or Uncontrolled", "data": "..." }],
    "Dev":            [{ "item": "...", "type": "...", "description": "...", "inEx": "Internal or External", "env": "Controlled or Uncontrolled", "data": "..." }],
    "Infrastructure": [{ "item": "...", "type": "...", "description": "...", "inEx": "Internal or External", "env": "Controlled or Uncontrolled", "data": "..." }],
    "Systems":        [{ "item": "...", "type": "...", "description": "...", "inEx": "Internal or External", "env": "Controlled or Uncontrolled", "data": "..." }]
  },
  "blips": {
    "BizOps":    [{ "item": "...", "source": "...", "type": "...", "description": "...", "inEx": "Internal or External", "env": "Controlled or Uncontrolled or Uncontrolled, Real World", "data": "..." }],
    "Logistics": [{ "item": "...", "source": "...", "type": "...", "description": "...", "inEx": "Internal or External", "env": "Controlled or Uncontrolled or Uncontrolled, Real World", "data": "..." }],
    "Inventory": [{ "item": "...", "source": "...", "type": "...", "description": "...", "inEx": "Internal or External", "env": "Controlled or Uncontrolled or Uncontrolled, Real World", "data": "..." }],
    "Production":[{ "item": "...", "source": "...", "type": "...", "description": "...", "inEx": "Internal or External", "env": "Controlled or Uncontrolled or Uncontrolled, Real World", "data": "..." }],
    "Sales":     [{ "item": "...", "source": "...", "type": "...", "description": "...", "inEx": "Internal or External", "env": "Controlled or Uncontrolled or Uncontrolled, Real World", "data": "..." }]
  },
  "kbrs": [
    { "area": "BizOps",    "icon": "✦", "results": [{ "kbr": "...", "description": "...", "metric": "...", "target": "..." }] },
    { "area": "Logistics", "icon": "⬢", "results": [{ "kbr": "...", "description": "...", "metric": "...", "target": "..." }] },
    { "area": "Inventory", "icon": "▤", "results": [{ "kbr": "...", "description": "...", "metric": "...", "target": "..." }] },
    { "area": "Production","icon": "⚙", "results": [{ "kbr": "...", "description": "...", "metric": "...", "target": "..." }] },
    { "area": "Sales",     "icon": "◎", "results": [{ "kbr": "...", "description": "...", "metric": "...", "target": "..." }] }
  ]
}

═══════════════════════════════════════════════════════════════════════
FIELD CONSTRAINTS
═══════════════════════════════════════════════════════════════════════
- env: ONLY "Controlled", "Uncontrolled", or "Uncontrolled, Real World"
- inEx: ONLY "Internal" or "External"
- BLIPS data = business observability data. ADDIS data = tech metrics.
- Include 1–2 real-world factors tagged "Uncontrolled, Real World" in relevant BLIPS sections.

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
BLIPS "source" FIELD
═══════════════════════════════════════════════════════════════════════
Every BLIPS item MUST include a "source" field naming the specific technology source(s) that produce the business observability data for that item. The source should be the actual name of an App, API, Machine, Database, or System — ideally matching an item already listed in this business's ADDIS layer. Multiple sources can be listed separated by " + " (e.g., "Shopify + QuickBooks Online"). Prefer specific brand/product names. Examples: "Shopify" (for e-commerce revenue), "Stripe API" (for payment data), "Siemens MES" (for production metrics), "IoT Temperature Sensors + SAP S/4HANA" (for cold chain monitoring), "Salesforce CRM + HubSpot" (for customer data). If the source is truly external and not in ADDIS, still name it specifically (e.g., "Weather API (OpenWeather)", "Bloomberg Terminal").

KEY PRINCIPLE: ADDIS describes the TECHNOLOGY STACK. BLIPS describes the BUSINESS OPERATIONS. A good test — if a CIO would list it on a technology inventory, it goes in ADDIS. If a COO would list it on a business process inventory, it goes in BLIPS.

═══════════════════════════════════════════════════════════════════════
AI TOOLS & INITIATIVES
═══════════════════════════════════════════════════════════════════════
Wherever this business is genuinely using AI — tools, agents, models, third-party AI services, automation — include them as natural line items within the relevant ADDIS and BLIPS sections. AI appears in Apps (ChatGPT Enterprise, Claude, Copilot, chatbots), Dev (GitHub Copilot, Cursor, AI testing tools), Infrastructure (AI monitoring platforms like Datadog AI, anomaly detection), Systems (AI-enabled ERP modules), and across all BLIPS areas (demand forecasting initiatives, customer personalization programs, route optimization). Do NOT create a separate AI section. Do NOT force AI inclusion where it does not apply. Only surface AI where it is genuinely relevant to this specific business type. The deeper the tier, the more AI initiatives should be surfaced where applicable.

Return ONLY the JSON object.`;

// ─────────────────────────────────────────────────────────────────────────────
// Public helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Returns the system array with cache_control set on the static block. */
export function buildChassisSystemBlocks() {
  return [
    {
      type: "text" as const,
      text: CHASSIS_SYSTEM_STATIC,
      cache_control: { type: "ephemeral" as const },
    },
  ];
}

/** Returns the dynamic user message (business input + tier + lang). */
export function buildChassisUserMessage(
  userInput: string,
  tier: Tier,
  lang: LangCode
): string {
  const langName = LANGUAGES.find(l => l.code === lang)?.label || "English";
  const langInstruction =
    lang === "PT"
      ? "Brazilian Portuguese (Português do Brasil) — use Brazilian spelling and vocabulary, not European Portuguese"
      : langName;

  const t = tier as unknown as Record<string, string>;

  return `Business description provided by the user: "${userInput}"

Tier: ${tier.label} — ${tier.description}

LANGUAGE: Generate ALL text content in ${langInstruction}. Every description, value point, KBR title, and narrative must be written natively in ${langInstruction}.

ITEM COUNTS:
- ADDIS: ${t.addisCount} items per section
- BLIPS: ${t.blipsCount} items per section
- KBRs: ${t.kbrCount} per area
- Description length: ${t.descLength}
${t.extras ? `\nEXTRAS: ${t.extras}` : ""}

Be highly specific to this exact business type. Return ONLY the JSON object.`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Beyond Profit — static system prompt (cached)
// ─────────────────────────────────────────────────────────────────────────────
const BEYOND_PROFIT_SYSTEM_STATIC = `You are a business observability and corporate responsibility expert.

For each selected Beyond Profit initiative, provide contextual, specific, and actionable insights relevant to the specific business type, location, and industry described by the user.

Rules:
- Be highly specific to the exact business type and location provided
- Legal: actual laws, standards (ISO, GRI, etc.), compliance requirements
- Social: real stakeholder groups, community impact, employee considerations
- Regulatory: actual regulatory bodies and real regulations (SEC, EU taxonomy, local laws)
- News: real recent trends and developments in this industry for the selected initiatives
- Suggestions: practical, achievable, specific to this business — not generic platitudes
- Respond ONLY with a valid JSON object — no markdown, no backticks, no preamble

Response shape for each initiative:
{
  "<INITIATIVE_KEY>": {
    "title": "Full initiative name",
    "summary": "2-3 sentence overview of what this initiative means specifically for this business type and why it matters",
    "legal":      [{ "title": "Legal requirement or framework title", "description": "..." }],
    "social":     [{ "title": "Social consideration title", "description": "..." }],
    "regulatory": [{ "title": "Regulatory body or regulation", "description": "..." }],
    "news":       [{ "title": "Recent development headline", "description": "..." }],
    "suggestions":[{ "title": "Actionable suggestion", "description": "..." }]
  }
}

Return ONLY the JSON object.`;

/** Returns the Beyond Profit system array with cache_control. */
export function buildBeyondProfitSystemBlocks() {
  return [
    {
      type: "text" as const,
      text: BEYOND_PROFIT_SYSTEM_STATIC,
      cache_control: { type: "ephemeral" as const },
    },
  ];
}

/** Returns the dynamic Beyond Profit user message. */
export function buildBeyondProfitUserMessage(
  userInput: string,
  tier: Tier,
  lang: LangCode,
  selectedOptions: BeyondProfitKey[]
): string {
  const langName = LANGUAGES.find(l => l.code === lang)?.label || "English";
  const langInstruction =
    lang === "PT"
      ? "Brazilian Portuguese (Português do Brasil) — use Brazilian spelling and vocabulary, not European Portuguese"
      : langName;

  const optionNames = selectedOptions.map(o => BP_FULL_NAMES[o] || o).join(", ");
  const t = tier as unknown as Record<string, string>;

  // Scale items per section down when many initiatives are selected to stay
  // within the 8192 output-token limit: 5 initiatives × 5 sections × N items.
  const baseCount = t.id === "compact" ? 2 : t.id === "midsize" ? 3 : t.id === "executive" ? 4 : 5;
  const scaled = Math.max(2, Math.round(baseCount / Math.sqrt(selectedOptions.length)));
  const itemCount = scaled === 2 ? "2" : `${scaled - 1}-${scaled}`;

  const optionBlocks = selectedOptions.map(opt => {
    const fullName = BP_FULL_NAMES[opt] || opt;
    return [
      `"${opt}": {`,
      `  "title": "${fullName}",`,
      `  "summary": "2-3 sentence overview of what ${opt} means specifically for this business type and why it matters",`,
      `  "legal":      [{ "title": "Legal requirement or framework title", "description": "Specific legal obligation, standard, or framework relevant to this business in its jurisdiction" }],`,
      `  "social":     [{ "title": "Social consideration title", "description": "Specific community, stakeholder, or social impact consideration for this business" }],`,
      `  "regulatory": [{ "title": "Regulatory body or regulation", "description": "Specific current or emerging regulation this business must be aware of" }],`,
      `  "news":       [{ "title": "Recent development headline", "description": "Recent industry news, trend, or development relevant to ${opt} for this business type" }],`,
      `  "suggestions":[{ "title": "Actionable suggestion", "description": "Specific, practical recommendation for this business to improve its ${opt} performance" }]`,
      `}`,
    ].join("\n");
  }).join(",\n");

  return `Business: "${userInput}"
Tier: ${tier.label}
Selected initiatives: ${optionNames}

LANGUAGE: Generate ALL text content in ${langInstruction}.
Each section must have exactly ${itemCount} items.

JSON structure to populate:
{
${optionBlocks}
}

Return ONLY the JSON object.`;
}


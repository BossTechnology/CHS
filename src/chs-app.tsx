import { useState, useEffect, useRef } from "react";
import supabase from "./lib/supabase";
import { useResponsive } from "./hooks/useResponsive";
import { LANGUAGES, detectLanguage, T, TIER_CONFIG, getTiers } from "./i18n/translations.js";
import {
  buildChassisSystemBlocks,
  buildChassisUserMessage,
  buildBeyondProfitSystemBlocks,
  buildBeyondProfitUserMessage,
} from "./features/generation/prompts";
import { AuthModal } from "./features/auth/AuthModal.jsx";
import { FinishCreatingAccount } from "./features/auth/FinishCreatingAccount.jsx";
import { AccountMenu } from "./features/auth/AccountMenu.jsx";
import { SettingsModal } from "./features/auth/SettingsModal.jsx";
import { SupportModal } from "./features/auth/SupportModal.jsx";
import { TokenPurchaseModal } from "./features/billing/TokenPurchaseModal.jsx";
import { WorkspaceCreateModal } from "./features/workspace/WorkspaceCreateModal.jsx";
import { WorkspaceMembersModal } from "./features/workspace/WorkspaceMembersModal.jsx";
import { ChassisHistoryModal } from "./features/history/ChassisHistoryModal.jsx";
import { GuestMenu } from "./shared/ui/GuestMenu.jsx";
import { LangDropdown } from "./shared/ui/LangDropdown.jsx";

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

const TIER_TOKEN_COST = { compact: 3, midsize: 5, executive: 10, luxury: 25 };
const BP_TOKEN_COST = 1;




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
  // Maintain 400×160 native aspect ratio (2.5 : 1)
  const width = Math.round(height * (400 / 160));
  return (
    <img
      src="/logo.png"
      alt="CHASS1S"
      width={width}
      height={height}
      style={{ width, height, display: "block", imageRendering: "auto" }}
    />
  );
}

function AppHeader({ lang, setLang, children = null, user, profile, onOpenAuth, onSignOut, onRefreshProfile,
  workspaces, currentWorkspace, onSwitchWorkspace, onCreateWorkspace, onOpenHistory, onOpenAdmin,
  onOpenSettings, onOpenSupport, chassisCount = 0, lastChassisName = null }) {
  const { isMobile } = useResponsive();
  const [menuOpen, setMenuOpen] = useState(false);
  const authRef = useRef(null);
  const initials = user ? (() => {
    const rawSrc = profile?.display_name?.trim() || user.email || '?';
    const words = rawSrc.split(/\s+/).filter(Boolean);
    return words.length >= 2
      ? (words[0][0] + words[1][0]).toUpperCase()
      : rawSrc.slice(0, 2).toUpperCase();
  })() : null;

  return (
    <div style={{ borderBottom: "1px solid #e0e0e0", background: "#fff", padding: isMobile ? "0 16px" : "0 40px" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 0", flexWrap: "nowrap", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, overflow: "hidden" }}>
          <CHSLogo height={isMobile ? 37 : 56} />
          <div style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
            <span style={{ fontFamily: "'Courier New', monospace", fontSize: 11, color: "#111", letterSpacing: "0.08em", fontWeight: 700, whiteSpace: "nowrap" }}>BO11Y FRAMEWORK</span>
            <a href="http://boss.technology" target="_blank" rel="noopener noreferrer" style={{ fontFamily: "'Courier New', monospace", fontSize: isMobile ? 9 : 10, color: "#888", letterSpacing: "0.06em", fontWeight: 700, textDecoration: "none" }}>a Boss.Technology</a>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: isMobile ? 10 : 16, flexShrink: 0 }}>
          {children}
          {/* ── Admin Button (only for admin users) ── */}
          {profile?.role === "admin" && onOpenAdmin && (
            <button onClick={onOpenAdmin}
              title="Admin Panel"
              style={{ fontFamily: "'Courier New', monospace", fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", padding: "5px 12px", background: "#000", color: "#fff", border: "none", cursor: "pointer", textTransform: "uppercase" }}>
              ADMIN
            </button>
          )}
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
                onOpenSettings={() => { onOpenSettings?.(); setMenuOpen(false); }}
                onOpenSupport={() => { onOpenSupport?.(); setMenuOpen(false); }}
                onClose={() => setMenuOpen(false)}
                t={T[lang]} chassisCount={chassisCount} lastChassisName={lastChassisName}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
// ── Admin Panel ───────────────────────────────────────────────────────────────
function AdminPanel({ onBack, lang, setLang, ...authProps }) {
  const [tab, setTab] = useState("overview");
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [generations, setGenerations] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [promos, setPromos] = useState([]);
  const [workspaceList, setWorkspaceList] = useState([]);
  const [cacheEntries, setCacheEntries] = useState([]);
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [toast, setToast] = useState(null);

  // Token adjustment
  const [adjustEmail, setAdjustEmail] = useState("");
  const [adjustAmt, setAdjustAmt] = useState("");

  // New promo
  const [np, setNp] = useState({ code: "", tokens: "5", max_uses: "100", expires_at: "" });

  const showToast = (msg, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  };

  const load = async (key, fn) => {
    setBusy(b => ({ ...b, [key]: true }));
    try { await fn(); } catch (e) { showToast(e.message, false); }
    setBusy(b => ({ ...b, [key]: false }));
  };

  const fetchOverview = () => load("overview", async () => {
    const { data, error } = await supabase.rpc("admin_get_stats");
    if (error) throw new Error(error.message);
    setStats(data);
  });

  const fetchUsers = () => load("users", async () => {
    const { data, error } = await supabase.rpc("admin_list_users", { p_limit: 100, p_offset: 0 });
    if (error) throw new Error(error.message);
    setUsers((data as any[]) || []);
  });

  const fetchGenerations = () => load("generations", async () => {
    const { data, error } = await supabase.rpc("admin_list_generations", { p_limit: 100, p_offset: 0 });
    if (error) throw new Error(error.message);
    setGenerations((data as any[]) || []);
  });

  const fetchPurchases = () => load("purchases", async () => {
    const { data, error } = await supabase.rpc("admin_list_purchases", { p_limit: 100, p_offset: 0 });
    if (error) throw new Error(error.message);
    setPurchases((data as any[]) || []);
  });

  const fetchPromos = () => load("promos", async () => {
    const { data, error } = await supabase.rpc("admin_list_promos");
    if (error) throw new Error(error.message);
    setPromos((data as any[]) || []);
  });

  const fetchWorkspaces = () => load("workspaces", async () => {
    const { data, error } = await supabase.rpc("admin_list_workspaces");
    if (error) throw new Error(error.message);
    setWorkspaceList((data as any[]) || []);
  });

  const fetchCache = () => load("cache", async () => {
    const { data, error } = await supabase.rpc("admin_list_cache", { p_limit: 30 });
    if (error) throw new Error(error.message);
    setCacheEntries((data as any[]) || []);
  });

  useEffect(() => {
    if (tab === "overview") fetchOverview();
    else if (tab === "users") fetchUsers();
    else if (tab === "generations") fetchGenerations();
    else if (tab === "purchases") fetchPurchases();
    else if (tab === "promos") fetchPromos();
    else if (tab === "workspaces") fetchWorkspaces();
    else if (tab === "cache") fetchCache();
  }, [tab]);

  const handleAdjustTokens = async () => {
    const u = users.find(x => x.email === adjustEmail.trim());
    if (!u) return showToast("User not found", false);
    const amt = parseFloat(adjustAmt);
    if (isNaN(amt) || amt === 0) return showToast("Enter a valid amount", false);
    await load("adjust", async () => {
      const { data, error } = await supabase.rpc("admin_adjust_tokens", { p_user_id: u.id, p_amount: amt });
      if (error) throw new Error(error.message);
      showToast(`✓ New balance: ${data} tokens`);
      setAdjustEmail(""); setAdjustAmt("");
      fetchUsers();
    });
  };

  const handleCreatePromo = async () => {
    if (!np.code.trim() || !np.tokens || !np.max_uses) return showToast("Fill all required fields", false);
    await load("createPromo", async () => {
      const { error } = await supabase.rpc("admin_create_promo", {
        p_code: np.code.trim().toUpperCase(),
        p_bonus_tokens: parseFloat(np.tokens),
        p_max_uses: parseInt(np.max_uses),
        p_expires_at: np.expires_at || null,
      });
      if (error) throw new Error(error.message);
      showToast("✓ Promo code created");
      setNp({ code: "", tokens: "5", max_uses: "100", expires_at: "" });
      fetchPromos();
    });
  };

  const handleTogglePromo = async (code, active) => {
    await load(`promo_${code}`, async () => {
      const { error } = await supabase.rpc("admin_toggle_promo", { p_code: code, p_active: !active });
      if (error) throw new Error(error.message);
      showToast(`✓ ${code} ${!active ? "activated" : "deactivated"}`);
      fetchPromos();
    });
  };

  const handleClearCache = async () => {
    if (!confirm("Delete all cache entries? This cannot be undone.")) return;
    await load("clearCache", async () => {
      const { data, error } = await supabase.rpc("admin_clear_cache");
      if (error) throw new Error(error.message);
      showToast(`✓ Deleted ${data} cache entries`);
      fetchCache();
      if (tab === "overview") fetchOverview();
    });
  };

  // ── Shared styles ──
  const S = {
    page: { minHeight: "100vh", background: "#f8f8f8", fontFamily: "'Courier New', monospace" } as React.CSSProperties,
    header: { background: "#000", padding: "16px 32px", display: "flex", alignItems: "center", justifyContent: "space-between" } as React.CSSProperties,
    tabs: { background: "#fff", borderBottom: "1px solid #e0e0e0", padding: "0 32px", display: "flex", gap: 0 } as React.CSSProperties,
    tab: (active: boolean): React.CSSProperties => ({ padding: "14px 20px", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", cursor: "pointer", border: "none", background: "transparent", borderBottom: active ? "2px solid #000" : "2px solid transparent", color: active ? "#000" : "#888", textTransform: "uppercase", transition: "all 0.15s" }),
    body: { padding: "32px", maxWidth: 1200, margin: "0 auto" } as React.CSSProperties,
    card: { background: "#fff", border: "1px solid #e0e0e0", borderRadius: 4, padding: 24, marginBottom: 24 } as React.CSSProperties,
    kpi: { background: "#fff", border: "1px solid #e0e0e0", borderRadius: 4, padding: "20px 24px", textAlign: "center" } as React.CSSProperties,
    kpiVal: { fontSize: 32, fontWeight: 900, color: "#000", lineHeight: 1 } as React.CSSProperties,
    kpiLabel: { fontSize: 10, color: "#888", letterSpacing: "0.12em", marginTop: 6, textTransform: "uppercase" } as React.CSSProperties,
    table: { width: "100%", borderCollapse: "collapse", fontSize: 12 } as React.CSSProperties,
    th: { padding: "8px 12px", textAlign: "left", borderBottom: "2px solid #000", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "#444" } as React.CSSProperties,
    td: { padding: "10px 12px", borderBottom: "1px solid #f0f0f0", color: "#222", verticalAlign: "top" } as React.CSSProperties,
    badge: (color: string): React.CSSProperties => ({ display: "inline-block", padding: "2px 8px", borderRadius: 2, fontSize: 10, fontWeight: 700, background: color === "green" ? "#e6f4ea" : color === "red" ? "#fce8e6" : "#f0f0f0", color: color === "green" ? "#1a7340" : color === "red" ? "#c5221f" : "#555", letterSpacing: "0.08em" }),
    input: { padding: "8px 12px", border: "1px solid #d0d0d0", fontSize: 12, fontFamily: "'Courier New', monospace", width: "100%", boxSizing: "border-box", outline: "none" } as React.CSSProperties,
    btn: (variant = "primary"): React.CSSProperties => ({ padding: "8px 20px", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", cursor: "pointer", border: "none", fontFamily: "'Courier New', monospace", textTransform: "uppercase", background: variant === "primary" ? "#000" : variant === "danger" ? "#c5221f" : "#f0f0f0", color: variant === "secondary" ? "#333" : "#fff", transition: "opacity 0.15s" }),
    sectionTitle: { fontSize: 11, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", color: "#888", marginBottom: 16 } as React.CSSProperties,
  };

  const fmtDate = (d) => d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";
  const fmtNum = (n) => n != null ? Number(n).toLocaleString() : "—";

  const TABS = [
    { id: "overview", label: "Overview" },
    { id: "users", label: "Users" },
    { id: "generations", label: "Generations" },
    { id: "purchases", label: "Purchases" },
    { id: "promos", label: "Promos" },
    { id: "workspaces", label: "Workspaces" },
    { id: "cache", label: "Cache" },
  ];

  return (
    <div style={S.page}>
      {/* Header */}
      <div style={S.header}>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <button onClick={onBack} style={{ background: "none", border: "1px solid #444", color: "#aaa", padding: "6px 14px", fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", cursor: "pointer", fontFamily: "'Courier New', monospace" }}>← BACK</button>
          <span style={{ fontFamily: "'Courier New', monospace", fontSize: 13, fontWeight: 900, color: "#fff", letterSpacing: "0.2em" }}>CHASS1S · ADMIN</span>
        </div>
        <span style={{ fontSize: 10, color: "#555", letterSpacing: "0.1em" }}>{authProps.user?.email}</span>
      </div>

      {/* Tabs */}
      <div style={S.tabs}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={S.tab(tab === t.id)}>{t.label}</button>
        ))}
      </div>

      {/* Toast */}
      {toast && (
        <div style={{ position: "fixed", bottom: 24, right: 24, padding: "12px 20px", background: toast.ok ? "#000" : "#c5221f", color: "#fff", fontSize: 12, fontFamily: "'Courier New', monospace", letterSpacing: "0.08em", zIndex: 9999, borderRadius: 2 }}>
          {toast.msg}
        </div>
      )}

      <div style={S.body}>

        {/* ── OVERVIEW ── */}
        {tab === "overview" && (
          <div>
            {busy.overview && <div style={{ color: "#888", fontSize: 12, marginBottom: 16 }}>Loading…</div>}
            {stats && (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 16, marginBottom: 32 }}>
                  {[
                    { val: fmtNum(stats.total_users), label: "Total Users" },
                    { val: fmtNum(stats.total_generations), label: "Total Generations" },
                    { val: fmtNum(stats.generations_today), label: "Today" },
                    { val: fmtNum(stats.generations_month), label: "This Month" },
                    { val: fmtNum(stats.tokens_consumed), label: "Tokens Consumed" },
                    { val: fmtNum(stats.tokens_sold), label: "Tokens Sold" },
                    { val: `$${Number(stats.revenue_usd || 0).toFixed(2)}`, label: "Revenue (USD)" },
                    { val: fmtNum(stats.total_workspaces), label: "Workspaces" },
                    { val: fmtNum(stats.cache_entries), label: "Cache Entries" },
                    { val: fmtNum(stats.cache_total_hits), label: "Cache Hits" },
                    { val: fmtNum(stats.pending_purchases), label: "Pending Purchases" },
                  ].map(({ val, label }) => (
                    <div key={label} style={S.kpi}>
                      <div style={S.kpiVal}>{val}</div>
                      <div style={S.kpiLabel}>{label}</div>
                    </div>
                  ))}
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
                  <div style={S.card}>
                    <div style={S.sectionTitle}>Generations by Tier</div>
                    {Object.entries(stats.tier_breakdown || {}).sort((a,b) => (b[1] as number)-(a[1] as number)).map(([tier, cnt]) => (
                      <div key={tier} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #f0f0f0", fontSize: 12 }}>
                        <span style={{ textTransform: "uppercase", letterSpacing: "0.08em" }}>{tier}</span>
                        <strong>{fmtNum(cnt)}</strong>
                      </div>
                    ))}
                  </div>
                  <div style={S.card}>
                    <div style={S.sectionTitle}>Generations by Language</div>
                    {Object.entries(stats.lang_breakdown || {}).sort((a,b) => (b[1] as number)-(a[1] as number)).map(([lang, cnt]) => (
                      <div key={lang} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #f0f0f0", fontSize: 12 }}>
                        <span>{lang}</span>
                        <strong>{fmtNum(cnt)}</strong>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
            <button onClick={fetchOverview} style={{ ...S.btn("secondary"), marginTop: 8 }}>↻ Refresh</button>
          </div>
        )}

        {/* ── USERS ── */}
        {tab === "users" && (
          <div>
            <div style={S.card}>
              <div style={S.sectionTitle}>Adjust Token Balance</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: 8, alignItems: "end" }}>
                <div>
                  <div style={{ fontSize: 10, color: "#888", marginBottom: 4 }}>USER EMAIL</div>
                  <input style={S.input} value={adjustEmail} onChange={e => setAdjustEmail(e.target.value)} placeholder="user@email.com" list="user-emails" />
                  <datalist id="user-emails">{users.map(u => <option key={u.id} value={u.email} />)}</datalist>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: "#888", marginBottom: 4 }}>AMOUNT (±)</div>
                  <input style={{ ...S.input, width: 120 }} value={adjustAmt} onChange={e => setAdjustAmt(e.target.value)} placeholder="+10 or -5" type="number" />
                </div>
                <button onClick={handleAdjustTokens} disabled={busy.adjust} style={S.btn("primary")}>
                  {busy.adjust ? "…" : "Apply"}
                </button>
              </div>
            </div>

            {busy.users && <div style={{ color: "#888", fontSize: 12, marginBottom: 16 }}>Loading…</div>}
            <div style={S.card}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <div style={S.sectionTitle}>{fmtNum(users.length)} Users</div>
                <button onClick={fetchUsers} style={S.btn("secondary")}>↻ Refresh</button>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table style={S.table}>
                  <thead><tr>
                    <th style={S.th}>Email</th>
                    <th style={S.th}>Tokens</th>
                    <th style={S.th}>Role</th>
                    <th style={S.th}>Generations</th>
                    <th style={S.th}>Last Gen</th>
                    <th style={S.th}>Joined</th>
                  </tr></thead>
                  <tbody>
                    {users.map(u => (
                      <tr key={u.id}>
                        <td style={S.td}>{u.email}</td>
                        <td style={S.td}><strong>{Number(u.token_balance).toFixed(2)}</strong></td>
                        <td style={S.td}>
                          <span style={S.badge(u.role === "admin" ? "green" : "default")}>{u.role}</span>
                        </td>
                        <td style={S.td}>{fmtNum(u.generation_count)}</td>
                        <td style={S.td}>{fmtDate(u.last_generation)}</td>
                        <td style={S.td}>{fmtDate(u.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── GENERATIONS ── */}
        {tab === "generations" && (
          <div>
            {busy.generations && <div style={{ color: "#888", fontSize: 12, marginBottom: 16 }}>Loading…</div>}
            <div style={S.card}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <div style={S.sectionTitle}>{fmtNum(generations.length)} Recent Generations</div>
                <button onClick={fetchGenerations} style={S.btn("secondary")}>↻ Refresh</button>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table style={S.table}>
                  <thead><tr>
                    <th style={S.th}>Business</th>
                    <th style={S.th}>User</th>
                    <th style={S.th}>Tier</th>
                    <th style={S.th}>Lang</th>
                    <th style={S.th}>Tokens</th>
                    <th style={S.th}>BP</th>
                    <th style={S.th}>Date</th>
                  </tr></thead>
                  <tbody>
                    {generations.map(g => (
                      <tr key={g.id}>
                        <td style={S.td}>{g.business_name || "—"}</td>
                        <td style={S.td} title={g.user_email}>{(g.user_email || "—").split("@")[0]}</td>
                        <td style={S.td}><span style={S.badge("default")}>{g.tier}</span></td>
                        <td style={S.td}>{g.lang}</td>
                        <td style={S.td}>{Number(g.tokens_consumed).toFixed(2)}</td>
                        <td style={S.td}>{g.has_beyond_profit ? <span style={S.badge("green")}>YES</span> : "—"}</td>
                        <td style={S.td}>{fmtDate(g.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── PURCHASES ── */}
        {tab === "purchases" && (
          <div>
            {busy.purchases && <div style={{ color: "#888", fontSize: 12, marginBottom: 16 }}>Loading…</div>}
            <div style={S.card}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <div style={S.sectionTitle}>{fmtNum(purchases.length)} Purchases</div>
                <button onClick={fetchPurchases} style={S.btn("secondary")}>↻ Refresh</button>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table style={S.table}>
                  <thead><tr>
                    <th style={S.th}>User</th>
                    <th style={S.th}>Amount USD</th>
                    <th style={S.th}>Tokens</th>
                    <th style={S.th}>Promo</th>
                    <th style={S.th}>Status</th>
                    <th style={S.th}>Created</th>
                    <th style={S.th}>Fulfilled</th>
                  </tr></thead>
                  <tbody>
                    {purchases.map(p => (
                      <tr key={p.id}>
                        <td style={S.td} title={p.user_email}>{(p.user_email || "—").split("@")[0]}</td>
                        <td style={S.td}>${Number(p.amount_usd).toFixed(2)}</td>
                        <td style={S.td}>{fmtNum(p.total_tokens)}</td>
                        <td style={S.td}>{p.promo_code || "—"}</td>
                        <td style={S.td}>
                          <span style={S.badge(p.fulfilled_at ? "green" : "red")}>
                            {p.fulfilled_at ? "CREDITED" : "PENDING"}
                          </span>
                        </td>
                        <td style={S.td}>{fmtDate(p.created_at)}</td>
                        <td style={S.td}>{fmtDate(p.fulfilled_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── PROMOS ── */}
        {tab === "promos" && (
          <div>
            <div style={S.card}>
              <div style={S.sectionTitle}>Create Promo Code</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr auto", gap: 8, alignItems: "end" }}>
                {[
                  { label: "CODE", key: "code", placeholder: "SUMMER25" },
                  { label: "BONUS TOKENS", key: "tokens", placeholder: "5" },
                  { label: "MAX USES", key: "max_uses", placeholder: "100" },
                  { label: "EXPIRES (optional)", key: "expires_at", placeholder: "", type: "date" },
                ].map(({ label, key, placeholder, type }) => (
                  <div key={key}>
                    <div style={{ fontSize: 10, color: "#888", marginBottom: 4 }}>{label}</div>
                    <input style={S.input} type={type || "text"} value={np[key]} placeholder={placeholder}
                      onChange={e => setNp(p => ({ ...p, [key]: e.target.value }))} />
                  </div>
                ))}
                <button onClick={handleCreatePromo} disabled={busy.createPromo} style={S.btn("primary")}>
                  {busy.createPromo ? "…" : "Create"}
                </button>
              </div>
            </div>

            {busy.promos && <div style={{ color: "#888", fontSize: 12, marginBottom: 16 }}>Loading…</div>}
            <div style={S.card}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <div style={S.sectionTitle}>Promo Codes</div>
                <button onClick={fetchPromos} style={S.btn("secondary")}>↻ Refresh</button>
              </div>
              <table style={S.table}>
                <thead><tr>
                  <th style={S.th}>Code</th>
                  <th style={S.th}>Bonus Tokens</th>
                  <th style={S.th}>Uses</th>
                  <th style={S.th}>Max Uses</th>
                  <th style={S.th}>Expires</th>
                  <th style={S.th}>Status</th>
                  <th style={S.th}>Action</th>
                </tr></thead>
                <tbody>
                  {promos.map(p => (
                    <tr key={p.code}>
                      <td style={S.td}><strong>{p.code}</strong></td>
                      <td style={S.td}>{fmtNum(p.bonus_tokens)}</td>
                      <td style={S.td}>{fmtNum(p.uses_count)}</td>
                      <td style={S.td}>{fmtNum(p.max_uses)}</td>
                      <td style={S.td}>{fmtDate(p.expires_at)}</td>
                      <td style={S.td}><span style={S.badge(p.active ? "green" : "red")}>{p.active ? "ACTIVE" : "INACTIVE"}</span></td>
                      <td style={S.td}>
                        <button onClick={() => handleTogglePromo(p.code, p.active)}
                          disabled={busy[`promo_${p.code}`]}
                          style={{ ...S.btn(p.active ? "danger" : "secondary"), padding: "4px 12px", fontSize: 10 }}>
                          {p.active ? "Deactivate" : "Activate"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── WORKSPACES ── */}
        {tab === "workspaces" && (
          <div>
            {busy.workspaces && <div style={{ color: "#888", fontSize: 12, marginBottom: 16 }}>Loading…</div>}
            <div style={S.card}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <div style={S.sectionTitle}>{fmtNum(workspaceList.length)} Workspaces</div>
                <button onClick={fetchWorkspaces} style={S.btn("secondary")}>↻ Refresh</button>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table style={S.table}>
                  <thead><tr>
                    <th style={S.th}>Name</th>
                    <th style={S.th}>Owner</th>
                    <th style={S.th}>Token Balance</th>
                    <th style={S.th}>Members</th>
                    <th style={S.th}>Created</th>
                  </tr></thead>
                  <tbody>
                    {workspaceList.map(w => (
                      <tr key={w.id}>
                        <td style={S.td}><strong>{w.name}</strong></td>
                        <td style={S.td}>{w.owner_email || "—"}</td>
                        <td style={S.td}>{Number(w.token_balance).toFixed(2)}</td>
                        <td style={S.td}>{fmtNum(w.member_count)}</td>
                        <td style={S.td}>{fmtDate(w.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── CACHE ── */}
        {tab === "cache" && (
          <div>
            <div style={{ display: "flex", gap: 12, marginBottom: 24 }}>
              <button onClick={fetchCache} style={S.btn("secondary")}>↻ Refresh</button>
              <button onClick={handleClearCache} disabled={busy.clearCache} style={S.btn("danger")}>
                {busy.clearCache ? "…" : "🗑 Clear All Cache"}
              </button>
            </div>
            {busy.cache && <div style={{ color: "#888", fontSize: 12, marginBottom: 16 }}>Loading…</div>}
            <div style={S.card}>
              <div style={S.sectionTitle}>Top {cacheEntries.length} Cached Entries (by hits)</div>
              <div style={{ overflowX: "auto" }}>
                <table style={S.table}>
                  <thead><tr>
                    <th style={S.th}>Input</th>
                    <th style={S.th}>Tier</th>
                    <th style={S.th}>Lang</th>
                    <th style={S.th}>Hits</th>
                    <th style={S.th}>Cached</th>
                    <th style={S.th}>Last Hit</th>
                  </tr></thead>
                  <tbody>
                    {cacheEntries.map(c => (
                      <tr key={c.id}>
                        <td style={{ ...S.td, maxWidth: 320 }} title={c.input_text}>
                          {c.input_text?.slice(0, 80)}{c.input_text?.length > 80 ? "…" : ""}
                        </td>
                        <td style={S.td}><span style={S.badge("default")}>{c.tier_id}</span></td>
                        <td style={S.td}>{c.lang}</td>
                        <td style={S.td}><strong>{fmtNum(c.hit_count)}</strong></td>
                        <td style={S.td}>{fmtDate(c.created_at)}</td>
                        <td style={S.td}>{fmtDate(c.last_hit_at)}</td>
                      </tr>
                    ))}
                    {cacheEntries.length === 0 && !busy.cache && (
                      <tr><td colSpan={6} style={{ ...S.td, textAlign: "center", color: "#aaa", padding: 32 }}>No cache entries yet</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

function AppFooter({ t }) {
  const { isMobile } = useResponsive();
  return (
    <div style={{ borderTop: "3px solid #000", background: "#000", padding: isMobile ? "14px 16px" : "18px 40px" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", textAlign: "center" }}>
        <span style={{ fontFamily: "'Courier New', monospace", fontSize: 11, color: "#888", letterSpacing: "0.1em" }}>©️ 2026 88 GREENWICH AVE LLC d/b/a CHASS1S</span>
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
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
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
              <div style={{ position: "absolute", top: "calc(100% + 8px)", left: "50%", transform: "translateX(-50%)", background: "#fff", border: "1px solid #000", borderRadius: 2, padding: "12px 16px", width: 280, zIndex: 200, boxShadow: "0 4px 20px rgba(0,0,0,0.12)" }}>
                {/* Arrow */}
                <div style={{ position: "absolute", top: -6, left: "50%", width: 10, height: 10, background: "#fff", border: "1px solid #000", borderBottom: "none", borderRight: "none", transform: "translateX(-50%) rotate(45deg)" }} />
                <div style={{ fontFamily: "'Courier New', monospace", fontSize: 10, color: "#333", lineHeight: 2, margin: 0, letterSpacing: "0.03em" }}>
                  {Object.keys(t.bpDefinitions || {}).map(key => (
                    <div key={key} style={{ borderBottom: "1px solid #f0f0f0", paddingBottom: 4, marginBottom: 4 }}>
                      {t.bpDefinitions[key]}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 1 TOKEN PER label */}
          <span style={{ fontFamily: "'Courier New', monospace", fontSize: 9, color: "#888", fontWeight: 700, letterSpacing: "0.08em", marginLeft: 2 }}>
            {t.tokensPer || "1 TOKEN PER"}
          </span>
        </div>

        {/* Checkboxes row */}
        <div style={{ display: "flex", gap: isMobile ? 8 : 20, flexWrap: "nowrap", alignItems: "center", overflowX: "auto" }}>
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
  workspaces, currentWorkspace, onSwitchWorkspace, onCreateWorkspace, onOpenHistory, onBuyTokens, onOpenAdmin, onOpenSettings, onOpenSupport, popupBlocked, chassisCount = 0, lastChassisName = null }) {
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
  const touchStartX = useRef<number | null>(null);

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

  // Mobile tier slider — computed at top level (no hooks inside conditional JSX)
  const sliderIdx = tiers.findIndex(ti => ti.id === selectedTierId);
  const sliderTier = tiers[sliderIdx] ?? tiers[0];
  const handleTouchStart = (e) => { touchStartX.current = e.touches[0].clientX; };
  const handleTouchEnd = (e) => {
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(dx) < 40) return;
    if (dx < 0) setSelectedTierId(tiers[(sliderIdx + 1) % tiers.length].id);
    else setSelectedTierId(tiers[(sliderIdx - 1 + tiers.length) % tiers.length].id);
  };

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
        workspaces={workspaces} currentWorkspace={currentWorkspace} onSwitchWorkspace={onSwitchWorkspace} onCreateWorkspace={onCreateWorkspace} onOpenHistory={onOpenHistory} onOpenAdmin={onOpenAdmin} onOpenSettings={onOpenSettings} onOpenSupport={onOpenSupport} chassisCount={chassisCount} lastChassisName={lastChassisName} />
      <main style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: isMobile ? "32px 20px" : isTablet ? "48px 32px" : "60px 48px" }}>
        <div style={{ width: "100%", maxWidth: 800, display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div style={{ textAlign: "center", marginBottom: isMobile ? 32 : 48 }}>
            <h1 style={{ fontSize: isMobile ? 32 : isTablet ? 40 : 48, fontWeight: 900, letterSpacing: "-0.03em", color: "#000", margin: 0, lineHeight: 1.05 }}>{t.pageTitle}</h1>
          </div>

          {/* Tier Cards */}
          <div style={{ width: "100%", marginBottom: 24 }}>
            {isMobile ? (
              /* ── Mobile slider — no IIFE, all logic lives at Page1 top-level ── */
              <div style={{ width: "100%" }}
                onTouchStart={handleTouchStart}
                onTouchEnd={handleTouchEnd}>
                <div style={{ padding: "14px 12px", background: "#000", color: "#fff", border: "2px solid #000", borderRadius: 2, textAlign: "left", height: 148, boxSizing: "border-box", display: "flex", flexDirection: "column" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
                    <div style={{ fontFamily: "'Courier New', monospace", fontWeight: 900, fontSize: 12, letterSpacing: "0.1em" }}>{sliderTier.label.toUpperCase()}</div>
                    <div style={{ fontFamily: "'Courier New', monospace", fontSize: 9, fontWeight: 700, color: "#888", letterSpacing: "0.06em" }}>{sliderIdx + 1} / {tiers.length}</div>
                  </div>
                  <div style={{ fontFamily: "'Courier New', monospace", fontSize: 10, fontWeight: 700, color: "#888", letterSpacing: "0.06em", marginBottom: 8 }}>
                    {TIER_TOKEN_COST[sliderTier.id]} {TIER_TOKEN_COST[sliderTier.id] === 1 ? "token" : "tokens"}
                  </div>
                  <div style={{ fontSize: 11, lineHeight: 1.6, color: "#ccc", fontFamily: "'Georgia', serif", flex: 1, overflow: "hidden" }}>{sliderTier.description}</div>
                  {/* Dot indicators */}
                  <div style={{ display: "flex", gap: 5, marginTop: 10 }}>
                    {tiers.map((_, i) => (
                      <button key={i} onClick={() => setSelectedTierId(tiers[i].id)}
                        style={{ width: i === sliderIdx ? 16 : 6, height: 6, borderRadius: 3, background: i === sliderIdx ? "#fff" : "#555", border: "none", cursor: "pointer", padding: 0, transition: "all 0.2s" }} />
                    ))}
                  </div>
                </div>
              </div>
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
          </div>


          {/* Beyond Profit */}
          <BeyondProfitSelector
            t={t}
            beyondProfitSelections={beyondProfitSelections}
            setBeyondProfitSelections={setBeyondProfitSelections}
            isMobile={isMobile}
          />

          {/* ── Popup blocked notice ── */}
          {popupBlocked && (
            <div style={{ background: "#fffbe6", border: "1px solid #f0c040", padding: "10px 16px",
              fontFamily: "'Courier New', monospace", fontSize: 11, color: "#7a5c00",
              marginBottom: 12, borderRadius: 2, letterSpacing: "0.04em" }}>
              POPUP BLOCKED — Generating in this tab instead.
            </div>
          )}

          {/* ── START FABRICATING button ── */}
          <button onClick={handleFabricateClick}
            disabled={!input.trim() || (user && !hasEnoughTokens)}
            style={{
              width: "100%", padding: isMobile ? "14px 16px" : "16px 32px", border: "none", borderRadius: 2,
              fontFamily: "'Courier New', monospace", fontSize: isMobile ? 11 : 13, fontWeight: 900,
              letterSpacing: isMobile ? "0.08em" : "0.15em", transition: "all 0.2s", whiteSpace: "nowrap",
              background: !input.trim() ? "#e8e8e8" : !user ? "#000" : hasEnoughTokens ? "#000" : "#e8e8e8",
              color: !input.trim() ? "#aaa" : !user ? "#fff" : hasEnoughTokens ? "#fff" : "#aaa",
              cursor: !input.trim() || (user && !hasEnoughTokens) ? "not-allowed" : "pointer",
            }}>
            {!user
              ? `${t.useTokens || "USE"} ${tokenCost} TOKENS & ${t.startBtn}`
              : !hasEnoughTokens
                ? `INSUFFICIENT TOKENS — ${tokenCost % 1 === 0 ? tokenCost : tokenCost.toFixed(2)} REQUIRED`
                : `${t.useTokens || "USE"} ${tokenCost} TOKENS & ${t.startBtn}`}
          </button>

          {/* ── Auth / Token nudge messages ── */}
          {!user && input.trim() && (
            <div style={{ width: "100%", marginTop: 12, padding: "14px 16px",
              background: "#f8f8f8", border: "1px solid #e0e0e0", borderRadius: 2,
              display: "flex", flexDirection: "row", alignItems: "center",
              justifyContent: "space-between", gap: 8 }}>
              <span style={{ fontFamily: "'Courier New', monospace", fontSize: 10, color: "#666",
                letterSpacing: "0.06em" }}>{t.auth?.freeTokens}</span>
              <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                <button onClick={() => onOpenAuth("signup")}
                  style={{ padding: "8px 14px", background: "#000", color: "#fff", border: "none",
                    fontFamily: "'Courier New', monospace", fontSize: 10, fontWeight: 900,
                    letterSpacing: "0.08em", cursor: "pointer", whiteSpace: "nowrap", borderRadius: 2 }}>
                  {t.auth?.signUpTab}
                </button>
                <button onClick={() => onOpenAuth("signin")}
                  style={{ padding: "8px 14px", background: "#fff", color: "#000",
                    border: "1px solid #000", fontFamily: "'Courier New', monospace", fontSize: 10,
                    fontWeight: 700, letterSpacing: "0.08em", cursor: "pointer", whiteSpace: "nowrap", borderRadius: 2 }}>
                  {t.auth?.signInTab}
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
function LoadingScreen({ input, tierLabel, t, streamedChars = 0, streamPreview = "" }) {
  const [step, setStep] = useState(0);
  const streaming = streamedChars > 0;

  useEffect(() => {
    // Advance steps until streaming starts, then jump to last step
    if (streaming) {
      setStep(t.loadingSteps.length - 1);
      return;
    }
    const iv = setInterval(() => setStep(p => p < t.loadingSteps.length - 1 ? p + 1 : p), 900);
    return () => clearInterval(iv);
  }, [streaming, t.loadingSteps.length]);

  return (
    <div style={{ minHeight: "100vh", background: "#000", display: "flex", alignItems: "center", justifyContent: "center", padding: "32px 20px" }}>
      <div style={{ textAlign: "center", maxWidth: 520 }}>
        <div style={{ fontFamily: "'Courier New', monospace", fontSize: 11, color: "#555", letterSpacing: "0.2em", marginBottom: 8 }}>CHASS1S · {t.tagline}</div>
        {tierLabel && <div style={{ fontFamily: "'Courier New', monospace", fontSize: 10, color: "#444", letterSpacing: "0.15em", marginBottom: 32 }}>{tierLabel.toUpperCase()} CHASSIS</div>}
        <div style={{ fontFamily: "'Courier New', monospace", fontSize: 13, color: "#888", marginBottom: 8, letterSpacing: "0.06em" }}>{t.loadingTitle}</div>
        <div style={{ fontFamily: "'Georgia', serif", fontSize: 18, color: "#fff", marginBottom: 36, lineHeight: 1.5, fontStyle: "italic" }}>"{input}"</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, alignItems: "flex-start", maxWidth: 360, margin: "0 auto" }}>
          {t.loadingSteps.map((s, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, opacity: i <= step ? 1 : 0.2, transition: "opacity 0.4s" }}>
              <span style={{ fontFamily: "monospace", color: i < step ? "#fff" : i === step ? "#888" : "#333", fontSize: 12 }}>{i < step ? "✓" : i === step ? "›" : "·"}</span>
              <span style={{ fontFamily: "'Courier New', monospace", fontSize: 11, color: i <= step ? "#fff" : "#333", letterSpacing: "0.08em" }}>{s}</span>
            </div>
          ))}
        </div>


        {!streaming && (
          <div style={{ marginTop: 32, display: "flex", gap: 6, justifyContent: "center" }}>
            {[0,1,2].map(i => <div key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: "#fff", opacity: 0.3, animation: `pulse 1.2s ease-in-out ${i*0.2}s infinite` }} />)}
          </div>
        )}
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

function BeyondProfitTab({ bpData, selectedOptions, bpLoading, bpError, t, onRetry }) {
  const { isMobile, isTablet } = useResponsive();
  const pad = isMobile ? "24px 16px" : isTablet ? "36px 24px" : "48px 40px";
  const [openSections, setOpenSections] = useState({});
  const toggleSection = (key) => setOpenSections(p => ({ ...p, [key]: !p[key] }));

  if (bpError) return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: pad }}>
      <div style={{ borderBottom: "3px solid #000", paddingBottom: 24, marginBottom: 36 }}>
        <h2 style={{ fontSize: isMobile ? 24 : 36, fontWeight: 900, margin: "0 0 8px", letterSpacing: "-0.02em" }}>Beyond Profit</h2>
      </div>
      <p style={{ fontFamily: "'Courier New', monospace", fontSize: 12, color: "#888", marginBottom: 16 }}>{t.bp?.errorMsg || "Could not generate Beyond Profit insights."} {bpError}</p>
      {onRetry && (
        <button onClick={onRetry} style={{ padding: "10px 24px", background: "#000", color: "#fff", border: "none", borderRadius: 2, fontFamily: "'Courier New', monospace", fontSize: 11, fontWeight: 900, letterSpacing: "0.12em", cursor: "pointer" }}>
          RETRY
        </button>
      )}
    </div>
  );

  if (bpLoading || !bpData) return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: pad }}>
      <div style={{ borderBottom: "3px solid #000", paddingBottom: 24, marginBottom: 36 }}>
        <h2 style={{ fontSize: isMobile ? 24 : 36, fontWeight: 900, margin: "0 0 8px", letterSpacing: "-0.02em" }}>Beyond Profit</h2>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 400 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#000", animation: "pulse 1.2s ease-in-out 0s infinite" }} />
          <span style={{ fontFamily: "'Courier New', monospace", fontSize: 11, color: "#888", letterSpacing: "0.1em" }}>{t.bp?.analyzing || "ANALYZING"} {selectedOptions.join(" · ")}...</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#000", animation: "pulse 1.2s ease-in-out 0.3s infinite", opacity: 0.4 }} />
          <span style={{ fontFamily: "'Courier New', monospace", fontSize: 11, color: "#bbb", letterSpacing: "0.1em" }}>{t.bp?.gatheringContext || "GATHERING LEGAL & REGULATORY CONTEXT..."}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#000", animation: "pulse 1.2s ease-in-out 0.6s infinite", opacity: 0.3 }} />
          <span style={{ fontFamily: "'Courier New', monospace", fontSize: 11, color: "#bbb", letterSpacing: "0.1em" }}>{t.bp?.generatingInsights || "GENERATING INSIGHTS & SUGGESTIONS..."}</span>
        </div>
      </div>
      <style>{`@keyframes pulse{0%,100%{opacity:0.2;transform:scale(0.8)}50%{opacity:1;transform:scale(1)}}`}</style>
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
  workspaces, currentWorkspace, onSwitchWorkspace, onCreateWorkspace, onOpenHistory, onOpenAdmin, onOpenSettings, onOpenSupport, chassisCount = 0, lastChassisName = null }) {
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
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 60000);
      try {
        const { data: { session: bpSession } } = await supabase.auth.getSession();
        const res = await fetch("/api/anthropic", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${bpSession?.access_token}`,
          },
          signal: controller.signal,
          body: JSON.stringify({
            max_tokens: 8192,
            system: buildBeyondProfitSystemBlocks(),
            messages: [{ role: "user", content: buildBeyondProfitUserMessage(userInput, tier, lang, beyondProfitSelections) }],
          }),
        });
        clearTimeout(timeout);
        const raw = await readAnthropicStream(res);
        const f = raw.indexOf("{"), l = raw.lastIndexOf("}");
        if (f === -1 || l === -1) throw new Error("No valid JSON in response.");
        const parsed = JSON.parse(raw.slice(f, l + 1));
        setBeyondProfitData(parsed);
      } catch (err) {
        clearTimeout(timeout);
        if (err.name === "AbortError") setBpError("Request timed out. Please try again.");
        else setBpError(err.message);
      } finally {
        setBpLoading(false);
      }
    };
    generate();
  }, []);
  const { business, addis, blips, kbrs } = chassisData as any;
  const addisKeys = ["Apps","Data","Dev","Infrastructure","Systems"];
  const blipsKeys = ["BizOps","Logistics","Inventory","Production","Sales"];
  const addisData: Record<string, any[]> = {}; addisKeys.forEach(k => { addisData[k] = (addis||{})[k]||[]; });
  const blipsData: Record<string, any[]> = {}; blipsKeys.forEach(k => { blipsData[k] = (blips||{})[k]||[]; });
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
    // HTML-escape every model-derived string before inlining it into the document.
    // The "PDF" is in fact an HTML document opened in a new window, so unescaped
    // model output (vulnerable to prompt injection of `<script>` tags) would
    // execute in the browser context, not just render statically in a PDF.
    const esc = (v) => {
      if (v === null || v === undefined) return '';
      return String(v)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    };

    const date = new Date().toLocaleDateString();
    const metaLine = esc([business.location, business.established ? `EST. ${business.established}` : null, business.type?.toUpperCase(), tier?.label?.toUpperCase()].filter(Boolean).join(" · "));

    const rowsHTML = (items, isBlips) => (items || []).map((row, i) => `
      <tr style="background:${i%2===0?'#fff':'#f8f8f8'}">
        <td style="padding:5px 8px;font-weight:700;font-size:10px;border-bottom:1px solid #eee">${esc(row.item)}</td>
        ${isBlips ? `<td style="padding:5px 8px;color:#000;font-weight:700;font-family:monospace;font-size:9px;border-bottom:1px solid #eee">${esc(row.source) || '&mdash;'}</td>` : ''}
        <td style="padding:5px 8px;color:#555;font-style:italic;font-size:10px;border-bottom:1px solid #eee">${esc(row.type)}</td>
        <td style="padding:5px 8px;color:#333;font-size:10px;border-bottom:1px solid #eee;line-height:1.4">${esc(row.description)}</td>
        <td style="padding:5px 8px;font-size:9px;border-bottom:1px solid #eee;white-space:nowrap">${esc(row.inEx)}</td>
        <td style="padding:5px 8px;font-size:9px;border-bottom:1px solid #eee;white-space:nowrap">${esc(row.env)}</td>
        <td style="padding:5px 8px;color:#444;font-size:10px;border-bottom:1px solid #eee;line-height:1.4">${esc(row.data)}</td>
      </tr>`).join('');

    const tableHTML = (key, items, isBlips) => {
      const headers = isBlips ? t.tableHeadersBlips : t.tableHeaders;
      return `
      <div style="margin-bottom:16px">
        <div style="background:#000;color:#fff;font-family:monospace;font-size:9px;font-weight:900;letter-spacing:0.1em;padding:5px 10px">${esc(key).toUpperCase()}</div>
        <table style="width:100%;border-collapse:collapse">
          <thead><tr style="background:#f0f0f0">
            ${headers.map(h => `<th style="padding:5px 8px;font-size:8px;font-family:monospace;letter-spacing:0.08em;border-bottom:1px solid #ccc;text-align:left">${esc(h).toUpperCase()}</th>`).join('')}
          </tr></thead>
          <tbody>${rowsHTML(items, isBlips)}</tbody>
        </table>
      </div>`;
    };

    const kbrHTML = (kbrs || []).map(area => `
      <div style="margin-bottom:18px">
        <div style="display:flex;align-items:center;gap:8px;border-bottom:1px solid #000;padding-bottom:6px;margin-bottom:8px">
          <span style="font-size:14px">${esc(area.icon)}</span>
          <span style="font-family:monospace;font-weight:900;font-size:11px;letter-spacing:0.1em">${esc(area.area).toUpperCase()}</span>
        </div>
        ${(area.results||[]).map(kbr => `
          <div style="display:grid;grid-template-columns:2fr 1fr 1fr;gap:10px;border-bottom:1px solid #eee;padding:7px 0">
            <div><div style="font-weight:700;font-size:11px;margin-bottom:2px">${esc(kbr.kbr)}</div><div style="color:#555;font-size:10px;line-height:1.4">${esc(kbr.description)}</div></div>
            <div><div style="font-family:monospace;font-size:8px;color:#888;letter-spacing:0.1em;margin-bottom:3px">${esc(t.metric)}</div><div style="font-size:10px">${esc(kbr.metric)}</div></div>
            <div><div style="font-family:monospace;font-size:8px;color:#888;letter-spacing:0.1em;margin-bottom:3px">${esc(t.target)}</div><div style="font-size:10px;font-weight:700">${esc(kbr.target)}</div></div>
          </div>`).join('')}
      </div>`).join('');

    const aboutHTML = (business.about||[]).map(item => `
      <div style="display:flex;border-bottom:1px solid #eee;padding:5px 0;font-size:11px">
        <span style="font-family:monospace;font-size:9px;color:#888;min-width:120px;letter-spacing:0.05em;padding-top:1px">${esc(item.label).toUpperCase()}</span>
        <span>${esc(item.value)}</span>
      </div>`).join('');

    const valueHTML = (business.chassisValue||[]).map(v => `
      <div style="display:flex;gap:8px;margin-bottom:5px;font-size:11px"><span style="font-weight:900">&rarr;</span><span>${esc(v)}</span></div>`).join('');

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>CHASS1S &mdash; ${esc(business.name)}</title>
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
    <div style="font-size:22px;font-weight:900;letter-spacing:-0.02em;margin-bottom:3px">${esc(business.name)}</div>
    <div style="font-family:monospace;font-size:9px;color:#888;letter-spacing:0.06em">${metaLine}</div>
  </div>
  <div style="font-family:monospace;font-size:9px;color:#888;text-align:right">
    <div style="margin-bottom:3px">boss.technology</div>
    <div style="margin-bottom:3px">${date}</div>
    <div>${addisTotal} ADDIS &middot; ${blipsTotal} BLIPS &middot; ${kbrsTotal} KBRs</div>
    <div>${controlledPct}% ${esc(t.pdfControlled)} &middot; ${uncontrolledPct}% ${esc(t.pdfUncontrolled)}</div>
  </div>
</div>

<div class="sec">${esc(t.tabs.intro)}</div>
<p style="font-size:12px;line-height:1.7;color:#333;margin:0 0 20px;max-width:680px">${esc(business.description)}</p>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:28px;margin-bottom:32px">
  <div>
    <div class="label">${esc(t.businessProfile)}</div>
    ${aboutHTML}
  </div>
  <div>
    <div class="label">${esc(t.whyChassis)}</div>
    <p style="font-size:11px;line-height:1.6;color:#333;margin:0 0 12px">${esc(business.whyChassis)}</p>
    <div class="label" style="margin-top:12px">${esc(t.keyValuePoints)}</div>
    ${valueHTML}
  </div>
</div>

<div class="pb">
  <div class="sec">ADDIS &mdash; ${esc(t.tabs.addisSub).toUpperCase()}</div>
  ${addisKeys.map(k => tableHTML(k, addisData[k], false)).join('')}
</div>

<div class="pb">
  <div class="sec">BLIPS &mdash; ${esc(t.tabs.blipsSub).toUpperCase()}</div>
  ${blipsKeys.map(k => tableHTML(k, blipsData[k], true)).join('')}
</div>

<div class="pb">
  <div class="sec">${esc(t.kbrTitle).toUpperCase()}</div>
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
          '<div style="background:#000;color:#fff;font-family:monospace;font-size:10px;font-weight:900;padding:6px 12px;margin-bottom:8px">' + esc(opt).toUpperCase() + ' &mdash; ' + esc(data.title) + '</div>' +
          '<p style="font-size:11px;line-height:1.6;color:#333;margin:0 0 10px">' + esc(data.summary) + '</p>' +
          Object.entries(bpLabels).map(([key, label]) => {
            const items = data[key] || [];
            if (!items.length) return '';
            return '<div style="margin-bottom:8px"><div style="font-family:monospace;font-size:8px;font-weight:900;letter-spacing:0.15em;color:#888;margin-bottom:4px">' + esc(label) + '</div>' +
              items.map((item,i) => '<div style="border-bottom:1px solid #eee;padding:4px 0;font-size:10px;background:' + (i%2===0?'#fff':'#fafafa') + '"><b>' + esc(item.title) + '</b> &mdash; ' + esc(item.description) + '</div>').join('') +
              '</div>';
          }).join('') + '</div>';
      }).join('') + '</div>';
  })() : ''}

  <script>setTimeout(function(){ window.print(); }, 400);</script>
</body></html>`;

    // Blob URL — works in all modern browsers, no length limit, not blocked by Chrome
    try {
      const blob = new Blob([html], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      const win = window.open(url, "_blank");
      setTimeout(() => URL.revokeObjectURL(url), 30000);
      if (!win) {
        // Fallback: download as .html file
        const blobFallback = new Blob([html], { type: "text/html" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blobFallback);
        a.download = `CHASS1S-${business.name.replace(/\s+/g, "-")}.html`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(a.href), 10000);
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
        workspaces={workspaces} currentWorkspace={currentWorkspace} onSwitchWorkspace={onSwitchWorkspace} onCreateWorkspace={onCreateWorkspace} onOpenHistory={onOpenHistory} onOpenAdmin={onOpenAdmin} onOpenSettings={onOpenSettings} onOpenSupport={onOpenSupport} chassisCount={chassisCount} lastChassisName={lastChassisName}>
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
        {activeTab==="beyondProfit"&&<BeyondProfitTab bpData={beyondProfitData} selectedOptions={beyondProfitSelections||[]} bpLoading={bpLoading} bpError={bpError} t={t} onRetry={() => { setBpError(null); setBpLoading(false); setBeyondProfitData(null); }}/>}
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

// ─── SSE STREAM READER ────────────────────────────────────────────────────────
// Module-level so both App (main generation) and Page2 (Beyond Profit) can use it.
async function readAnthropicStream(res, onChunk?: (accumulated: string) => void) {
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(`API error: ${res.status} — ${errBody.error || errBody.message || "unknown"}`);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let text = "";
  let messageStopReceived = false;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop();
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const payload = line.slice(6).trim();
      if (payload === "[DONE]") { messageStopReceived = true; continue; }
      try {
        const evt = JSON.parse(payload);
        if (evt.type === "error") {
          throw new Error(evt.error?.message || `Anthropic stream error: ${evt.error?.type || "unknown"}`);
        }
        if (evt.type === "message_stop") {
          messageStopReceived = true;
        }
        if (evt.type === "content_block_delta" && evt.delta?.type === "text_delta") {
          text += evt.delta.text;
          onChunk?.(text);
        }
      } catch (parseErr) {
        if (parseErr.message.startsWith("Anthropic stream error")) throw parseErr;
        // ignore other malformed SSE lines
      }
    }
  }
  if (!messageStopReceived && text.length === 0) {
    throw new Error("El stream se cerró sin contenido — posible timeout o sobrecarga del modelo.");
  }
  return text;
}

// ─── ROOT APP ─────────────────────────────────────────────────────────────────
export default function App() {

  // ── Detect generation / view tab ──────────────────────────────────────────
  const pendingGenId = new URLSearchParams(window.location.search).get("chassis_gen");
  const pendingViewId = new URLSearchParams(window.location.search).get("chassis_view");

  // ── Viewport meta ──────────────────────────────────────────────────────────
  useEffect(() => {
    let meta = document.querySelector<HTMLMetaElement>('meta[name="viewport"]');
    if (!meta) { meta = document.createElement('meta') as HTMLMetaElement; meta.name = 'viewport'; document.head.appendChild(meta); }
    meta.content = 'width=device-width, initial-scale=1, maximum-scale=1';
  }, []);

  // ── Language ───────────────────────────────────────────────────────────────
  const [lang, setLang] = useState(() => {
    if (pendingGenId) {
      try { const s = JSON.parse(localStorage.getItem(pendingGenId) || "{}"); return s.lang || detectLanguage(); }
      catch { return detectLanguage(); }
    }
    if (pendingViewId) {
      try { const s = JSON.parse(localStorage.getItem(pendingViewId) || "{}"); return s.lang || detectLanguage(); }
      catch { return detectLanguage(); }
    }
    return detectLanguage();
  });

  // ── App state ──────────────────────────────────────────────────────────────
  const [screen, setScreen] = useState(pendingGenId || pendingViewId ? "loading" : "page1");
  const [userInput, setUserInput] = useState("");
  const [selectedTier, setSelectedTier] = useState(null);
  const [chassisData, setChassisData] = useState(null);
  const [beyondProfitSelections, setBeyondProfitSelections] = useState([]);
  const [beyondProfitData, setBeyondProfitData] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [popupBlocked, setPopupBlocked] = useState(false);
  const [streamedChars, setStreamedChars] = useState(0);
  const [streamPreview, setStreamPreview] = useState("");
  const [oauthError, setOauthError] = useState(() => {
    // Pick up any OAuth error stored by handleOAuthCallback() on redirect
    try {
      const msg = sessionStorage.getItem("chs_oauth_error");
      if (msg) { sessionStorage.removeItem("chs_oauth_error"); return msg; }
    } catch {}
    return null;
  });

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
  const [chassisCount, setChassisCount] = useState(0);
  const [lastChassisName, setLastChassisName] = useState<string | null>(null);
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
    return data;
  };

  // ── Fetch user workspaces ──────────────────────────────────────────────────
  const fetchWorkspaces = async (userId) => {
    const { data: rawMemberships } = await supabase.from("workspace_members").select("*").eq("user_id", userId);
    const memberships = rawMemberships as any[] | null;
    if (!memberships?.length) { setWorkspaces([]); return; }
    const wsResults = await Promise.all(memberships.map((m: any) => supabase.from("workspaces").select("*").eq("id", m.workspace_id).single()));
    const combined = wsResults.map((r, i) => (r as any).data ? { ...(r as any).data, role: memberships[i].role } : null).filter(Boolean);
    setWorkspaces(combined);
  };

  // ── Fetch chassis history count + last business name ─────────────────────
  const fetchChassisCount = async (userId: string, workspaceId: string | null = null) => {
    try {
      const q = supabase.from("chassis_history").select("id, business_name").eq("user_id", userId);
      if (workspaceId !== null) q.eq("workspace_id", workspaceId);
      else q.is("workspace_id", null);
      q.order("created_at", { ascending: false });
      const { data } = await q;
      if (Array.isArray(data)) {
        setChassisCount((data as unknown[]).length);
        setLastChassisName((data[0] as any)?.business_name || null);
      } else {
        setChassisCount(0);
        setLastChassisName(null);
      }
    } catch {
      setChassisCount(0);
      setLastChassisName(null);
    }
  };

  // ── Auth session listener ─────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) { setUser(session.user); userRef.current = session.user; fetchProfile(session.user.id); fetchWorkspaces(session.user.id); fetchChassisCount(session.user.id); }
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user ?? null;
      setUser(u); userRef.current = u;
      if (u) { fetchProfile(u.id).then(async (prof) => { if (prof && (prof as any).onboarding_complete === false) setScreen('onboarding'); if (prof && (prof as any).account_status === 'deactivated') { await supabase.rpc('reactivate_account', { p_user_id: u.id }); fetchProfile(u.id); } }); fetchWorkspaces(u.id); fetchChassisCount(u.id); }
      else { setProfile(null); setWorkspaces([]); setCurrentWorkspace(null); }
    });
    return () => subscription.unsubscribe();
  }, []);

  // ── Handle return from Stripe payment ─────────────────────────────────────
  // Tokens are credited server-side via the Stripe webhook (api/stripe-webhook.js).
  // On return we just refresh the profile balance from DB.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("payment") !== "success" || !user) return;
    window.history.replaceState(null, "", window.location.pathname);
    fetchProfile(user.id);
  }, [user]);

  // ── Sign out ───────────────────────────────────────────────────────────────
  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setUser(null); setProfile(null); setWorkspaces([]); setCurrentWorkspace(null);
  };

  // ── Atomic: deduct tokens AND insert history row in a single transaction ───
  // Backed by the consume_and_save_chassis RPC (migration 003). Either both
  // sides land or neither does, so the user can never pay tokens without a
  // history record being persisted.
  const consumeAndSave = async (parsed, tier, input, bpSelections, currentLang) => {
    const u = userRef.current;
    const p = profileRef.current;
    if (!u) return { ok: false, reason: "no_user" };
    const cost = (TIER_TOKEN_COST[tier.id] || 1) + (bpSelections.length * BP_TOKEN_COST);
    const wsId = currentWorkspace?.id ?? null;

    const { data, error: rpcErr } = await supabase.rpc("consume_and_save_chassis", {
      p_user_id: u.id,
      p_workspace_id: wsId,
      p_amount: cost,
      p_business_name: parsed.business?.name || input,
      p_business_input: input,
      p_tier: tier.id,
      p_lang: currentLang,
      p_chassis_data: parsed,
      p_beyond_profit_selections: bpSelections,
    });

    if (rpcErr) {
      console.error("consume_and_save_chassis RPC error:", rpcErr.message);
      return { ok: false, reason: "rpc_error", message: rpcErr.message };
    }

    const row = Array.isArray(data) ? data[0] : data;
    if (!row || row.status !== "ok") {
      return { ok: false, reason: row?.status || "unknown" };
    }

    // Refresh local balance from DB to stay in sync
    if (wsId) {
      const { data: ws } = await supabase.from("workspaces").select("*").eq("id", wsId).single();
      if (ws) setCurrentWorkspace(ws);
    } else if (p) {
      const { data: prof } = await supabase.from("profiles").select("*").eq("id", u.id).single();
      if (prof) { setProfile(prof); profileRef.current = prof; }
    }

    fetchChassisCount(u.id, wsId);
    return { ok: true };
  };

  // ── Trigram cache helpers (pg_trgm — no external API) ───────────────────
  // Normalize input before storing/querying so minor formatting differences
  // (extra spaces, trailing commas, mixed case) don't create duplicate entries.
  const normalizeInput = (text) => text.toLowerCase().replace(/\s+/g, " ").trim();

  // Query Supabase for a similar cached chassis result (similarity > 0.65).
  // Returns { id, chassis_data } or null on miss / error.
  const lookupCache = async (input, tierId, currentLang) => {
    try {
      const { data: rawData, error } = await supabase.rpc("lookup_chassis_cache", {
        p_input_text: normalizeInput(input),
        p_tier_id: tierId,
        p_lang: currentLang,
        p_threshold: 0.65,
      });
      const data = rawData as any[];
      if (error || !data?.length) return null;
      return { id: data[0].id, chassis_data: data[0].chassis_data };
    } catch {
      return null;
    }
  };

  // Persist a new result to the cache (fire-and-forget, non-blocking).
  const storeCache = async (input, tierId, currentLang, chassisData) => {
    try {
      await supabase.rpc("insert_chassis_cache", {
        p_input_text: normalizeInput(input),
        p_tier_id: tierId,
        p_lang: currentLang,
        p_chassis_data: chassisData,
      });
    } catch {
      // Cache write failure is non-fatal
    }
  };

  // ── Core generation logic ─────────────────────────────────────────────────
  const runGeneration = async (input, tier, currentLang, bpSelections) => {
    try {
      const { data: { session: genSession } } = await supabase.auth.getSession();
      const sessionToken = genSession?.access_token;

      if (!genSession?.user?.email_confirmed_at) {
        throw new Error(T[currentLang]?.errorEmailNotConfirmed ?? "Please confirm your email address before generating. Check your inbox.");
      }

      // ── Trigram cache check (no external API) ──────────────────────────
      let cachedResult = null;
      try {
        const hit = await lookupCache(input, tier.id, currentLang);
        if (hit) {
          cachedResult = hit.chassis_data;
          // Increment hit counter (fire-and-forget)
          supabase.rpc("record_cache_hit", { p_cache_id: hit.id }).catch(() => {});
        }
      } catch {
        // Cache lookup failure is non-fatal — fall through to live generation
      }

      let parsed;
      if (cachedResult) {
        // ── Cache HIT: use cached result, still charge tokens ───────────
        parsed = cachedResult;
        setStreamedChars(0);
        setStreamPreview("⚡ Retrieved from cache");
      } else {
        // ── Cache MISS: call Anthropic ──────────────────────────────────
        const res = await fetch("/api/anthropic", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${sessionToken}`,
          },
          body: JSON.stringify({
            max_tokens: tier.tokens,
            system: buildChassisSystemBlocks(),
            messages: [{ role: "user", content: buildChassisUserMessage(input, tier, currentLang) }],
          }),
        });
        setStreamedChars(0);
        setStreamPreview("");
        const raw = await readAnthropicStream(res, (accumulated) => {
          setStreamedChars(accumulated.length);
          setStreamPreview(accumulated.slice(-120));
        });
        const f = raw.indexOf("{"), l = raw.lastIndexOf("}");
        if (f === -1 || l === -1) throw new Error("No valid JSON found in response.");
        parsed = JSON.parse(raw.slice(f, l + 1));

        // Store in cache for future hits (fire-and-forget, non-blocking)
        storeCache(input, tier.id, currentLang, parsed).catch(() => {});
      }

      // Persist + charge atomically BEFORE rendering Page2. If this fails,
      // the user keeps their tokens and sees an error instead of a result
      // they were charged for but cannot retrieve from history.
      const result = await consumeAndSave(parsed, tier, input, bpSelections, currentLang);
      if (!result.ok) {
        const msg =
          result.reason === "insufficient_balance" ? "Insufficient token balance." :
          result.reason === "not_found" ? "Account not found." :
          result.message || "Could not save your chassis. No tokens were charged.";
        throw new Error(msg);
      }

      setChassisData(parsed);
      setScreen("page2");
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

  // ── Load history chassis in this view tab (no re-generation) ─────────────
  useEffect(() => {
    if (!pendingViewId) return;
    const stored = localStorage.getItem(pendingViewId);
    localStorage.removeItem(pendingViewId);
    if (!stored) { setScreen("page1"); return; }
    let params;
    try { params = JSON.parse(stored); } catch { setScreen("page1"); return; }
    const { chassisData, tierId, beyondProfitSelections: bpSels, beyondProfitData: bpData, businessInput, lang: storedLang } = params;
    if (!chassisData) { setScreen("page1"); return; }
    if (storedLang) setLang(storedLang);
    setChassisData(chassisData);
    setSelectedTier(getTiers(storedLang || lang).find(t => t.id === tierId) || getTiers(lang)[0]);
    setBeyondProfitSelections(bpSels || []);
    if (bpData) setBeyondProfitData(bpData);
    setUserInput(businessInput || "");
    setScreen("page2");
  }, []);

  // ── openChassisInNewTab — opens a history result in a new tab ─────────────
  const openChassisInNewTab = (ch) => {
    const viewId = "chassis_view_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
    localStorage.setItem(viewId, JSON.stringify({
      chassisData: ch.chassis_data,
      tierId: ch.tier,
      beyondProfitSelections: ch.beyond_profit_selections || [],
      beyondProfitData: ch.beyond_profit_data || null,
      businessInput: ch.business_input || "",
      lang: ch.lang || lang,
    }));
    const url = window.location.origin + window.location.pathname + "?chassis_view=" + viewId;
    const newTab = window.open(url, "_blank");
    if (!newTab) {
      localStorage.removeItem(viewId);
      if (ch.chassis_data) {
        setChassisData(ch.chassis_data);
        setSelectedTier(getTiers(lang).find(t => t.id === ch.tier) || getTiers(lang)[0]);
        setBeyondProfitSelections(ch.beyond_profit_selections || []);
        if (ch.beyond_profit_data) setBeyondProfitData(ch.beyond_profit_data);
        setUserInput(ch.business_input || "");
        setScreen("page2");
      }
    }
  };

  // ── generateChassis — opens new tab, Page 1 stays ─────────────────────────
  const generateChassis = (input, tier, bpSelections = []) => {
    const genId = "chassis_gen_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
    localStorage.setItem(genId, JSON.stringify({ input, tier, bpSelections, lang }));
    const newTabUrl = window.location.origin + window.location.pathname + "?chassis_gen=" + genId;
    const newTab = window.open(newTabUrl, "_blank");
    if (!newTab) {
      localStorage.removeItem(genId);
      setPopupBlocked(true);
      setTimeout(() => setPopupBlocked(false), 5000);
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
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);

  const authProps = {
    user, profile,
    onOpenAuth: openAuth,
    onSignOut: handleSignOut,
    onRefreshProfile: () => user && fetchProfile(user.id),
    workspaces,
    currentWorkspace,
    onSwitchWorkspace: (ws) => { setCurrentWorkspace(ws); if (user) fetchChassisCount(user.id, ws?.id ?? null); },
    onCreateWorkspace: () => setWorkspaceCreateOpen(true),
    onOpenHistory: () => setHistoryOpen(true),
    onBuyTokens: () => setBuyTokensOpen(true),
    onOpenAdmin: profile?.role === "admin" ? () => setScreen("admin") : undefined,
    onOpenSettings: () => setSettingsOpen(true),
    onOpenSupport: () => setSupportOpen(true),
    chassisCount,
    lastChassisName,
  };

  const Modals = () => (
    <>
      {authModalOpen && <AuthModal onClose={() => setAuthModalOpen(false)} onSuccess={setUser} initialMode={authModalMode} lang={lang} />}
      {workspaceCreateOpen && <WorkspaceCreateModal user={user} onClose={() => setWorkspaceCreateOpen(false)} onCreated={(ws) => { setWorkspaces(prev => [...prev, ws]); setWorkspaceCreateOpen(false); }} />}
      {buyTokensOpen && user && <TokenPurchaseModal user={user} profile={profile} currentWorkspace={currentWorkspace} onClose={() => setBuyTokensOpen(false)} onTokensAdded={() => { fetchProfile(user.id); setBuyTokensOpen(false); }} />}
      {settingsOpen && user && <SettingsModal user={user} profile={profile} lang={lang} t={T[lang]} onClose={() => setSettingsOpen(false)} onSignOut={handleSignOut} onRefreshProfile={() => fetchProfile(user.id)} />}
      {supportOpen && user && <SupportModal user={user} profile={profile} lang={lang} t={T[lang]} onClose={() => setSupportOpen(false)} />}
      {historyOpen && user && <ChassisHistoryModal user={user} onClose={() => setHistoryOpen(false)}
        onOpenChassis={(ch) => { openChassisInNewTab(ch); setHistoryOpen(false); }} />}
    </>
  );

  // ── OAuth error toast (shown once after a failed/cancelled OAuth redirect) ──
  const OAuthErrorToast = oauthError ? (
    <div style={{
      position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)",
      background: "#1a1a1a", color: "#fff", padding: "12px 20px 12px 16px",
      borderRadius: 4, fontSize: 13, fontFamily: "'Courier New', monospace",
      display: "flex", alignItems: "center", gap: 12, zIndex: 9999,
      boxShadow: "0 4px 20px rgba(0,0,0,0.3)", maxWidth: "90vw",
    }}>
      <span style={{ color: "#f87171" }}>⚠</span>
      <span>{oauthError}</span>
      <button onClick={() => setOauthError(null)} style={{
        background: "none", border: "none", color: "#888", cursor: "pointer",
        fontSize: 16, lineHeight: 1, padding: "0 0 0 4px", flexShrink: 0,
      }}>×</button>
    </div>
  ) : null;

  if (screen === 'onboarding' && user) return (
    <FinishCreatingAccount user={user} lang={lang} onComplete={() => { fetchProfile(user.id); setScreen('page1'); }} />
  );

  if (screen === "page1") return (
    <>
      <Page1 onSubmit={generateChassis} lang={lang} setLang={setLang} popupBlocked={popupBlocked} {...authProps} />
      <Modals />
      {OAuthErrorToast}
    </>
  );
  if (screen === "loading") return <LoadingScreen input={userInput} tierLabel={selectedTier?.label} t={t} streamedChars={streamedChars} streamPreview={streamPreview} />;
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
  if (screen === "admin" && profile?.role === "admin") return (
    <AdminPanel onBack={() => setScreen("page1")} lang={lang} setLang={setLang} {...authProps} />
  );
  return null;
}

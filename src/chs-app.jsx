import { useState, useEffect, useRef } from "react";
import supabase from "./lib/supabase.js";
import { useResponsive } from "./hooks/useResponsive.js";
import { LANGUAGES, detectLanguage, T, TIER_CONFIG, getTiers } from "./i18n/translations.js";
import { buildPrompt, buildBeyondProfitPrompt } from "./features/generation/prompts.js";
import { AuthModal } from "./features/auth/AuthModal.jsx";
import { AccountMenu } from "./features/auth/AccountMenu.jsx";
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
const BP_TOKEN_COST = 0.25;

// ─── STRIPE PAYMENT LINK ──────────────────────────────────────────────────────
// "Customers choose what to pay" link — prefilled_amount is in cents
const STRIPE_PAYMENT_LINK = "https://buy.stripe.com/9B6dR8aBRcn72Ca6QK4Vy06";



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
        <div style={{ display: "flex", gap: isMobile ? 10 : 20, flexWrap: "nowrap", alignItems: "center" }}>
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
  workspaces, currentWorkspace, onSwitchWorkspace, onCreateWorkspace, onOpenHistory, onBuyTokens, popupBlocked }) {
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
                    <div style={{ padding: "14px 12px", background: "#000", color: "#fff", border: "2px solid #000", borderRadius: 2, textAlign: "left", height: 148, boxSizing: "border-box", display: "flex", flexDirection: "column" }}>
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

function BeyondProfitTab({ bpData, selectedOptions, bpLoading, bpError, t, onRetry }) {
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
            model: "claude-sonnet-4-5",
            max_tokens: 8000,
            messages: [{ role: "user", content: buildBeyondProfitPrompt(userInput, tier, lang, beyondProfitSelections) }],
          }),
        });
        clearTimeout(timeout);
        if (!res.ok) throw new Error(`API error: ${res.status}`);
        const apiData = await res.json();
        const raw = apiData.content.filter(b => b.type === "text").map(b => b.text).join("");
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
  const [popupBlocked, setPopupBlocked] = useState(false);

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

  // ── Deduct tokens — atomic via Supabase RPC (prevents race conditions) ───────
  const deductTokens = async (tier, bpSelections, parsed, input, currentLang) => {
    const u = userRef.current;
    const p = profileRef.current;
    if (!u) return;
    const cost = (TIER_TOKEN_COST[tier.id] || 1) + (bpSelections.length * BP_TOKEN_COST);
    const wsId = currentWorkspace?.id ?? null;

    // Atomic deduction — SQL function uses FOR UPDATE lock to prevent double-spend
    const { data: ok, error: rpcErr } = await supabase.rpc("deduct_tokens", {
      p_user_id: u.id,
      p_workspace_id: wsId,
      p_amount: cost,
    });
    if (rpcErr) console.error("deduct_tokens RPC error:", rpcErr.message);
    else if (ok === false) console.warn("deduct_tokens: insufficient balance at commit time");

    // Refresh local balance from DB to stay in sync
    if (wsId) {
      const { data: ws } = await supabase.from("workspaces").select("*").eq("id", wsId).single();
      if (ws) setCurrentWorkspace(ws);
    } else if (p) {
      const { data: prof } = await supabase.from("profiles").select("*").eq("id", u.id).single();
      if (prof) { setProfile(prof); profileRef.current = prof; }
    }

    await saveChassis(parsed, tier, input, bpSelections, currentLang);
  };

  // ── Core generation logic ─────────────────────────────────────────────────
  const runGeneration = async (input, tier, currentLang, bpSelections) => {
    try {
      const { data: { session: genSession } } = await supabase.auth.getSession();
      const res = await fetch("/api/anthropic", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${genSession?.access_token}`,
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-5",
          max_tokens: tier.tokens,
          messages: [{ role: "user", content: buildPrompt(input, tier, currentLang) }],
        }),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(`API error: ${res.status} — ${errBody.error || errBody.message || "unknown"}`);
      }
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
      <Page1 onSubmit={generateChassis} lang={lang} setLang={setLang} popupBlocked={popupBlocked} {...authProps} />
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

import { useState, useEffect, useRef } from "react";
import { TokenPurchaseModal } from "../billing/TokenPurchaseModal.jsx";
import { WorkspaceMembersModal } from "../workspace/WorkspaceMembersModal.jsx";
import { LangDropdown } from "../../shared/ui/LangDropdown.jsx";

function SignOutSVG() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 2H2a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h3" />
      <polyline points="9 9 12 6.5 9 4" />
      <line x1="12" y1="6.5" x2="5" y2="6.5" />
    </svg>
  );
}
function GearSVG() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="6.5" cy="6.5" r="1.75" />
      <path d="M6.5 1.2v1.1M6.5 10.7v1.1M1.2 6.5h1.1M10.7 6.5h1.1M2.9 2.9l.78.78M9.32 9.32l.78.78M2.9 10.1l.78-.78M9.32 3.68l.78-.78" />
    </svg>
  );
}
function SupportSVG() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 1.5H2a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h3l1.5 2 1.5-2h3a1 1 0 0 0 1-1v-6a1 1 0 0 0-1-1z" />
      <line x1="6.5" y1="4" x2="6.5" y2="6" />
      <circle cx="6.5" cy="7.5" r="0.4" fill="currentColor" stroke="none" />
    </svg>
  );
}

function AccountMenu({ user, profile, onSignOut, onClose, onRefreshProfile, lang, setLang,
  workspaces, currentWorkspace, onSwitchWorkspace, onCreateWorkspace, onOpenHistory,
  onOpenSettings, onOpenSupport, t, chassisCount = 0, lastChassisName = null }) {
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
  const contextLabel = currentWorkspace ? currentWorkspace.name : (t?.menuPersonal || 'Personal');
  const roleLabel = currentWorkspace?.role?.toUpperCase() || "";

  // Avatar initials — prefer display_name, fall back to email
  const rawSrc = profile?.display_name?.trim() || user?.email || '?';
  const words = rawSrc.split(/\s+/).filter(Boolean);
  const initials = words.length >= 2
    ? (words[0][0] + words[1][0]).toUpperCase()
    : rawSrc.slice(0, 2).toUpperCase();

  if (buyOpen) return (
    <TokenPurchaseModal
      user={user} profile={profile}
      currentWorkspace={currentWorkspace}
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
      background: "#fff", border: "1px solid #000", minWidth: 220, zIndex: 300,
      boxShadow: "0 8px 32px rgba(0,0,0,0.15)" }}>

      {/* User info — avatar + name + lang dropdown */}
      <div style={{ padding: "12px 14px", borderBottom: "1px solid #e8e8e8" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#000",
              fontFamily: "'Georgia', serif", overflow: "hidden",
              textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {profile?.display_name || user.email}
            </div>
          </div>
          <LangDropdown lang={lang} setLang={setLang} />
        </div>
      </div>

      {/* Workspace switcher */}
      <div style={{ borderBottom: "1px solid #e8e8e8" }}>
        <button onClick={() => setWorkspaceExpanded(o => !o)}
          style={{ width: "100%", padding: "10px 14px", background: "none", border: "none",
            cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center",
            justifyContent: "space-between", gap: 8 }}>
          <div>
            <div style={{ fontFamily: "'Courier New', monospace", fontSize: 9, color: "#aaa",
              letterSpacing: "0.12em", marginBottom: 2 }}>
              {t?.menuWorkspace || 'WORKSPACE'}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontFamily: "'Courier New', monospace", fontSize: 11, fontWeight: 900,
                color: "#000" }}>{contextLabel}</span>
              {roleLabel && <span style={{ fontFamily: "'Courier New', monospace", fontSize: 8,
                color: "#888", border: "1px solid #ddd", padding: "1px 4px" }}>{roleLabel}</span>}
            </div>
          </div>
          <span style={{ fontFamily: "monospace", fontSize: 10, color: "#888" }}>
            {workspaceExpanded ? "▲" : "▼"}
          </span>
        </button>
        {workspaceExpanded && (
          <div style={{ borderTop: "1px solid #f0f0f0" }}>
            <button onClick={() => { onSwitchWorkspace(null); setWorkspaceExpanded(false); }}
              style={{ width: "100%", padding: "8px 14px 8px 22px", background: !currentWorkspace ? "#f8f8f8" : "none",
                border: "none", cursor: "pointer", textAlign: "left", fontFamily: "'Courier New', monospace",
                fontSize: 11, color: "#000", fontWeight: !currentWorkspace ? 900 : 400,
                borderLeft: !currentWorkspace ? "3px solid #000" : "3px solid transparent" }}
              onMouseEnter={e => { if (currentWorkspace) e.currentTarget.style.background = "#f5f5f5"; }}
              onMouseLeave={e => { if (currentWorkspace) e.currentTarget.style.background = "none"; }}>
              {t?.menuPersonal || 'Personal'}
            </button>
            {workspaces.map(ws => (
              <div key={ws.id} style={{ display: "flex", alignItems: "stretch" }}>
                <button onClick={() => { onSwitchWorkspace(ws); setWorkspaceExpanded(false); }}
                  style={{ flex: 1, padding: "8px 10px 8px 22px",
                    background: currentWorkspace?.id === ws.id ? "#f8f8f8" : "none",
                    border: "none", cursor: "pointer", textAlign: "left", fontFamily: "'Courier New', monospace",
                    fontSize: 11, color: "#000", fontWeight: currentWorkspace?.id === ws.id ? 900 : 400,
                    borderLeft: currentWorkspace?.id === ws.id ? "3px solid #000" : "3px solid transparent",
                    display: "flex", justifyContent: "space-between", alignItems: "center" }}
                  onMouseEnter={e => { if (currentWorkspace?.id !== ws.id) e.currentTarget.style.background = "#f5f5f5"; }}
                  onMouseLeave={e => { if (currentWorkspace?.id !== ws.id) e.currentTarget.style.background = "none"; }}>
                  <span>{ws.name}</span>
                  <span style={{ fontSize: 8, color: "#888", border: "1px solid #eee", padding: "1px 4px", marginLeft: 6 }}>
                    {ws.role?.toUpperCase()}
                  </span>
                </button>
                {(ws.role === "owner" || ws.role === "co-owner") && (
                  <button onClick={() => setManagingWorkspace(ws)}
                    title="Manage members"
                    style={{ padding: "8px 10px", background: "none", border: "none", borderLeft: "1px solid #f0f0f0",
                      cursor: "pointer", fontFamily: "monospace", fontSize: 13, color: "#aaa" }}
                    onMouseEnter={e => { e.currentTarget.style.background = "#f5f5f5"; e.currentTarget.style.color = "#000"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = "none"; e.currentTarget.style.color = "#aaa"; }}>
                    ⚙
                  </button>
                )}
              </div>
            ))}
            <button onClick={() => { onCreateWorkspace(); setWorkspaceExpanded(false); onClose(); }}
              style={{ width: "100%", padding: "8px 14px 8px 22px", background: "none", border: "none",
                borderTop: "1px solid #f0f0f0", cursor: "pointer", textAlign: "left",
                fontFamily: "'Courier New', monospace", fontSize: 11, color: "#888" }}
              onMouseEnter={e => { e.currentTarget.style.background = "#f5f5f5"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "none"; }}>
              {t?.menuAddWorkspace || '+ Work Space'}
            </button>
          </div>
        )}
      </div>

      {/* Chassis count + last name */}
      <button onClick={() => { onOpenHistory(); onClose(); }}
        style={{ width: "100%", padding: "9px 14px", background: "none", border: "none",
          borderBottom: "1px solid #e8e8e8", cursor: "pointer", textAlign: "left" }}
        onMouseEnter={e => e.currentTarget.style.background = "#f0f0f0"}
        onMouseLeave={e => e.currentTarget.style.background = "none"}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 6, overflow: "hidden" }}>
          <span style={{ fontFamily: "'Courier New', monospace", fontSize: 9, fontWeight: 700,
            letterSpacing: "0.12em", color: "#000", whiteSpace: "nowrap" }}>
            {t?.menuChassis || 'CHASSIS'} ({chassisCount})
          </span>
          {lastChassisName && (
            <span style={{ fontFamily: "'Courier New', monospace", fontSize: 9, color: "#aaa",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
              · {lastChassisName}
            </span>
          )}
        </div>
      </button>

      {/* Token balance */}
      <div style={{ padding: "12px 14px", borderBottom: "1px solid #e8e8e8", background: "#f8f8f8" }}>
        <div style={{ fontFamily: "'Courier New', monospace", fontSize: 9, color: "#aaa",
          letterSpacing: "0.12em", marginBottom: 4 }}>
          {t?.menuTokenBalance || 'TOKEN BALANCE'}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <span style={{ fontSize: 18, fontWeight: 900, color: "#000", lineHeight: 1,
            fontFamily: "'Courier New', monospace" }}>{displayTokens}</span>
          <button onClick={() => setBuyOpen(true)}
            style={{ background: "none", border: "none", cursor: "pointer",
              fontFamily: "'Courier New', monospace", fontSize: 10, fontWeight: 900,
              color: "#000" }}>
            {t?.menuBuyMore || '+ Buy More'}
          </button>
        </div>
      </div>

      {/* Actions — 3-button row */}
      <div style={{ display: "flex", borderTop: "1px solid #e8e8e8" }}>
        {[
          { key: "signout",  label: t?.menuSignOut  || "SIGN OUT", icon: <SignOutSVG />, action: () => { onSignOut(); onClose(); } },
          { key: "settings", label: t?.menuSettings || "Settings",  icon: <GearSVG />,    action: () => { onOpenSettings?.(); onClose(); } },
          { key: "support",  label: t?.menuSupport  || "Support",   icon: <SupportSVG />, action: () => { onOpenSupport?.(); onClose(); } },
        ].map((item, idx) => (
          <div key={item.key} style={{ display: "contents" }}>
            {idx > 0 && <div style={{ width: 1, background: "#e8e8e8", alignSelf: "stretch" }} />}
            <button onClick={item.action}
              style={{ flex: 1, padding: "10px 6px", background: "none", border: "none",
                cursor: "pointer", display: "flex", flexDirection: "column",
                alignItems: "center", gap: 4, color: "#000" }}
              onMouseEnter={e => e.currentTarget.style.background = "#f5f5f5"}
              onMouseLeave={e => e.currentTarget.style.background = "none"}>
              {item.icon}
              <span style={{ fontFamily: "'Courier New', monospace", fontSize: 9,
                letterSpacing: "0.12em", color: "#000" }}>
                {item.label}
              </span>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export { AccountMenu };

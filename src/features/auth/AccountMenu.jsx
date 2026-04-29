import { useState, useEffect, useRef } from "react";
import { TokenPurchaseModal } from "../billing/TokenPurchaseModal.jsx";
import { WorkspaceMembersModal } from "../workspace/WorkspaceMembersModal.jsx";
import { LangDropdown } from "../../shared/ui/LangDropdown.jsx";

function AccountMenu({ user, profile, onSignOut, onClose, onRefreshProfile, lang, setLang,
  workspaces, currentWorkspace, onSwitchWorkspace, onCreateWorkspace, onOpenHistory, t, chassisCount = 0 }) {
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

  const chassisLabel = `${t?.menuChassis || 'CHASSIS'} (${chassisCount})`;

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

      {/* User info — avatar + signed in as */}
      <div style={{ padding: "14px 18px", borderBottom: "1px solid #e8e8e8" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#000",
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <span style={{ fontFamily: "'Courier New', monospace", fontSize: 9,
              fontWeight: 900, color: "#fff" }}>{initials}</span>
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: "'Courier New', monospace", fontSize: 9, color: "#aaa",
              letterSpacing: "0.12em", marginBottom: 3 }}>
              {t?.menuSignedInAs || 'SIGNED IN AS'}
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#000",
              fontFamily: "'Georgia', serif", overflow: "hidden",
              textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {profile?.display_name || user.email}
            </div>
          </div>
        </div>
      </div>

      {/* Workspace switcher */}
      <div style={{ borderBottom: "1px solid #e8e8e8" }}>
        <button onClick={() => setWorkspaceExpanded(o => !o)}
          style={{ width: "100%", padding: "12px 18px", background: "none", border: "none",
            cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center",
            justifyContent: "space-between", gap: 8 }}>
          <div>
            <div style={{ fontFamily: "'Courier New', monospace", fontSize: 9, color: "#aaa",
              letterSpacing: "0.12em", marginBottom: 3 }}>
              {t?.menuWorkspace || 'WORKSPACE'}
            </div>
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
              {t?.menuPersonal || 'Personal'}
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
                fontFamily: "'Courier New', monospace", fontSize: 11, color: "#888" }}
              onMouseEnter={e => e.currentTarget.style.background = "#f5f5f5"}
              onMouseLeave={e => e.currentTarget.style.background = "none"}>
              {t?.menuAddWorkspace || '+ Work Space'}
            </button>
          </div>
        )}
      </div>

      {/* Chassis count */}
      <button onClick={() => { onOpenHistory(); onClose(); }}
        style={{ width: "100%", padding: "10px 18px", background: "none", border: "none",
          borderBottom: "1px solid #e8e8e8", cursor: "pointer", textAlign: "left",
          fontFamily: "'Courier New', monospace", fontSize: 11, fontWeight: 700,
          letterSpacing: "0.08em", color: "#000" }}
        onMouseEnter={e => e.currentTarget.style.background = "#f0f0f0"}
        onMouseLeave={e => e.currentTarget.style.background = "none"}>
        {chassisLabel}
      </button>

      {/* Token balance */}
      <div style={{ padding: "14px 18px", borderBottom: "1px solid #e8e8e8", background: "#f8f8f8" }}>
        <div style={{ fontFamily: "'Courier New', monospace", fontSize: 9, color: "#aaa",
          letterSpacing: "0.12em", marginBottom: 6 }}>
          {t?.menuTokenBalance || 'TOKEN BALANCE'}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <span style={{ fontSize: 24, fontWeight: 900, color: "#000", lineHeight: 1,
            fontFamily: "'Courier New', monospace" }}>{displayTokens}</span>
          <button onClick={() => setBuyOpen(true)}
            style={{ background: "none", border: "none", cursor: "pointer",
              fontFamily: "'Courier New', monospace", fontSize: 10, fontWeight: 900,
              color: "#000", textDecoration: "underline" }}>
            {t?.menuBuyMore || '+ Buy More'}
          </button>
        </div>
      </div>

      {/* Language selector */}
      <div style={{ padding: "12px 18px", borderBottom: "1px solid #e8e8e8" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontFamily: "'Courier New', monospace", fontSize: 9, color: "#aaa",
            letterSpacing: "0.12em" }}>{t?.menuLanguage || 'LANGUAGE'}</span>
          <LangDropdown lang={lang} setLang={setLang} />
        </div>
      </div>

      {/* Actions */}
      <div style={{ padding: "6px 0" }}>
        <button onClick={() => { onSignOut(); onClose(); }}
          style={{ width: "100%", padding: "10px 18px", background: "none", border: "none",
            cursor: "pointer", textAlign: "left", fontFamily: "'Courier New', monospace",
            fontSize: 11, color: "#000", fontWeight: 700, letterSpacing: "0.08em" }}
          onMouseEnter={e => e.currentTarget.style.background = "#f0f0f0"}
          onMouseLeave={e => e.currentTarget.style.background = "none"}>
          {t?.menuSignOut || 'SIGN OUT'}
        </button>
      </div>
    </div>
  );
}

export { AccountMenu };

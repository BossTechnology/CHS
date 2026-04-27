import { useState, useEffect, useRef } from "react";
import supabase from "../../lib/supabase";

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
    const { data: lookup, error: lookupErr } = await supabase.rpc("lookup_profile_by_email", { p_email: inviteEmail.trim() });
    if (lookupErr) { setError(lookupErr.message); setLoading(false); return; }
    const p = Array.isArray(lookup) ? lookup[0] : lookup;
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

export { WorkspaceMembersModal };

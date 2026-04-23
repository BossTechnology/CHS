import { useState, useEffect, useRef } from "react";
import supabase from "../../lib/supabase.js";

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

export { WorkspaceCreateModal };

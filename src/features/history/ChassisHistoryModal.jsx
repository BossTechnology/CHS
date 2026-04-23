import { useState, useEffect, useRef } from "react";
import supabase from "../../lib/supabase.js";

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

export { ChassisHistoryModal };

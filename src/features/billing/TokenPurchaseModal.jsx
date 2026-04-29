import { useState, useEffect, useRef } from "react";
import supabase from "../../lib/supabase";

function TokenPurchaseModal({ user, profile, currentWorkspace, onClose, onTokensAdded }) {
  const [amountStr, setAmountStr] = useState("25.00");
  const [promoCode, setPromoCode] = useState("");
  const [promoApplied, setPromoApplied] = useState(false);
  const [promoError, setPromoError] = useState("");
  const [promoBonus, setPromoBonus] = useState(0);
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
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

  const handleApplyPromo = async () => {
    const code = promoCode.trim().toUpperCase();
    if (!code) return;
    try {
      const { data: { session: promoSession } } = await supabase.auth.getSession();
      const res = await fetch("/api/validate-promo", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${promoSession?.access_token}`,
        },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (res.ok && data.bonus > 0) {
        setPromoBonus(data.bonus); setPromoApplied(true); setPromoError("");
      } else {
        setPromoError(data.error || "Invalid promo code."); setPromoApplied(false); setPromoBonus(0);
      }
    } catch {
      setPromoError("Could not validate promo code."); setPromoApplied(false); setPromoBonus(0);
    }
  };

  const handleProceed = async () => {
    if (!isValid || !user) return;
    setLoading(true);
    try {
      const { data: { session: purchaseSession } } = await supabase.auth.getSession();
      const res = await fetch("/api/create-purchase", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${purchaseSession?.access_token}`,
        },
        body: JSON.stringify({
          amount: amountNum,
          promoCode: promoApplied ? promoCode.trim().toUpperCase() : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create purchase");
      window.open(data.stripe_url, "_blank");
      setSuccess(`Payment page opened for $${amountNum.toFixed(2)}. Complete your payment on Stripe — your tokens will be credited automatically.`);
    } catch (err) {
      setError(err.message || "Could not start payment. Please try again.");
    } finally {
      setLoading(false);
    }
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
            marginBottom: currentWorkspace ? 4 : 6 }}>Buy Tokens</div>
          {currentWorkspace && (
            <div style={{ fontFamily: "'Courier New', monospace", fontSize: 10, color: "#9966ff",
              letterSpacing: "0.1em", marginBottom: 6 }}>
              {currentWorkspace.name}
            </div>
          )}
          <div style={{ fontFamily: "'Courier New', monospace", fontSize: 11, color: "#555" }}>
            Current balance:{" "}
            <span style={{ color: "#fff", fontWeight: 900 }}>
              {currentWorkspace
                ? (typeof currentWorkspace.token_balance === "number" ? currentWorkspace.token_balance : "—")
                : (typeof profile?.token_balance === "number" ? profile.token_balance : "—")
              } tokens
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
            {[["Compact", "3 tokens", "$3.00"], ["Mid-Size", "5 tokens", "$5.00"],
              ["Executive", "10 tokens", "$10.00"], ["Luxury", "25 tokens", "$25.00"],
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

export { TokenPurchaseModal };

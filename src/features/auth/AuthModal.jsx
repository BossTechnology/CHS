import { useState, useEffect, useRef } from "react";
import supabase from "../../lib/supabase.js";

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

  const handleForgot = async () => {
    if (!email) return;
    setLoading(true); setError(""); setSuccess("");
    const { error: err } = await supabase.auth.resetPasswordForEmail(email);
    if (err) setError(err.message);
    else setSuccess("Password reset email sent. Check your inbox.");
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
          {mode === "signin" ? "Sign In to CHASS1S" : mode === "signup" ? "Create Your Account" : "Reset Password"}
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

        {/* ── Mode tabs (signin / signup only — forgot is a sub-state of signin) ── */}
        {mode !== "forgot" && (
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
        )}

        {/* ── Forgot Password mode ── */}
        {mode === "forgot" ? (
          <>
            <label style={labelStyle}>EMAIL ADDRESS</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              style={inputStyle} placeholder="your@email.com"
              onKeyDown={e => { if (e.key === "Enter") handleForgot(); }} />
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
            <button onClick={handleForgot} disabled={loading || !email}
              style={{ width: "100%", padding: "13px", border: "none", borderRadius: 2,
                cursor: email ? "pointer" : "not-allowed",
                background: email ? "#000" : "#e8e8e8",
                color: email ? "#fff" : "#aaa",
                fontFamily: "'Courier New', monospace", fontSize: 12, fontWeight: 900,
                letterSpacing: "0.15em", transition: "all 0.15s" }}>
              {loading ? "SENDING..." : "SEND RESET EMAIL"}
            </button>
            <button onClick={() => { setMode("signin"); setError(""); setSuccess(""); }}
              style={{ marginTop: 12, background: "none", border: "none", cursor: "pointer",
                fontFamily: "'Courier New', monospace", fontSize: 10, color: "#888",
                textDecoration: "underline", width: "100%" }}>
              Back to Sign In
            </button>
          </>
        ) : (
          <>
            {/* ── Email / Password fields ── */}
            <label style={labelStyle}>EMAIL ADDRESS</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              style={inputStyle} placeholder="your@email.com"
              onKeyDown={e => { if (e.key === "Enter") handleSubmit(); }} />
            <label style={labelStyle}>PASSWORD</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              style={inputStyle} placeholder="••••••••"
              onKeyDown={e => { if (e.key === "Enter") handleSubmit(); }} />

            {/* Forgot password link (signin only) */}
            {mode === "signin" && (
              <div style={{ textAlign: "right", marginBottom: 14, marginTop: -8 }}>
                <button onClick={() => { setMode("forgot"); setError(""); setSuccess(""); }}
                  style={{ background: "none", border: "none", cursor: "pointer",
                    fontFamily: "'Courier New', monospace", fontSize: 10,
                    color: "#888", textDecoration: "underline", padding: 0 }}>
                  Forgot password?
                </button>
              </div>
            )}

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
          </>
        )}
      </div>
    </div>
  );
}

export { AuthModal };

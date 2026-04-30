import { useState, useEffect, useRef } from "react";
import supabase from "../../lib/supabase.ts";

const SUPA_URL = import.meta.env.VITE_SUPABASE_URL || "https://jsffepzvyqurzkzbmzzj.supabase.co";
const SUPA_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "sb_publishable_d2kXxGL7xCMSNDdThc8yDw_dLKu54cJ";

const EN_ROLES = [
  "Student", "Entrepreneur", "Business Owner", "Corporate",
  "Gov Employee", "Artist / Creative", "Consultant",
];

const ROLE_LABELS = {
  EN: ["Student", "Entrepreneur", "Business Owner", "Corporate", "Gov Employee", "Artist / Creative", "Consultant"],
  ES: ["Estudiante", "Emprendedor", "Dueño de Negocio", "Corporativo", "Empleado Gov.", "Artista / Creativo", "Consultor"],
  FR: ["Étudiant", "Entrepreneur", "Chef d'Entreprise", "Entreprise", "Employé Gov.", "Artiste / Créatif", "Consultant"],
  PT: ["Estudante", "Empreendedor", "Dono de Negócio", "Corporativo", "Funcionário Gov.", "Artista / Criativo", "Consultor"],
};

const AGE_RANGES = {
  EN: ["Under 18", "18–24", "25–34", "35–44", "45–54", "55–64", "65+"],
  ES: ["Menor de 18", "18–24", "25–34", "35–44", "45–54", "55–64", "65+"],
  FR: ["Moins de 18", "18–24", "25–34", "35–44", "45–54", "55–64", "65+"],
  PT: ["Menos de 18", "18–24", "25–34", "35–44", "45–54", "55–64", "65+"],
};

const COUNTRIES = [
  { code: "AR", name: "Argentina", flag: "🇦🇷" }, { code: "AU", name: "Australia", flag: "🇦🇺" },
  { code: "AT", name: "Austria", flag: "🇦🇹" }, { code: "BE", name: "Belgium", flag: "🇧🇪" },
  { code: "BO", name: "Bolivia", flag: "🇧🇴" }, { code: "BR", name: "Brazil", flag: "🇧🇷" },
  { code: "CA", name: "Canada", flag: "🇨🇦" }, { code: "CL", name: "Chile", flag: "🇨🇱" },
  { code: "CN", name: "China", flag: "🇨🇳" }, { code: "CO", name: "Colombia", flag: "🇨🇴" },
  { code: "CR", name: "Costa Rica", flag: "🇨🇷" }, { code: "CU", name: "Cuba", flag: "🇨🇺" },
  { code: "CZ", name: "Czech Republic", flag: "🇨🇿" }, { code: "DK", name: "Denmark", flag: "🇩🇰" },
  { code: "DO", name: "Dominican Republic", flag: "🇩🇴" }, { code: "EC", name: "Ecuador", flag: "🇪🇨" },
  { code: "EG", name: "Egypt", flag: "🇪🇬" }, { code: "SV", name: "El Salvador", flag: "🇸🇻" },
  { code: "FI", name: "Finland", flag: "🇫🇮" }, { code: "FR", name: "France", flag: "🇫🇷" },
  { code: "DE", name: "Germany", flag: "🇩🇪" }, { code: "GH", name: "Ghana", flag: "🇬🇭" },
  { code: "GT", name: "Guatemala", flag: "🇬🇹" }, { code: "HN", name: "Honduras", flag: "🇭🇳" },
  { code: "HK", name: "Hong Kong", flag: "🇭🇰" }, { code: "HU", name: "Hungary", flag: "🇭🇺" },
  { code: "IN", name: "India", flag: "🇮🇳" }, { code: "ID", name: "Indonesia", flag: "🇮🇩" },
  { code: "IE", name: "Ireland", flag: "🇮🇪" }, { code: "IL", name: "Israel", flag: "🇮🇱" },
  { code: "IT", name: "Italy", flag: "🇮🇹" }, { code: "JM", name: "Jamaica", flag: "🇯🇲" },
  { code: "JP", name: "Japan", flag: "🇯🇵" }, { code: "KE", name: "Kenya", flag: "🇰🇪" },
  { code: "KR", name: "South Korea", flag: "🇰🇷" }, { code: "LB", name: "Lebanon", flag: "🇱🇧" },
  { code: "MY", name: "Malaysia", flag: "🇲🇾" }, { code: "MX", name: "Mexico", flag: "🇲🇽" },
  { code: "MA", name: "Morocco", flag: "🇲🇦" }, { code: "NL", name: "Netherlands", flag: "🇳🇱" },
  { code: "NZ", name: "New Zealand", flag: "🇳🇿" }, { code: "NI", name: "Nicaragua", flag: "🇳🇮" },
  { code: "NG", name: "Nigeria", flag: "🇳🇬" }, { code: "NO", name: "Norway", flag: "🇳🇴" },
  { code: "PK", name: "Pakistan", flag: "🇵🇰" }, { code: "PA", name: "Panama", flag: "🇵🇦" },
  { code: "PY", name: "Paraguay", flag: "🇵🇾" }, { code: "PE", name: "Peru", flag: "🇵🇪" },
  { code: "PH", name: "Philippines", flag: "🇵🇭" }, { code: "PL", name: "Poland", flag: "🇵🇱" },
  { code: "PT", name: "Portugal", flag: "🇵🇹" }, { code: "PR", name: "Puerto Rico", flag: "🇵🇷" },
  { code: "RO", name: "Romania", flag: "🇷🇴" }, { code: "RU", name: "Russia", flag: "🇷🇺" },
  { code: "SA", name: "Saudi Arabia", flag: "🇸🇦" }, { code: "SG", name: "Singapore", flag: "🇸🇬" },
  { code: "ZA", name: "South Africa", flag: "🇿🇦" }, { code: "ES", name: "Spain", flag: "🇪🇸" },
  { code: "SE", name: "Sweden", flag: "🇸🇪" }, { code: "CH", name: "Switzerland", flag: "🇨🇭" },
  { code: "TW", name: "Taiwan", flag: "🇹🇼" }, { code: "TH", name: "Thailand", flag: "🇹🇭" },
  { code: "TT", name: "Trinidad and Tobago", flag: "🇹🇹" }, { code: "TN", name: "Tunisia", flag: "🇹🇳" },
  { code: "TR", name: "Turkey", flag: "🇹🇷" }, { code: "UA", name: "Ukraine", flag: "🇺🇦" },
  { code: "AE", name: "United Arab Emirates", flag: "🇦🇪" }, { code: "GB", name: "United Kingdom", flag: "🇬🇧" },
  { code: "US", name: "United States", flag: "🇺🇸" }, { code: "UY", name: "Uruguay", flag: "🇺🇾" },
  { code: "VE", name: "Venezuela", flag: "🇻🇪" }, { code: "VN", name: "Vietnam", flag: "🇻🇳" },
  { code: "ZW", name: "Zimbabwe", flag: "🇿🇼" }, { code: "OT", name: "Other", flag: "🌍" },
];

const LABEL_MONO = { fontFamily: "'Courier New', monospace", fontSize: 9, color: "#888", letterSpacing: "0.12em" };
const INPUT_BASE = { width: "100%", padding: "9px 10px", border: "1px solid #ddd", fontFamily: "'Courier New', monospace", fontSize: 12, boxSizing: "border-box", color: "#000", outline: "none", background: "#fff" };

function SettingsModal({ user, profile, lang, t, onClose, onSignOut, onRefreshProfile }) {
  const overlayRef = useRef(null);

  useEffect(() => {
    const h = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);

  // ── Section 1: Profile ────────────────────────────────────────────────────
  const [displayName, setDisplayName] = useState(profile?.display_name || "");
  const [country, setCountry] = useState(profile?.country || "");
  const [ageRange, setAgeRange] = useState(profile?.age_range || "");
  const [roles, setRoles] = useState(() => {
    const saved = profile?.user_roles || [];
    return saved.map((r) => EN_ROLES.indexOf(r)).filter((i) => i !== -1);
  });
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState(false);
  const [profileError, setProfileError] = useState("");

  const saveProfile = async () => {
    setProfileLoading(true); setProfileError("");
    const { error } = await supabase.from("profiles").update({
      display_name: displayName.trim(),
      country,
      age_range: ageRange,
      user_roles: roles.map((i) => EN_ROLES[i]),
    }).eq("id", user.id);
    setProfileLoading(false);
    if (error) { setProfileError(error.message); return; }
    setProfileSuccess(true);
    setTimeout(() => { setProfileSuccess(false); onRefreshProfile(); }, 2000);
  };

  // ── Section 2: Security — Email (multi-step) ───────────────────────────────
  const providers = user?.app_metadata?.providers ||
    (user?.app_metadata?.provider ? [user.app_metadata.provider] : []);
  const hasEmailAuth = providers.includes("email");

  // Steps: 'password' → 'otp' → 'new_email' → 'done'
  const [emailStep, setEmailStep] = useState("password");
  const [emailPassword, setEmailPassword] = useState("");
  const [emailOtp, setEmailOtp] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [showEmailPwd, setShowEmailPwd] = useState(false);

  const resetEmailFlow = () => {
    setEmailStep("password");
    setEmailPassword(""); setEmailOtp(""); setNewEmail("");
    setEmailError(""); setEmailLoading(false); setShowEmailPwd(false);
  };

  // Step 1: verify password then send OTP to current email
  const handleVerifyPassword = async () => {
    if (!emailPassword) return;
    setEmailLoading(true); setEmailError("");
    const { error: authErr } = await supabase.auth.signInWithPassword({ email: user.email, password: emailPassword });
    if (authErr) { setEmailLoading(false); setEmailError("Incorrect password. Please try again."); return; }

    // Send OTP to current email
    try {
      const res = await fetch(`${SUPA_URL}/auth/v1/otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: SUPA_KEY },
        body: JSON.stringify({ email: user.email }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setEmailLoading(false);
        setEmailError(d.msg || d.error_description || "Failed to send code. Try again.");
        return;
      }
    } catch {
      setEmailLoading(false);
      setEmailError("Network error. Please try again.");
      return;
    }
    setEmailLoading(false);
    setEmailStep("otp");
  };

  // Step 2: verify OTP for current email
  const handleVerifyOtp = async () => {
    if (emailOtp.length < 4) return;
    setEmailLoading(true); setEmailError("");
    try {
      const res = await fetch(`${SUPA_URL}/auth/v1/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: SUPA_KEY },
        body: JSON.stringify({ type: "email", email: user.email, token: emailOtp }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setEmailLoading(false);
        setEmailError(d.msg || d.error_description || "Invalid or expired code.");
        return;
      }
    } catch {
      setEmailLoading(false);
      setEmailError("Network error. Please try again.");
      return;
    }
    setEmailLoading(false);
    setEmailStep("new_email");
  };

  // Step 3: update to new email (Supabase sends confirmation to new email)
  const handleUpdateEmail = async () => {
    if (!newEmail.trim()) return;
    setEmailLoading(true); setEmailError("");
    const { error } = await supabase.auth.updateUser({ email: newEmail.trim() });
    setEmailLoading(false);
    if (error) { setEmailError(error.message); return; }
    setEmailStep("done");
  };

  // ── Section 2: Security — Password ────────────────────────────────────────
  const [currentPwd, setCurrentPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [pwdLoading, setPwdLoading] = useState(false);
  const [pwdSuccess, setPwdSuccess] = useState(false);
  const [pwdError, setPwdError] = useState("");
  const [showCurrentPwd, setShowCurrentPwd] = useState(false);
  const [showNewPwd, setShowNewPwd] = useState(false);
  const [showConfirmPwd, setShowConfirmPwd] = useState(false);

  const updatePassword = async () => {
    if (newPwd !== confirmPwd) { setPwdError("Passwords do not match"); return; }
    if (newPwd.length < 6) { setPwdError("Minimum 6 characters"); return; }
    setPwdLoading(true); setPwdError("");
    const { error: reAuthErr } = await supabase.auth.signInWithPassword({ email: user.email, password: currentPwd });
    if (reAuthErr) { setPwdLoading(false); setPwdError("Current password is incorrect"); return; }
    const { error } = await supabase.auth.updateUser({ password: newPwd });
    setPwdLoading(false);
    if (error) { setPwdError(error.message); return; }
    setPwdSuccess(true);
    setTimeout(() => { setPwdSuccess(false); setCurrentPwd(""); setNewPwd(""); setConfirmPwd(""); }, 2000);
  };

  // ── Section 4: Close Account ──────────────────────────────────────────────
  const [dangerExpanded, setDangerExpanded] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deactivating, setDeactivating] = useState(false);
  const [deactivated, setDeactivated] = useState(false);

  const deactivateAccount = async () => {
    if (deleteConfirm !== "DELETE") return;
    setDeactivating(true);
    const deletionDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const { error } = await supabase.from("profiles").update({
      account_status: "deactivated",
      deletion_scheduled_at: deletionDate,
    }).eq("id", user.id);
    if (error) { setDeactivating(false); return; }
    setDeactivated(true);
    setTimeout(async () => { await onSignOut(); onClose(); }, 2000);
  };

  const ageRangesForLang = AGE_RANGES[lang] || AGE_RANGES.EN;
  const roleLabelsForLang = ROLE_LABELS[lang] || ROLE_LABELS.EN;

  const sectionLabel = (text) => (
    <div style={{ ...LABEL_MONO, fontSize: 9, fontWeight: 700, marginBottom: 14 }}>{text}</div>
  );

  const chipBtn = (label, active, onClick) => (
    <button type="button" onClick={onClick} style={{
      padding: "4px 10px", border: `1px solid ${active ? "#000" : "#ddd"}`,
      background: active ? "#000" : "#fff", color: active ? "#fff" : "#888",
      fontFamily: "'Courier New', monospace", fontSize: 9, cursor: "pointer",
    }}>{label}</button>
  );

  const inputFocus = (e) => { e.target.style.borderColor = "#000"; };
  const inputBlur  = (e) => { e.target.style.borderColor = "#ddd"; };

  const pwdField = (label, value, set, show, setShow) => (
    <div style={{ marginBottom: 10 }}>
      <label style={{ display: "block", ...LABEL_MONO, marginBottom: 5 }}>{label}</label>
      <div style={{ position: "relative" }}>
        <input type={show ? "text" : "password"} value={value}
          onChange={(e) => set(e.target.value)}
          onFocus={inputFocus} onBlur={inputBlur}
          style={{ ...INPUT_BASE, paddingRight: 48 }} />
        <button type="button" onClick={() => setShow(s => !s)}
          style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
            background: "none", border: "none", cursor: "pointer", color: "#888",
            fontSize: 9, fontFamily: "'Courier New', monospace", letterSpacing: "0.06em" }}>
          {show ? "hide" : "show"}
        </button>
      </div>
    </div>
  );

  return (
    <div ref={overlayRef}
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 1000,
        display: "flex", alignItems: "flex-start", justifyContent: "center",
        overflowY: "auto", padding: "32px 16px" }}>
      <div style={{ background: "#fff", width: "100%", maxWidth: 460, margin: "auto", position: "relative" }}>

        {/* Close */}
        <button onClick={onClose} style={{ position: "absolute", top: 12, right: 12, background: "none",
          border: "none", cursor: "pointer", fontSize: 16, color: "#aaa", padding: "4px 6px", lineHeight: 1 }}>✕</button>

        {/* Header */}
        <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid #e8e8e8" }}>
          <h2 style={{ margin: 0, fontFamily: "'Georgia', serif", fontSize: 18, fontWeight: 900, color: "#000" }}>
            {t?.settingsTitle || "Account Settings"}
          </h2>
        </div>

        {/* ── Section 1: Profile ── */}
        <div style={{ padding: "18px 24px", borderBottom: "1px solid #e8e8e8" }}>
          {sectionLabel(t?.settingsSectionProfile || "PROFILE INFO")}

          <div style={{ marginBottom: 12 }}>
            <label style={{ display: "block", ...LABEL_MONO, marginBottom: 5 }}>DISPLAY NAME</label>
            <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)}
              onFocus={inputFocus} onBlur={inputBlur} style={INPUT_BASE} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
            <div>
              <label style={{ display: "block", ...LABEL_MONO, marginBottom: 5 }}>COUNTRY</label>
              <select value={country} onChange={(e) => setCountry(e.target.value)}
                onFocus={inputFocus} onBlur={inputBlur}
                style={{ ...INPUT_BASE, cursor: "pointer" }}>
                <option value="">— Select —</option>
                {COUNTRIES.map((c) => (
                  <option key={c.code} value={c.code}>{c.flag} {c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ display: "block", ...LABEL_MONO, marginBottom: 5 }}>AGE RANGE</label>
              <select value={ageRange} onChange={(e) => setAgeRange(e.target.value)}
                onFocus={inputFocus} onBlur={inputBlur}
                style={{ ...INPUT_BASE, cursor: "pointer", color: ageRange ? "#000" : "#aaa" }}>
                <option value="">—</option>
                {ageRangesForLang.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", ...LABEL_MONO, marginBottom: 6 }}>YOUR ROLE(S)</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
              {roleLabelsForLang.map((r, i) => chipBtn(r, roles.includes(i),
                () => setRoles((prev) => prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i])
              ))}
            </div>
          </div>

          {profileError && (
            <div style={{ color: "#cc0000", fontFamily: "'Courier New', monospace", fontSize: 10, marginBottom: 8 }}>
              {profileError}
            </div>
          )}
          <button onClick={saveProfile} disabled={profileLoading}
            style={{ padding: "9px 18px", background: profileSuccess ? "#00aa44" : "#000", color: "#fff",
              border: "none", cursor: "pointer", fontFamily: "'Courier New', monospace",
              fontSize: 9, fontWeight: 700, letterSpacing: "0.1em" }}>
            {profileLoading
              ? (t?.settingsSaving || "SAVING...")
              : profileSuccess
                ? (t?.settingsSaved || "✓ Saved")
                : (t?.settingsSave || "SAVE CHANGES")}
          </button>
        </div>

        {/* ── Section 2: Security ── */}
        <div style={{ padding: "18px 24px", borderBottom: "1px solid #e8e8e8" }}>
          {sectionLabel(t?.settingsSectionSecurity || "SECURITY")}

          {/* Email update — multi-step */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: "block", ...LABEL_MONO, marginBottom: 10 }}>
              {t?.settingsNewEmail || "CHANGE EMAIL"}
            </label>

            {emailStep === "password" && (
              <div>
                <div style={{ fontFamily: "'Courier New', monospace", fontSize: 10, color: "#555", marginBottom: 8 }}>
                  Enter your current password to begin.
                </div>
                <div style={{ position: "relative", marginBottom: 8 }}>
                  <input type={showEmailPwd ? "text" : "password"} value={emailPassword}
                    onChange={(e) => setEmailPassword(e.target.value)}
                    placeholder="Current password"
                    onFocus={inputFocus} onBlur={inputBlur}
                    onKeyDown={(e) => { if (e.key === "Enter") handleVerifyPassword(); }}
                    style={{ ...INPUT_BASE, paddingRight: 48 }} />
                  <button type="button" onClick={() => setShowEmailPwd(s => !s)}
                    style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
                      background: "none", border: "none", cursor: "pointer", color: "#888",
                      fontSize: 9, fontFamily: "'Courier New', monospace" }}>
                    {showEmailPwd ? "hide" : "show"}
                  </button>
                </div>
                {emailError && <div style={{ color: "#cc0000", fontFamily: "'Courier New', monospace", fontSize: 10, marginBottom: 6 }}>{emailError}</div>}
                <button onClick={handleVerifyPassword} disabled={emailLoading || !emailPassword}
                  style={{ padding: "9px 16px", background: emailPassword && !emailLoading ? "#000" : "#e8e8e8",
                    color: emailPassword && !emailLoading ? "#fff" : "#aaa", border: "none",
                    cursor: emailPassword && !emailLoading ? "pointer" : "not-allowed",
                    fontFamily: "'Courier New', monospace", fontSize: 9, fontWeight: 700, letterSpacing: "0.08em" }}>
                  {emailLoading ? "..." : "VERIFY PASSWORD"}
                </button>
              </div>
            )}

            {emailStep === "otp" && (
              <div>
                <div style={{ fontFamily: "'Courier New', monospace", fontSize: 10, color: "#555", marginBottom: 8 }}>
                  A verification code was sent to <strong>{user.email}</strong>. Enter it below.
                </div>
                <input type="text" value={emailOtp}
                  onChange={(e) => setEmailOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="6-digit code"
                  onFocus={inputFocus} onBlur={inputBlur}
                  onKeyDown={(e) => { if (e.key === "Enter") handleVerifyOtp(); }}
                  style={{ ...INPUT_BASE, letterSpacing: "0.2em", marginBottom: 8 }} />
                {emailError && <div style={{ color: "#cc0000", fontFamily: "'Courier New', monospace", fontSize: 10, marginBottom: 6 }}>{emailError}</div>}
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={handleVerifyOtp} disabled={emailLoading || emailOtp.length < 4}
                    style={{ padding: "9px 16px", background: emailOtp.length >= 4 && !emailLoading ? "#000" : "#e8e8e8",
                      color: emailOtp.length >= 4 && !emailLoading ? "#fff" : "#aaa", border: "none",
                      cursor: emailOtp.length >= 4 && !emailLoading ? "pointer" : "not-allowed",
                      fontFamily: "'Courier New', monospace", fontSize: 9, fontWeight: 700, letterSpacing: "0.08em" }}>
                    {emailLoading ? "..." : "VERIFY CODE"}
                  </button>
                  <button onClick={resetEmailFlow}
                    style={{ padding: "9px 12px", background: "none", border: "1px solid #ddd",
                      cursor: "pointer", fontFamily: "'Courier New', monospace", fontSize: 9, color: "#888" }}>
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {emailStep === "new_email" && (
              <div>
                <div style={{ fontFamily: "'Courier New', monospace", fontSize: 10, color: "#555", marginBottom: 8 }}>
                  Identity verified. Enter your new email address.
                </div>
                <input type="email" value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="New email address"
                  onFocus={inputFocus} onBlur={inputBlur}
                  onKeyDown={(e) => { if (e.key === "Enter") handleUpdateEmail(); }}
                  style={{ ...INPUT_BASE, marginBottom: 8 }} />
                {emailError && <div style={{ color: "#cc0000", fontFamily: "'Courier New', monospace", fontSize: 10, marginBottom: 6 }}>{emailError}</div>}
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={handleUpdateEmail} disabled={emailLoading || !newEmail.trim()}
                    style={{ padding: "9px 16px", background: newEmail.trim() && !emailLoading ? "#000" : "#e8e8e8",
                      color: newEmail.trim() && !emailLoading ? "#fff" : "#aaa", border: "none",
                      cursor: newEmail.trim() && !emailLoading ? "pointer" : "not-allowed",
                      fontFamily: "'Courier New', monospace", fontSize: 9, fontWeight: 700, letterSpacing: "0.08em" }}>
                    {emailLoading ? "..." : "SEND CONFIRMATION"}
                  </button>
                  <button onClick={resetEmailFlow}
                    style={{ padding: "9px 12px", background: "none", border: "1px solid #ddd",
                      cursor: "pointer", fontFamily: "'Courier New', monospace", fontSize: 9, color: "#888" }}>
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {emailStep === "done" && (
              <div>
                <div style={{ color: "#00aa44", fontFamily: "'Courier New', monospace", fontSize: 10, lineHeight: 1.7, marginBottom: 8 }}>
                  ✓ Confirmation sent to <strong>{newEmail}</strong>. Check your inbox to complete the change.
                </div>
                <button onClick={resetEmailFlow}
                  style={{ padding: "9px 16px", background: "#000", color: "#fff", border: "none",
                    cursor: "pointer", fontFamily: "'Courier New', monospace", fontSize: 9, fontWeight: 700, letterSpacing: "0.08em" }}>
                  DONE
                </button>
              </div>
            )}
          </div>

          {/* Password */}
          {!hasEmailAuth ? (
            <div style={{ color: "#888", fontFamily: "'Courier New', monospace", fontSize: 10, lineHeight: 1.7 }}>
              {t?.settingsOAuthNoPassword || "Password login is not available for your account."}
            </div>
          ) : (
            <div>
              <label style={{ display: "block", ...LABEL_MONO, marginBottom: 10 }}>
                {t?.settingsChangePassword || "CHANGE PASSWORD"}
              </label>
              {pwdField(t?.settingsCurrentPassword || "CURRENT PASSWORD", currentPwd, setCurrentPwd, showCurrentPwd, setShowCurrentPwd)}
              {pwdField(t?.settingsNewPassword || "NEW PASSWORD", newPwd, setNewPwd, showNewPwd, setShowNewPwd)}
              {pwdField(t?.settingsConfirmPassword || "CONFIRM NEW PASSWORD", confirmPwd, setConfirmPwd, showConfirmPwd, setShowConfirmPwd)}
              {pwdError && (
                <div style={{ color: "#cc0000", fontFamily: "'Courier New', monospace", fontSize: 10, marginBottom: 8 }}>
                  {pwdError}
                </div>
              )}
              <button onClick={updatePassword} disabled={pwdLoading || !currentPwd || !newPwd || !confirmPwd}
                style={{ padding: "9px 18px", background: pwdSuccess ? "#00aa44" : "#000", color: "#fff",
                  border: "none", cursor: "pointer", fontFamily: "'Courier New', monospace",
                  fontSize: 9, fontWeight: 700, letterSpacing: "0.1em" }}>
                {pwdLoading ? "..." : pwdSuccess ? "✓ Updated" : (t?.settingsUpdatePassword || "UPDATE PASSWORD")}
              </button>
            </div>
          )}
        </div>

        {/* ── Section 3: Connected Accounts ── */}
        <div style={{ padding: "18px 24px", borderBottom: "1px solid #e8e8e8" }}>
          {sectionLabel(t?.settingsSectionConnected || "CONNECTED ACCOUNTS")}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
            {providers.length === 0 ? (
              <span style={{ color: "#aaa", fontFamily: "'Courier New', monospace", fontSize: 10 }}>—</span>
            ) : providers.map((p) => (
              <span key={p} style={{ border: "1px solid #000", borderRadius: 2, padding: "3px 10px",
                fontFamily: "'Courier New', monospace", fontSize: 9, fontWeight: 900,
                display: "flex", alignItems: "center", gap: 5 }}>
                <span style={{ color: "#00aa44" }}>✓</span>
                {{ google: "Google", linkedin_oidc: "LinkedIn", github: "GitHub", email: "Email" }[p] || p}
              </span>
            ))}
          </div>
          <div style={{ color: "#aaa", fontFamily: "'Courier New', monospace", fontSize: 9 }}>
            Linking / unlinking not available in this version.
          </div>
        </div>

        {/* ── Section 4: Close Account ── */}
        <div style={{ padding: "18px 24px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            {sectionLabel(t?.settingsSectionDanger || "CLOSE ACCOUNT")}
            {!dangerExpanded && (
              <button onClick={() => setDangerExpanded(true)}
                style={{ background: "none", border: "none", cursor: "pointer",
                  fontFamily: "'Courier New', monospace", fontSize: 9,
                  color: "#888", textDecoration: "underline", marginTop: -14 }}>
                {t?.settingsDangerShow || "Show options"}
              </button>
            )}
          </div>

          {dangerExpanded && (
            <div style={{ marginTop: 6 }}>
              <div style={{ background: "#fff5f5", border: "1px solid #ffcccc",
                padding: "10px 14px", color: "#cc0000", fontFamily: "'Courier New', monospace",
                fontSize: 10, lineHeight: 1.7, marginBottom: 12 }}>
                {t?.settingsDangerWarning || "Your account will be scheduled for deletion in 30 days."}
              </div>

              {deactivated ? (
                <div style={{ textAlign: "center", padding: "10px 0", color: "#cc0000",
                  fontFamily: "'Courier New', monospace", fontSize: 10 }}>
                  {t?.settingsDeactivated || "Account deactivated. You will be signed out."}
                </div>
              ) : (
                <>
                  <label style={{ display: "block", ...LABEL_MONO, marginBottom: 5 }}>
                    {t?.settingsDangerPrompt || "Type DELETE to confirm"}
                  </label>
                  <input type="text" value={deleteConfirm} onChange={(e) => setDeleteConfirm(e.target.value)}
                    placeholder="DELETE"
                    style={{ ...INPUT_BASE, marginBottom: 10 }}
                    onFocus={inputFocus} onBlur={inputBlur} />
                  <button onClick={deactivateAccount}
                    disabled={deleteConfirm !== "DELETE" || deactivating}
                    style={{ width: "100%", padding: "9px 18px",
                      background: deleteConfirm === "DELETE" ? "#cc0000" : "#e8e8e8",
                      color: deleteConfirm === "DELETE" ? "#fff" : "#aaa",
                      border: "none",
                      cursor: deleteConfirm === "DELETE" ? "pointer" : "not-allowed",
                      fontFamily: "'Courier New', monospace", fontSize: 10,
                      fontWeight: 900, letterSpacing: "0.08em" }}>
                    {deactivating ? "..." : (t?.settingsDeactivateBtn || "DEACTIVATE ACCOUNT")}
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export { SettingsModal };

import { useState, useEffect, useRef } from "react";
import supabase from "../../lib/supabase.ts";

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

const LABEL_MONO = { fontFamily: "'Courier New', monospace", fontSize: 10, color: "#888", letterSpacing: "0.12em" };
const INPUT_BASE = { width: "100%", padding: "10px 12px", border: "1px solid #ddd", fontFamily: "'Courier New', monospace", fontSize: 12, boxSizing: "border-box", color: "#000", outline: "none", background: "#fff" };

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

  // ── Section 2: Security ───────────────────────────────────────────────────
  const providers = user?.app_metadata?.providers ||
    (user?.app_metadata?.provider ? [user.app_metadata.provider] : []);
  const hasEmailAuth = providers.includes("email");

  const [newEmail, setNewEmail] = useState("");
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailSuccess, setEmailSuccess] = useState(false);
  const [emailError, setEmailError] = useState("");

  const [currentPwd, setCurrentPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [pwdLoading, setPwdLoading] = useState(false);
  const [pwdSuccess, setPwdSuccess] = useState(false);
  const [pwdError, setPwdError] = useState("");
  const [showCurrentPwd, setShowCurrentPwd] = useState(false);
  const [showNewPwd, setShowNewPwd] = useState(false);
  const [showConfirmPwd, setShowConfirmPwd] = useState(false);

  const updateEmail = async () => {
    if (!newEmail.trim()) return;
    setEmailLoading(true); setEmailError("");
    const { error } = await supabase.auth.updateUser({ email: newEmail.trim() });
    setEmailLoading(false);
    if (error) { setEmailError(error.message); return; }
    setEmailSuccess(true);
    setNewEmail("");
    setTimeout(() => setEmailSuccess(false), 4000);
  };

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
    <div style={{ ...LABEL_MONO, fontSize: 10, fontWeight: 700, marginBottom: 16 }}>{text}</div>
  );

  const chipBtn = (label, active, onClick) => (
    <button type="button" onClick={onClick} style={{
      padding: "5px 12px", border: `1px solid ${active ? "#000" : "#ddd"}`,
      background: active ? "#000" : "#fff", color: active ? "#fff" : "#888",
      fontFamily: "'Courier New', monospace", fontSize: 10, cursor: "pointer",
    }}>{label}</button>
  );

  const inputFocus = (e) => { e.target.style.borderColor = "#000"; };
  const inputBlur  = (e) => { e.target.style.borderColor = "#ddd"; };

  return (
    <div ref={overlayRef}
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 1000,
        display: "flex", alignItems: "flex-start", justifyContent: "center",
        overflowY: "auto", padding: "40px 20px" }}>
      <div style={{ background: "#fff", width: "100%", maxWidth: 520, margin: "auto", position: "relative" }}>

        {/* Close */}
        <button onClick={onClose} style={{ position: "absolute", top: 14, right: 14, background: "none",
          border: "none", cursor: "pointer", fontSize: 18, color: "#aaa", padding: "4px 8px", lineHeight: 1 }}>✕</button>

        {/* Header */}
        <div style={{ padding: "28px 32px 22px", borderBottom: "1px solid #e8e8e8" }}>
          <h2 style={{ margin: 0, fontFamily: "'Georgia', serif", fontSize: 20, fontWeight: 900, color: "#000" }}>
            {t?.settingsTitle || "Account Settings"}
          </h2>
        </div>

        {/* ── Section 1: Profile ── */}
        <div style={{ padding: "24px 32px", borderBottom: "1px solid #e8e8e8" }}>
          {sectionLabel(t?.settingsSectionProfile || "PROFILE INFO")}

          <div style={{ marginBottom: 14 }}>
            <label style={{ display: "block", ...LABEL_MONO, marginBottom: 6 }}>DISPLAY NAME</label>
            <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)}
              onFocus={inputFocus} onBlur={inputBlur} style={INPUT_BASE} />
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={{ display: "block", ...LABEL_MONO, marginBottom: 6 }}>COUNTRY</label>
            <select value={country} onChange={(e) => setCountry(e.target.value)}
              style={{ ...INPUT_BASE, cursor: "pointer" }}>
              <option value="">— Select country —</option>
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>{c.flag} {c.name}</option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={{ display: "block", ...LABEL_MONO, marginBottom: 8 }}>AGE RANGE</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {ageRangesForLang.map((r) => chipBtn(r, ageRange === r, () => setAgeRange(r)))}
            </div>
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{ display: "block", ...LABEL_MONO, marginBottom: 8 }}>YOUR ROLE(S)</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {roleLabelsForLang.map((r, i) => chipBtn(r, roles.includes(i),
                () => setRoles((prev) => prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i])
              ))}
            </div>
          </div>

          {profileError && (
            <div style={{ color: "#cc0000", fontFamily: "'Courier New', monospace", fontSize: 11, marginBottom: 10 }}>
              {profileError}
            </div>
          )}
          <button onClick={saveProfile} disabled={profileLoading}
            style={{ padding: "10px 20px", background: profileSuccess ? "#00aa44" : "#000", color: "#fff",
              border: "none", cursor: "pointer", fontFamily: "'Courier New', monospace",
              fontSize: 10, fontWeight: 700, letterSpacing: "0.1em" }}>
            {profileLoading
              ? (t?.settingsSaving || "SAVING...")
              : profileSuccess
                ? (t?.settingsSaved || "✓ Saved")
                : (t?.settingsSave || "SAVE CHANGES")}
          </button>
        </div>

        {/* ── Section 2: Security ── */}
        <div style={{ padding: "24px 32px", borderBottom: "1px solid #e8e8e8" }}>
          {sectionLabel(t?.settingsSectionSecurity || "SECURITY")}

          {/* Email update */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: "block", ...LABEL_MONO, marginBottom: 6 }}>
              {t?.settingsNewEmail || "NEW EMAIL ADDRESS"}
            </label>
            <div style={{ display: "flex", gap: 8 }}>
              <input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)}
                placeholder={user.email} onFocus={inputFocus} onBlur={inputBlur}
                style={{ ...INPUT_BASE, flex: 1 }} />
              <button onClick={updateEmail} disabled={emailLoading || !newEmail.trim()}
                style={{ padding: "10px 14px", background: "#000", color: "#fff", border: "none",
                  cursor: "pointer", fontFamily: "'Courier New', monospace", fontSize: 10,
                  fontWeight: 700, whiteSpace: "nowrap", flexShrink: 0 }}>
                {emailLoading ? "..." : (t?.settingsUpdateEmail || "UPDATE EMAIL")}
              </button>
            </div>
            {emailSuccess && (
              <div style={{ color: "#00aa44", fontFamily: "'Courier New', monospace", fontSize: 11, marginTop: 6 }}>
                Confirmation email sent.
              </div>
            )}
            {emailError && (
              <div style={{ color: "#cc0000", fontFamily: "'Courier New', monospace", fontSize: 11, marginTop: 6 }}>
                {emailError}
              </div>
            )}
          </div>

          {/* Password */}
          {!hasEmailAuth ? (
            <div style={{ color: "#888", fontFamily: "'Courier New', monospace", fontSize: 11, lineHeight: 1.7 }}>
              {t?.settingsOAuthNoPassword || "Password login is not available for your account."}
            </div>
          ) : (
            <div>
              {[
                { label: t?.settingsCurrentPassword || "CURRENT PASSWORD", value: currentPwd, set: setCurrentPwd, show: showCurrentPwd, setShow: setShowCurrentPwd },
                { label: t?.settingsNewPassword || "NEW PASSWORD",       value: newPwd,     set: setNewPwd,     show: showNewPwd,     setShow: setShowNewPwd },
                { label: t?.settingsConfirmPassword || "CONFIRM NEW PASSWORD", value: confirmPwd, set: setConfirmPwd, show: showConfirmPwd, setShow: setShowConfirmPwd },
              ].map(({ label, value, set, show, setShow }) => (
                <div key={label} style={{ marginBottom: 12 }}>
                  <label style={{ display: "block", ...LABEL_MONO, marginBottom: 6 }}>{label}</label>
                  <div style={{ position: "relative" }}>
                    <input type={show ? "text" : "password"} value={value}
                      onChange={(e) => set(e.target.value)}
                      onFocus={inputFocus} onBlur={inputBlur}
                      style={{ ...INPUT_BASE, paddingRight: 52 }} />
                    <button type="button" onClick={() => setShow((s) => !s)}
                      style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
                        background: "none", border: "none", cursor: "pointer", color: "#888",
                        fontSize: 10, fontFamily: "'Courier New', monospace", letterSpacing: "0.06em" }}>
                      {show ? "hide" : "show"}
                    </button>
                  </div>
                </div>
              ))}
              {pwdError && (
                <div style={{ color: "#cc0000", fontFamily: "'Courier New', monospace", fontSize: 11, marginBottom: 10 }}>
                  {pwdError}
                </div>
              )}
              <button onClick={updatePassword} disabled={pwdLoading || !currentPwd || !newPwd || !confirmPwd}
                style={{ padding: "10px 20px", background: pwdSuccess ? "#00aa44" : "#000", color: "#fff",
                  border: "none", cursor: "pointer", fontFamily: "'Courier New', monospace",
                  fontSize: 10, fontWeight: 700, letterSpacing: "0.1em" }}>
                {pwdLoading ? "..." : pwdSuccess ? "✓ Updated" : (t?.settingsUpdatePassword || "UPDATE PASSWORD")}
              </button>
            </div>
          )}
        </div>

        {/* ── Section 3: Connected Accounts ── */}
        <div style={{ padding: "24px 32px", borderBottom: "1px solid #e8e8e8" }}>
          {sectionLabel(t?.settingsSectionConnected || "CONNECTED ACCOUNTS")}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
            {providers.length === 0 ? (
              <span style={{ color: "#aaa", fontFamily: "'Courier New', monospace", fontSize: 11 }}>—</span>
            ) : providers.map((p) => (
              <span key={p} style={{ border: "1px solid #000", borderRadius: 2, padding: "4px 12px",
                fontFamily: "'Courier New', monospace", fontSize: 10, fontWeight: 900,
                display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ color: "#00aa44" }}>✓</span>
                {{ google: "Google", linkedin_oidc: "LinkedIn", github: "GitHub", email: "Email" }[p] || p}
              </span>
            ))}
          </div>
          <div style={{ color: "#aaa", fontFamily: "'Courier New', monospace", fontSize: 10 }}>
            Linking / unlinking not available in this version.
          </div>
        </div>

        {/* ── Section 4: Close Account ── */}
        <div style={{ padding: "24px 32px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            {sectionLabel(t?.settingsSectionDanger || "CLOSE ACCOUNT")}
            {!dangerExpanded && (
              <button onClick={() => setDangerExpanded(true)}
                style={{ background: "none", border: "none", cursor: "pointer",
                  fontFamily: "'Courier New', monospace", fontSize: 10,
                  color: "#888", textDecoration: "underline", marginTop: -16 }}>
                {t?.settingsDangerShow || "Show options"}
              </button>
            )}
          </div>

          {dangerExpanded && (
            <div style={{ marginTop: 8 }}>
              <div style={{ background: "#fff5f5", border: "1px solid #ffcccc", borderRadius: 2,
                padding: "12px 16px", color: "#cc0000", fontFamily: "'Courier New', monospace",
                fontSize: 11, lineHeight: 1.7, marginBottom: 16 }}>
                {t?.settingsDangerWarning || "Your account will be scheduled for deletion in 30 days."}
              </div>

              {deactivated ? (
                <div style={{ textAlign: "center", padding: "12px 0", color: "#cc0000",
                  fontFamily: "'Courier New', monospace", fontSize: 11 }}>
                  {t?.settingsDeactivated || "Account deactivated. You will be signed out."}
                </div>
              ) : (
                <>
                  <label style={{ display: "block", ...LABEL_MONO, marginBottom: 6 }}>
                    {t?.settingsDangerPrompt || "Type DELETE to confirm"}
                  </label>
                  <input type="text" value={deleteConfirm} onChange={(e) => setDeleteConfirm(e.target.value)}
                    placeholder="DELETE"
                    style={{ ...INPUT_BASE, marginBottom: 12 }}
                    onFocus={inputFocus} onBlur={inputBlur} />
                  <button onClick={deactivateAccount}
                    disabled={deleteConfirm !== "DELETE" || deactivating}
                    style={{ width: "100%", padding: "10px 20px",
                      background: deleteConfirm === "DELETE" ? "#cc0000" : "#e8e8e8",
                      color: deleteConfirm === "DELETE" ? "#fff" : "#aaa",
                      border: "none",
                      cursor: deleteConfirm === "DELETE" ? "pointer" : "not-allowed",
                      fontFamily: "'Courier New', monospace", fontSize: 11,
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

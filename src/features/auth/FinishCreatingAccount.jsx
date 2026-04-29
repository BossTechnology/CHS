import { useState, useRef, useEffect } from "react";
import supabase from "../../lib/supabase.ts";

const FINISH_STRINGS = {
  EN: {
    heading: "Finish Creating Your Account",
    subheading: "Just a few details to personalize your experience.",
    privacyLink: "Why do we ask?",
    nameLabel: "Display Name",
    namePlaceholder: "How should we call you?",
    countryLabel: "Country",
    ageLabel: "Age Range",
    rolesLabel: "Your Role(s)",
    rolesOptional: "optional",
    submitBtn: "Complete Setup",
    submitting: "Saving...",
    successMsg: "All set! Welcome to CHASS1S.",
    terms: "By continuing you agree to our",
    termsLink: "Terms of Service",
    termsAnd: "and",
    policyLink: "Privacy Policy",
    termsDot: ".",
    ageRanges: ["Under 18", "18–24", "25–34", "35–44", "45–54", "55–64", "65+"],
    roles: ["Student", "Entrepreneur", "Business Owner", "Corporate", "Gov Employee", "Artist / Creative", "Consultant"],
  },
  ES: {
    heading: "Termina de Crear tu Cuenta",
    subheading: "Solo unos detalles para personalizar tu experiencia.",
    privacyLink: "¿Por qué preguntamos?",
    nameLabel: "Nombre para mostrar",
    namePlaceholder: "¿Cómo debemos llamarte?",
    countryLabel: "País",
    ageLabel: "Rango de Edad",
    rolesLabel: "Tu(s) Rol(es)",
    rolesOptional: "opcional",
    submitBtn: "Completar Configuración",
    submitting: "Guardando...",
    successMsg: "¡Listo! Bienvenido a CHASS1S.",
    terms: "Al continuar aceptas nuestros",
    termsLink: "Términos de Servicio",
    termsAnd: "y",
    policyLink: "Política de Privacidad",
    termsDot: ".",
    ageRanges: ["Menor de 18", "18–24", "25–34", "35–44", "45–54", "55–64", "65+"],
    roles: ["Estudiante", "Emprendedor", "Dueño de Negocio", "Corporativo", "Empleado Gov.", "Artista / Creativo", "Consultor"],
  },
  FR: {
    heading: "Finalisez la Création de Votre Compte",
    subheading: "Quelques détails pour personnaliser votre expérience.",
    privacyLink: "Pourquoi demandons-nous cela ?",
    nameLabel: "Nom d'affichage",
    namePlaceholder: "Comment devons-nous vous appeler ?",
    countryLabel: "Pays",
    ageLabel: "Tranche d'âge",
    rolesLabel: "Votre / Vos Rôle(s)",
    rolesOptional: "optionnel",
    submitBtn: "Terminer la Configuration",
    submitting: "Enregistrement...",
    successMsg: "C'est parti ! Bienvenue sur CHASS1S.",
    terms: "En continuant, vous acceptez nos",
    termsLink: "Conditions d'Utilisation",
    termsAnd: "et notre",
    policyLink: "Politique de Confidentialité",
    termsDot: ".",
    ageRanges: ["Moins de 18", "18–24", "25–34", "35–44", "45–54", "55–64", "65+"],
    roles: ["Étudiant", "Entrepreneur", "Chef d'Entreprise", "Entreprise", "Employé Gov.", "Artiste / Créatif", "Consultant"],
  },
  PT: {
    heading: "Conclua a Criação da sua Conta",
    subheading: "Apenas alguns detalhes para personalizar sua experiência.",
    privacyLink: "Por que perguntamos?",
    nameLabel: "Nome de exibição",
    namePlaceholder: "Como devemos te chamar?",
    countryLabel: "País",
    ageLabel: "Faixa Etária",
    rolesLabel: "Seu(s) Papel(éis)",
    rolesOptional: "opcional",
    submitBtn: "Concluir Configuração",
    submitting: "Salvando...",
    successMsg: "Pronto! Bem-vindo ao CHASS1S.",
    terms: "Ao continuar, você concorda com nossos",
    termsLink: "Termos de Serviço",
    termsAnd: "e",
    policyLink: "Política de Privacidade",
    termsDot: ".",
    ageRanges: ["Menos de 18", "18–24", "25–34", "35–44", "45–54", "55–64", "65+"],
    roles: ["Estudante", "Empreendedor", "Dono de Negócio", "Corporativo", "Funcionário Gov.", "Artista / Criativo", "Consultor"],
  },
};

// Always save English role values regardless of UI language
const EN_ROLES = [
  "Student",
  "Entrepreneur",
  "Business Owner",
  "Corporate",
  "Gov Employee",
  "Artist / Creative",
  "Consultant",
];

const COUNTRIES = [
  { code: "AR", name: "Argentina", flag: "🇦🇷" },
  { code: "AU", name: "Australia", flag: "🇦🇺" },
  { code: "AT", name: "Austria", flag: "🇦🇹" },
  { code: "BE", name: "Belgium", flag: "🇧🇪" },
  { code: "BO", name: "Bolivia", flag: "🇧🇴" },
  { code: "BR", name: "Brazil", flag: "🇧🇷" },
  { code: "CA", name: "Canada", flag: "🇨🇦" },
  { code: "CL", name: "Chile", flag: "🇨🇱" },
  { code: "CN", name: "China", flag: "🇨🇳" },
  { code: "CO", name: "Colombia", flag: "🇨🇴" },
  { code: "CR", name: "Costa Rica", flag: "🇨🇷" },
  { code: "CU", name: "Cuba", flag: "🇨🇺" },
  { code: "CZ", name: "Czech Republic", flag: "🇨🇿" },
  { code: "DK", name: "Denmark", flag: "🇩🇰" },
  { code: "DO", name: "Dominican Republic", flag: "🇩🇴" },
  { code: "EC", name: "Ecuador", flag: "🇪🇨" },
  { code: "EG", name: "Egypt", flag: "🇪🇬" },
  { code: "SV", name: "El Salvador", flag: "🇸🇻" },
  { code: "FI", name: "Finland", flag: "🇫🇮" },
  { code: "FR", name: "France", flag: "🇫🇷" },
  { code: "DE", name: "Germany", flag: "🇩🇪" },
  { code: "GH", name: "Ghana", flag: "🇬🇭" },
  { code: "GT", name: "Guatemala", flag: "🇬🇹" },
  { code: "HN", name: "Honduras", flag: "🇭🇳" },
  { code: "HK", name: "Hong Kong", flag: "🇭🇰" },
  { code: "HU", name: "Hungary", flag: "🇭🇺" },
  { code: "IN", name: "India", flag: "🇮🇳" },
  { code: "ID", name: "Indonesia", flag: "🇮🇩" },
  { code: "IE", name: "Ireland", flag: "🇮🇪" },
  { code: "IL", name: "Israel", flag: "🇮🇱" },
  { code: "IT", name: "Italy", flag: "🇮🇹" },
  { code: "JM", name: "Jamaica", flag: "🇯🇲" },
  { code: "JP", name: "Japan", flag: "🇯🇵" },
  { code: "KE", name: "Kenya", flag: "🇰🇪" },
  { code: "KR", name: "South Korea", flag: "🇰🇷" },
  { code: "LB", name: "Lebanon", flag: "🇱🇧" },
  { code: "MY", name: "Malaysia", flag: "🇲🇾" },
  { code: "MX", name: "Mexico", flag: "🇲🇽" },
  { code: "MA", name: "Morocco", flag: "🇲🇦" },
  { code: "NL", name: "Netherlands", flag: "🇳🇱" },
  { code: "NZ", name: "New Zealand", flag: "🇳🇿" },
  { code: "NI", name: "Nicaragua", flag: "🇳🇮" },
  { code: "NG", name: "Nigeria", flag: "🇳🇬" },
  { code: "NO", name: "Norway", flag: "🇳🇴" },
  { code: "PK", name: "Pakistan", flag: "🇵🇰" },
  { code: "PA", name: "Panama", flag: "🇵🇦" },
  { code: "PY", name: "Paraguay", flag: "🇵🇾" },
  { code: "PE", name: "Peru", flag: "🇵🇪" },
  { code: "PH", name: "Philippines", flag: "🇵🇭" },
  { code: "PL", name: "Poland", flag: "🇵🇱" },
  { code: "PT", name: "Portugal", flag: "🇵🇹" },
  { code: "PR", name: "Puerto Rico", flag: "🇵🇷" },
  { code: "RO", name: "Romania", flag: "🇷🇴" },
  { code: "RU", name: "Russia", flag: "🇷🇺" },
  { code: "SA", name: "Saudi Arabia", flag: "🇸🇦" },
  { code: "SG", name: "Singapore", flag: "🇸🇬" },
  { code: "ZA", name: "South Africa", flag: "🇿🇦" },
  { code: "ES", name: "Spain", flag: "🇪🇸" },
  { code: "SE", name: "Sweden", flag: "🇸🇪" },
  { code: "CH", name: "Switzerland", flag: "🇨🇭" },
  { code: "TW", name: "Taiwan", flag: "🇹🇼" },
  { code: "TH", name: "Thailand", flag: "🇹🇭" },
  { code: "TT", name: "Trinidad and Tobago", flag: "🇹🇹" },
  { code: "TN", name: "Tunisia", flag: "🇹🇳" },
  { code: "TR", name: "Turkey", flag: "🇹🇷" },
  { code: "UA", name: "Ukraine", flag: "🇺🇦" },
  { code: "AE", name: "United Arab Emirates", flag: "🇦🇪" },
  { code: "GB", name: "United Kingdom", flag: "🇬🇧" },
  { code: "US", name: "United States", flag: "🇺🇸" },
  { code: "UY", name: "Uruguay", flag: "🇺🇾" },
  { code: "VE", name: "Venezuela", flag: "🇻🇪" },
  { code: "VN", name: "Vietnam", flag: "🇻🇳" },
  { code: "ZW", name: "Zimbabwe", flag: "🇿🇼" },
  { code: "OT", name: "Other", flag: "🌍" },
];

function CountryDropdown({ value, onChange, countryLabel }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef(null);
  const searchRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (open && searchRef.current) searchRef.current.focus();
  }, [open]);

  const filtered = COUNTRIES.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  const selected = COUNTRIES.find((c) => c.code === value);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => { setOpen((o) => !o); setSearch(""); }}
        style={{
          width: "100%",
          padding: "12px 16px",
          background: "#1a1a1a",
          border: "1px solid #333",
          borderRadius: 6,
          color: selected ? "#fff" : "#666",
          fontFamily: "'Courier New', monospace",
          fontSize: 13,
          cursor: "pointer",
          textAlign: "left",
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        {selected ? (
          <>
            <span>{selected.flag}</span>
            <span>{selected.name}</span>
          </>
        ) : (
          <span>{countryLabel}</span>
        )}
        <span style={{ marginLeft: "auto", color: "#666", fontSize: 10 }}>
          {open ? "▲" : "▼"}
        </span>
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            right: 0,
            background: "#1a1a1a",
            border: "1px solid #333",
            borderRadius: 6,
            zIndex: 500,
            maxHeight: 240,
            overflowY: "auto",
            boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
          }}
        >
          <div style={{ padding: "8px 8px 4px" }}>
            <input
              ref={searchRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search..."
              style={{
                width: "100%",
                padding: "8px 10px",
                background: "#111",
                border: "1px solid #333",
                borderRadius: 4,
                color: "#fff",
                fontFamily: "'Courier New', monospace",
                fontSize: 12,
                boxSizing: "border-box",
              }}
            />
          </div>
          {filtered.map((c) => (
            <button
              key={c.code}
              type="button"
              onClick={() => { onChange(c.code); setOpen(false); }}
              style={{
                width: "100%",
                padding: "9px 14px",
                background: c.code === value ? "#9966ff22" : "none",
                border: "none",
                cursor: "pointer",
                textAlign: "left",
                color: c.code === value ? "#9966ff" : "#ccc",
                fontFamily: "'Courier New', monospace",
                fontSize: 12,
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}
              onMouseEnter={(e) => { if (c.code !== value) e.currentTarget.style.background = "#ffffff0d"; }}
              onMouseLeave={(e) => { if (c.code !== value) e.currentTarget.style.background = "none"; }}
            >
              <span>{c.flag}</span>
              <span>{c.name}</span>
            </button>
          ))}
          {filtered.length === 0 && (
            <div style={{ padding: "12px 14px", color: "#555", fontFamily: "'Courier New', monospace", fontSize: 12 }}>
              No results
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function FinishCreatingAccount({ user, lang, onComplete }) {
  const s = FINISH_STRINGS[lang] || FINISH_STRINGS.EN;

  const [displayName, setDisplayName] = useState("");
  const [country, setCountry] = useState("");
  const [ageRange, setAgeRange] = useState("");
  const [roles, setRoles] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const toggleRole = (idx) => {
    setRoles((prev) =>
      prev.includes(idx) ? prev.filter((r) => r !== idx) : [...prev, idx]
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!displayName.trim()) return;
    if (!country) return;
    if (!ageRange) return;

    setSubmitting(true);
    setError("");

    const englishRoles = roles.map((i) => EN_ROLES[i]);

    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        display_name: displayName.trim(),
        country,
        age_range: ageRange,
        user_roles: englishRoles,
        onboarding_complete: true,
      })
      .eq("id", user.id);

    if (updateError) {
      setError(updateError.message || "Something went wrong. Please try again.");
      setSubmitting(false);
      return;
    }

    setSuccess(true);
    setTimeout(() => onComplete(), 1800);
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "#0a0a0a",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: "24px 16px",
        overflowY: "auto",
      }}
    >
      <div
        style={{
          background: "#111",
          border: "1px solid #222",
          borderRadius: 12,
          padding: "40px 36px",
          width: "100%",
          maxWidth: 480,
          boxShadow: "0 24px 64px rgba(0,0,0,0.6)",
        }}
      >
        {/* Logo / brand mark */}
        <div style={{ marginBottom: 28, textAlign: "center" }}>
          <span
            style={{
              fontFamily: "'Courier New', monospace",
              fontSize: 11,
              color: "#9966ff",
              letterSpacing: "0.25em",
              fontWeight: 900,
            }}
          >
            CHASS1S
          </span>
        </div>

        <h1
          style={{
            fontFamily: "'Courier New', monospace",
            fontSize: 18,
            color: "#fff",
            fontWeight: 900,
            letterSpacing: "0.04em",
            margin: "0 0 8px",
            textAlign: "center",
          }}
        >
          {s.heading}
        </h1>
        <p
          style={{
            fontFamily: "'Courier New', monospace",
            fontSize: 11,
            color: "#777",
            textAlign: "center",
            margin: "0 0 32px",
            letterSpacing: "0.06em",
          }}
        >
          {s.subheading}
        </p>

        {success ? (
          <div
            style={{
              textAlign: "center",
              padding: "32px 0",
              fontFamily: "'Courier New', monospace",
              fontSize: 13,
              color: "#9966ff",
              letterSpacing: "0.06em",
            }}
          >
            {s.successMsg}
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {/* Display Name */}
            <div>
              <label
                style={{
                  display: "block",
                  fontFamily: "'Courier New', monospace",
                  fontSize: 10,
                  color: "#888",
                  letterSpacing: "0.12em",
                  marginBottom: 8,
                }}
              >
                {s.nameLabel} *
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder={s.namePlaceholder}
                required
                autoFocus
                style={{
                  width: "100%",
                  padding: "12px 16px",
                  background: "#1a1a1a",
                  border: "1px solid #333",
                  borderRadius: 6,
                  color: "#fff",
                  fontFamily: "'Courier New', monospace",
                  fontSize: 13,
                  boxSizing: "border-box",
                  outline: "none",
                }}
                onFocus={(e) => { e.target.style.borderColor = "#9966ff"; }}
                onBlur={(e) => { e.target.style.borderColor = "#333"; }}
              />
            </div>

            {/* Country */}
            <div>
              <label
                style={{
                  display: "block",
                  fontFamily: "'Courier New', monospace",
                  fontSize: 10,
                  color: "#888",
                  letterSpacing: "0.12em",
                  marginBottom: 8,
                }}
              >
                {s.countryLabel} *
              </label>
              <CountryDropdown value={country} onChange={setCountry} countryLabel={s.countryLabel} />
            </div>

            {/* Age Range */}
            <div>
              <label
                style={{
                  display: "block",
                  fontFamily: "'Courier New', monospace",
                  fontSize: 10,
                  color: "#888",
                  letterSpacing: "0.12em",
                  marginBottom: 8,
                }}
              >
                {s.ageLabel} *
              </label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {s.ageRanges.map((range, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setAgeRange(range)}
                    style={{
                      padding: "7px 14px",
                      background: ageRange === range ? "#9966ff" : "#1a1a1a",
                      border: `1px solid ${ageRange === range ? "#9966ff" : "#333"}`,
                      borderRadius: 20,
                      color: ageRange === range ? "#fff" : "#888",
                      fontFamily: "'Courier New', monospace",
                      fontSize: 11,
                      cursor: "pointer",
                      letterSpacing: "0.05em",
                      transition: "all 0.15s",
                    }}
                  >
                    {range}
                  </button>
                ))}
              </div>
            </div>

            {/* Roles */}
            <div>
              <label
                style={{
                  display: "block",
                  fontFamily: "'Courier New', monospace",
                  fontSize: 10,
                  color: "#888",
                  letterSpacing: "0.12em",
                  marginBottom: 8,
                }}
              >
                {s.rolesLabel}{" "}
                <span style={{ color: "#555" }}>({s.rolesOptional})</span>
              </label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {s.roles.map((role, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => toggleRole(i)}
                    style={{
                      padding: "7px 14px",
                      background: roles.includes(i) ? "#9966ff22" : "#1a1a1a",
                      border: `1px solid ${roles.includes(i) ? "#9966ff" : "#333"}`,
                      borderRadius: 20,
                      color: roles.includes(i) ? "#9966ff" : "#888",
                      fontFamily: "'Courier New', monospace",
                      fontSize: 11,
                      cursor: "pointer",
                      letterSpacing: "0.05em",
                      transition: "all 0.15s",
                    }}
                  >
                    {role}
                  </button>
                ))}
              </div>
            </div>

            {error && (
              <div
                style={{
                  padding: "10px 14px",
                  background: "#ff000011",
                  border: "1px solid #ff000044",
                  borderRadius: 6,
                  fontFamily: "'Courier New', monospace",
                  fontSize: 11,
                  color: "#ff6666",
                }}
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting || !displayName.trim() || !country || !ageRange}
              style={{
                padding: "14px",
                background: submitting || !displayName.trim() || !country || !ageRange
                  ? "#333"
                  : "#9966ff",
                border: "none",
                borderRadius: 6,
                color: submitting || !displayName.trim() || !country || !ageRange
                  ? "#666"
                  : "#fff",
                fontFamily: "'Courier New', monospace",
                fontSize: 12,
                fontWeight: 900,
                letterSpacing: "0.1em",
                cursor: submitting || !displayName.trim() || !country || !ageRange
                  ? "not-allowed"
                  : "pointer",
                transition: "all 0.15s",
                marginTop: 4,
              }}
            >
              {submitting ? s.submitting : s.submitBtn}
            </button>

            {/* Terms */}
            <p
              style={{
                fontFamily: "'Courier New', monospace",
                fontSize: 9,
                color: "#555",
                textAlign: "center",
                margin: 0,
                letterSpacing: "0.06em",
                lineHeight: 1.6,
              }}
            >
              {s.terms}{" "}
              <a href="/terms" target="_blank" rel="noopener noreferrer" style={{ color: "#9966ff", textDecoration: "none" }}>
                {s.termsLink}
              </a>{" "}
              {s.termsAnd}{" "}
              <a href="/privacy" target="_blank" rel="noopener noreferrer" style={{ color: "#9966ff", textDecoration: "none" }}>
                {s.policyLink}
              </a>
              {s.termsDot}
            </p>
          </form>
        )}
      </div>
    </div>
  );
}

export { FinishCreatingAccount };

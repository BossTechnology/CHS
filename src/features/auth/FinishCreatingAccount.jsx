import { useState, useRef, useEffect } from "react";
import supabase from "../../lib/supabase.ts";

const FINISH_STRINGS = {
  EN: {
    greeting: "Hello, where are you visiting from?",
    heading: "Finish Creating Your Account",
    subheading: "Just a few details to personalize your experience.",
    nameLabel: "NAME / NICKNAME / TAG",
    countryLabel: "COUNTRY",
    countryPlaceholder: "Select country",
    countrySearch: "Search...",
    countryNoResults: "No results",
    ageLabel: "AGE RANGE",
    rolesLabel: "YOUR ROLE(S)",
    rolesOptional: "optional",
    submitBtn: "FINISH CREATING ACCOUNT",
    submitting: "SAVING...",
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
    greeting: "Hola, ¿desde dónde nos visitas?",
    heading: "Termina de Crear tu Cuenta",
    subheading: "Solo unos detalles para personalizar tu experiencia.",
    nameLabel: "NOMBRE / APODO / TAG",
    countryLabel: "PAÍS",
    countryPlaceholder: "Selecciona país",
    countrySearch: "Buscar...",
    countryNoResults: "Sin resultados",
    ageLabel: "RANGO DE EDAD",
    rolesLabel: "TU(S) ROL(ES)",
    rolesOptional: "opcional",
    submitBtn: "FINALIZAR CREACIÓN DE CUENTA",
    submitting: "GUARDANDO...",
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
    greeting: "Bonjour, d'où venez-vous ?",
    heading: "Finalisez la Création de Votre Compte",
    subheading: "Quelques détails pour personnaliser votre expérience.",
    nameLabel: "NOM / PSEUDO / TAG",
    countryLabel: "PAYS",
    countryPlaceholder: "Sélectionner un pays",
    countrySearch: "Rechercher...",
    countryNoResults: "Aucun résultat",
    ageLabel: "TRANCHE D'ÂGE",
    rolesLabel: "VOTRE / VOS RÔLE(S)",
    rolesOptional: "optionnel",
    submitBtn: "TERMINER LA CRÉATION DU COMPTE",
    submitting: "ENREGISTREMENT...",
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
    greeting: "Olá, de onde você está nos visitando?",
    heading: "Conclua a Criação da sua Conta",
    subheading: "Apenas alguns detalhes para personalizar sua experiência.",
    nameLabel: "NOME / APELIDO / TAG",
    countryLabel: "PAÍS",
    countryPlaceholder: "Selecionar país",
    countrySearch: "Pesquisar...",
    countryNoResults: "Sem resultados",
    ageLabel: "FAIXA ETÁRIA",
    rolesLabel: "SEU(S) PAPEL(EIS)",
    rolesOptional: "opcional",
    submitBtn: "CONCLUIR CRIAÇÃO DE CONTA",
    submitting: "SALVANDO...",
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

const EN_ROLES = [
  "Student", "Entrepreneur", "Business Owner", "Corporate",
  "Gov Employee", "Artist / Creative", "Consultant",
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

const INPUT_STYLE = {
  width: "100%",
  padding: "8px 10px",
  border: "1px solid #ddd",
  fontFamily: "'Courier New', monospace",
  fontSize: 12,
  boxSizing: "border-box",
  color: "#000",
  outline: "none",
  background: "#fff",
  borderRadius: 0,
};

const LABEL_STYLE = {
  display: "block",
  fontFamily: "'Courier New', monospace",
  fontSize: 9,
  color: "#aaa",
  letterSpacing: "0.12em",
  marginBottom: 6,
};

function CountryDropdown({ value, onChange, s }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef(null);
  const searchRef = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
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
          ...INPUT_STYLE,
          cursor: "pointer",
          textAlign: "left",
          display: "flex",
          alignItems: "center",
          gap: 8,
          border: open ? "1px solid #000" : "1px solid #ddd",
        }}
      >
        {selected ? (
          <>
            <span>{selected.flag}</span>
            <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{selected.name}</span>
          </>
        ) : (
          <span style={{ flex: 1, color: "#aaa" }}>{s.countryPlaceholder}</span>
        )}
        <span style={{ color: "#888", fontSize: 9 }}>{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div style={{
          position: "absolute",
          top: "calc(100% + 2px)",
          left: 0,
          right: 0,
          background: "#fff",
          border: "1px solid #000",
          zIndex: 500,
          maxHeight: 200,
          overflowY: "auto",
          boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
        }}>
          <div style={{ padding: "6px 6px 3px", borderBottom: "1px solid #f0f0f0" }}>
            <input
              ref={searchRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={s.countrySearch}
              style={{
                width: "100%",
                padding: "6px 8px",
                border: "1px solid #ddd",
                fontFamily: "'Courier New', monospace",
                fontSize: 11,
                boxSizing: "border-box",
                outline: "none",
                color: "#000",
                background: "#fff",
                borderRadius: 0,
              }}
              onFocus={(e) => { e.target.style.borderColor = "#000"; }}
              onBlur={(e) => { e.target.style.borderColor = "#ddd"; }}
            />
          </div>
          {filtered.map((c) => (
            <button
              key={c.code}
              type="button"
              onClick={() => { onChange(c.code); setOpen(false); }}
              style={{
                width: "100%",
                padding: "7px 10px",
                background: c.code === value ? "#f0f0f0" : "none",
                border: "none",
                borderLeft: c.code === value ? "3px solid #000" : "3px solid transparent",
                cursor: "pointer",
                textAlign: "left",
                color: "#000",
                fontFamily: "'Courier New', monospace",
                fontSize: 11,
                fontWeight: c.code === value ? 900 : 400,
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
              onMouseEnter={(e) => { if (c.code !== value) e.currentTarget.style.background = "#f8f8f8"; }}
              onMouseLeave={(e) => { if (c.code !== value) e.currentTarget.style.background = "none"; }}
            >
              <span>{c.flag}</span>
              <span>{c.name}</span>
            </button>
          ))}
          {filtered.length === 0 && (
            <div style={{ padding: "10px", color: "#aaa", fontFamily: "'Courier New', monospace", fontSize: 11 }}>
              {s.countryNoResults}
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
    setRoles((prev) => prev.includes(idx) ? prev.filter((r) => r !== idx) : [...prev, idx]);
  };

  const isValid = displayName.trim() && country && ageRange;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isValid) return;
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

  const chipStyle = (active) => ({
    padding: "5px 10px",
    background: active ? "#000" : "#fff",
    border: `1px solid ${active ? "#000" : "#ddd"}`,
    color: active ? "#fff" : "#555",
    fontFamily: "'Courier New', monospace",
    fontSize: 9,
    fontWeight: active ? 900 : 400,
    cursor: "pointer",
    letterSpacing: "0.05em",
    borderRadius: 0,
  });

  return (
    <div style={{
      position: "fixed",
      inset: 0,
      background: "#fff",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 1000,
      padding: "16px 12px",
      overflowY: "auto",
    }}>
      <div style={{
        background: "#fff",
        border: "1px solid #000",
        padding: "24px 20px",
        width: "100%",
        maxWidth: 460,
        boxShadow: "0 8px 32px rgba(0,0,0,0.08)",
      }}>

        {/* Logo */}
        <div style={{ marginBottom: 16, textAlign: "center" }}>
          <img src="/logo.png" alt="CHASS1S" style={{ height: 32, objectFit: "contain" }} />
        </div>

        {/* Greeting */}
        <p style={{
          fontFamily: "'Courier New', monospace",
          fontSize: 10,
          color: "#888",
          textAlign: "center",
          margin: "0 0 10px",
          letterSpacing: "0.06em",
        }}>
          {s.greeting}
        </p>

        {/* Heading */}
        <h1 style={{
          fontFamily: "'Georgia', serif",
          fontSize: 19,
          fontWeight: 900,
          color: "#000",
          margin: "0 0 4px",
          textAlign: "center",
          letterSpacing: "-0.01em",
        }}>
          {s.heading}
        </h1>
        <p style={{
          fontFamily: "'Courier New', monospace",
          fontSize: 10,
          color: "#aaa",
          textAlign: "center",
          margin: "0 0 18px",
          letterSpacing: "0.04em",
        }}>
          {s.subheading}
        </p>

        {/* Divider */}
        <div style={{ borderTop: "1px solid #e8e8e8", marginBottom: 18 }} />

        {success ? (
          <div style={{
            textAlign: "center",
            padding: "24px 0",
            fontFamily: "'Georgia', serif",
            fontSize: 16,
            fontWeight: 700,
            color: "#000",
          }}>
            {s.successMsg}
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>

            {/* Display Name */}
            <div>
              <label style={LABEL_STYLE}>{s.nameLabel} *</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
                autoFocus
                style={INPUT_STYLE}
                onFocus={(e) => { e.target.style.borderColor = "#000"; }}
                onBlur={(e) => { e.target.style.borderColor = "#ddd"; }}
              />
            </div>

            {/* Country + Age Range — same row */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, alignItems: "start" }}>
              <div>
                <label style={LABEL_STYLE}>{s.countryLabel} *</label>
                <CountryDropdown value={country} onChange={setCountry} s={s} />
              </div>
              <div>
                <label style={LABEL_STYLE}>{s.ageLabel} *</label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                  {s.ageRanges.map((range) => (
                    <button
                      key={range}
                      type="button"
                      onClick={() => setAgeRange(range)}
                      style={chipStyle(ageRange === range)}
                      onMouseEnter={(e) => { if (ageRange !== range) { e.currentTarget.style.borderColor = "#000"; e.currentTarget.style.color = "#000"; } }}
                      onMouseLeave={(e) => { if (ageRange !== range) { e.currentTarget.style.borderColor = "#ddd"; e.currentTarget.style.color = "#555"; } }}
                    >
                      {range}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Roles */}
            <div>
              <label style={LABEL_STYLE}>
                {s.rolesLabel}{" "}
                <span style={{ color: "#ccc", fontWeight: 400 }}>({s.rolesOptional})</span>
              </label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {s.roles.map((role, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => toggleRole(i)}
                    style={chipStyle(roles.includes(i))}
                    onMouseEnter={(e) => { if (!roles.includes(i)) { e.currentTarget.style.borderColor = "#000"; e.currentTarget.style.color = "#000"; } }}
                    onMouseLeave={(e) => { if (!roles.includes(i)) { e.currentTarget.style.borderColor = "#ddd"; e.currentTarget.style.color = "#555"; } }}
                  >
                    {role}
                  </button>
                ))}
              </div>
            </div>

            {error && (
              <div style={{
                padding: "8px 10px",
                border: "1px solid #cc0000",
                fontFamily: "'Courier New', monospace",
                fontSize: 11,
                color: "#cc0000",
              }}>
                {error}
              </div>
            )}

            {/* Terms — above button */}
            <p style={{
              fontFamily: "'Courier New', monospace",
              fontSize: 9,
              color: "#aaa",
              textAlign: "center",
              margin: 0,
              letterSpacing: "0.04em",
              lineHeight: 1.7,
            }}>
              {s.terms}{" "}
              <a href="/terms" target="_blank" rel="noopener noreferrer"
                style={{ color: "#000", textDecoration: "underline" }}>
                {s.termsLink}
              </a>{" "}
              {s.termsAnd}{" "}
              <a href="/privacy" target="_blank" rel="noopener noreferrer"
                style={{ color: "#000", textDecoration: "underline" }}>
                {s.policyLink}
              </a>
              {s.termsDot}
            </p>

            {/* Submit */}
            <button
              type="submit"
              disabled={submitting || !isValid}
              style={{
                padding: "12px",
                background: isValid && !submitting ? "#000" : "#e8e8e8",
                border: "none",
                color: isValid && !submitting ? "#fff" : "#aaa",
                fontFamily: "'Courier New', monospace",
                fontSize: 10,
                fontWeight: 900,
                letterSpacing: "0.1em",
                cursor: isValid && !submitting ? "pointer" : "not-allowed",
              }}
            >
              {submitting ? s.submitting : s.submitBtn}
            </button>

          </form>
        )}
      </div>
    </div>
  );
}

export { FinishCreatingAccount };

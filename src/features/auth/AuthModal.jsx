import { useState, useEffect, useRef } from "react";
import supabase from "../../lib/supabase";

// ─── Centralised auth strings (all UI text lives here) ───────────────────────
const AUTH_STRINGS = {
  EN: {
    signInTitle:   "Sign In to CHASS1S",
    signUpTitle:   "Create Your Account",
    resetTitle:    "Reset Your Password",
    emailTab:      "EMAIL SIGN IN",
    signUpTab:     "CREATE ACCOUNT",
    forgotTab:     "RESET PASSWORD",
    emailLabel:    "EMAIL ADDRESS",
    passwordLabel: "PASSWORD",
    submitSignIn:  "SIGN IN",
    submitSignUp:  "CREATE ACCOUNT",
    redirecting:   "REDIRECTING...",
    processing:    "PROCESSING...",
    sending:       "SENDING...",
    sendReset:     "SEND RESET EMAIL",
    backToSignIn:  "Back to Sign In",
    forgotLink:    "Forgot password?",
    signUpSuccess: "Account created! Check your email to confirm.",
    resetSuccess:  "Password reset email sent. Check your inbox.",
    freeTokens:    "New accounts receive 10 FREE TOKENS — no credit card required.",
    orContinueWith:"OR CONTINUE WITH",
    moreInfo:      "More info",
    emailInvalid:  "Please enter a valid email address.",
    accountNotFoundShort:    "ACCOUNT NOT FOUND",
    accountNotFoundMoreInfo: "The email address entered is incorrect, the account was deleted due to inactivity, or a previously linked account was removed. Check the spelling or create a new account.",
    alreadyExistsShort:      "ACCOUNT ALREADY EXISTS",
    alreadyExistsMoreInfo:   "The email you are using is already registered. Sign in rather than register, use Forgot Password, or use a different email.",
    invalidLoginShort:       "Incorrect email or password.",
    invalidLoginMoreInfo:    "Double-check your credentials. If you signed up with Google or LinkedIn, use those buttons instead.",
    unknownErrorShort:       "Something went wrong.",
    unknownErrorMoreInfo:    "Please try again. If the problem persists, contact support.",
  },
  ES: {
    signInTitle:   "Iniciar Sesión en CHASS1S",
    signUpTitle:   "Crear Tu Cuenta",
    resetTitle:    "Restablecer Tu Contraseña",
    emailTab:      "EMAIL SIGN IN",
    signUpTab:     "CREAR CUENTA",
    forgotTab:     "RESTABLECER",
    emailLabel:    "CORREO ELECTRÓNICO",
    passwordLabel: "CONTRASEÑA",
    submitSignIn:  "INICIAR SESIÓN",
    submitSignUp:  "CREAR CUENTA",
    redirecting:   "REDIRIGIENDO...",
    processing:    "PROCESANDO...",
    sending:       "ENVIANDO...",
    sendReset:     "ENVIAR EMAIL DE RESTABLECIMIENTO",
    backToSignIn:  "Volver al Inicio de Sesión",
    forgotLink:    "¿Olvidaste tu contraseña?",
    signUpSuccess: "¡Cuenta creada! Revisa tu email para confirmar.",
    resetSuccess:  "Email de restablecimiento enviado. Revisa tu bandeja.",
    freeTokens:    "Las cuentas nuevas reciben 10 TOKENS GRATIS — sin tarjeta de crédito.",
    orContinueWith:"O CONTINUAR CON",
    moreInfo:      "Más info",
    emailInvalid:  "Por favor ingresa un correo electrónico válido.",
    accountNotFoundShort:    "CUENTA NO ENCONTRADA",
    accountNotFoundMoreInfo: "La dirección de correo electrónico ingresada es incorrecta, la cuenta fue eliminada por inactividad, o una cuenta vinculada previamente fue removida. Verifica la ortografía o crea una nueva cuenta.",
    alreadyExistsShort:      "CUENTA YA EXISTE",
    alreadyExistsMoreInfo:   "El correo electrónico que estás usando ya está registrado. Inicia sesión, usa Olvidé mi contraseña, o usa otro correo.",
    invalidLoginShort:       "Email o contraseña incorrectos.",
    invalidLoginMoreInfo:    "Verifica tus credenciales. Si te registraste con Google o LinkedIn, usa esos botones.",
    unknownErrorShort:       "Algo salió mal.",
    unknownErrorMoreInfo:    "Por favor intenta nuevamente. Si el problema persiste, contacta soporte.",
  },
  FR: {
    signInTitle:   "Connexion à CHASS1S",
    signUpTitle:   "Créer Votre Compte",
    resetTitle:    "Réinitialiser Votre Mot de Passe",
    emailTab:      "EMAIL SIGN IN",
    signUpTab:     "CRÉER UN COMPTE",
    forgotTab:     "RÉINITIALISER",
    emailLabel:    "ADRESSE EMAIL",
    passwordLabel: "MOT DE PASSE",
    submitSignIn:  "CONNEXION",
    submitSignUp:  "CRÉER UN COMPTE",
    redirecting:   "REDIRECTION...",
    processing:    "TRAITEMENT...",
    sending:       "ENVOI...",
    sendReset:     "ENVOYER L'EMAIL DE RÉINITIALISATION",
    backToSignIn:  "Retour à la Connexion",
    forgotLink:    "Mot de passe oublié ?",
    signUpSuccess: "Compte créé ! Vérifiez votre email pour confirmer.",
    resetSuccess:  "Email de réinitialisation envoyé. Vérifiez votre boîte.",
    freeTokens:    "Les nouveaux comptes reçoivent 10 TOKENS GRATUITS — sans carte bancaire.",
    orContinueWith:"OU CONTINUER AVEC",
    moreInfo:      "Plus d'info",
    emailInvalid:  "Veuillez saisir une adresse email valide.",
    accountNotFoundShort:    "COMPTE INTROUVABLE",
    accountNotFoundMoreInfo: "L'adresse email saisie est incorrecte, le compte a été supprimé pour inactivité, ou un compte précédemment lié a été supprimé. Vérifiez l'orthographe ou créez un nouveau compte.",
    alreadyExistsShort:      "COMPTE DÉJÀ EXISTANT",
    alreadyExistsMoreInfo:   "L'email que vous utilisez est déjà enregistré. Connectez-vous, utilisez Mot de passe oublié, ou utilisez un autre email.",
    invalidLoginShort:       "Email ou mot de passe incorrect.",
    invalidLoginMoreInfo:    "Vérifiez vos identifiants. Si vous vous êtes inscrit avec Google ou LinkedIn, utilisez ces boutons.",
    unknownErrorShort:       "Une erreur s'est produite.",
    unknownErrorMoreInfo:    "Veuillez réessayer. Si le problème persiste, contactez le support.",
  },
  PT: {
    signInTitle:   "Entrar no CHASS1S",
    signUpTitle:   "Criar Sua Conta",
    resetTitle:    "Redefinir Sua Senha",
    emailTab:      "EMAIL SIGN IN",
    signUpTab:     "CRIAR CONTA",
    forgotTab:     "REDEFINIR",
    emailLabel:    "ENDEREÇO DE EMAIL",
    passwordLabel: "SENHA",
    submitSignIn:  "ENTRAR",
    submitSignUp:  "CRIAR CONTA",
    redirecting:   "REDIRECIONANDO...",
    processing:    "PROCESSANDO...",
    sending:       "ENVIANDO...",
    sendReset:     "ENVIAR EMAIL DE REDEFINIÇÃO",
    backToSignIn:  "Voltar ao Login",
    forgotLink:    "Esqueceu a senha?",
    signUpSuccess: "Conta criada! Verifique seu email para confirmar.",
    resetSuccess:  "Email de redefinição enviado. Verifique sua caixa.",
    freeTokens:    "Novas contas recebem 10 TOKENS GRATUITOS — sem cartão de crédito.",
    orContinueWith:"OU CONTINUAR COM",
    moreInfo:      "Mais info",
    emailInvalid:  "Por favor insira um endereço de email válido.",
    accountNotFoundShort:    "CONTA NÃO ENCONTRADA",
    accountNotFoundMoreInfo: "O endereço de email inserido está incorreto, a conta foi excluída por inatividade, ou uma conta vinculada anteriormente foi removida. Verifique a ortografia ou crie uma nova conta.",
    alreadyExistsShort:      "CONTA JÁ EXISTE",
    alreadyExistsMoreInfo:   "O email que você está usando já está cadastrado. Faça login, use Esqueceu a senha, ou use um email diferente.",
    invalidLoginShort:       "Email ou senha incorretos.",
    invalidLoginMoreInfo:    "Verifique suas credenciais. Se se cadastrou com Google ou LinkedIn, use esses botões.",
    unknownErrorShort:       "Algo deu errado.",
    unknownErrorMoreInfo:    "Por favor tente novamente. Se o problema persistir, entre em contato com o suporte.",
  },
};

// ─── Error classifier ─────────────────────────────────────────────────────────
function classifyAuthError(message = "") {
  const m = message.toLowerCase();
  if (m.includes("invalid login") || m.includes("invalid credentials") || m.includes("email not confirmed")) return "invalid_login";
  if (m.includes("user not found") || m.includes("no user found") || m.includes("email address not found")) return "account_not_found";
  if (m.includes("already registered") || m.includes("already exists") || m.includes("user already")) return "already_exists";
  return "unknown";
}

// ─── Social providers ─────────────────────────────────────────────────────────
const SOCIAL_PROVIDERS = [
  {
    id: "google",
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
    id: "linkedin_oidc",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="#0A66C2">
        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
      </svg>
    ),
  },
  {
    id: "github",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="#24292F">
        <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/>
      </svg>
    ),
  },
];

const PROVIDER_LABELS = { google: "Google", linkedin_oidc: "LinkedIn", github: "GitHub" };

// ─── Eye icon ─────────────────────────────────────────────────────────────────
function EyeIcon({ open }) {
  return open ? (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  ) : (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  );
}

// ─── AuthModal ────────────────────────────────────────────────────────────────
function AuthModal({ onClose, onSuccess, initialMode = "signin", lang = "EN" }) {
  const s = AUTH_STRINGS[lang] ?? AUTH_STRINGS.EN;

  const [mode, setMode] = useState(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(null);
  const [errorType, setErrorType] = useState(null);   // account_not_found | already_exists | invalid_login | unknown
  const [moreInfoOpen, setMoreInfoOpen] = useState(false);
  const [success, setSuccess] = useState("");
  const overlayRef = useRef(null);

  const clearError = () => { setErrorType(null); setMoreInfoOpen(false); };

  // Auto-expand More Info for errors that need guidance without extra click
  const setError = (type) => {
    setErrorType(type);
    if (type === "account_not_found" || type === "already_exists") setMoreInfoOpen(true);
  };

  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  const isValidEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

  const handleOAuth = async (provider) => {
    setOauthLoading(provider); clearError();
    await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: window.location.origin },
    });
    setOauthLoading(null);
  };

  const handleSubmit = async () => {
    if (!email || !password) return;
    setLoading(true); clearError(); setSuccess("");
    if (mode === "signin") {
      const { data, error: err } = await supabase.auth.signInWithPassword({ email, password });
      if (err) {
        setError(classifyAuthError(err.message));
      } else {
        onSuccess(data.user);
        onClose();
      }
    } else {
      const { data: signUpData, error: err } = await supabase.auth.signUp({ email, password });
      if (err) {
        setError(classifyAuthError(err.message));
      } else if (!signUpData.user || signUpData.user.identities?.length === 0) {
        setError("already_exists");
      } else {
        setSuccess(s.signUpSuccess);
      }
    }
    setLoading(false);
  };

  const handleForgot = async () => {
    if (!email) return;
    if (!isValidEmail(email)) { setErrorType("email_invalid"); return; }
    setLoading(true); clearError(); setSuccess("");
    const { error: err } = await supabase.auth.resetPasswordForEmail(email);
    if (err) {
      setErrorType("unknown");
    } else {
      setSuccess(s.resetSuccess);
    }
    setLoading(false);
  };

  // ── Derived error strings ─────────────────────────────────────────────────
  const errorShort = errorType && {
    account_not_found: s.accountNotFoundShort,
    already_exists:    s.alreadyExistsShort,
    invalid_login:     s.invalidLoginShort,
    email_invalid:     s.emailInvalid,
    unknown:           s.unknownErrorShort,
  }[errorType];

  const errorDetail = errorType && {
    account_not_found: s.accountNotFoundMoreInfo,
    already_exists:    s.alreadyExistsMoreInfo,
    invalid_login:     s.invalidLoginMoreInfo,
    email_invalid:     null,
    unknown:           s.unknownErrorMoreInfo,
  }[errorType];

  const modalTitle =
    mode === "signin" ? s.signInTitle :
    mode === "signup" ? s.signUpTitle :
    s.resetTitle;

  // ── Shared styles ─────────────────────────────────────────────────────────
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

        {/* Title — no tagline */}
        <h2 style={{ fontSize: 20, fontWeight: 900, margin: "0 0 24px",
          fontFamily: "'Georgia', serif", color: "#000" }}>
          {modalTitle}
        </h2>

        {/* Social buttons */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
          {SOCIAL_PROVIDERS.map(({ id, icon }) => (
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
                {oauthLoading === id ? s.redirecting : `Continue with ${PROVIDER_LABELS[id]}`}
              </span>
            </button>
          ))}
        </div>

        {/* OR divider */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
          <div style={{ flex: 1, height: 1, background: "#e0e0e0" }} />
          <span style={{ fontFamily: "'Courier New', monospace", fontSize: 10, color: "#bbb",
            letterSpacing: "0.1em" }}>{s.orContinueWith}</span>
          <div style={{ flex: 1, height: 1, background: "#e0e0e0" }} />
        </div>

        {/* Mode tabs */}
        {mode !== "forgot" && (
          <div style={{ display: "flex", marginBottom: 20, borderBottom: "2px solid #e0e0e0" }}>
            {[["signin", s.emailTab], ["signup", s.signUpTab]].map(([m, label]) => (
              <button key={m} onClick={() => { setMode(m); clearError(); setSuccess(""); }}
                style={{ padding: "7px 16px", border: "none", background: "none", cursor: "pointer",
                  fontFamily: "'Courier New', monospace", fontSize: 11, fontWeight: 900,
                  color: mode === m ? "#000" : "#bbb", letterSpacing: "0.08em",
                  borderBottom: mode === m ? "2px solid #000" : "2px solid transparent",
                  marginBottom: -2, whiteSpace: "nowrap" }}>
                {label}
              </button>
            ))}
          </div>
        )}

        {/* Forgot mode */}
        {mode === "forgot" ? (
          <>
            <label style={labelStyle}>{s.emailLabel}</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              style={inputStyle} placeholder="your@email.com"
              onKeyDown={e => { if (e.key === "Enter") handleForgot(); }} />

            {/* Error box */}
            {errorType && (
              <ErrorBox short={errorShort} detail={errorDetail}
                moreInfoOpen={moreInfoOpen} setMoreInfoOpen={setMoreInfoOpen}
                moreInfoLabel={s.moreInfo} />
            )}
            {success && <SuccessBox message={success} />}

            <button onClick={handleForgot} disabled={loading || !email}
              style={{ width: "100%", padding: "13px", border: "none", borderRadius: 2,
                cursor: email ? "pointer" : "not-allowed",
                background: email ? "#000" : "#e8e8e8", color: email ? "#fff" : "#aaa",
                fontFamily: "'Courier New', monospace", fontSize: 12, fontWeight: 900,
                letterSpacing: "0.15em", transition: "all 0.15s" }}>
              {loading ? s.sending : s.sendReset}
            </button>
            <button onClick={() => { setMode("signin"); clearError(); setSuccess(""); }}
              style={{ marginTop: 12, background: "none", border: "none", cursor: "pointer",
                fontFamily: "'Courier New', monospace", fontSize: 10, color: "#888",
                textDecoration: "underline", width: "100%" }}>
              {s.backToSignIn}
            </button>
          </>
        ) : (
          <>
            {/* Email field */}
            <label style={labelStyle}>{s.emailLabel}</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              style={inputStyle} placeholder="your@email.com"
              onKeyDown={e => { if (e.key === "Enter") handleSubmit(); }} />

            {/* Password field with reveal toggle */}
            <label style={labelStyle}>{s.passwordLabel}</label>
            <div style={{ position: "relative", marginBottom: 14 }}>
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={e => setPassword(e.target.value)}
                style={{ ...inputStyle, marginBottom: 0, paddingRight: 42 }}
                placeholder="••••••••"
                onKeyDown={e => { if (e.key === "Enter") handleSubmit(); }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
                  background: "none", border: "none", cursor: "pointer", padding: 2,
                  color: "#aaa", display: "flex", alignItems: "center" }}
                aria-label={showPassword ? "Hide password" : "Show password"}>
                <EyeIcon open={showPassword} />
              </button>
            </div>

            {/* Forgot link */}
            {mode === "signin" && (
              <div style={{ textAlign: "right", marginBottom: 14, marginTop: -6 }}>
                <button onClick={() => { setMode("forgot"); clearError(); setSuccess(""); }}
                  style={{ background: "none", border: "none", cursor: "pointer",
                    fontFamily: "'Courier New', monospace", fontSize: 10,
                    color: "#888", textDecoration: "underline", padding: 0 }}>
                  {s.forgotLink}
                </button>
              </div>
            )}

            {/* Error box */}
            {errorType && (
              <ErrorBox short={errorShort} detail={errorDetail}
                moreInfoOpen={moreInfoOpen} setMoreInfoOpen={setMoreInfoOpen}
                moreInfoLabel={s.moreInfo} />
            )}
            {errorType === "already_exists" && (
              <button onClick={() => { setMode("signin"); clearError(); setSuccess(""); }}
                style={{ width: "100%", padding: "11px", border: "none", borderRadius: 2,
                  background: "#000", color: "#fff", fontFamily: "'Courier New', monospace",
                  fontSize: 11, fontWeight: 900, letterSpacing: "0.1em", cursor: "pointer",
                  marginBottom: 14, transition: "opacity 0.15s" }}>
                → {s.submitSignIn}
              </button>
            )}
            {success && <SuccessBox message={success} />}

            {/* Submit */}
            <button onClick={handleSubmit} disabled={loading || !email || !password}
              style={{ width: "100%", padding: "13px", border: "none",
                cursor: email && password ? "pointer" : "not-allowed",
                background: email && password ? "#000" : "#e8e8e8",
                color: email && password ? "#fff" : "#aaa",
                fontFamily: "'Courier New', monospace", fontSize: 12, fontWeight: 900,
                letterSpacing: "0.15em", transition: "all 0.15s", borderRadius: 2 }}>
              {loading
                ? s.processing
                : mode === "signin" ? s.submitSignIn : s.submitSignUp}
            </button>

            {mode === "signup" && (
              <p style={{ fontFamily: "'Courier New', monospace", fontSize: 10, color: "#888",
                textAlign: "center", lineHeight: 1.8, margin: "14px 0 0" }}>
                {s.freeTokens}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ─── Shared UI sub-components ─────────────────────────────────────────────────
function ErrorBox({ short, detail, moreInfoOpen, setMoreInfoOpen, moreInfoLabel }) {
  return (
    <div style={{ background: "#fff5f5", border: "1px solid #ffcccc", borderRadius: 2,
      marginBottom: 14, overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "10px 14px", gap: 8 }}>
        <span style={{ fontFamily: "'Courier New', monospace", fontSize: 11, color: "#cc0000",
          lineHeight: 1.5 }}>{short}</span>
        {detail && (
          <button
            onClick={() => setMoreInfoOpen(o => !o)}
            style={{ background: "none", border: "1px solid #ffaaaa", borderRadius: 2,
              padding: "2px 8px", cursor: "pointer", fontFamily: "'Courier New', monospace",
              fontSize: 9, color: "#cc0000", whiteSpace: "nowrap", flexShrink: 0,
              letterSpacing: "0.06em" }}>
            {moreInfoLabel} {moreInfoOpen ? "▲" : "▼"}
          </button>
        )}
      </div>
      {detail && moreInfoOpen && (
        <div style={{ padding: "8px 14px 12px", borderTop: "1px solid #ffe0e0",
          fontFamily: "'Georgia', serif", fontSize: 12, color: "#a00000", lineHeight: 1.6 }}>
          {detail}
        </div>
      )}
    </div>
  );
}

function SuccessBox({ message }) {
  return (
    <div style={{ background: "#f0fff4", border: "1px solid #b2f5c8", padding: "10px 14px",
      marginBottom: 14, fontFamily: "'Courier New', monospace", fontSize: 11, color: "#006633",
      lineHeight: 1.5, borderRadius: 2 }}>
      {message}
    </div>
  );
}

export { AuthModal };

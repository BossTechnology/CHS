import { useState, useEffect, useRef } from "react";
import supabase from "../../lib/supabase.ts";

const SUPA_URL = import.meta.env.VITE_SUPABASE_URL || "https://jsffepzvyqurzkzbmzzj.supabase.co";

const TICKET_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function genTicketId() {
  return Array.from({ length: 6 }, () =>
    TICKET_CHARS[Math.floor(Math.random() * TICKET_CHARS.length)]
  ).join("");
}

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp", "application/pdf"];

function SupportModal({ user, profile, lang, t, onClose }) {
  const overlayRef = useRef(null);
  const fileInputRef = useRef(null);

  const [ticketId] = useState(genTicketId);
  const [step, setStep] = useState("form"); // 'form' | 'submitting' | 'success'
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState(null);
  const [fileError, setFileError] = useState("");
  const [submitError, setSubmitError] = useState("");

  const isValid = category !== "" && description.trim().length >= 20;

  useEffect(() => {
    const h = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);

  const handleFileChange = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!ALLOWED_TYPES.includes(f.type)) {
      setFileError(t?.supportFileTypeError || "Only images and PDF files are accepted");
      e.target.value = "";
      return;
    }
    if (f.size > 5 * 1024 * 1024) {
      setFileError(t?.supportFileSizeError || "File must be under 5MB");
      e.target.value = "";
      return;
    }
    setFile(f);
    setFileError("");
  };

  const handleSubmit = async () => {
    if (!isValid) return;
    setStep("submitting");

    // ── Upload attachment (if any) ────────────────────────────────────────────
    let fileUrl = null;
    if (file) {
      try {
        const ext = file.name.split(".").pop();
        const path = `${user.id}/${ticketId}.${ext}`;
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        if (token) {
          const res = await fetch(`${SUPA_URL}/storage/v1/object/support-attachments/${path}`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}`, "Content-Type": file.type },
            body: file,
          });
          if (res.ok) {
            fileUrl = `${SUPA_URL}/storage/v1/object/public/support-attachments/${path}`;
          }
        }
      } catch (err) {
        console.warn("File upload failed:", err);
      }
    }

    // ── Insert ticket row ─────────────────────────────────────────────────────
    const { error: insertErr } = await supabase.from("support_tickets").insert({
      ticket_id: ticketId,
      user_id: user.id,
      user_email: user.email,
      user_name: profile?.display_name || user.email,
      category,
      description,
      file_url: fileUrl,
      lang,
      status: "open",
    });

    if (insertErr) {
      setSubmitError(insertErr.message || "Submission failed. Please try again.");
      setStep("form");
      return;
    }

    // ── Invoke Edge Function (non-blocking) ───────────────────────────────────
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      fetch(`${SUPA_URL}/functions/v1/send-support-email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          ticketId, category, description, fileUrl,
          userEmail: user.email,
          userName: profile?.display_name || user.email,
          lang,
        }),
      }).catch((err) => console.warn("Email dispatch failed:", err));
    } catch (err) {
      console.warn("Email dispatch failed:", err);
    }

    setStep("success");
  };

  const categories = t?.supportCategories ||
    ["Billing & Tokens", "Technical Issue", "Account Access", "Generation Quality", "Feature Request", "Other"];

  const LABEL = { fontFamily: "'Courier New', monospace", fontSize: 10, color: "#888", letterSpacing: "0.12em" };
  const INPUT = { width: "100%", padding: "10px 12px", border: "1px solid #ddd", fontFamily: "'Courier New', monospace", fontSize: 12, boxSizing: "border-box", color: "#000", outline: "none", background: "#fff" };
  const onFocus = (e) => { e.target.style.borderColor = "#000"; };
  const onBlur  = (e) => { e.target.style.borderColor = "#ddd"; };

  return (
    <div ref={overlayRef}
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 1000,
        display: "flex", alignItems: "flex-start", justifyContent: "center",
        overflowY: "auto", padding: "40px 20px" }}>
      <div style={{ background: "#fff", width: "100%", maxWidth: 500, margin: "auto", position: "relative" }}>

        {/* Close */}
        <button onClick={onClose} style={{ position: "absolute", top: 14, right: 14, background: "none",
          border: "none", cursor: "pointer", fontSize: 18, color: "#aaa", padding: "4px 8px", lineHeight: 1 }}>✕</button>

        {/* ── Submitting ── */}
        {step === "submitting" && (
          <div style={{ padding: "80px 32px", textAlign: "center",
            fontFamily: "'Courier New', monospace", fontSize: 13, color: "#888", letterSpacing: "0.12em" }}>
            {t?.supportSubmitting || "SUBMITTING..."}
          </div>
        )}

        {/* ── Success ── */}
        {step === "success" && (
          <div style={{ padding: "56px 32px", textAlign: "center" }}>
            <div style={{ fontSize: 52, marginBottom: 16, color: "#9966ff" }}>✓</div>
            <h3 style={{ fontFamily: "'Georgia', serif", fontSize: 20, fontWeight: 900,
              color: "#000", margin: "0 0 10px" }}>
              {t?.supportSuccessTitle || "Ticket Submitted"}
            </h3>
            <p style={{ fontFamily: "'Courier New', monospace", fontSize: 12, color: "#555",
              lineHeight: 1.7, margin: "0 0 16px" }}>
              {t?.supportSuccessMsg || "We'll get back to you within 24–48 hours. Your ticket number is:"}
            </p>
            <div style={{ fontFamily: "'Courier New', monospace", fontSize: 24, fontWeight: 900,
              letterSpacing: "0.25em", color: "#000", margin: "0 0 28px" }}>
              {ticketId}
            </div>
            <button onClick={onClose}
              style={{ padding: "10px 32px", background: "#000", color: "#fff", border: "none",
                cursor: "pointer", fontFamily: "'Courier New', monospace",
                fontSize: 11, fontWeight: 700, letterSpacing: "0.1em" }}>
              {t?.supportClose || "CLOSE"}
            </button>
          </div>
        )}

        {/* ── Form ── */}
        {step === "form" && (
          <>
            <div style={{ padding: "28px 32px 22px", borderBottom: "1px solid #e8e8e8" }}>
              <h2 style={{ margin: 0, fontFamily: "'Georgia', serif", fontSize: 20, fontWeight: 900, color: "#000" }}>
                {t?.supportTitle || "Contact Support"}
              </h2>
            </div>
            <div style={{ padding: "24px 32px", display: "flex", flexDirection: "column", gap: 20 }}>

              {/* Category */}
              <div>
                <label style={{ display: "block", ...LABEL, marginBottom: 6 }}>
                  {t?.supportCategoryLabel || "ISSUE CATEGORY"}
                </label>
                <select value={category} onChange={(e) => setCategory(e.target.value)}
                  style={{ ...INPUT, cursor: "pointer", color: category ? "#000" : "#aaa" }}>
                  <option value="" disabled>— Select category —</option>
                  {categories.map((cat, i) => (
                    <option key={i} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              {/* Description */}
              <div>
                <label style={{ display: "block", ...LABEL, marginBottom: 6 }}>
                  {t?.supportDescriptionLabel || "DESCRIPTION"}
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value.slice(0, 1000))}
                  placeholder={t?.supportDescriptionPlaceholder || "Describe your issue in detail (minimum 20 characters)..."}
                  rows={5}
                  maxLength={1000}
                  onFocus={onFocus} onBlur={onBlur}
                  style={{ ...INPUT, resize: "vertical" }} />
                <div style={{ fontFamily: "'Courier New', monospace", fontSize: 10, textAlign: "right",
                  marginTop: 3, color: description.length > 1000 ? "#cc0000" : "#aaa" }}>
                  {description.length}/1000
                </div>
              </div>

              {/* Attachment */}
              <div>
                <label style={{ display: "block", ...LABEL, marginBottom: 6 }}>
                  {t?.supportAttachLabel || "ATTACHMENT (optional)"}
                </label>
                <input ref={fileInputRef} type="file" accept="image/*,.pdf"
                  onChange={handleFileChange} style={{ display: "none" }} />
                {file ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px",
                    border: "1px solid #ddd", fontFamily: "'Courier New', monospace", fontSize: 11, color: "#000" }}>
                    <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {file.name}
                    </span>
                    <button onClick={() => { setFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                      style={{ background: "none", border: "none", cursor: "pointer", color: "#888",
                        fontSize: 14, padding: 0, flexShrink: 0, lineHeight: 1 }}>✕</button>
                  </div>
                ) : (
                  <button onClick={() => fileInputRef.current?.click()}
                    style={{ padding: "8px 16px", border: "1px solid #000", background: "none",
                      cursor: "pointer", fontFamily: "'Courier New', monospace",
                      fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", color: "#000" }}>
                    {t?.supportChooseFile || "CHOOSE FILE"}
                  </button>
                )}
                {fileError && (
                  <div style={{ color: "#cc0000", fontFamily: "'Courier New', monospace", fontSize: 10, marginTop: 4 }}>
                    {fileError}
                  </div>
                )}
              </div>

              {submitError && (
                <div style={{ color: "#cc0000", fontFamily: "'Courier New', monospace", fontSize: 11 }}>
                  {submitError}
                </div>
              )}

              <button onClick={handleSubmit} disabled={!isValid}
                style={{ padding: "12px 24px", background: isValid ? "#000" : "#e8e8e8",
                  color: isValid ? "#fff" : "#aaa", border: "none",
                  cursor: isValid ? "pointer" : "not-allowed",
                  fontFamily: "'Courier New', monospace", fontSize: 11,
                  fontWeight: 700, letterSpacing: "0.1em", alignSelf: "flex-start" }}>
                {t?.supportSubmit || "SUBMIT TICKET"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export { SupportModal };

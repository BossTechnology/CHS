import { useState, useEffect, useRef } from "react";
import { LANGUAGES } from "../../i18n/translations.js";

function LangDropdown({ lang, setLang }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  return (
    <div ref={ref} style={{ position: "relative", userSelect: "none" }}>
      <button onClick={() => setOpen(o => !o)}
        style={{ display: "flex", alignItems: "center", gap: 5, background: "transparent", border: "1px solid #d0d0d0", padding: "5px 10px", cursor: "pointer", fontFamily: "'Courier New', monospace", fontSize: 11, fontWeight: 900, letterSpacing: "0.12em", color: "#000", borderRadius: 2 }}>
        {lang} <span style={{ fontSize: 8, color: "#888" }}>{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div style={{ position: "absolute", right: 0, top: "calc(100% + 4px)", background: "#fff", border: "1px solid #000", borderRadius: 2, overflow: "hidden", zIndex: 100, minWidth: 90, boxShadow: "0 4px 16px rgba(0,0,0,0.1)" }}>
          {LANGUAGES.map(l => (
            <button key={l.code} onClick={() => { setLang(l.code); setOpen(false); }}
              style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", padding: "9px 14px", background: l.code === lang ? "#000" : "#fff", color: l.code === lang ? "#fff" : "#000", border: "none", cursor: "pointer", fontFamily: "'Courier New', monospace", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", gap: 10, textAlign: "left" }}>
              <span>{l.code}</span>
              <span style={{ fontSize: 10, opacity: 0.6, fontWeight: 400, letterSpacing: "0.04em" }}>{l.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export { LangDropdown };

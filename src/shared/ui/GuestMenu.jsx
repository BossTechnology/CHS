import { useEffect, useRef } from "react";
import { LangDropdown } from "./LangDropdown.jsx";

function GuestMenu({ lang, setLang, onOpenAuth, onClose }) {
  const ref = useRef(null);
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [onClose]);

  return (
    <div ref={ref} style={{ position: "absolute", right: 0, top: "calc(100% + 8px)",
      background: "#fff", border: "1px solid #000", minWidth: 220, zIndex: 300,
      boxShadow: "0 8px 32px rgba(0,0,0,0.15)" }}>
      {/* Auth actions */}
      <div style={{ padding: "6px 0", borderBottom: "1px solid #e8e8e8" }}>
        <button onClick={() => { onOpenAuth("signin"); onClose(); }}
          style={{ width: "100%", padding: "12px 18px", background: "#000", border: "none",
            cursor: "pointer", textAlign: "left", fontFamily: "'Courier New', monospace",
            fontSize: 11, color: "#fff", fontWeight: 900, letterSpacing: "0.08em" }}>
          SIGN IN
        </button>
        <button onClick={() => { onOpenAuth("signup"); onClose(); }}
          style={{ width: "100%", padding: "11px 18px", background: "none", border: "none",
            cursor: "pointer", textAlign: "left", fontFamily: "'Courier New', monospace",
            fontSize: 11, color: "#000", fontWeight: 700, letterSpacing: "0.08em" }}
          onMouseEnter={e => e.currentTarget.style.background = "#f0f0f0"}
          onMouseLeave={e => e.currentTarget.style.background = "none"}>
          CREATE ACCOUNT
        </button>
      </div>
      {/* Language selector */}
      <div style={{ padding: "12px 18px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontFamily: "'Courier New', monospace", fontSize: 9, color: "#aaa",
          letterSpacing: "0.12em" }}>LANGUAGE</span>
        <LangDropdown lang={lang} setLang={setLang} />
      </div>
    </div>
  );
}

export { GuestMenu };

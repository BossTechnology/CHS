const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  const RESEND_API_KEY  = Deno.env.get("RESEND_API_KEY") ?? "";
  const SUPABASE_URL    = Deno.env.get("SUPABASE_URL")    ?? "";

  // ── Verify JWT ─────────────────────────────────────────────────────────────
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }
  const token = authHeader.slice(7);
  const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${token}`, apikey: Deno.env.get("SUPABASE_ANON_KEY") ?? "" },
  });
  if (!userRes.ok) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  // ── Parse body ─────────────────────────────────────────────────────────────
  let body: {
    ticketId: string; category: string; description: string;
    fileUrl: string | null; userEmail: string; userName: string; lang: string;
  };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  const { ticketId, category, description, fileUrl, userEmail, userName, lang } = body;
  const subject = `CHASS1S Support - Ticket #${ticketId} - ${category}`;

  // ── Email to user (confirmation) ────────────────────────────────────────────
  const userHtml = `
    <div style="font-family:'Courier New',monospace;max-width:520px;margin:auto;padding:32px;background:#fff;border:1px solid #e0e0e0">
      <div style="font-size:11px;letter-spacing:0.2em;color:#888;margin-bottom:24px">CHASS1S SUPPORT</div>
      <h2 style="font-family:Georgia,serif;font-size:20px;color:#000;margin:0 0 16px">Your ticket has been received</h2>
      <p style="font-size:12px;color:#555;line-height:1.7;margin:0 0 20px">
        We've received your support request and will get back to you within <strong>24–48 hours</strong>.
      </p>
      <div style="background:#f8f8f8;border-left:3px solid #000;padding:14px 18px;margin-bottom:20px">
        <div style="font-size:10px;color:#aaa;letter-spacing:0.12em;margin-bottom:4px">TICKET NUMBER</div>
        <div style="font-size:22px;font-weight:900;letter-spacing:0.2em;color:#000">${ticketId}</div>
      </div>
      <div style="font-size:11px;color:#555;margin-bottom:8px"><strong>Category:</strong> ${category}</div>
      <div style="font-size:11px;color:#555;line-height:1.6"><strong>Your message:</strong><br>${description.slice(0, 300)}${description.length > 300 ? "…" : ""}</div>
    </div>
  `;

  // ── Email to internal team ──────────────────────────────────────────────────
  const internalHtml = `
    <div style="font-family:'Courier New',monospace;max-width:560px;margin:auto;padding:32px;background:#fff;border:1px solid #e0e0e0">
      <div style="font-size:11px;letter-spacing:0.2em;color:#888;margin-bottom:24px">NEW SUPPORT TICKET</div>
      <table style="width:100%;border-collapse:collapse;font-size:12px">
        <tr><td style="padding:6px 0;color:#888;width:160px">Ticket ID</td><td style="font-weight:700">${ticketId}</td></tr>
        <tr><td style="padding:6px 0;color:#888">User Email</td><td>${userEmail}</td></tr>
        <tr><td style="padding:6px 0;color:#888">User Name</td><td>${userName}</td></tr>
        <tr><td style="padding:6px 0;color:#888">Category</td><td>${category}</td></tr>
        <tr><td style="padding:6px 0;color:#888">Language</td><td>${lang}</td></tr>
        ${fileUrl ? `<tr><td style="padding:6px 0;color:#888">Attachment</td><td><a href="${fileUrl}">${fileUrl}</a></td></tr>` : ""}
      </table>
      <div style="margin-top:20px;padding:14px 18px;background:#f8f8f8;border-left:3px solid #000">
        <div style="font-size:10px;color:#aaa;letter-spacing:0.1em;margin-bottom:8px">DESCRIPTION</div>
        <div style="font-size:12px;color:#333;line-height:1.7;white-space:pre-wrap">${description}</div>
      </div>
    </div>
  `;

  // ── Send via Resend ─────────────────────────────────────────────────────────
  const sendEmail = async (to: string, html: string) => {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: "support@chass1s.com", to, subject, html }),
      });
      if (!res.ok) {
        const err = await res.text();
        console.warn(`Resend error sending to ${to}:`, err);
      }
    } catch (err) {
      console.warn(`Email send failed for ${to}:`, err);
    }
  };

  await Promise.all([
    sendEmail(userEmail, userHtml),
    sendEmail("support@chass1s.com", internalHtml),
  ]);

  return new Response(JSON.stringify({ success: true, ticketId }), {
    status: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
});

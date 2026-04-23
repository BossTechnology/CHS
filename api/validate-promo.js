const ALLOWED_ORIGIN = process.env.VITE_APP_URL || "https://chass1s.com";

async function verifyJWT(token) {
  const res = await fetch(`${process.env.VITE_SUPABASE_URL}/auth/v1/user`, {
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: process.env.VITE_SUPABASE_ANON_KEY,
    },
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data?.id ? data : null;
}

export default async function handler(req) {
  const origin = req.headers.get("origin") || "";
  const corsHeaders = {
    "Access-Control-Allow-Origin": origin === ALLOWED_ORIGIN ? ALLOWED_ORIGIN : "",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });
  }

  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  const user = token ? await verifyJWT(token) : null;
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
  }

  const { code } = await req.json().catch(() => ({}));
  if (!code) {
    return new Response(JSON.stringify({ error: "Missing promo code" }), { status: 400, headers: corsHeaders });
  }

  // Look up promo code in Supabase (bypassing RLS — service key read-only lookup)
  const dbRes = await fetch(
    `${process.env.VITE_SUPABASE_URL}/rest/v1/promo_codes?code=eq.${encodeURIComponent(code.toUpperCase())}&active=eq.true&select=code,bonus_tokens,max_uses,uses_count,expires_at`,
    {
      headers: {
        apikey: process.env.SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
      },
    }
  );

  const rows = await dbRes.json();
  if (!rows || rows.length === 0) {
    return new Response(JSON.stringify({ error: "Invalid promo code" }), {
      status: 400, headers: corsHeaders,
    });
  }

  const promo = rows[0];

  if (promo.expires_at && new Date(promo.expires_at) < new Date()) {
    return new Response(JSON.stringify({ error: "This promo code has expired" }), {
      status: 400, headers: corsHeaders,
    });
  }

  if (promo.max_uses !== null && promo.uses_count >= promo.max_uses) {
    return new Response(JSON.stringify({ error: "This promo code has reached its usage limit" }), {
      status: 400, headers: corsHeaders,
    });
  }

  return new Response(JSON.stringify({ bonus: promo.bonus_tokens, code: promo.code }), {
    status: 200,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

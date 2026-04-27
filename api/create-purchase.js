export const config = { runtime: 'edge' };
import { checkRateLimit } from './_ratelimit.js'
import { withNewRelic, nrLog } from './_newrelic.js'

const _rawAppUrl = process.env.VITE_APP_URL || "";
// Guard: must start with https:// — otherwise fall back to the canonical URL
const ALLOWED_ORIGIN = _rawAppUrl.startsWith("https://")
  ? _rawAppUrl.replace(/\/$/, "")   // strip trailing slash
  : "https://www.chass1s.com";

function getVolumeBonus(amt) {
  if (amt >= 500) return 0.30;
  if (amt >= 250) return 0.25;
  if (amt >= 100) return 0.20;
  if (amt >= 50)  return 0.10;
  return 0;
}

function calcTokens(amountUsd, promoBonusTokens) {
  const base = amountUsd;
  const bonusPct = getVolumeBonus(amountUsd);
  const volumeBonus = Math.round(base * bonusPct * 100) / 100;
  return Math.round((base + volumeBonus + (promoBonusTokens || 0)) * 100) / 100;
}

// Look up and validate a promo code from the DB.
// Returns { bonus_tokens } on success, null if invalid/expired/maxed.
async function lookupPromo(code) {
  const svcHeaders = {
    apikey: process.env.SUPABASE_SERVICE_KEY,
    Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
  };
  const res = await fetch(
    `${process.env.VITE_SUPABASE_URL}/rest/v1/promo_codes?code=eq.${encodeURIComponent(code)}&active=eq.true&select=bonus_tokens,max_uses,uses_count,expires_at`,
    { headers: svcHeaders }
  );
  if (!res.ok) return null;
  const rows = await res.json();
  if (!rows || rows.length === 0) return null;
  const promo = rows[0];
  if (promo.expires_at && new Date(promo.expires_at) < new Date()) return null;
  if (promo.max_uses !== null && promo.uses_count >= promo.max_uses) return null;
  return promo;
}

async function verifyJWT(token) {
  const res = await fetch(`${process.env.VITE_SUPABASE_URL}/auth/v1/user`, {
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_KEY,
    },
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data?.id ? data : null;
}

export default withNewRelic("create-purchase", async function handler(req) {
  const origin = req.headers.get("origin") || "";
  const appUrl = ALLOWED_ORIGIN;
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

  // Authenticate
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
  }
  const user = await verifyJWT(token);
  if (!user) {
    return new Response(JSON.stringify({ error: "Invalid token" }), { status: 401, headers: corsHeaders });
  }

  const rateLimitRes = await checkRateLimit('purchase', user.id);
  if (rateLimitRes) return rateLimitRes;

  const body = await req.json().catch(() => null);
  const { amount, promoCode } = body || {};
  const amountNum = parseFloat(amount);

  if (!amountNum || amountNum < 25 || amountNum > 1000) {
    return new Response(JSON.stringify({ error: "Invalid amount (25–1000 USD)" }), {
      status: 400, headers: corsHeaders,
    });
  }

  const promoUpper = promoCode ? promoCode.trim().toUpperCase() : null;
  let promoBonusTokens = 0;
  if (promoUpper) {
    const promo = await lookupPromo(promoUpper);
    if (!promo) {
      return new Response(JSON.stringify({ error: "Invalid or expired promo code" }), {
        status: 400, headers: corsHeaders,
      });
    }
    promoBonusTokens = promo.bonus_tokens;
  }

  const totalTokens = calcTokens(amountNum, promoBonusTokens);
  const cents = Math.round(amountNum * 100);

  // Store pending purchase server-side (bypassing RLS with service key)
  const insertRes = await fetch(
    `${process.env.VITE_SUPABASE_URL}/rest/v1/pending_purchases`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: process.env.SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        user_id: user.id,
        amount_usd: amountNum,
        total_tokens: totalTokens,
        promo_code: promoUpper,
      }),
    }
  );

  if (!insertRes.ok) {
    const err = await insertRes.text();
    nrLog(`pending_purchases insert failed: ${err}`, "error", { handler: "create-purchase" });
    return new Response(JSON.stringify({ error: "Failed to create purchase record" }), {
      status: 500, headers: corsHeaders,
    });
  }

  const [record] = await insertRes.json();

  // Create Stripe Checkout Session via REST API (Edge-compatible, no npm package needed)
  const params = new URLSearchParams({
    mode: "payment",
    "line_items[0][price_data][currency]": "usd",
    "line_items[0][price_data][product_data][name]": "CHASS1S Tokens",
    "line_items[0][price_data][unit_amount]": String(cents),
    "line_items[0][quantity]": "1",
    success_url: `${appUrl}/?payment=success`,
    cancel_url: `${appUrl}/?payment=cancelled`,
    client_reference_id: record.id,
    "metadata[purchase_id]": record.id,
    "metadata[user_id]": user.id,
    "metadata[total_tokens]": String(totalTokens),
  });

  // Only include customer_email if present — Stripe rejects empty strings
  if (user.email) params.set("customer_email", user.email);

  const sessionRes = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  if (!sessionRes.ok) {
    const err = await sessionRes.json().catch(() => ({}));
    const stripeMsg = err?.error?.message || JSON.stringify(err);
    nrLog(`Stripe session creation failed: ${stripeMsg}`, "error", { handler: "create-purchase" });
    return new Response(JSON.stringify({ error: `Payment session error: ${stripeMsg}` }), {
      status: 500, headers: corsHeaders,
    });
  }

  const session = await sessionRes.json();

  return new Response(JSON.stringify({ stripe_url: session.url, purchase_id: record.id }), {
    status: 200,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
});

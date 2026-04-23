import { checkRateLimit } from './_ratelimit.js'

const ALLOWED_ORIGIN = process.env.VITE_APP_URL || "https://chass1s.com";
const STRIPE_PAYMENT_LINK = process.env.STRIPE_PAYMENT_LINK || "https://buy.stripe.com/9B6dR8aBRcn72Ca6QK4Vy06";

const PROMO_CODES = {
  WELCOME20: 20,
  BOSS10: 10,
  CHS50: 50,
};

function getVolumeBonus(amt) {
  if (amt >= 500) return 0.30;
  if (amt >= 250) return 0.25;
  if (amt >= 100) return 0.20;
  if (amt >= 50)  return 0.10;
  return 0;
}

function calcTokens(amountUsd, promoCode) {
  const base = amountUsd;
  const bonusPct = getVolumeBonus(amountUsd);
  const volumeBonus = Math.round(base * bonusPct * 100) / 100;
  const promoBonus = promoCode ? (PROMO_CODES[promoCode.toUpperCase()] || 0) : 0;
  return Math.round((base + volumeBonus + promoBonus) * 100) / 100;
}

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

  // Authenticate
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
  }
  const user = await verifyJWT(token);
  if (!user) {
    return new Response(JSON.stringify({ error: "Invalid token" }), { status: 401, headers: corsHeaders });
  }

  const rateLimitRes = await checkRateLimit('purchase', user.id)
  if (rateLimitRes) return rateLimitRes

  const body = await req.json().catch(() => null);
  const { amount, promoCode } = body || {};
  const amountNum = parseFloat(amount);

  if (!amountNum || amountNum < 25 || amountNum > 1000) {
    return new Response(JSON.stringify({ error: "Invalid amount (25–1000 USD)" }), {
      status: 400, headers: corsHeaders,
    });
  }

  const promoUpper = promoCode ? promoCode.trim().toUpperCase() : null;
  if (promoUpper && !PROMO_CODES[promoUpper]) {
    return new Response(JSON.stringify({ error: "Invalid promo code" }), {
      status: 400, headers: corsHeaders,
    });
  }

  const totalTokens = calcTokens(amountNum, promoUpper);

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
    console.error("pending_purchases insert failed:", err);
    return new Response(JSON.stringify({ error: "Failed to create purchase record" }), {
      status: 500, headers: corsHeaders,
    });
  }

  const [record] = await insertRes.json();
  const cents = Math.round(amountNum * 100);
  const stripeUrl = `${STRIPE_PAYMENT_LINK}?prefilled_amount=${cents}&client_reference_id=${record.id}`;

  return new Response(JSON.stringify({ stripe_url: stripeUrl, purchase_id: record.id }), {
    status: 200,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

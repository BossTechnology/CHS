export const config = { runtime: 'edge' };

// Constant-time string comparison to prevent timing attacks
function safeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

export default async function handler(req) {
  // Require HEALTHCHECK_SECRET via header. The endpoint exists so ops can probe
  // env-var/api-key health without exposing infra details to anonymous visitors.
  const expected = process.env.HEALTHCHECK_SECRET;
  if (!expected) {
    return new Response(
      JSON.stringify({ error: "Healthcheck disabled: HEALTHCHECK_SECRET not configured" }),
      { status: 503, headers: { "Content-Type": "application/json" } }
    );
  }
  const provided = req.headers.get("x-healthcheck-secret") || "";
  if (!safeEqual(provided, expected)) {
    return new Response("Not Found", { status: 404 });
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL || "";
  const serviceKey  = process.env.SUPABASE_SERVICE_KEY || "";
  const anonKey     = process.env.VITE_SUPABASE_ANON_KEY || "";
  const apiKey      = serviceKey || anonKey;

  // Test whether the apikey we'd send to Supabase is accepted.
  // We pass a deliberately invalid user token — if the APIKEY is valid, Supabase
  // returns a JWT-related error (not "Invalid API key").
  let supabaseApiKeyOk = false;
  let supabaseApiKeyMsg = "";
  try {
    const r = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        Authorization: "Bearer healthcheck_probe_invalid_token",
        apikey: apiKey,
      },
    });
    const body = await r.json().catch(() => ({}));
    supabaseApiKeyMsg = body.message || body.msg || JSON.stringify(body);
    // If the apikey is GOOD, Supabase rejects the user token (not the apikey itself)
    supabaseApiKeyOk = !supabaseApiKeyMsg.toLowerCase().includes("invalid api key");
  } catch (e) {
    supabaseApiKeyMsg = `fetch error: ${e.message}`;
  }

  // Behind the secret guard we can safely include presence + short prefixes
  // for ops debugging. Never expose full keys.
  const checks = {
    ANTHROPIC_API_KEY:    !!process.env.ANTHROPIC_API_KEY,
    VITE_SUPABASE_URL:    !!supabaseUrl,
    VITE_SUPABASE_ANON_KEY: !!anonKey,
    SUPABASE_SERVICE_KEY: !!serviceKey,
    STRIPE_SECRET_KEY:    !!process.env.STRIPE_SECRET_KEY,
    STRIPE_WEBHOOK_SECRET:!!process.env.STRIPE_WEBHOOK_SECRET,
    UPSTASH_REDIS_REST_URL: !!process.env.UPSTASH_REDIS_REST_URL,
    VITE_APP_URL:         process.env.VITE_APP_URL || "(not set)",
    ANTHROPIC_KEY_PREFIX: process.env.ANTHROPIC_API_KEY?.slice(0, 16) + "..." || "MISSING",
    SERVICE_KEY_PREFIX:   serviceKey ? serviceKey.slice(0, 12) + "..." : "MISSING",
    ANON_KEY_PREFIX:      anonKey    ? anonKey.slice(0, 12) + "..."    : "MISSING",
    SUPABASE_APIKEY_VALID: supabaseApiKeyOk,
    SUPABASE_APIKEY_MSG:   supabaseApiKeyMsg,
  };

  return new Response(JSON.stringify(checks, null, 2), {
    status: 200,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

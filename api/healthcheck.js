export const config = { runtime: 'edge' };
export default async function handler(req) {
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

  const checks = {
    ANTHROPIC_API_KEY:    !!process.env.ANTHROPIC_API_KEY,
    VITE_SUPABASE_URL:    !!supabaseUrl,
    VITE_SUPABASE_ANON_KEY: !!anonKey,
    SUPABASE_SERVICE_KEY: !!serviceKey,
    STRIPE_SECRET_KEY:    !!process.env.STRIPE_SECRET_KEY,
    STRIPE_WEBHOOK_SECRET:!!process.env.STRIPE_WEBHOOK_SECRET,
    UPSTASH_REDIS_REST_URL: !!process.env.UPSTASH_REDIS_REST_URL,
    VITE_APP_URL:         process.env.VITE_APP_URL || "(not set)",
    // Key format hints — first 12 chars only, safe to expose
    ANTHROPIC_KEY_PREFIX: process.env.ANTHROPIC_API_KEY?.slice(0, 16) + "..." || "MISSING",
    SERVICE_KEY_PREFIX:   serviceKey ? serviceKey.slice(0, 12) + "..." : "MISSING",
    ANON_KEY_PREFIX:      anonKey    ? anonKey.slice(0, 12) + "..."    : "MISSING",
    // Supabase apikey probe result
    SUPABASE_APIKEY_VALID: supabaseApiKeyOk,
    SUPABASE_APIKEY_MSG:   supabaseApiKeyMsg,
  };

  return new Response(JSON.stringify(checks, null, 2), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

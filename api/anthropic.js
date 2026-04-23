export const config = { runtime: 'edge' };
import { checkRateLimit } from './_ratelimit.js'

const ALLOWED_ORIGIN = process.env.VITE_APP_URL || "https://chass1s.com";

const corsHeaders = (origin) => ({
  "Access-Control-Allow-Origin": origin === ALLOWED_ORIGIN ? ALLOWED_ORIGIN : "",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
});

async function verifySupabaseJWT(token) {
  const res = await fetch(`${process.env.VITE_SUPABASE_URL}/auth/v1/user`, {
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY,
    },
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data?.id ? data : null;
}

export default async function handler(req) {
  const origin = req.headers.get("origin") || "";

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders(origin) });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405, headers: { "Content-Type": "application/json" },
    });
  }

  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) {
    return new Response(JSON.stringify({ error: "Missing authorization token" }), {
      status: 401, headers: { "Content-Type": "application/json" },
    });
  }

  const user = await verifySupabaseJWT(token);
  if (!user) {
    return new Response(JSON.stringify({ error: "Invalid or expired token" }), {
      status: 401, headers: { "Content-Type": "application/json" },
    });
  }

  const rateLimitRes = await checkRateLimit('generation', user.id);
  if (rateLimitRes) return rateLimitRes;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "Server misconfiguration: missing API key" }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json();

    // Use streaming so the Edge function starts responding immediately,
    // avoiding the 25-second initial-response timeout.
    const upstream = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({ ...body, stream: true }),
    });

    if (!upstream.ok) {
      const errData = await upstream.json().catch(() => ({}));
      return new Response(JSON.stringify({ error: errData.error?.message || "Anthropic error" }), {
        status: upstream.status,
        headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
      });
    }

    // Pipe the SSE stream straight through to the client.
    // The client accumulates text_delta events and parses JSON at the end.
    return new Response(upstream.body, {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "X-Accel-Buffering": "no",
        ...corsHeaders(origin),
      },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
    });
  }
}

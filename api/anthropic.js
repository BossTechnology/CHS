// Node.js serverless runtime — Edge runtime is capped at 25–60s by Vercel
// regardless of maxDuration, killing long Luxury-tier streams. Node serverless
// honors maxDuration: 300 on Pro plans, which is required for 90s+ generations.
export const config = {
  runtime: 'nodejs',
  maxDuration: 300,
};
import { checkRateLimit } from './_ratelimit.js'
import { withNewRelic } from './_newrelic.js'

const _rawAppUrl = (process.env.VITE_APP_URL || "").trim();
const ALLOWED_ORIGIN = _rawAppUrl.startsWith("https://")
  ? _rawAppUrl.replace(/\/$/, "")
  : "https://www.chass1s.com";

const corsHeaders = (origin) => ({
  "Access-Control-Allow-Origin": origin === ALLOWED_ORIGIN ? ALLOWED_ORIGIN : "",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
});

async function verifySupabaseJWT(token) {
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

export default withNewRelic("anthropic", async function handler(req) {
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

    // Whitelist only the fields the client is allowed to influence.
    // Never let the client choose the model or set an unlimited token budget.
    const ALLOWED_MODEL = "claude-sonnet-4-5";
    const MAX_TOKENS_CAP = 64000; // model max with output-128k-2025-02-19 beta

    const { messages, system, max_tokens: clientMaxTokens } = body;

    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: "messages is required" }), {
        status: 400, headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
      });
    }

    const max_tokens = Math.min(
      Number.isInteger(clientMaxTokens) && clientMaxTokens > 0 ? clientMaxTokens : MAX_TOKENS_CAP,
      MAX_TOKENS_CAP
    );

    const anthropicBody = {
      model: ALLOWED_MODEL,
      max_tokens,
      messages,
      ...(system !== undefined ? { system } : {}),
      stream: true,
    };

    // Use streaming so the Edge function starts responding immediately,
    // avoiding the 25-second initial-response timeout.
    const upstream = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-beta": "prompt-caching-2024-07-31,output-128k-2025-02-19",
      },
      body: JSON.stringify(anthropicBody),
    });

    if (!upstream.ok) {
      const errData = await upstream.json().catch(() => ({}));
      return new Response(JSON.stringify({ error: errData.error?.message || "Anthropic error" }), {
        status: upstream.status,
        headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
      });
    }

    // Wrap the upstream stream so we can inject keep-alive pings every 15s.
    // Without these, idle proxies (Vercel, Cloudflare) may close the connection
    // mid-generation on long Luxury-tier responses, surfacing as truncated JSON.
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    const keepAliveStream = new ReadableStream({
      async start(controller) {
        const reader = upstream.body.getReader();
        let lastChunkAt = Date.now();
        const pingInterval = setInterval(() => {
          if (Date.now() - lastChunkAt >= 15000) {
            try { controller.enqueue(encoder.encode(": keep-alive\n\n")); } catch {}
            lastChunkAt = Date.now();
          }
        }, 5000);
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            lastChunkAt = Date.now();
            controller.enqueue(value);
          }
        } catch (err) {
          try { controller.enqueue(encoder.encode(`event: error\ndata: ${JSON.stringify({ type: "error", error: { message: err.message } })}\n\n`)); } catch {}
        } finally {
          clearInterval(pingInterval);
          try { controller.close(); } catch {}
        }
      },
    });

    return new Response(keepAliveStream, {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        "X-Accel-Buffering": "no",
        "Connection": "keep-alive",
        ...corsHeaders(origin),
      },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
    });
  }
});

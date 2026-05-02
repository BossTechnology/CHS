// Node.js serverless runtime — required for maxDuration: 300 (set in vercel.json).
// Edge runtime is hard-capped at 25–60s by Vercel infrastructure regardless of
// maxDuration, killing long Luxury-tier streams. Node serverless on Pro plan
// honors the full 300s, allowing 90s+ generations to complete.
//
// This handler uses the Node.js (req, res) signature directly because Vercel's
// Web Standard auto-detection doesn't reliably activate when the Edge config is
// removed — the function was crashing on req.headers.get(). All other endpoints
// stay on Edge runtime; only this one needs the longer duration.

import { checkRateLimit } from './_ratelimit.js'
import { nrLog, nrEvent } from './_newrelic.js'

const _rawAppUrl = (process.env.VITE_APP_URL || "").trim();
const ALLOWED_ORIGIN = _rawAppUrl.startsWith("https://")
  ? _rawAppUrl.replace(/\/$/, "")
  : "https://www.chass1s.com";

function setCorsHeaders(res, origin) {
  res.setHeader("Access-Control-Allow-Origin", origin === ALLOWED_ORIGIN ? ALLOWED_ORIGIN : "");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(payload));
}

async function verifySupabaseJWT(token) {
  const r = await fetch(`${process.env.VITE_SUPABASE_URL}/auth/v1/user`, {
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_KEY,
    },
  });
  if (!r.ok) return null;
  const data = await r.json();
  return data?.id ? data : null;
}

// Read raw request body from Node's IncomingMessage and parse JSON.
async function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    // Vercel sometimes pre-parses JSON bodies into req.body for you
    if (req.body && typeof req.body === "object") return resolve(req.body);
    if (typeof req.body === "string") {
      try { return resolve(JSON.parse(req.body)); } catch (e) { return reject(e); }
    }
    let data = "";
    req.setEncoding("utf8");
    req.on("data", (chunk) => { data += chunk; });
    req.on("end", () => {
      if (!data) return resolve({});
      try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
    });
    req.on("error", reject);
  });
}

export default async function handler(req, res) {
  const start = Date.now();
  let status = 500;
  let errorMsg = null;

  try {
    const origin = req.headers.origin || "";
    setCorsHeaders(res, origin);

    if (req.method === "OPTIONS") {
      status = 200;
      res.statusCode = 200;
      return res.end();
    }
    if (req.method !== "POST") {
      status = 405;
      return sendJson(res, 405, { error: "Method not allowed" });
    }

    const authHeader = req.headers.authorization || "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) {
      status = 401;
      return sendJson(res, 401, { error: "Missing authorization token" });
    }

    const user = await verifySupabaseJWT(token);
    if (!user) {
      status = 401;
      return sendJson(res, 401, { error: "Invalid or expired token" });
    }

    // Rate limit returns a Response (Web API). In Node.js handler we can't
    // pass that through directly — extract its parts and translate.
    const rateLimitRes = await checkRateLimit('generation', user.id);
    if (rateLimitRes) {
      status = rateLimitRes.status;
      const text = await rateLimitRes.text();
      // Forward original headers
      rateLimitRes.headers.forEach((v, k) => { res.setHeader(k, v); });
      res.statusCode = status;
      return res.end(text);
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      status = 500;
      return sendJson(res, 500, { error: "Server misconfiguration: missing API key" });
    }

    const body = await readJsonBody(req);

    const ALLOWED_MODEL = "claude-sonnet-4-5";
    const MAX_TOKENS_CAP = 64000;
    const { messages, system, max_tokens: clientMaxTokens } = body;

    if (!Array.isArray(messages) || messages.length === 0) {
      status = 400;
      return sendJson(res, 400, { error: "messages is required" });
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
      status = upstream.status;
      return sendJson(res, upstream.status, { error: errData.error?.message || "Anthropic error" });
    }

    // Begin streaming SSE response back to the client. Inject a keep-alive
    // comment every 15s during silence so idle-proxy disconnects don't cut
    // the stream mid-generation on long Luxury-tier responses.
    status = 200;
    res.statusCode = 200;
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("X-Accel-Buffering", "no");
    res.setHeader("Connection", "keep-alive");
    if (typeof res.flushHeaders === "function") res.flushHeaders();

    const reader = upstream.body.getReader();
    const decoder = new TextDecoder();
    let lastChunkAt = Date.now();
    let aborted = false;
    let messageStopSeen = false;
    const onClientClose = () => { aborted = true; try { reader.cancel(); } catch {} };
    req.on("close", onClientClose);

    // .unref() so the interval never blocks the Node event loop from exiting
    // even if clearInterval somehow gets skipped on an abrupt error path.
    const pingInterval = setInterval(() => {
      if (aborted) return;
      if (Date.now() - lastChunkAt >= 15000) {
        try { res.write(": keep-alive\n\n"); } catch {}
        lastChunkAt = Date.now();
      }
    }, 5000);
    if (typeof pingInterval.unref === "function") pingInterval.unref();

    try {
      // Anthropic ends the stream with `event: message_stop`, but the underlying
      // TCP connection stays open due to HTTP keep-alive — reader.read() would
      // block forever waiting for the next chunk that never arrives, hitting
      // maxDuration. Detect message_stop in the bytes and break manually.
      let tail = "";
      while (!aborted) {
        const { done, value } = await reader.read();
        if (done) break;
        lastChunkAt = Date.now();
        res.write(Buffer.from(value));
        tail = (tail + decoder.decode(value, { stream: true })).slice(-512);
        if (tail.includes('"type":"message_stop"') || tail.includes("event: message_stop")) {
          messageStopSeen = true;
          break;
        }
      }
    } catch (err) {
      try { res.write(`event: error\ndata: ${JSON.stringify({ type: "error", error: { message: err.message } })}\n\n`); } catch {}
    } finally {
      // Aggressive cleanup so the Lambda exits as soon as the response is sent.
      // Without these, dangling resources (open reader, registered close listener)
      // can keep the function alive until maxDuration cap (300s) and inflate cost.
      clearInterval(pingInterval);
      try { req.off("close", onClientClose); } catch {}
      try { reader.releaseLock(); } catch {}
      try { await upstream.body.cancel(); } catch {}
      try { res.end(); } catch {}
    }
  } catch (err) {
    errorMsg = err?.message || String(err);
    if (!res.headersSent) {
      status = 500;
      return sendJson(res, 500, { error: errorMsg });
    }
    try { res.end(); } catch {}
  } finally {
    const duration = Date.now() - start;
    const level = status >= 500 ? "error" : status >= 400 ? "warn" : "info";
    nrLog(`anthropic ${status} in ${duration}ms`, level, { handler: "anthropic", status, duration, hasError: !!errorMsg });
    nrEvent("EdgeRequest", { handler: "anthropic", status, duration, isError: status >= 500, isClientError: status >= 400 && status < 500 });
    if (errorMsg) {
      nrLog(`Unhandled exception in anthropic: ${errorMsg}`, "error", { handler: "anthropic", error: errorMsg });
      nrEvent("EdgeError", { handler: "anthropic", error: errorMsg });
    }
  }
}

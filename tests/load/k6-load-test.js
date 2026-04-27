/**
 * CHASS1S — k6 Load Test Suite
 *
 * Scenarios (set via K6_SCENARIO env var):
 *   smoke   — 1 VU, 1 iteration, sanity check (~1 min)
 *   load    — ramp to 50 VUs, hold 5 min (~10 min)
 *   stress  — ramp to 200 VUs, find breaking point (~13 min)
 *
 * Auth options (provide ONE of the following):
 *   Option A — JWT token directly (get from browser devtools):
 *     --env TEST_TOKEN=eyJhbGci...
 *
 *   Option B — email + password (auto-authenticates in setup):
 *     --env TEST_EMAIL=you@email.com --env TEST_PASSWORD=secret
 *
 * Other required vars:
 *   --env BASE_URL=https://www.chass1s.com
 *   --env SUPABASE_URL=https://jsffepzvyqurzkzbmzzj.supabase.co
 *   --env SUPABASE_ANON_KEY=sb_publishable_...
 *
 * How to get TEST_TOKEN from browser:
 *   1. Open chass1s.com and log in
 *   2. Open DevTools → Application → Local Storage → chass1s.com
 *   3. Find key "chs_sess" → copy the value of "access_token"
 *
 * Quick smoke run:
 *   K6_SCENARIO=smoke k6 run tests/load/k6-load-test.js \
 *     --env BASE_URL=https://www.chass1s.com \
 *     --env TEST_TOKEN=<paste_token_here> \
 *     --env SUPABASE_URL=https://jsffepzvyqurzkzbmzzj.supabase.co \
 *     --env SUPABASE_ANON_KEY=sb_publishable_d2kXxGL7xCMSNDdThc8yDw_dLKu54cJ
 */

import http from "k6/http";
import { check, sleep, group } from "k6";
import { Rate, Trend, Counter } from "k6/metrics";

// ── Custom metrics ─────────────────────────────────────────────────────────
const errorRate     = new Rate("errors");
const authDuration  = new Trend("auth_duration",         true);
const cacheDuration = new Trend("cache_lookup_duration",  true);
const healthDuration= new Trend("healthcheck_duration",   true);
const profileDur    = new Trend("profile_fetch_duration", true);
const genDuration   = new Trend("generation_duration",    true);
const cacheHits     = new Counter("cache_hits");
const cacheMisses   = new Counter("cache_misses");

// ── Scenario definitions ───────────────────────────────────────────────────
const SCENARIO = __ENV.K6_SCENARIO || "smoke";

const SCENARIOS = {
  smoke: {
    executor: "per-vu-iterations",
    vus: 1,
    iterations: 1,
    maxDuration: "3m",
  },
  load: {
    executor: "ramping-vus",
    startVUs: 0,
    stages: [
      { duration: "2m", target: 10 },
      { duration: "5m", target: 50 },
      { duration: "2m", target: 50 },
      { duration: "1m", target: 0  },
    ],
    gracefulRampDown: "30s",
  },
  stress: {
    executor: "ramping-vus",
    startVUs: 0,
    stages: [
      { duration: "2m", target: 50  },
      { duration: "3m", target: 100 },
      { duration: "3m", target: 150 },
      { duration: "3m", target: 200 },
      { duration: "2m", target: 0   },
    ],
    gracefulRampDown: "30s",
  },
};

export const options = {
  scenarios: { [SCENARIO]: SCENARIOS[SCENARIO] },
  thresholds: {
    errors:                 ["rate<0.02"],
    auth_duration:          ["p(95)<3000"],
    healthcheck_duration:   ["p(95)<1500"],  // 1.5 s — first hit may be a cold start
    cache_lookup_duration:  ["p(95)<1500"],
    profile_fetch_duration: ["p(95)<2000"],
    generation_duration:    ["p(95)<45000"],
    http_req_duration:      ["p(95)<5000"],
    // healthcheck intentionally returns 404 (no secret) — exclude from failure rate
    http_req_failed:        ["rate<0.50"],
  },
};

// ── Setup — runs once, result shared with all VUs ──────────────────────────
export function setup() {
  const supabaseUrl = __ENV.SUPABASE_URL || "https://jsffepzvyqurzkzbmzzj.supabase.co";
  const supabaseKey = __ENV.SUPABASE_ANON_KEY;

  // Option A: token provided directly
  if (__ENV.TEST_TOKEN) {
    console.log("✓ Using provided TEST_TOKEN");
    return { token: __ENV.TEST_TOKEN, supabaseUrl, supabaseKey };
  }

  // Option B: sign in with email + password
  const email    = __ENV.TEST_EMAIL;
  const password = __ENV.TEST_PASSWORD;

  if (!email || !password) {
    console.warn("⚠ No TEST_TOKEN or TEST_EMAIL+TEST_PASSWORD provided — auth tests will be skipped");
    return { token: null, supabaseUrl, supabaseKey };
  }

  const res = http.post(
    `${supabaseUrl}/auth/v1/token?grant_type=password`,
    JSON.stringify({ email, password }),
    { headers: { "Content-Type": "application/json", apikey: supabaseKey } }
  );

  if (res.status !== 200) {
    console.error(`✗ Auth failed ${res.status}: ${res.body}`);
    return { token: null, supabaseUrl, supabaseKey };
  }

  const token = JSON.parse(res.body).access_token;
  console.log(`✓ Authenticated as ${email}`);
  return { token, supabaseUrl, supabaseKey };
}

// ── Helpers ────────────────────────────────────────────────────────────────
const BASE_URL = __ENV.BASE_URL || "https://www.chass1s.com";

// ── Test 1: Healthcheck (no auth required) ─────────────────────────────────
function testHealthcheck() {
  const start = Date.now();
  const res = http.get(`${BASE_URL}/api/healthcheck`);
  healthDuration.add(Date.now() - start);

  // Without the HEALTHCHECK_SECRET header, the endpoint should return 404 or 503
  // (not 500 = internal error, not 0 = connection refused)
  const ok = check(res, {
    "healthcheck: reachable":  (r) => r.status > 0,
    "healthcheck: not 500":    (r) => r.status !== 500,
    "healthcheck: responds ms": (r) => r.timings.duration < 800,
  });
  errorRate.add(!ok);
  return ok;
}

// ── Test 2: Profile fetch (Supabase REST, requires auth) ───────────────────
function testProfileFetch(token, supabaseUrl, supabaseKey) {
  const start = Date.now();
  const res = http.get(
    `${supabaseUrl}/rest/v1/profiles?select=id,email,token_balance,role&limit=1`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: supabaseKey,
      },
    }
  );
  profileDur.add(Date.now() - start);

  const ok = check(res, {
    "profile: status 200":    (r) => r.status === 200,
    "profile: returns data":  (r) => {
      try { const d = JSON.parse(r.body); return Array.isArray(d) && d.length > 0; } catch { return false; }
    },
  });
  errorRate.add(!ok);
  return ok;
}

// ── Test 3: Cache lookup RPC (pg_trgm, requires auth) ─────────────────────
function testCacheLookup(token, supabaseUrl, supabaseKey) {
  const inputs = [
    "coffee shop new york city brooklyn",
    "italian restaurant miami florida",
    "software startup san francisco tech",
    "retail clothing store los angeles",
    "fitness gym downtown chicago",
  ];
  const input = inputs[Math.floor(Math.random() * inputs.length)];

  const start = Date.now();
  const res = http.post(
    `${supabaseUrl}/rest/v1/rpc/lookup_chassis_cache`,
    JSON.stringify({
      p_input_text: input,
      p_tier_id:    "compact",
      p_lang:       "EN",
      p_threshold:  0.65,
    }),
    {
      headers: {
        "Content-Type": "application/json",
        Authorization:  `Bearer ${token}`,
        apikey: supabaseKey,
      },
    }
  );
  cacheDuration.add(Date.now() - start);

  const ok = check(res, {
    "cache lookup: status 200":    (r) => r.status === 200,
    "cache lookup: valid response": (r) => {
      try { return Array.isArray(JSON.parse(r.body)); } catch { return false; }
    },
  });

  try {
    const rows = JSON.parse(res.body);
    if (rows.length > 0) cacheHits.add(1);
    else cacheMisses.add(1);
  } catch {}

  errorRate.add(!ok);
  return ok;
}

// ── Test 4: Generation endpoint (SMOKE ONLY — costs Anthropic tokens) ──────
function testGeneration(token) {
  const start = Date.now();
  const res = http.post(
    `${BASE_URL}/api/anthropic`,
    JSON.stringify({
      max_tokens: 256,
      system: [{ type: "text", text: "You are a test assistant. Reply only with valid JSON." }],
      messages: [{ role: "user", content: 'Reply with exactly: {"test":true,"status":"ok"}' }],
    }),
    {
      headers: {
        "Content-Type":  "application/json",
        Authorization:   `Bearer ${token}`,
      },
      timeout: "60s",
    }
  );
  genDuration.add(Date.now() - start);

  const ok = check(res, {
    "generation: status 200":  (r) => r.status === 200,
    "generation: has body":    (r) => r.body && r.body.length > 0,
    "generation: not error":   (r) => !r.body.includes('"error"'),
  });
  errorRate.add(!ok);
  return ok;
}

// ── Main VU loop ───────────────────────────────────────────────────────────
export default function (data) {
  const { token, supabaseUrl, supabaseKey } = data;

  // ① Healthcheck — always runs (no auth required)
  group("1_healthcheck", () => testHealthcheck());
  sleep(0.3);

  if (!token) {
    console.warn("No token — skipping auth-required tests");
    return;
  }

  // ② Profile fetch
  group("2_profile_fetch", () => testProfileFetch(token, supabaseUrl, supabaseKey));
  sleep(0.3);

  // ③ Cache lookup
  group("3_cache_lookup", () => testCacheLookup(token, supabaseUrl, supabaseKey));
  sleep(0.3);

  // ④ Generation — smoke only (avoids Anthropic costs in load/stress)
  if (SCENARIO === "smoke") {
    group("4_generation", () => testGeneration(token));
  }

  // Realistic think time between page actions
  sleep(Math.random() * 2 + 0.5);
}

export function teardown() {
  console.log(`\n── Test complete ──────────────────────────────`);
  console.log(`   Scenario : ${SCENARIO}`);
  console.log(`   Base URL : ${BASE_URL}`);
  console.log(`──────────────────────────────────────────────`);
}

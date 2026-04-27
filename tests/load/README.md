# CHASS1S — Load Testing with k6

## Install k6

```bash
brew install k6
```

## Environment variables

Create a local `.env.k6` file (never commit this):

```bash
export BASE_URL="https://www.chass1s.com"
export TEST_EMAIL="your-test-user@email.com"
export TEST_PASSWORD="your-test-password"
export SUPABASE_URL="https://jsffepzvyqurzkzbmzzj.supabase.co"
export SUPABASE_ANON_KEY="sb_publishable_d2kXxGL7xCMSNDdThc8yDw_dLKu54cJ"
```

## Run tests

### Smoke (1 VU — sanity check, ~2 min)
```bash
source tests/load/.env.k6
K6_SCENARIO=smoke k6 run tests/load/k6-load-test.js \
  --env BASE_URL=$BASE_URL \
  --env TEST_EMAIL=$TEST_EMAIL \
  --env TEST_PASSWORD=$TEST_PASSWORD \
  --env SUPABASE_URL=$SUPABASE_URL \
  --env SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY
```

### Load (ramp to 50 VUs — normal traffic, ~10 min)
```bash
K6_SCENARIO=load k6 run tests/load/k6-load-test.js \
  --env BASE_URL=$BASE_URL \
  --env TEST_EMAIL=$TEST_EMAIL \
  --env TEST_PASSWORD=$TEST_PASSWORD \
  --env SUPABASE_URL=$SUPABASE_URL \
  --env SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY
```

### Stress (ramp to 200 VUs — find breaking point, ~13 min)
```bash
K6_SCENARIO=stress k6 run tests/load/k6-load-test.js \
  --env BASE_URL=$BASE_URL \
  --env TEST_EMAIL=$TEST_EMAIL \
  --env TEST_PASSWORD=$TEST_PASSWORD \
  --env SUPABASE_URL=$SUPABASE_URL \
  --env SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY
```

## Thresholds (pass/fail criteria)

| Metric | Threshold |
|--------|-----------|
| Error rate | < 2% |
| Auth p95 | < 3s |
| Healthcheck p95 | < 500ms |
| Cache lookup p95 | < 1s |
| Generation p95 | < 45s |
| All HTTP p95 | < 5s |

## What gets tested

| Test | Endpoint | Notes |
|------|----------|-------|
| Healthcheck | `GET /api/healthcheck` | Verifies 404 (not 500) for anonymous |
| Profile fetch | `GET /rest/v1/profiles` | Supabase REST with JWT |
| Cache lookup | `POST /rest/v1/rpc/lookup_chassis_cache` | pg_trgm similarity |
| Auth re-sign-in | Supabase auth token | Smoke only |
| Generation | `POST /api/anthropic` | Smoke only (costs money) |

> ⚠️ The generation endpoint calls Anthropic and costs tokens.
> It only runs in **smoke** mode (1 iteration) — not in load/stress.

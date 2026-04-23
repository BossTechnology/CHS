import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

// Lazily created — avoids crash when env vars are absent in local dev
let _redis = null
let _limiters = null

function getLimiters() {
  if (_limiters) return _limiters
  if (!process.env.UPSTASH_REDIS_REST_URL) return null

  _redis = Redis.fromEnv()

  _limiters = {
    // AI generation: 10 per hour per user
    generation: new Ratelimit({
      redis: _redis,
      limiter: Ratelimit.slidingWindow(10, '1 h'),
      prefix: 'rl:gen',
    }),
    // Purchases: 5 per hour per user
    purchase: new Ratelimit({
      redis: _redis,
      limiter: Ratelimit.slidingWindow(5, '1 h'),
      prefix: 'rl:purchase',
    }),
    // Promo validation: 20 per hour — prevents brute-force of codes
    promo: new Ratelimit({
      redis: _redis,
      limiter: Ratelimit.slidingWindow(20, '1 h'),
      prefix: 'rl:promo',
    }),
  }

  return _limiters
}

/**
 * Returns a 429 Response if the user is rate-limited, null if allowed.
 * Fails open if Redis is unavailable — never blocks users due to infra issues.
 */
export async function checkRateLimit(type, userId) {
  try {
    const limiters = getLimiters()
    if (!limiters || !limiters[type]) return null

    const { success, limit, remaining, reset } = await limiters[type].limit(userId)
    if (!success) {
      const retryAfter = Math.ceil((reset - Date.now()) / 1000)
      return new Response(
        JSON.stringify({ error: 'Too many requests. Please try again later.', retryAfter }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'X-RateLimit-Limit': String(limit),
            'X-RateLimit-Remaining': '0',
            'Retry-After': String(retryAfter),
          },
        }
      )
    }
    return null
  } catch {
    return null // fail open
  }
}

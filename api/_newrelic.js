/**
 * New Relic telemetry for Vercel Edge Functions.
 *
 * Uses only fetch() — no npm packages, fully compatible with the V8 Edge
 * Runtime. All sends are fire-and-forget: a failure here never affects
 * the main response.
 *
 * Required env var:
 *   NEW_RELIC_LICENSE_KEY   Your NR ingest license key (40-char hex string)
 *
 * Optional env var:
 *   NEW_RELIC_ACCOUNT_ID    Numeric account ID — enables the custom Events API
 *                           for dashboarding EdgeRequest / EdgeError events.
 *                           Without it, only Logs are sent.
 */

const NR_LOG_URL   = "https://log-api.newrelic.com/log/v1";
const NR_EVENT_URL = process.env.NEW_RELIC_ACCOUNT_ID
  ? `https://insights-collector.newrelic.com/v1/accounts/${process.env.NEW_RELIC_ACCOUNT_ID}/events`
  : null;

const SERVICE = "chs-edge";
const ENV     = process.env.VERCEL_ENV || "production";

/** Fire-and-forget POST to New Relic — errors are silently swallowed. */
function _nrSend(url, payload) {
  const key = process.env.NEW_RELIC_LICENSE_KEY;
  if (!key || !url) return; // no-op when not configured
  try {
    fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Api-Key": key },
      body: JSON.stringify(payload),
    }).catch(() => {});
  } catch {}
}

/**
 * Send a structured log entry to New Relic Logs.
 *
 * @param {string}                          message
 * @param {"info"|"warn"|"error"}           level
 * @param {Record<string, unknown>}         attrs  Extra key-value attributes
 */
export function nrLog(message, level = "info", attrs = {}) {
  _nrSend(NR_LOG_URL, [{
    logs: [{
      timestamp:   Date.now(),
      message,
      level,
      service:     SERVICE,
      environment: ENV,
      ...attrs,
    }],
  }]);
}

/**
 * Send a custom event to New Relic Insights / Events API.
 * Silently no-ops when NEW_RELIC_ACCOUNT_ID is not set.
 *
 * @param {string}                      eventType  PascalCase name (e.g. "EdgeRequest")
 * @param {Record<string, unknown>}     attrs
 */
export function nrEvent(eventType, attrs = {}) {
  _nrSend(NR_EVENT_URL, [{
    eventType,
    timestamp:   Math.floor(Date.now() / 1000),
    service:     SERVICE,
    environment: ENV,
    ...attrs,
  }]);
}

/**
 * Wrap a Vercel Edge handler with automatic request/error telemetry.
 *
 * What gets tracked automatically:
 *  - Response duration (ms)
 *  - HTTP status code
 *  - Unhandled exceptions (logged at "error" level + EdgeError event)
 *  - One EdgeRequest event per handled request (duration, status, flags)
 *
 * @param {string}   name     Short handler label shown in NR  (e.g. "anthropic")
 * @param {Function} handler  The original async (req) => Response function
 * @returns {Function}        Wrapped handler with identical signature
 */
export function withNewRelic(name, handler) {
  return async function wrappedHandler(req) {
    const start    = Date.now();
    let   status   = 500;
    let   errorMsg = null;

    try {
      const res = await handler(req);
      status = res.status;
      return res;
    } catch (err) {
      errorMsg = err?.message || String(err);
      // Log the full stack while it's still available
      nrLog(`Unhandled exception in ${name}: ${errorMsg}`, "error", {
        handler: name,
        error:   errorMsg,
        stack:   err?.stack?.slice(0, 800) ?? "",
      });
      nrEvent("EdgeError", {
        handler: name,
        error:   errorMsg,
      });
      throw err; // re-throw so Vercel returns its own 500
    } finally {
      const duration = Date.now() - start;
      const level    = status >= 500 ? "error" : status >= 400 ? "warn" : "info";
      nrLog(`${name} ${status} in ${duration}ms`, level, {
        handler:  name,
        status,
        duration,
        hasError: !!errorMsg,
      });
      nrEvent("EdgeRequest", {
        handler:       name,
        status,
        duration,
        isError:       status >= 500,
        isClientError: status >= 400 && status < 500,
      });
    }
  };
}

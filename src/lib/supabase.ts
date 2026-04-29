import type {
  SupabaseSession,
  SupabaseUser,
  SupabaseResponse,
} from "../types";

const SUPA_URL = import.meta.env.VITE_SUPABASE_URL || "https://jsffepzvyqurzkzbmzzj.supabase.co";
const SUPA_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "sb_publishable_d2kXxGL7xCMSNDdThc8yDw_dLKu54cJ";

type Listener = (event: null, payload: { user: SupabaseUser } | null) => void;

const supabase = (() => {
  let _session: SupabaseSession | null = null;
  let _listeners: Listener[] = [];

  // ── Cross-tab token refresh coordination ───────────────────────────────────
  // Prevents multiple tabs from racing on the same refresh_token (which is
  // single-use — whichever tab wins invalidates the token for all others).
  let _refreshPromise: Promise<SupabaseResponse<{ session: SupabaseSession }>> | null = null;
  const LOCK_KEY      = "chs_refresh_lock";
  const LOCK_TTL_MS   = 8_000; // max time another tab can hold the lock
  const LOCK_POLL_MS  = 150;   // how often we poll while waiting
  const LOCK_WAIT_MAX = 9_000; // give up waiting after this long

  // BroadcastChannel — lets the winning tab push the new session to all others
  // without any extra network round-trip.
  const _bc = (() => {
    try { return new BroadcastChannel("chs_session"); } catch { return null; }
  })();

  const _bcBroadcast = (session: SupabaseSession | null) => {
    try { _bc?.postMessage({ type: "SESSION_UPDATED", session }); } catch {}
  };

  if (_bc) {
    _bc.onmessage = (ev) => {
      if (ev.data?.type !== "SESSION_UPDATED") return;
      const session: SupabaseSession | null = ev.data.session;
      _session = session;
      if (session) {
        _tryLS(() => sessionStorage.setItem("chs_sess", JSON.stringify(session)));
      } else {
        _tryLS(() => sessionStorage.removeItem("chs_sess"));
      }
      _notify(session);
    };
  }

  /** Acquire a cross-tab lock. Returns true if we own it, false if timed out. */
  const _acquireLock = (): boolean => {
    const token = `${Date.now()}_${Math.random()}`;
    _tryLS(() => localStorage.setItem(LOCK_KEY, JSON.stringify({ token, at: Date.now() })));
    // Read back to confirm we wrote it (no built-in CAS in localStorage, but
    // this is "good enough" — true atomicity requires SharedArrayBuffer/Atomics).
    const stored = _tryLS(() => JSON.parse(localStorage.getItem(LOCK_KEY) || "null") as { token: string; at: number } | null);
    return stored?.token === token;
  };

  const _releaseLock = () => _tryLS(() => localStorage.removeItem(LOCK_KEY));

  const _lockHeld = (): boolean => {
    const stored = _tryLS(() => JSON.parse(localStorage.getItem(LOCK_KEY) || "null") as { token: string; at: number } | null);
    if (!stored) return false;
    return Date.now() - stored.at < LOCK_TTL_MS;
  };

  /** Wait until no other tab holds the refresh lock, then return true.
   *  Returns false if we wait longer than LOCK_WAIT_MAX. */
  const _waitForLock = (): Promise<boolean> => new Promise((resolve) => {
    const deadline = Date.now() + LOCK_WAIT_MAX;
    const poll = () => {
      if (!_lockHeld()) { resolve(true); return; }
      if (Date.now() >= deadline) { resolve(false); return; }
      setTimeout(poll, LOCK_POLL_MS);
    };
    poll();
  });

  const _tryLS = <T>(fn: () => T, fallback: T | null = null): T | null => {
    try { return fn(); } catch { return fallback; }
  };

  const _headers = (extra: Record<string, string> = {}): Record<string, string> => {
    const h: Record<string, string> = { "Content-Type": "application/json", apikey: SUPA_KEY, ...extra };
    if (_session?.access_token) h["Authorization"] = `Bearer ${_session.access_token}`;
    return h;
  };

  const _notify = (session: SupabaseSession | null) =>
    _listeners.forEach(fn => fn(null, session ? { user: session.user } : null));

  const _normalizeSession = (data: SupabaseSession): SupabaseSession => {
    if (!data.expires_at && data.expires_in) {
      return { ...data, expires_at: Math.floor(Date.now() / 1000) + data.expires_in };
    }
    return data;
  };

  const _q = async <T = unknown>(
    method: string,
    url: string,
    body?: unknown,
    opts: { single?: boolean; returnData?: boolean } = {}
  ): Promise<SupabaseResponse<T>> => {
    const { single = false, returnData = false } = opts;
    const prefer = returnData || single ? "return=representation" : "return=minimal";
    try {
      const res = await fetch(url, {
        method,
        headers: _headers({ Prefer: prefer }),
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
      const text = await res.text();
      if (!res.ok) {
        const err = _tryLS(() => JSON.parse(text) as Record<string, string>, {});
        return { data: null, error: { message: (err as Record<string, string>)?.message || (err as Record<string, string>)?.error_description || "Request failed" } };
      }
      if (!text) return { data: null, error: null };
      const json = _tryLS(() => JSON.parse(text) as T);
      return { data: single && Array.isArray(json) ? (json[0] ?? null) : json as T, error: null };
    } catch (e) {
      return { data: null, error: { message: (e as Error).message } };
    }
  };

  const auth = {
    async signUp({ email, password }: { email: string; password: string }) {
      const res = await fetch(`${SUPA_URL}/auth/v1/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: SUPA_KEY },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json() as SupabaseSession & { msg?: string; error_description?: string };
      if (!res.ok) return { data: null, error: { message: data.msg || data.error_description || "Signup failed" } };
      if (data.access_token) {
        _session = _normalizeSession(data);
        _tryLS(() => sessionStorage.setItem("chs_sess", JSON.stringify(_session)));
        _notify(_session);
      }
      return { data, error: null };
    },

    async signInWithPassword({ email, password }: { email: string; password: string }) {
      const res = await fetch(`${SUPA_URL}/auth/v1/token?grant_type=password`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: SUPA_KEY },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json() as SupabaseSession & { msg?: string; error_description?: string };
      if (!res.ok) return { data: null, error: { message: data.error_description || data.msg || "Sign in failed" } };
      _session = _normalizeSession(data);
      _tryLS(() => sessionStorage.setItem("chs_sess", JSON.stringify(_session)));
      _notify(_session);
      return { data: { user: data.user, session: _session }, error: null };
    },

    async signOut() {
      try { await fetch(`${SUPA_URL}/auth/v1/logout`, { method: "POST", headers: _headers() }); } catch {}
      _session = null;
      _tryLS(() => sessionStorage.removeItem("chs_sess"));
      _notify(null);
      return { error: null };
    },

    async resetPasswordForEmail(email: string) {
      const res = await fetch(`${SUPA_URL}/auth/v1/recover`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: SUPA_KEY },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const data = await res.json() as { msg?: string; error_description?: string };
        return { error: { message: data.msg || data.error_description || "Reset failed" } };
      }
      return { error: null };
    },

    async refreshSession(): Promise<SupabaseResponse<{ session: SupabaseSession }>> {
      // ── Within-tab deduplication ─────────────────────────────────────────
      // If this tab is already mid-refresh, return the same promise so callers
      // share one network round-trip instead of spawning independent ones.
      if (_refreshPromise) return _refreshPromise;

      _refreshPromise = (async (): Promise<SupabaseResponse<{ session: SupabaseSession }>> => {
        try {
          // ── Cross-tab coordination ───────────────────────────────────────
          // If another tab is currently refreshing, wait for it to finish, then
          // re-read the session it stored in sessionStorage instead of calling
          // the token endpoint again (which would invalidate the new token).
          if (_lockHeld()) {
            const released = await _waitForLock();
            if (released) {
              // Another tab finished — pick up its session.
              const stored = _tryLS(() => JSON.parse(sessionStorage.getItem("chs_sess") || "null") as SupabaseSession | null);
              if (stored && stored.refresh_token !== _session?.refresh_token) {
                // Genuinely new session from the other tab.
                _session = stored;
                _notify(_session);
                return { data: { session: _session }, error: null };
              }
            }
            // Lock never released (crashed tab?) — fall through and try ourselves.
          }

          const refreshToken = _session?.refresh_token;
          if (!refreshToken) {
            _session = null;
            _tryLS(() => sessionStorage.removeItem("chs_sess"));
            _notify(null);
            return { data: null, error: { message: "No refresh token" } };
          }

          // Acquire the cross-tab lock before hitting the network.
          _acquireLock();

          try {
            const res = await fetch(`${SUPA_URL}/auth/v1/token?grant_type=refresh_token`, {
              method: "POST",
              headers: { "Content-Type": "application/json", apikey: SUPA_KEY },
              body: JSON.stringify({ refresh_token: refreshToken }),
            });
            const data = await res.json() as SupabaseSession & { error_description?: string };
            if (!res.ok) {
              _session = null;
              _tryLS(() => sessionStorage.removeItem("chs_sess"));
              _notify(null);
              _bcBroadcast(null);
              return { data: null, error: { message: data.error_description || "Token refresh failed" } };
            }
            _session = _normalizeSession(data);
            _tryLS(() => sessionStorage.setItem("chs_sess", JSON.stringify(_session)));
            _notify(_session);
            // Tell all other tabs about the new session so they don't refresh again.
            _bcBroadcast(_session);
            return { data: { session: _session }, error: null };
          } finally {
            _releaseLock();
          }
        } catch (e) {
          return { data: null, error: { message: (e as Error).message } };
        }
      })();

      try {
        return await _refreshPromise;
      } finally {
        _refreshPromise = null;
      }
    },

    async getSession(): Promise<SupabaseResponse<{ session: SupabaseSession | null }>> {
      if (!_session) {
        const stored = _tryLS(() => JSON.parse(sessionStorage.getItem("chs_sess") || "null") as SupabaseSession | null);
        if (stored) _session = stored;
      }
      if (!_session) return { data: { session: null }, error: null };

      // Legacy sessions without expires_at: force refresh
      if (!_session.expires_at) {
        return await auth.refreshSession() as SupabaseResponse<{ session: SupabaseSession | null }>;
      }

      const now = Math.floor(Date.now() / 1000);
      if (now >= _session.expires_at - 30) {
        return await auth.refreshSession() as SupabaseResponse<{ session: SupabaseSession | null }>;
      }

      return { data: { session: _session }, error: null };
    },

    onAuthStateChange(callback: Listener) {
      _listeners.push(callback);
      return {
        data: {
          subscription: {
            unsubscribe: () => { _listeners = _listeners.filter(fn => fn !== callback); },
          },
        },
      };
    },

    signInWithOAuth({ provider, options = {} }: { provider: string; options?: { redirectTo?: string } }) {
      const redirectTo = options.redirectTo || window.location.origin;
      const params = new URLSearchParams({ provider, redirect_to: redirectTo });
      window.location.href = `${SUPA_URL}/auth/v1/authorize?${params}`;
      return Promise.resolve({ data: { url: `${SUPA_URL}/auth/v1/authorize?${params}` }, error: null });
    },

    async updateUser(attrs: { email?: string; password?: string }) {
      const res = await fetch(`${SUPA_URL}/auth/v1/user`, {
        method: "PUT",
        headers: _headers(),
        body: JSON.stringify(attrs),
      });
      const data = await res.json() as Record<string, string>;
      if (!res.ok) return { data: null, error: { message: data.msg || data.error_description || "Update failed" } };
      return { data, error: null };
    },

    // Called once on app boot — reads the OAuth hash fragment Supabase puts in
    // the URL after a successful provider redirect (access_token, refresh_token…)
    // Also handles error cases (user cancelled, provider error, etc.) by storing
    // a human-readable message in sessionStorage for the app to display.
    handleOAuthCallback(): boolean {
      if (typeof window === "undefined") return false;
      const hash = window.location.hash.slice(1);
      if (!hash) return false;
      const params = new URLSearchParams(hash);

      // ── Error path: provider returned an error ──────────────────────────
      const error = params.get("error");
      if (error) {
        const desc = params.get("error_description") || error;
        // Humanize the most common cases
        const message =
          error === "access_denied"
            ? "Sign-in was cancelled. You can try again anytime."
            : desc.replace(/\+/g, " ");
        // Store for the App component to pick up and display
        _tryLS(() => sessionStorage.setItem("chs_oauth_error", message));
        // Clean the hash without a page reload
        history.replaceState(null, "", window.location.pathname + window.location.search);
        return false;
      }

      // ── Success path ────────────────────────────────────────────────────
      const access_token  = params.get("access_token");
      const refresh_token = params.get("refresh_token");
      const expires_in    = params.get("expires_in");
      const token_type    = params.get("token_type");
      if (!access_token || !refresh_token) return false;

      // Fetch the user object with the new token
      fetch(`${SUPA_URL}/auth/v1/user`, {
        headers: { Authorization: `Bearer ${access_token}`, apikey: SUPA_KEY },
      })
        .then(r => r.json())
        .then((user: SupabaseUser) => {
          if (!user?.id) return;
          const session: SupabaseSession = {
            access_token,
            refresh_token,
            token_type: token_type || "bearer",
            expires_in: expires_in ? Number(expires_in) : 3600,
            expires_at: Math.floor(Date.now() / 1000) + (expires_in ? Number(expires_in) : 3600),
            user,
          };
          _session = session;
          _tryLS(() => sessionStorage.setItem("chs_sess", JSON.stringify(session)));
          _notify(session);
          // Clean the hash from the URL without a page reload
          history.replaceState(null, "", window.location.pathname + window.location.search);
        })
        .catch(() => {});

      return true;
    },
  };

  const from = (table: string) => ({
    select: (cols = "*") => {
      const filters: string[] = [];
      const builder = {
        eq: (col: string, val: unknown) => { filters.push(`${col}=eq.${val}`); return builder; },
        neq: (col: string, val: unknown) => { filters.push(`${col}=neq.${val}`); return builder; },
        is: (col: string, val: null) => { filters.push(val === null ? `${col}=is.null` : `${col}=is.${val}`); return builder; },
        order: (col: string, { ascending = true } = {}) => { filters.push(`order=${col}.${ascending ? "asc" : "desc"}`); return builder; },
        limit: (n: number) => { filters.push(`limit=${n}`); return builder; },
        single: <T = unknown>() => {
          const qs = [...filters, "limit=1"].join("&");
          return _q<T>("GET", `${SUPA_URL}/rest/v1/${table}?select=${cols}&${qs}`, undefined, { single: true });
        },
        execute: <T = unknown>() => {
          const qs = filters.join("&");
          return _q<T>("GET", `${SUPA_URL}/rest/v1/${table}?select=${cols}${qs ? "&" + qs : ""}`, undefined, {});
        },
        then: <T = unknown>(resolve: (v: SupabaseResponse<T>) => void, reject?: (e: unknown) => void) => {
          const qs = filters.join("&");
          return _q<T>("GET", `${SUPA_URL}/rest/v1/${table}?select=${cols}${qs ? "&" + qs : ""}`, undefined, {}).then(resolve, reject);
        },
      };
      return builder;
    },
    insert: (body: unknown) => ({
      select: () => ({
        single: <T = unknown>() => _q<T>("POST", `${SUPA_URL}/rest/v1/${table}`, body, { single: true, returnData: true }),
      }),
      then: <T = unknown>(resolve: (v: SupabaseResponse<T>) => void, reject?: (e: unknown) => void) =>
        _q<T>("POST", `${SUPA_URL}/rest/v1/${table}`, body, {}).then(resolve, reject),
    }),
    update: (body: unknown) => ({
      eq: (col: string, val: unknown) => ({
        select: () => ({
          single: <T = unknown>() => _q<T>("PATCH", `${SUPA_URL}/rest/v1/${table}?${col}=eq.${val}`, body, { single: true, returnData: true }),
        }),
        then: <T = unknown>(resolve: (v: SupabaseResponse<T>) => void, reject?: (e: unknown) => void) =>
          _q<T>("PATCH", `${SUPA_URL}/rest/v1/${table}?${col}=eq.${val}`, body, {}).then(resolve, reject),
      }),
    }),
    delete: () => ({
      eq: (col: string, val: unknown) => _q("DELETE", `${SUPA_URL}/rest/v1/${table}?${col}=eq.${val}`, undefined, {}),
    }),
  });

  const rpc = <T = unknown>(fn: string, params: Record<string, unknown> = {}) =>
    _q<T>("POST", `${SUPA_URL}/rest/v1/rpc/${fn}`, params, {});

  return { auth, from, rpc };
})();

export default supabase;

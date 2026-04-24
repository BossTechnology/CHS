const SUPA_URL = import.meta.env.VITE_SUPABASE_URL || "https://jsffepzvyqurzkzbmzzj.supabase.co";
const SUPA_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "sb_publishable_d2kXxGL7xCMSNDdThc8yDw_dLKu54cJ";

const supabase = (() => {
  let _session = null;
  let _listeners = [];

  const _tryLS = (fn, fallback = null) => { try { return fn(); } catch { return fallback; } };

  const _headers = (extra = {}) => {
    const h = { "Content-Type": "application/json", "apikey": SUPA_KEY, ...extra };
    if (_session?.access_token) h["Authorization"] = `Bearer ${_session.access_token}`;
    return h;
  };

  const _notify = (session) => _listeners.forEach(fn => fn(null, session ? { user: session.user } : null));

  // Ensure expires_at is always a Unix timestamp so expiry checks are reliable
  const _normalizeSession = (data) => {
    if (!data) return data;
    if (!data.expires_at && data.expires_in) {
      return { ...data, expires_at: Math.floor(Date.now() / 1000) + data.expires_in };
    }
    return data;
  };

  const _q = async (method, url, body, opts = {}) => {
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
        const err = _tryLS(() => JSON.parse(text), {});
        return { data: null, error: { message: err.message || err.error_description || "Request failed" } };
      }
      if (!text) return { data: null, error: null };
      const json = _tryLS(() => JSON.parse(text));
      return { data: single && Array.isArray(json) ? (json[0] ?? null) : json, error: null };
    } catch (e) { return { data: null, error: { message: e.message } }; }
  };

  const auth = {
    async signUp({ email, password }) {
      const res = await fetch(`${SUPA_URL}/auth/v1/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "apikey": SUPA_KEY },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) return { data: null, error: { message: data.msg || data.error_description || "Signup failed" } };
      if (data.access_token) {
        _session = _normalizeSession(data);
        _tryLS(() => localStorage.setItem("chs_sess", JSON.stringify(_session)));
        _notify(_session);
      }
      return { data, error: null };
    },

    async signInWithPassword({ email, password }) {
      const res = await fetch(`${SUPA_URL}/auth/v1/token?grant_type=password`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "apikey": SUPA_KEY },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) return { data: null, error: { message: data.error_description || data.msg || "Sign in failed" } };
      _session = _normalizeSession(data);
      _tryLS(() => localStorage.setItem("chs_sess", JSON.stringify(_session)));
      _notify(_session);
      return { data: { user: data.user, session: data }, error: null };
    },

    async signOut() {
      try { await fetch(`${SUPA_URL}/auth/v1/logout`, { method: "POST", headers: _headers() }); } catch {}
      _session = null;
      _tryLS(() => localStorage.removeItem("chs_sess"));
      _notify(null);
      return { error: null };
    },

    async resetPasswordForEmail(email) {
      const res = await fetch(`${SUPA_URL}/auth/v1/recover`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "apikey": SUPA_KEY },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const data = await res.json();
        return { error: { message: data.msg || data.error_description || "Reset failed" } };
      }
      return { error: null };
    },

    async refreshSession() {
      const refreshToken = _session?.refresh_token;
      if (!refreshToken) {
        _session = null;
        _tryLS(() => localStorage.removeItem("chs_sess"));
        _notify(null);
        return { data: { session: null }, error: { message: "No refresh token" } };
      }
      try {
        const res = await fetch(`${SUPA_URL}/auth/v1/token?grant_type=refresh_token`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "apikey": SUPA_KEY },
          body: JSON.stringify({ refresh_token: refreshToken }),
        });
        const data = await res.json();
        if (!res.ok) {
          _session = null;
          _tryLS(() => localStorage.removeItem("chs_sess"));
          _notify(null);
          return { data: { session: null }, error: { message: data.error_description || "Token refresh failed" } };
        }
        _session = _normalizeSession(data);
        _tryLS(() => localStorage.setItem("chs_sess", JSON.stringify(_session)));
        _notify(_session);
        return { data: { session: _session }, error: null };
      } catch (e) {
        return { data: { session: null }, error: { message: e.message } };
      }
    },

    async getSession() {
      // Load from localStorage if not in memory
      if (!_session) {
        const stored = _tryLS(() => JSON.parse(localStorage.getItem("chs_sess") || "null"));
        if (stored) _session = stored;
      }
      if (!_session) return { data: { session: null }, error: null };

      // Legacy sessions without expires_at: force refresh so we get a fresh token+expiry
      if (!_session.expires_at) {
        return await auth.refreshSession();
      }

      // Check if access_token is expired (or expires within 30s)
      const now = Math.floor(Date.now() / 1000);
      if (now >= _session.expires_at - 30) {
        return await auth.refreshSession();
      }

      return { data: { session: _session }, error: null };
    },

    onAuthStateChange(callback) {
      _listeners.push(callback);
      return { data: { subscription: { unsubscribe: () => { _listeners = _listeners.filter(fn => fn !== callback); } } } };
    },

    signInWithOAuth({ provider, options = {} }) {
      const redirectTo = options.redirectTo || window.location.origin;
      const params = new URLSearchParams({ provider, redirect_to: redirectTo });
      window.location.href = `${SUPA_URL}/auth/v1/authorize?${params}`;
      return Promise.resolve({ data: { url: `${SUPA_URL}/auth/v1/authorize?${params}` }, error: null });
    },
  };

  const from = (table) => ({
    select: (cols = "*") => {
      const filters = [];
      const builder = {
        eq: (col, val) => { filters.push(`${col}=eq.${val}`); return builder; },
        neq: (col, val) => { filters.push(`${col}=neq.${val}`); return builder; },
        order: (col, { ascending = true } = {}) => { filters.push(`order=${col}.${ascending ? "asc" : "desc"}`); return builder; },
        limit: (n) => { filters.push(`limit=${n}`); return builder; },
        single: () => {
          const qs = [...filters, "limit=1"].join("&");
          return _q("GET", `${SUPA_URL}/rest/v1/${table}?select=${cols}&${qs}`, undefined, { single: true });
        },
        execute: () => {
          const qs = filters.join("&");
          return _q("GET", `${SUPA_URL}/rest/v1/${table}?select=${cols}${qs ? "&" + qs : ""}`, undefined, {});
        },
        then: (resolve, reject) => {
          const qs = filters.join("&");
          return _q("GET", `${SUPA_URL}/rest/v1/${table}?select=${cols}${qs ? "&" + qs : ""}`, undefined, {}).then(resolve, reject);
        },
      };
      return builder;
    },
    insert: (body) => ({
      select: () => ({
        single: () => _q("POST", `${SUPA_URL}/rest/v1/${table}`, body, { single: true, returnData: true }),
      }),
      then: (resolve, reject) => _q("POST", `${SUPA_URL}/rest/v1/${table}`, body, {}).then(resolve, reject),
    }),
    update: (body) => ({
      eq: (col, val) => ({
        select: () => ({
          single: () => _q("PATCH", `${SUPA_URL}/rest/v1/${table}?${col}=eq.${val}`, body, { single: true, returnData: true }),
        }),
        then: (resolve, reject) => _q("PATCH", `${SUPA_URL}/rest/v1/${table}?${col}=eq.${val}`, body, {}).then(resolve, reject),
      }),
    }),
    delete: () => ({
      eq: (col, val) => _q("DELETE", `${SUPA_URL}/rest/v1/${table}?${col}=eq.${val}`, undefined, {}),
    }),
  });

  const rpc = (fn, params = {}) => _q("POST", `${SUPA_URL}/rest/v1/rpc/${fn}`, params, {});

  return { auth, from, rpc };
})();

export default supabase;

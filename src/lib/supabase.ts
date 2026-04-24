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
        _tryLS(() => localStorage.setItem("chs_sess", JSON.stringify(_session)));
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
      _tryLS(() => localStorage.setItem("chs_sess", JSON.stringify(_session)));
      _notify(_session);
      return { data: { user: data.user, session: _session }, error: null };
    },

    async signOut() {
      try { await fetch(`${SUPA_URL}/auth/v1/logout`, { method: "POST", headers: _headers() }); } catch {}
      _session = null;
      _tryLS(() => localStorage.removeItem("chs_sess"));
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
      const refreshToken = _session?.refresh_token;
      if (!refreshToken) {
        _session = null;
        _tryLS(() => localStorage.removeItem("chs_sess"));
        _notify(null);
        return { data: null, error: { message: "No refresh token" } };
      }
      try {
        const res = await fetch(`${SUPA_URL}/auth/v1/token?grant_type=refresh_token`, {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: SUPA_KEY },
          body: JSON.stringify({ refresh_token: refreshToken }),
        });
        const data = await res.json() as SupabaseSession & { error_description?: string };
        if (!res.ok) {
          _session = null;
          _tryLS(() => localStorage.removeItem("chs_sess"));
          _notify(null);
          return { data: null, error: { message: data.error_description || "Token refresh failed" } };
        }
        _session = _normalizeSession(data);
        _tryLS(() => localStorage.setItem("chs_sess", JSON.stringify(_session)));
        _notify(_session);
        return { data: { session: _session }, error: null };
      } catch (e) {
        return { data: null, error: { message: (e as Error).message } };
      }
    },

    async getSession(): Promise<SupabaseResponse<{ session: SupabaseSession | null }>> {
      if (!_session) {
        const stored = _tryLS(() => JSON.parse(localStorage.getItem("chs_sess") || "null") as SupabaseSession | null);
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
  };

  const from = (table: string) => ({
    select: (cols = "*") => {
      const filters: string[] = [];
      const builder = {
        eq: (col: string, val: unknown) => { filters.push(`${col}=eq.${val}`); return builder; },
        neq: (col: string, val: unknown) => { filters.push(`${col}=neq.${val}`); return builder; },
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

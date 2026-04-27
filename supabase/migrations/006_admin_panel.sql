-- 006_admin_panel.sql
-- Adds admin role to profiles + all admin-only SECURITY DEFINER RPCs.
-- Applied to production 2026-04-27.

-- ── Role column ───────────────────────────────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user'
  CHECK (role IN ('user', 'admin'));

-- Set the owner as admin
UPDATE public.profiles SET role = 'admin' WHERE email = 'hdgarzon3@gmail.com';

-- ── Helper: is calling user an admin? ────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin');
$$;
REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- ── admin_get_stats ───────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_get_stats()
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Not authorized'; END IF;
  RETURN (
    SELECT jsonb_build_object(
      'total_users',            (SELECT COUNT(*) FROM public.profiles),
      'generations_today',      (SELECT COUNT(*) FROM public.chassis_history WHERE created_at >= CURRENT_DATE),
      'generations_month',      (SELECT COUNT(*) FROM public.chassis_history WHERE created_at >= date_trunc('month', NOW())),
      'total_generations',      (SELECT COUNT(*) FROM public.chassis_history),
      'tokens_consumed',        (SELECT COALESCE(SUM(tokens_consumed),0) FROM public.chassis_history),
      'tokens_sold',            (SELECT COALESCE(SUM(total_tokens),0) FROM public.pending_purchases WHERE fulfilled_at IS NOT NULL),
      'revenue_usd',            (SELECT COALESCE(SUM(amount_usd),0) FROM public.pending_purchases WHERE fulfilled_at IS NOT NULL),
      'cache_entries',          (SELECT COUNT(*) FROM public.chassis_cache),
      'cache_total_hits',       (SELECT COALESCE(SUM(hit_count),0) FROM public.chassis_cache),
      'tier_breakdown',         (SELECT COALESCE(jsonb_object_agg(tier, cnt),'{}') FROM (SELECT tier, COUNT(*) cnt FROM public.chassis_history GROUP BY tier) t),
      'lang_breakdown',         (SELECT COALESCE(jsonb_object_agg(lang, cnt),'{}') FROM (SELECT lang, COUNT(*) cnt FROM public.chassis_history GROUP BY lang) t),
      'pending_purchases',      (SELECT COUNT(*) FROM public.pending_purchases WHERE fulfilled_at IS NULL),
      'total_workspaces',       (SELECT COUNT(*) FROM public.workspaces)
    )
  );
END;
$$;
REVOKE ALL ON FUNCTION public.admin_get_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_get_stats() TO authenticated;

-- ── admin_list_users ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_list_users(p_limit INT DEFAULT 50, p_offset INT DEFAULT 0)
RETURNS TABLE (id UUID, email TEXT, token_balance NUMERIC, role TEXT, created_at TIMESTAMPTZ, generation_count BIGINT, last_generation TIMESTAMPTZ)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Not authorized'; END IF;
  RETURN QUERY
    SELECT p.id, p.email, p.token_balance, p.role, p.created_at,
           COUNT(h.id)::BIGINT,
           MAX(h.created_at)
    FROM public.profiles p
    LEFT JOIN public.chassis_history h ON h.user_id = p.id
    GROUP BY p.id, p.email, p.token_balance, p.role, p.created_at
    ORDER BY p.created_at DESC
    LIMIT p_limit OFFSET p_offset;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_list_users(INT,INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_users(INT,INT) TO authenticated;

-- ── admin_list_generations ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_list_generations(p_limit INT DEFAULT 50, p_offset INT DEFAULT 0)
RETURNS TABLE (id UUID, user_email TEXT, business_name TEXT, tier TEXT, lang TEXT, tokens_consumed NUMERIC, has_beyond_profit BOOLEAN, created_at TIMESTAMPTZ)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Not authorized'; END IF;
  RETURN QUERY
    SELECT h.id, p.email, h.business_name, h.tier, h.lang, h.tokens_consumed,
           (h.beyond_profit_data IS NOT NULL),
           h.created_at
    FROM public.chassis_history h
    LEFT JOIN public.profiles p ON p.id = h.user_id
    ORDER BY h.created_at DESC
    LIMIT p_limit OFFSET p_offset;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_list_generations(INT,INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_generations(INT,INT) TO authenticated;

-- ── admin_list_purchases ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_list_purchases(p_limit INT DEFAULT 50, p_offset INT DEFAULT 0)
RETURNS TABLE (id UUID, user_email TEXT, amount_usd NUMERIC, total_tokens NUMERIC, promo_code TEXT, fulfilled_at TIMESTAMPTZ, created_at TIMESTAMPTZ)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Not authorized'; END IF;
  RETURN QUERY
    SELECT pp.id, p.email, pp.amount_usd, pp.total_tokens, pp.promo_code, pp.fulfilled_at, pp.created_at
    FROM public.pending_purchases pp
    LEFT JOIN public.profiles p ON p.id = pp.user_id
    ORDER BY pp.created_at DESC
    LIMIT p_limit OFFSET p_offset;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_list_purchases(INT,INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_purchases(INT,INT) TO authenticated;

-- ── admin_list_promos ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_list_promos()
RETURNS TABLE (code TEXT, bonus_tokens NUMERIC, max_uses INT, uses_count INT, expires_at TIMESTAMPTZ, active BOOLEAN, created_at TIMESTAMPTZ)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Not authorized'; END IF;
  RETURN QUERY SELECT pc.code, pc.bonus_tokens, pc.max_uses, pc.uses_count, pc.expires_at, pc.active, pc.created_at FROM public.promo_codes pc ORDER BY pc.created_at DESC;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_list_promos() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_promos() TO authenticated;

-- ── admin_create_promo ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_create_promo(p_code TEXT, p_bonus_tokens NUMERIC, p_max_uses INT, p_expires_at TIMESTAMPTZ DEFAULT NULL)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Not authorized'; END IF;
  INSERT INTO public.promo_codes (code, bonus_tokens, max_uses, expires_at, active)
  VALUES (UPPER(TRIM(p_code)), p_bonus_tokens, p_max_uses, p_expires_at, TRUE);
END;
$$;
REVOKE ALL ON FUNCTION public.admin_create_promo(TEXT,NUMERIC,INT,TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_create_promo(TEXT,NUMERIC,INT,TIMESTAMPTZ) TO authenticated;

-- ── admin_toggle_promo ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_toggle_promo(p_code TEXT, p_active BOOLEAN)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Not authorized'; END IF;
  UPDATE public.promo_codes SET active = p_active WHERE code = p_code;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_toggle_promo(TEXT,BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_toggle_promo(TEXT,BOOLEAN) TO authenticated;

-- ── admin_adjust_tokens ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_adjust_tokens(p_user_id UUID, p_amount NUMERIC)
RETURNS NUMERIC LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE new_bal NUMERIC;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Not authorized'; END IF;
  UPDATE public.profiles SET token_balance = GREATEST(0, token_balance + p_amount), updated_at = NOW()
  WHERE id = p_user_id RETURNING token_balance INTO new_bal;
  RETURN new_bal;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_adjust_tokens(UUID,NUMERIC) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_adjust_tokens(UUID,NUMERIC) TO authenticated;

-- ── admin_list_workspaces ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_list_workspaces()
RETURNS TABLE (id UUID, name TEXT, owner_email TEXT, token_balance NUMERIC, member_count BIGINT, created_at TIMESTAMPTZ)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Not authorized'; END IF;
  RETURN QUERY
    SELECT w.id, w.name, p.email, w.token_balance,
           COUNT(wm.user_id)::BIGINT,
           w.created_at
    FROM public.workspaces w
    LEFT JOIN public.profiles p ON p.id = w.created_by
    LEFT JOIN public.workspace_members wm ON wm.workspace_id = w.id
    GROUP BY w.id, w.name, p.email, w.token_balance, w.created_at
    ORDER BY w.created_at DESC;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_list_workspaces() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_workspaces() TO authenticated;

-- ── admin_list_cache ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_list_cache(p_limit INT DEFAULT 20)
RETURNS TABLE (id UUID, input_text TEXT, tier_id TEXT, lang TEXT, hit_count INT, created_at TIMESTAMPTZ, last_hit_at TIMESTAMPTZ)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Not authorized'; END IF;
  RETURN QUERY SELECT c.id, c.input_text, c.tier_id, c.lang, c.hit_count, c.created_at, c.last_hit_at
  FROM public.chassis_cache c ORDER BY c.hit_count DESC, c.created_at DESC LIMIT p_limit;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_list_cache(INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_cache(INT) TO authenticated;

-- ── admin_clear_cache ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_clear_cache()
RETURNS BIGINT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE deleted BIGINT;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Not authorized'; END IF;
  DELETE FROM public.chassis_cache;
  GET DIAGNOSTICS deleted = ROW_COUNT;
  RETURN deleted;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_clear_cache() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_clear_cache() TO authenticated;

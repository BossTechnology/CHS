-- ============================================================
-- Migration 002 — Idempotent purchase fulfillment
-- Run in: Supabase Dashboard → SQL Editor → New query
-- ============================================================
--
-- Problem: the previous flow read `pending_purchases`, then called
-- `credit_tokens` and PATCHed `fulfilled_at` in three separate HTTP
-- round-trips. Stripe retries any 5xx webhook response, and each
-- retry re-entered the flow with a non-atomic guard, opening a
-- race window for double-credit.
--
-- Solution: a single `fulfill_purchase(p_purchase_id)` RPC that
-- locks the row, checks `fulfilled_at`, credits tokens, increments
-- promo uses, and stamps `fulfilled_at` — all in one transaction.
-- ============================================================

-- Helper: increment promo code uses_count atomically
CREATE OR REPLACE FUNCTION increment_promo_uses(p_code TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE promo_codes
  SET uses_count = uses_count + 1
  WHERE code = p_code;
END;
$$;

-- Single idempotent fulfillment RPC
CREATE OR REPLACE FUNCTION fulfill_purchase(p_purchase_id UUID)
RETURNS TABLE (status TEXT, credited NUMERIC) -- 'credited' | 'already_fulfilled' | 'not_found'
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_purchase pending_purchases%ROWTYPE;
BEGIN
  -- Lock the row to serialize concurrent webhook retries
  SELECT * INTO v_purchase
  FROM pending_purchases
  WHERE id = p_purchase_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT 'not_found'::TEXT, 0::NUMERIC;
    RETURN;
  END IF;

  IF v_purchase.fulfilled_at IS NOT NULL THEN
    RETURN QUERY SELECT 'already_fulfilled'::TEXT, v_purchase.total_tokens;
    RETURN;
  END IF;

  -- Credit tokens
  UPDATE profiles
  SET token_balance = token_balance + v_purchase.total_tokens
  WHERE id = v_purchase.user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User % not found for purchase %', v_purchase.user_id, p_purchase_id;
  END IF;

  -- Increment promo (best-effort; missing promo is non-fatal)
  IF v_purchase.promo_code IS NOT NULL THEN
    UPDATE promo_codes
    SET uses_count = uses_count + 1
    WHERE code = v_purchase.promo_code;
  END IF;

  -- Mark fulfilled — within the same transaction
  UPDATE pending_purchases
  SET fulfilled_at = NOW()
  WHERE id = p_purchase_id;

  RETURN QUERY SELECT 'credited'::TEXT, v_purchase.total_tokens;
END;
$$;

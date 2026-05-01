-- ============================================================
-- Migration 013 — Update consume_and_save_chassis RPC
-- Run in: Supabase Dashboard → SQL Editor → New query
-- ============================================================
-- Adds p_action_type parameter (DEFAULT 'fabricated') so that
-- re-fabricated and future tuned events are stored distinctly.
-- The full function body is preserved; only the signature and
-- the INSERT INTO chassis_history statement are updated.
-- ============================================================

CREATE OR REPLACE FUNCTION consume_and_save_chassis(
  p_user_id                    UUID,
  p_workspace_id               UUID,
  p_amount                     NUMERIC,
  p_business_name              TEXT,
  p_business_input             TEXT,
  p_tier                       TEXT,
  p_lang                       TEXT,
  p_chassis_data               JSONB,
  p_beyond_profit_selections   JSONB,
  p_action_type                TEXT DEFAULT 'fabricated'
)
RETURNS TABLE (
  status        TEXT,
  history_id    UUID,
  new_balance   NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_history_id UUID;
  v_balance    NUMERIC;
BEGIN
  IF p_workspace_id IS NOT NULL THEN
    SELECT token_balance INTO v_balance
    FROM workspaces
    WHERE id = p_workspace_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RETURN QUERY SELECT 'not_found'::TEXT, NULL::UUID, 0::NUMERIC;
      RETURN;
    END IF;

    IF v_balance < p_amount THEN
      RETURN QUERY SELECT 'insufficient_balance'::TEXT, NULL::UUID, v_balance;
      RETURN;
    END IF;

    UPDATE workspaces
    SET token_balance = token_balance - p_amount
    WHERE id = p_workspace_id;

    v_balance := v_balance - p_amount;
  ELSE
    SELECT token_balance INTO v_balance
    FROM profiles
    WHERE id = p_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RETURN QUERY SELECT 'not_found'::TEXT, NULL::UUID, 0::NUMERIC;
      RETURN;
    END IF;

    IF v_balance < p_amount THEN
      RETURN QUERY SELECT 'insufficient_balance'::TEXT, NULL::UUID, v_balance;
      RETURN;
    END IF;

    UPDATE profiles
    SET token_balance = token_balance - p_amount
    WHERE id = p_user_id;

    v_balance := v_balance - p_amount;
  END IF;

  INSERT INTO chassis_history (
    user_id, workspace_id, business_name, business_input,
    tier, tokens_consumed, chassis_data, beyond_profit_selections, lang,
    action_type
  ) VALUES (
    p_user_id, p_workspace_id, p_business_name, p_business_input,
    p_tier, p_amount, p_chassis_data, p_beyond_profit_selections, p_lang,
    p_action_type
  )
  RETURNING id INTO v_history_id;

  RETURN QUERY SELECT 'ok'::TEXT, v_history_id, v_balance;
END;
$$;

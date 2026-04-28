-- ============================================================
-- Migration 008 — Token Ledger (append-only audit log)
-- Run in: Supabase Dashboard → SQL Editor → New query
-- Safe to re-run: all statements are idempotent.
-- ============================================================

-- ── 1. Create table (idempotent) ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS token_ledger (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID          NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  workspace_id  UUID          REFERENCES workspaces(id) ON DELETE SET NULL,
  delta         NUMERIC(10,4) NOT NULL,
  reason        TEXT          NOT NULL,
  reference_id  TEXT,
  balance_after NUMERIC(10,4),
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- ── 2. Add any missing columns if table already existed without them ──────────

ALTER TABLE token_ledger ADD COLUMN IF NOT EXISTS delta         NUMERIC(10,4);
ALTER TABLE token_ledger ADD COLUMN IF NOT EXISTS reason        TEXT;
ALTER TABLE token_ledger ADD COLUMN IF NOT EXISTS reference_id  TEXT;
ALTER TABLE token_ledger ADD COLUMN IF NOT EXISTS balance_after NUMERIC(10,4);

-- ── 3. Add constraints only if they don't exist yet ───────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'token_ledger_delta_not_zero'
      AND conrelid = 'token_ledger'::regclass
  ) THEN
    ALTER TABLE token_ledger ADD CONSTRAINT token_ledger_delta_not_zero CHECK (delta <> 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'token_ledger_reason_values'
      AND conrelid = 'token_ledger'::regclass
  ) THEN
    ALTER TABLE token_ledger ADD CONSTRAINT token_ledger_reason_values
      CHECK (reason IN ('generation','purchase','signup_bonus','refund','promo_redemption','admin_adjustment'));
  END IF;
END
$$;

-- ── 4. Indexes ────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_token_ledger_user
  ON token_ledger(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_token_ledger_reason
  ON token_ledger(reason, created_at DESC);

-- ── 5. RLS ────────────────────────────────────────────────────────────────────

ALTER TABLE token_ledger ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'token_ledger'
      AND policyname = 'Users view own ledger'
  ) THEN
    CREATE POLICY "Users view own ledger"
      ON token_ledger FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
END
$$;

-- ── 6. Amend consume_and_save_chassis() to write a ledger row ─────────────────
-- Preserves the original signature and return type from migration 003.

CREATE OR REPLACE FUNCTION consume_and_save_chassis(
  p_user_id                    UUID,
  p_workspace_id               UUID,
  p_amount                     NUMERIC,
  p_business_name              TEXT,
  p_business_input             TEXT,
  p_tier                       TEXT,
  p_lang                       TEXT,
  p_chassis_data               JSONB,
  p_beyond_profit_selections   JSONB
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
    tier, tokens_consumed, chassis_data, beyond_profit_selections, lang
  ) VALUES (
    p_user_id, p_workspace_id, p_business_name, p_business_input,
    p_tier, p_amount, p_chassis_data, p_beyond_profit_selections, p_lang
  )
  RETURNING id INTO v_history_id;

  INSERT INTO token_ledger (user_id, workspace_id, delta, reason, reference_id, balance_after)
  VALUES (p_user_id, p_workspace_id, -p_amount, 'generation', v_history_id::TEXT, v_balance);

  RETURN QUERY SELECT 'ok'::TEXT, v_history_id, v_balance;
END;
$$;

-- ── 7. Amend fulfill_purchase() to write a ledger row ────────────────────────
-- Preserves the original signature and return type from migration 002.

CREATE OR REPLACE FUNCTION fulfill_purchase(p_purchase_id UUID)
RETURNS TABLE (status TEXT, credited NUMERIC)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_purchase pending_purchases%ROWTYPE;
BEGIN
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

  UPDATE profiles
  SET token_balance = token_balance + v_purchase.total_tokens
  WHERE id = v_purchase.user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User % not found for purchase %', v_purchase.user_id, p_purchase_id;
  END IF;

  IF v_purchase.promo_code IS NOT NULL THEN
    UPDATE promo_codes
    SET uses_count = uses_count + 1
    WHERE code = v_purchase.promo_code;
  END IF;

  UPDATE pending_purchases
  SET fulfilled_at = NOW()
  WHERE id = p_purchase_id;

  INSERT INTO token_ledger (user_id, delta, reason, reference_id, balance_after)
  VALUES (
    v_purchase.user_id,
    v_purchase.total_tokens,
    'purchase',
    p_purchase_id::TEXT,
    (SELECT token_balance FROM profiles WHERE id = v_purchase.user_id)
  );

  RETURN QUERY SELECT 'credited'::TEXT, v_purchase.total_tokens;
END;
$$;

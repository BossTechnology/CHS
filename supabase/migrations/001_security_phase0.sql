-- ============================================================
-- Migration 001 — Phase 0 Security
-- Run in: Supabase Dashboard → SQL Editor → New query
-- ============================================================

-- 1. Tabla para compras pendientes (server-side, no client-side)
CREATE TABLE IF NOT EXISTS pending_purchases (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  amount_usd   NUMERIC(10,2) NOT NULL CHECK (amount_usd >= 25 AND amount_usd <= 1000),
  total_tokens NUMERIC(10,4) NOT NULL CHECK (total_tokens > 0),
  promo_code   TEXT,
  fulfilled_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE pending_purchases ENABLE ROW LEVEL SECURITY;
-- Solo accessible via service key (no RLS policies para usuarios)

-- 2. Tabla de promo codes (reemplaza los hardcoded en cliente)
CREATE TABLE IF NOT EXISTS promo_codes (
  code         TEXT PRIMARY KEY,
  bonus_tokens NUMERIC(10,2) NOT NULL CHECK (bonus_tokens > 0),
  max_uses     INTEGER,
  uses_count   INTEGER NOT NULL DEFAULT 0,
  expires_at   TIMESTAMPTZ,
  active       BOOLEAN NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE promo_codes ENABLE ROW LEVEL SECURITY;
-- Solo accessible via service key

-- Insertar promo codes existentes
INSERT INTO promo_codes (code, bonus_tokens, max_uses, active) VALUES
  ('WELCOME20', 20, 1000, true),
  ('BOSS10',    10,  500, true),
  ('CHS50',     50,  100, true)
ON CONFLICT (code) DO NOTHING;

-- 3. RPC para acreditar tokens (SECURITY DEFINER = bypasa RLS con permisos de superuser)
CREATE OR REPLACE FUNCTION credit_tokens(p_user_id UUID, p_amount NUMERIC)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE profiles
  SET token_balance = token_balance + p_amount
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User % not found', p_user_id;
  END IF;
END;
$$;

-- 4. Constraint de balance no negativo (si no existe ya)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'profiles_token_balance_non_negative'
  ) THEN
    ALTER TABLE profiles
      ADD CONSTRAINT profiles_token_balance_non_negative
      CHECK (token_balance >= 0);
  END IF;
END;
$$;

-- 5. Indices críticos para queries frecuentes
CREATE INDEX IF NOT EXISTS idx_chassis_history_user_date
  ON chassis_history (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_workspace_members_user
  ON workspace_members (user_id);

CREATE INDEX IF NOT EXISTS idx_workspace_members_workspace
  ON workspace_members (workspace_id);

CREATE INDEX IF NOT EXISTS idx_pending_purchases_user
  ON pending_purchases (user_id, created_at DESC);

-- ============================================================
-- Después de ejecutar este SQL:
-- 1. Ve a Supabase → Settings → API
-- 2. Copia la "service_role" key (NO la anon key)
-- 3. Agrégala en Vercel: vercel env add SUPABASE_SERVICE_KEY production --value "eyJ..."
-- ============================================================

-- ============================================================
-- Migration 012 — Add action_type to chassis_history
-- Run in: Supabase Dashboard → SQL Editor → New query
-- ============================================================
-- Distinguishes fabricated vs refabricated vs tuned events
-- in the chassis_history table.
-- ============================================================

ALTER TABLE chassis_history
  ADD COLUMN IF NOT EXISTS action_type TEXT NOT NULL DEFAULT 'fabricated';

-- Back-fill existing rows as 'fabricated'
UPDATE chassis_history SET action_type = 'fabricated' WHERE action_type IS NULL;

-- Index for filtered queries by business (used by ChassisPageHistoryModal)
CREATE INDEX IF NOT EXISTS idx_chassis_history_business_user
  ON chassis_history (user_id, business_name, created_at DESC);

-- 009_onboarding_profile_fields.sql
-- Adds onboarding fields to profiles table (idempotent)

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS display_name       TEXT,
  ADD COLUMN IF NOT EXISTS country            TEXT,
  ADD COLUMN IF NOT EXISTS age_range          TEXT,
  ADD COLUMN IF NOT EXISTS user_roles         TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS onboarding_complete BOOLEAN DEFAULT FALSE;

-- Index to quickly find users who have not finished onboarding
CREATE INDEX IF NOT EXISTS idx_profiles_onboarding
  ON profiles (onboarding_complete)
  WHERE onboarding_complete = FALSE OR onboarding_complete IS NULL;

-- Grandfather existing users — they already completed the old flow
UPDATE profiles
SET onboarding_complete = TRUE
WHERE onboarding_complete IS NULL OR onboarding_complete = FALSE;

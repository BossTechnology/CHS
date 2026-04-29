ALTER TABLE profiles ADD COLUMN IF NOT EXISTS account_status      TEXT        DEFAULT 'active';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS deletion_scheduled_at TIMESTAMPTZ;

-- Backfill: ensure no NULLs in existing rows
UPDATE profiles SET account_status = 'active' WHERE account_status IS NULL;

-- RPC: reactivate a deactivated account (called on sign-in within the 30-day window)
CREATE OR REPLACE FUNCTION reactivate_account(p_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE profiles
  SET account_status      = 'active',
      deletion_scheduled_at = NULL
  WHERE id = p_user_id;
END;
$$;

-- TD-22: Attempt to schedule daily deletion job via pg_cron.
-- Wrapped in DO/EXCEPTION so the migration succeeds even if pg_cron is unavailable.
-- Replace with a Supabase Edge Function on a cron trigger before launch.
DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_cron;
  PERFORM cron.schedule(
    'delete-deactivated-accounts',
    '0 3 * * *',
    $cron$
      DELETE FROM profiles
      WHERE account_status = 'deactivated'
        AND deletion_scheduled_at < now();
    $cron$
  );
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- Enable pgcrypto for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS support_tickets (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id         TEXT        NOT NULL UNIQUE,
  user_id           UUID        NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email        TEXT,
  user_name         TEXT,
  category          TEXT        NOT NULL,
  description       TEXT        NOT NULL,
  file_url          TEXT,
  lang              TEXT        DEFAULT 'EN',
  status            TEXT        NOT NULL DEFAULT 'open',
  admin_notes       TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_support_tickets_user_id    ON support_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status     ON support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_support_tickets_created_at ON support_tickets(created_at);

ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'support_tickets'
      AND policyname = 'users_can_insert_own_tickets'
  ) THEN
    CREATE POLICY users_can_insert_own_tickets ON support_tickets
      FOR INSERT TO authenticated
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'support_tickets'
      AND policyname = 'users_can_read_own_tickets'
  ) THEN
    CREATE POLICY users_can_read_own_tickets ON support_tickets
      FOR SELECT TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- Storage: allow authenticated users to upload to their own folder
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename  = 'objects'
      AND policyname = 'users_can_upload_own_attachments'
  ) THEN
    CREATE POLICY users_can_upload_own_attachments ON storage.objects
      FOR INSERT TO authenticated
      WITH CHECK (
        bucket_id = 'support-attachments'
        AND (storage.foldername(name))[1] = auth.uid()::text
      );
  END IF;
END $$;

-- Storage: public read for support attachments
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename  = 'objects'
      AND policyname = 'public_read_support_attachments'
  ) THEN
    CREATE POLICY public_read_support_attachments ON storage.objects
      FOR SELECT
      USING (bucket_id = 'support-attachments');
  END IF;
END $$;

-- 004_rls_policies.sql
-- Hardens RLS on workspace_members and profiles, and adds a SECURITY DEFINER
-- RPC for the invite-by-email flow so we don't have to expose profiles SELECT
-- to all authenticated users.
--
-- Fixes:
--   H1 (critical): drops the open INSERT policy on workspace_members that
--                  allowed any authenticated user to add themselves to any
--                  workspace.
--   H2: adds a workspace_members SELECT policy so members can list peers.
--   H3: adds DELETE/UPDATE policies so owner/co-owner can manage members
--       (currently the modal silently no-ops).
--   H4: adds a tightly scoped profiles SELECT policy for workspace mates,
--       plus the lookup_profile_by_email() RPC for the invite flow.

BEGIN;

-- ---------------------------------------------------------------------------
-- Helpers (SECURITY DEFINER) to avoid RLS recursion when policies reference
-- workspace_members from other tables (or itself).
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_workspace_member(p_ws_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = p_ws_id
      AND user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.is_workspace_admin(p_ws_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = p_ws_id
      AND user_id = auth.uid()
      AND role IN ('owner', 'co-owner')
  );
$$;

CREATE OR REPLACE FUNCTION public.shares_workspace_with(p_other_user UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.workspace_members wm1
    JOIN public.workspace_members wm2
      ON wm1.workspace_id = wm2.workspace_id
    WHERE wm1.user_id = auth.uid()
      AND wm2.user_id = p_other_user
  );
$$;

REVOKE ALL ON FUNCTION public.is_workspace_member(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_workspace_admin(UUID)  FROM PUBLIC;
REVOKE ALL ON FUNCTION public.shares_workspace_with(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_workspace_member(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_workspace_admin(UUID)  TO authenticated;
GRANT EXECUTE ON FUNCTION public.shares_workspace_with(UUID) TO authenticated;

-- ---------------------------------------------------------------------------
-- workspace_members: drop the dangerous open-INSERT policy and replace with
-- two scoped policies (creator self-insert as owner; admin invites).
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Members insert workspace_members" ON public.workspace_members;

DROP POLICY IF EXISTS "creator self-insert as owner"  ON public.workspace_members;
DROP POLICY IF EXISTS "admin invites members"         ON public.workspace_members;
DROP POLICY IF EXISTS "members select shared workspace members" ON public.workspace_members;
DROP POLICY IF EXISTS "admin removes non-owner members" ON public.workspace_members;
DROP POLICY IF EXISTS "admin updates non-owner roles"  ON public.workspace_members;

-- INSERT path 1: workspace creator can insert themselves as owner.
-- Used by WorkspaceCreateModal right after creating the workspace row.
CREATE POLICY "creator self-insert as owner"
  ON public.workspace_members
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND role = 'owner'
    AND EXISTS (
      SELECT 1 FROM public.workspaces w
      WHERE w.id = workspace_id
        AND w.created_by = auth.uid()
    )
  );

-- INSERT path 2: existing admin invites a member or co-owner.
-- 'owner' role is reserved and cannot be granted via invite.
CREATE POLICY "admin invites members"
  ON public.workspace_members
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_workspace_admin(workspace_id)
    AND role IN ('member', 'co-owner')
  );

-- SELECT: members can see all peers in workspaces they belong to.
CREATE POLICY "members select shared workspace members"
  ON public.workspace_members
  FOR SELECT
  TO authenticated
  USING (public.is_workspace_member(workspace_id));

-- DELETE: admins can remove anyone except the owner.
CREATE POLICY "admin removes non-owner members"
  ON public.workspace_members
  FOR DELETE
  TO authenticated
  USING (
    public.is_workspace_admin(workspace_id)
    AND role <> 'owner'
  );

-- UPDATE: admins can change roles for non-owner rows (cannot promote to owner).
CREATE POLICY "admin updates non-owner roles"
  ON public.workspace_members
  FOR UPDATE
  TO authenticated
  USING (
    public.is_workspace_admin(workspace_id)
    AND role <> 'owner'
  )
  WITH CHECK (
    public.is_workspace_admin(workspace_id)
    AND role IN ('member', 'co-owner')
  );

-- ---------------------------------------------------------------------------
-- profiles: extra SELECT policy so members can render peer emails in the
-- members list. PERMISSIVE policies combine with OR — the existing "owner
-- can read self" policy still applies.
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "see profiles of workspace mates" ON public.profiles;

CREATE POLICY "see profiles of workspace mates"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    id = auth.uid()
    OR public.shares_workspace_with(id)
  );

-- ---------------------------------------------------------------------------
-- lookup_profile_by_email: invite-by-email flow without exposing the whole
-- profiles table. Caller must be owner/co-owner of at least one workspace.
-- Returns at most one row.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.lookup_profile_by_email(p_email TEXT)
RETURNS TABLE (id UUID, email TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE user_id = auth.uid()
      AND role IN ('owner', 'co-owner')
  ) THEN
    RAISE EXCEPTION 'Not authorized to lookup profiles';
  END IF;

  RETURN QUERY
  SELECT p.id, p.email
  FROM public.profiles p
  WHERE LOWER(p.email) = LOWER(TRIM(p_email))
  LIMIT 1;
END;
$$;

REVOKE ALL ON FUNCTION public.lookup_profile_by_email(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lookup_profile_by_email(TEXT) TO authenticated;

COMMIT;

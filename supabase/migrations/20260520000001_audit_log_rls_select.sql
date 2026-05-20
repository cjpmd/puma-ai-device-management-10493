-- Add SELECT policy to audit_log.
--
-- RLS has been enabled on audit_log since foundation_tables, but only an
-- INSERT policy existed. Without a SELECT policy, authenticated users receive
-- zero rows (deny-by-default). This policy restores visibility for:
--   1. A user's own actions (user_id = auth.uid())
--   2. Actions by any member of an academy the viewer also belongs to
--
-- Academy admins reviewing the Compliance page will therefore see the full
-- audit trail for their academy without cross-org leakage.

CREATE POLICY "al_select_academy_members" ON audit_log
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM   user_academies ua_viewer
      JOIN   user_academies ua_actor
             ON ua_actor.academy_id = ua_viewer.academy_id
      WHERE  ua_viewer.user_id = auth.uid()
        AND  ua_actor.user_id  = audit_log.user_id
    )
  );

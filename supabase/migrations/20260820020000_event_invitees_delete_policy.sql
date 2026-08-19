-- Evently: event_invitees never had a DELETE policy, so managers could not
-- remove an invitee row (RLS defaults to deny). Allow the event's own
-- managers (manager_ids) or a super_admin to delete invitee rows for their
-- events - same predicate already used for the existing UPDATE policy.
-- Run once in the Supabase SQL editor, after the previous migrations.

CREATE POLICY "event_invitees_delete_manager"
  ON public.event_invitees FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      JOIN public.events e ON e.id = event_invitees.event_id
      WHERE p.auth_user_id = auth.uid() AND (p.role = 'super_admin' OR p.id = ANY (e.manager_ids))
    )
  );

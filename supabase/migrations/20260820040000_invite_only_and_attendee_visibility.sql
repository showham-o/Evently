-- Evently: three new per-event options -
--   1. registration_mode gains a third value, 'invite_only' - only people a
--      manager has already added as an invitee may RSVP; nobody self-serves.
--   2. hide_attendee_count - hides the "X / Y נרשמים" count from public/
--      non-manager viewers (managers always see it).
--   3. attendee_list_visibility - who may see the list of registered
--      attendees' names + status: managers only (default), managers +
--      that event's own invitees, any logged-in user, or fully public.
-- Run once in the Supabase SQL editor, after the previous migrations.

-- ------------------------------------------------------------------
-- 1. registration_mode: add 'invite_only'
-- ------------------------------------------------------------------
ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_registration_mode_check;
ALTER TABLE public.events ADD CONSTRAINT events_registration_mode_check
  CHECK (registration_mode IN ('registered_only', 'anyone', 'invite_only'));

-- ------------------------------------------------------------------
-- 2. hide_attendee_count
-- ------------------------------------------------------------------
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS hide_attendee_count boolean NOT NULL DEFAULT false;

-- ------------------------------------------------------------------
-- 3. attendee_list_visibility
-- ------------------------------------------------------------------
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS attendee_list_visibility text NOT NULL DEFAULT 'managers';
ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_attendee_list_visibility_check;
ALTER TABLE public.events ADD CONSTRAINT events_attendee_list_visibility_check
  CHECK (attendee_list_visibility IN ('managers', 'managers_and_invitees', 'logged_in', 'public'));

-- ------------------------------------------------------------------
-- 4. event_attendee_summary: a name+status-only view of who's registered,
--    gated per-event by attendee_list_visibility. Deliberately does NOT
--    touch event_invitees' own RLS policy (event_invitees_select_public,
--    USING(true)) - that policy's broad read access is also relied on by
--    the guest-RSVP dedupe check and the registration-page "recover my
--    prior guest RSVP" prefill (both match rows by email with no session
--    to prove ownership, so they can't be scoped to self-or-manager
--    without breaking those existing, already-shipped flows). This view
--    is additive: it's the mechanism the app uses for the new "who's
--    registered" display, with its own visibility logic independent of
--    the base table's existing policy.
--    A plain view (no `security_invoker`) runs as its owner, so it can
--    read every underlying row internally regardless of the caller's own
--    RLS grants - only the rows/columns this query actually SELECTs are
--    ever returned to the caller.
CREATE OR REPLACE VIEW public.event_attendee_summary AS
SELECT
  ei.event_id,
  COALESCE(p.full_name, ei.full_name) AS full_name,
  ei.rsvp_status,
  ei.registration_status
FROM public.event_invitees ei
JOIN public.events e ON e.id = ei.event_id
LEFT JOIN public.profiles p ON p.id = ei.profile_id
WHERE
  -- The event's own managers/super_admin always see everyone.
  EXISTS (
    SELECT 1 FROM public.profiles pr
    WHERE pr.auth_user_id = auth.uid() AND (pr.role = 'super_admin' OR pr.id = ANY (e.manager_ids))
  )
  OR e.attendee_list_visibility = 'public'
  OR (e.attendee_list_visibility = 'logged_in' AND auth.uid() IS NOT NULL)
  OR (
    e.attendee_list_visibility = 'managers_and_invitees'
    AND EXISTS (
      SELECT 1 FROM public.profiles pr2
      WHERE pr2.auth_user_id = auth.uid()
        AND pr2.id IN (
          SELECT profile_id FROM public.event_invitees WHERE event_id = e.id AND profile_id IS NOT NULL
        )
    )
  );

GRANT SELECT ON public.event_attendee_summary TO anon, authenticated;

-- ------------------------------------------------------------------
-- 5. invite_only enforcement at the INSERT policy, not just the UI.
--    Previously a registered user could self-insert an invitee row for any
--    event regardless of registration_mode (that column only ever gated
--    the anonymous *guest* insert branch). For invite_only events, remove
--    the plain self-insert path entirely - only a manager can create the
--    initial invitee row; the existing self-update policy (unchanged)
--    still lets that invited person change their own row's status
--    afterwards, since it's an UPDATE on an already-existing row, not a
--    new INSERT.
-- ------------------------------------------------------------------
DROP POLICY IF EXISTS "event_invitees_insert_self_manager_or_guest" ON public.event_invitees;
CREATE POLICY "event_invitees_insert_self_manager_or_guest"
  ON public.event_invitees FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    (
      profile_id IS NOT NULL
      AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.auth_user_id = auth.uid() AND p.id = profile_id)
      AND EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_invitees.event_id AND e.registration_mode <> 'invite_only')
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      JOIN public.events e ON e.id = event_invitees.event_id
      WHERE p.auth_user_id = auth.uid() AND (p.role = 'super_admin' OR p.id = ANY (e.manager_ids))
    )
    OR (
      profile_id IS NULL
      AND EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_invitees.event_id AND e.registration_mode = 'anyone')
    )
  );

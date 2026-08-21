-- Evently: fix a real bug found while testing invite_only visibility -
-- someone added as a guest invitee, who later creates a real account with
-- the matching email, never actually gets linked to that invitee row. The
-- auto-link step (linkGuestInviteesToProfile, called right after
-- registration) runs an UPDATE that RLS silently denies unless the row's
-- parent event has registration_mode = 'anyone' - a restriction written
-- back when the only way a guest row could exist was the public
-- self-service 'anyone' flow.
--
-- That's no longer true: AddInviteeModal's guest tab lets a manager add a
-- guest invitee to an event of ANY registration_mode (it explicitly bypasses
-- the registration_mode check - see submitGuestRsvp's
-- bypassRegistrationModeCheck option), so a legitimate guest row can exist
-- on a registered_only or invite_only event too, not just an 'anyone' one.
--
-- This branch is fundamentally an identity-claim, not a registration
-- action: "this pre-existing row already has my email, let me attach it to
-- my new account." The row's content doesn't change, only its profile_id
-- ownership - safe regardless of what registration_mode the parent event
-- happens to be in. Dropping the registration_mode condition entirely
-- rather than special-casing invite_only, so this doesn't quietly resurface
-- for registered_only next.
-- Run once in the Supabase SQL editor, after the previous migrations.

DROP POLICY IF EXISTS "event_invitees_update_self_manager_or_guest" ON public.event_invitees;
CREATE POLICY "event_invitees_update_self_manager_or_guest"
  ON public.event_invitees FOR UPDATE
  TO anon, authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.auth_user_id = auth.uid() AND p.id = profile_id)
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      JOIN public.events e ON e.id = event_invitees.event_id
      WHERE p.auth_user_id = auth.uid() AND (p.role = 'super_admin' OR p.id = ANY (e.manager_ids))
    )
    OR (
      profile_id IS NULL
      AND (
        auth.uid() IS NULL
        OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.auth_user_id = auth.uid() AND p.email = event_invitees.email)
      )
    )
  );

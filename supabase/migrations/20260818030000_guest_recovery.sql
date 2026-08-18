-- Evently: let a guest RSVP be reused/reclaimed when that person later
-- registers a real account with the same email.
-- Run once in the Supabase SQL editor, after the previous three migrations.

-- Tighten the "anyone" branch of the event_invitees UPDATE policy: an
-- authenticated user may only update a guest row (profile_id IS NULL) if it
-- matches their own profile's email - previously any authenticated user
-- could update any guest row on an "anyone" event. Anonymous (anon role)
-- submissions on "anyone" events remain unrestricted, same as before - an
-- anonymous guest has no session to prove which row is theirs, which is an
-- inherent tradeoff of allowing unauthenticated RSVPs at all.
DROP POLICY IF EXISTS "event_invitees_update_self_manager_or_guest" ON public.event_invitees;
CREATE POLICY "event_invitees_update_self_manager_or_guest"
  ON public.event_invitees FOR UPDATE
  TO anon, authenticated
  USING (
    (profile_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.profiles p WHERE p.auth_user_id = auth.uid() AND p.id = profile_id
    ))
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      JOIN public.events e ON e.id = event_invitees.event_id
      WHERE p.auth_user_id = auth.uid() AND (p.role = 'super_admin' OR p.id = ANY (e.manager_ids))
    )
    OR (
      profile_id IS NULL
      AND EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_invitees.event_id AND e.registration_mode = 'anyone')
      AND (
        auth.uid() IS NULL
        OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.auth_user_id = auth.uid() AND p.email = event_invitees.email)
      )
    )
  );

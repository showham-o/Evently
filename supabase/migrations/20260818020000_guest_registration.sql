-- Evently: allow events to accept RSVPs from non-registered guests.
-- Run once in the Supabase SQL editor, after the previous two migrations.

-- ------------------------------------------------------------------
-- 1. events.registration_mode
-- ------------------------------------------------------------------
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS registration_mode text NOT NULL DEFAULT 'registered_only'
    CHECK (registration_mode IN ('registered_only', 'anyone'));

-- ------------------------------------------------------------------
-- 2. event_invitees.age (full_name/email/phone already exist in this schema)
-- ------------------------------------------------------------------
ALTER TABLE public.event_invitees ADD COLUMN IF NOT EXISTS age integer;

-- ------------------------------------------------------------------
-- 3. Lock registration_mode once anyone has registered - enforced at the
--    DB level so it can't be bypassed by calling the API directly, not
--    just hidden in the UI.
-- ------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.prevent_registration_mode_change()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.registration_mode IS DISTINCT FROM OLD.registration_mode THEN
    IF EXISTS (SELECT 1 FROM public.event_invitees WHERE event_id = OLD.id) THEN
      RAISE EXCEPTION 'לא ניתן לשנות את הגדרת ההרשמה לאחר שמישהו נרשם לאירוע';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS prevent_registration_mode_change_trigger ON public.events;
CREATE TRIGGER prevent_registration_mode_change_trigger
  BEFORE UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.prevent_registration_mode_change();

-- ------------------------------------------------------------------
-- 4. event_invitees RLS: allow anonymous (no-session) inserts/updates for
--    guest RSVPs, but only on events with registration_mode = 'anyone', and
--    only for rows with no profile_id (i.e. an actual guest record, not
--    someone else's registered-user RSVP).
--
--    Caveat worth knowing: unlike a registered user's RSVP (tied to their
--    login), an anonymous guest has no session to prove which guest record
--    is "theirs" - so anyone can technically update any guest row on an
--    open event via a direct API call, same as they could always submit
--    one in the first place. This is inherent to allowing unauthenticated
--    RSVPs at all, not something RLS can close without adding a per-guest
--    secret token (e.g. via the existing rsvp_tokens table) - out of scope
--    for this change, flagged as a possible future hardening step.
-- ------------------------------------------------------------------
DROP POLICY IF EXISTS "event_invitees_insert_self_or_manager" ON public.event_invitees;
CREATE POLICY "event_invitees_insert_self_manager_or_guest"
  ON public.event_invitees FOR INSERT
  TO anon, authenticated
  WITH CHECK (
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
    )
  );

DROP POLICY IF EXISTS "event_invitees_update_self_or_manager" ON public.event_invitees;
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
    )
  );

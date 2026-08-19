-- Evently: the profiles_select_authenticated policy (added by the RLS
-- lockdown pass) only allows the `authenticated` role to read profiles, so
-- anonymous (logged-out) visitors get a null embedded `creator` on events -
-- the event details page then shows "created by a user no longer
-- available" even though the creator's profile exists. Fix: let `anon`
-- read profiles too, but restrict it to the two columns actually needed to
-- display a creator's name (id, full_name) - full row access (email,
-- phone, age, role) stays authenticated-only.
-- Run once in the Supabase SQL editor, after the previous migrations.

REVOKE SELECT ON public.profiles FROM anon;
GRANT SELECT (id, full_name) ON public.profiles TO anon;

DROP POLICY IF EXISTS "profiles_select_authenticated" ON public.profiles;
CREATE POLICY "profiles_select_public_name_or_authenticated"
  ON public.profiles FOR SELECT
  TO anon, authenticated
  USING (true);

-- Evently: corrective pass over the hand-written schema.
-- Run once in the Supabase SQL editor, after the schema you already applied.
--
-- Fixes, in order:
--   1. Signup trigger: bootstrap first user -> super_admin, capture phone/age.
--   2. events.manager_ids "at least 1" check (NULL-vs-empty-array bug).
--   3. events.created_by: ON DELETE CASCADE would delete an event outright
--      when its creator's account is deleted, even if co-managers remain.
--      Changed to ON DELETE SET NULL.
--   4. Missing enum values ('completed' status, 'rejected' registration).
--   5. archived_profiles.id needs a default (the app always supplies one
--      explicitly now, but this is a safety net for any other inserter).
--   6. CRITICAL: profiles currently allows any authenticated user to update
--      ANY column on their own row via a blanket USING(true) policy with no
--      column restriction - including `role`. That means any logged-in user
--      can self-promote to super_admin with a single REST call. Locked down
--      via column-level GRANTs (role is no longer directly updatable) plus
--      two security-definer RPCs that enforce who can change roles and how.
--   7. events UPDATE/DELETE and event_invitees INSERT/UPDATE were similarly
--      unrestricted (any authenticated user could edit/delete any event;
--      anon could write arbitrary invitee rows). Scoped to actual
--      owners/managers.

-- ------------------------------------------------------------------
-- 1. Signup trigger
-- ------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  is_first_user boolean;
BEGIN
  SELECT NOT EXISTS (SELECT 1 FROM public.profiles) INTO is_first_user;

  INSERT INTO public.profiles (auth_user_id, full_name, email, phone, age, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', SPLIT_PART(NEW.email, '@', 1)),
    NEW.email,
    NEW.raw_user_meta_data->>'phone',
    NULLIF(NEW.raw_user_meta_data->>'age', '')::integer,
    CASE WHEN is_first_user THEN 'super_admin' ELSE 'registered_user' END
  )
  ON CONFLICT (email) DO UPDATE
  SET auth_user_id = EXCLUDED.auth_user_id,
      phone = COALESCE(EXCLUDED.phone, public.profiles.phone),
      age = COALESCE(EXCLUDED.age, public.profiles.age);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ------------------------------------------------------------------
-- 2 & 3. events constraint + FK fixes
-- ------------------------------------------------------------------
ALTER TABLE public.events DROP CONSTRAINT IF EXISTS check_manager_count;
ALTER TABLE public.events ADD CONSTRAINT check_manager_count
  CHECK (COALESCE(array_length(manager_ids, 1), 0) BETWEEN 1 AND 3);

ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_created_by_fkey;
ALTER TABLE public.events ALTER COLUMN created_by DROP NOT NULL;
ALTER TABLE public.events ADD CONSTRAINT events_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES public.profiles (id) ON DELETE SET NULL;

-- ------------------------------------------------------------------
-- 4. Missing enum values
-- ------------------------------------------------------------------
ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_status_check;
ALTER TABLE public.events ADD CONSTRAINT events_status_check
  CHECK (status IN ('draft', 'published', 'cancelled', 'completed'));

ALTER TABLE public.event_invitees DROP CONSTRAINT IF EXISTS event_invitees_registration_status_check;
ALTER TABLE public.event_invitees ADD CONSTRAINT event_invitees_registration_status_check
  CHECK (registration_status IN ('approved', 'waiting_list', 'rejected_age', 'rejected', 'cancelled'));

-- ------------------------------------------------------------------
-- 5. archived_profiles.id default
-- ------------------------------------------------------------------
ALTER TABLE public.archived_profiles ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- ------------------------------------------------------------------
-- 6. profiles: column-level lockdown + role-change RPCs
-- ------------------------------------------------------------------
REVOKE UPDATE ON public.profiles FROM authenticated, anon;
GRANT UPDATE (full_name, email, phone, age) ON public.profiles TO authenticated;

DROP POLICY IF EXISTS "Public profiles select" ON public.profiles;
CREATE POLICY "profiles_select_authenticated"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Public profiles update" ON public.profiles;
CREATE POLICY "profiles_update_self"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth_user_id = auth.uid());

-- Self-elevation on event creation: registered_user -> event_manager only.
CREATE OR REPLACE FUNCTION public.elevate_to_event_manager()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
  SET role = 'event_manager'
  WHERE auth_user_id = auth.uid() AND role = 'registered_user';
END;
$$;

GRANT EXECUTE ON FUNCTION public.elevate_to_event_manager() TO authenticated;

-- Admin promote/demote: caller must already be super_admin.
CREATE OR REPLACE FUNCTION public.admin_set_role(target_profile_id uuid, new_role text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_role text;
BEGIN
  SELECT role INTO caller_role FROM public.profiles WHERE auth_user_id = auth.uid();

  IF caller_role IS DISTINCT FROM 'super_admin' THEN
    RAISE EXCEPTION 'only super_admin can change roles';
  END IF;

  IF new_role NOT IN ('event_manager', 'registered_user') THEN
    RAISE EXCEPTION 'invalid role';
  END IF;

  UPDATE public.profiles SET role = new_role WHERE id = target_profile_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_set_role(uuid, text) TO authenticated;

-- ------------------------------------------------------------------
-- 7. events / event_invitees policy tightening
-- ------------------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated events insert" ON public.events;
CREATE POLICY "events_insert_non_guest"
  ON public.events FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.auth_user_id = auth.uid() AND p.role <> 'guest')
  );

DROP POLICY IF EXISTS "Authenticated events update" ON public.events;
CREATE POLICY "events_update_managers"
  ON public.events FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.auth_user_id = auth.uid() AND (p.role = 'super_admin' OR p.id = ANY (manager_ids))
    )
  );

DROP POLICY IF EXISTS "Authenticated events delete" ON public.events;
CREATE POLICY "events_delete_managers"
  ON public.events FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.auth_user_id = auth.uid() AND (p.role = 'super_admin' OR p.id = ANY (manager_ids))
    )
  );

DROP POLICY IF EXISTS "Public invitees all" ON public.event_invitees;

CREATE POLICY "event_invitees_select_public"
  ON public.event_invitees FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "event_invitees_insert_self_or_manager"
  ON public.event_invitees FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.auth_user_id = auth.uid() AND p.id = profile_id)
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      JOIN public.events e ON e.id = event_invitees.event_id
      WHERE p.auth_user_id = auth.uid() AND (p.role = 'super_admin' OR p.id = ANY (e.manager_ids))
    )
  );

CREATE POLICY "event_invitees_update_self_or_manager"
  ON public.event_invitees FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.auth_user_id = auth.uid() AND p.id = profile_id)
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      JOIN public.events e ON e.id = event_invitees.event_id
      WHERE p.auth_user_id = auth.uid() AND (p.role = 'super_admin' OR p.id = ANY (e.manager_ids))
    )
  );

-- Not addressed in this pass (flagged, not fixed): event_logistics and
-- rsvp_tokens still have unrestricted "FOR ALL ... USING (true)" policies
-- for anon+authenticated. No app code touches either table yet, so this is
-- latent rather than actively exploitable through the app - worth locking
-- down before building features against them.

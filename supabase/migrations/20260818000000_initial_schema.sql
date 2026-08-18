-- Evently: full initial schema for a fresh Supabase project.
-- Run once in the Supabase SQL editor (or via `supabase db push`).
-- This replaces the old incremental migration - there is no pre-existing
-- schema to build on top of anymore.

create extension if not exists pgcrypto;

-- --- profiles ---
create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique references auth.users (id) on delete cascade,
  full_name text not null,
  email text not null unique,
  phone text,
  age integer,
  role text not null default 'registered_user'
    check (role in ('super_admin', 'event_manager', 'registered_user', 'guest')),
  created_at timestamptz not null default now()
);

create index profiles_role_idx on public.profiles (role);

-- --- events ---
create table public.events (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references public.profiles (id),
  title text not null,
  description text,
  location text,
  event_date timestamptz not null,
  status text not null default 'draft'
    check (status in ('draft', 'published', 'cancelled', 'completed')),
  max_capacity integer,
  minimum_age integer,
  manager_ids uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  -- array_length() returns NULL (not 0) for an empty array, hence the coalesce.
  constraint events_manager_ids_count_check
    check (coalesce(array_length(manager_ids, 1), 0) between 1 and 3)
);

create index events_manager_ids_gin_idx on public.events using gin (manager_ids);
create index events_status_idx on public.events (status);

-- --- event_invitees ---
create table public.event_invitees (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  rsvp_status text not null check (rsvp_status in ('attending', 'not_attending', 'maybe')),
  registration_status text not null default 'approved'
    check (registration_status in ('approved', 'waiting_list', 'rejected_age', 'rejected', 'cancelled')),
  registration_source text not null default 'web',
  created_at timestamptz not null default now(),
  unique (event_id, profile_id)
);

create index event_invitees_event_id_idx on public.event_invitees (event_id);

-- --- archived_profiles ---
create table public.archived_profiles (
  id uuid primary key default gen_random_uuid(),
  original_profile_id uuid,
  full_name text,
  email text not null,
  phone text,
  age integer,
  archived_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '1 year')
);

create index archived_profiles_email_idx on public.archived_profiles (email);

-- --- Bootstrap trigger: first person to ever register becomes super_admin ---
-- Reads full_name/phone/age from the auth signup call's options.data metadata
-- (see supabase.auth.signUp in RegisterPage.tsx). Runs inside the same
-- transaction as the auth.users insert, so the profiles row exists by the
-- time the client's signUp() call returns.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  is_first_user boolean;
begin
  select not exists (select 1 from public.profiles) into is_first_user;

  insert into public.profiles (auth_user_id, full_name, email, phone, age, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.email),
    new.email,
    new.raw_user_meta_data ->> 'phone',
    nullif(new.raw_user_meta_data ->> 'age', '')::integer,
    case when is_first_user then 'super_admin' else 'registered_user' end
  )
  on conflict (auth_user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- --- Row Level Security ---
-- A reasonable starting point given the app's client-side role checks.
-- Review before relying on this in a real production deployment.

alter table public.profiles enable row level security;
alter table public.events enable row level security;
alter table public.event_invitees enable row level security;
alter table public.archived_profiles enable row level security;

-- profiles: readable by any authenticated user (needed for invitee lists,
-- admin listing, co-manager lookup by email); a user may update their own
-- row; a super_admin may update any row (promote/demote).
create policy "profiles_select_authenticated"
  on public.profiles for select
  to authenticated
  using (true);

create policy "profiles_update_self_or_admin"
  on public.profiles for update
  to authenticated
  using (
    auth_user_id = auth.uid()
    or exists (select 1 from public.profiles p where p.auth_user_id = auth.uid() and p.role = 'super_admin')
  );

-- profiles insert is normally handled by the trigger (security definer,
-- bypasses RLS). No insert policy is defined for anon/authenticated.

-- events: publicly readable (home page browses without login); managers or
-- super_admin may insert/update.
create policy "events_select_public"
  on public.events for select
  to anon, authenticated
  using (true);

create policy "events_insert_authenticated"
  on public.events for insert
  to authenticated
  with check (
    exists (select 1 from public.profiles p where p.auth_user_id = auth.uid() and p.role <> 'guest')
  );

create policy "events_update_managers"
  on public.events for update
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.auth_user_id = auth.uid()
        and (p.role = 'super_admin' or p.id = any (manager_ids))
    )
  );

-- event_invitees: readable by anyone (capacity counts show on public event
-- pages without login); a user may insert/update their own RSVP; event
-- managers may update any invitee row for their events (approve/reject).
create policy "event_invitees_select_public"
  on public.event_invitees for select
  to anon, authenticated
  using (true);

create policy "event_invitees_insert_self"
  on public.event_invitees for insert
  to authenticated
  with check (
    exists (select 1 from public.profiles p where p.auth_user_id = auth.uid() and p.id = profile_id)
  );

create policy "event_invitees_update_self_or_manager"
  on public.event_invitees for update
  to authenticated
  using (
    exists (select 1 from public.profiles p where p.auth_user_id = auth.uid() and p.id = profile_id)
    or exists (
      select 1 from public.profiles p
      join public.events e on e.id = event_invitees.event_id
      where p.auth_user_id = auth.uid()
        and (p.role = 'super_admin' or p.id = any (e.manager_ids))
    )
  );

-- archived_profiles: read is public (queried pre-signup, before a session
-- exists, to pre-fill the registration form); delete requires
-- authentication (cleanup after a successful re-registration). Inserts
-- happen only via the delete-account Edge Function's service-role key.
create policy "archived_profiles_select_anon"
  on public.archived_profiles for select
  to anon, authenticated
  using (true);

create policy "archived_profiles_delete_authenticated"
  on public.archived_profiles for delete
  to authenticated
  using (true);

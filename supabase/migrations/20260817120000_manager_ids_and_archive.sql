-- Evently: multi-manager events + profile archiving
-- Run this once in the Supabase SQL editor (or via `supabase db push` if the
-- CLI is linked to this project). Safe to re-run: uses IF NOT EXISTS guards
-- where practical, but review before running on a database with existing data.

-- 1. events.manager_ids: up to 3 managers per event, always at least 1.
alter table public.events
  add column if not exists manager_ids uuid[] not null default '{}';

-- Backfill existing rows: every event's creator becomes its sole manager.
update public.events
set manager_ids = array[created_by]
where coalesce(array_length(manager_ids, 1), 0) = 0
  and created_by is not null;

-- Enforce 1..3 managers. array_length() returns NULL (not 0) for an empty
-- array, so it's coalesced before comparing.
alter table public.events
  drop constraint if exists events_manager_ids_count_check;
alter table public.events
  add constraint events_manager_ids_count_check
  check (coalesce(array_length(manager_ids, 1), 0) between 1 and 3);

create index if not exists events_manager_ids_gin_idx
  on public.events using gin (manager_ids);

-- The old JSONB co_managers column is superseded by manager_ids and is no
-- longer read by the app. Left in place (not dropped) since dropping a
-- column is destructive - drop it yourself once you've confirmed nothing
-- else depends on it:
--   alter table public.events drop column co_managers;

-- 2. archived_profiles: soft-retention for deleted accounts (1 year).
create table if not exists public.archived_profiles (
  id uuid primary key default gen_random_uuid(),
  original_profile_id uuid,
  full_name text,
  email text not null,
  phone text,
  age integer,
  archived_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '1 year')
);

create index if not exists archived_profiles_email_idx
  on public.archived_profiles (email);

-- --- Row Level Security ---
-- These are a reasonable starting point given the app's current auth model
-- (client-side role checks backed by RLS). Review before relying on them in
-- production - in particular, the archived_profiles read policy is
-- intentionally public (unauthenticated) because it's queried during
-- registration before a session exists, which means email existence in the
-- archive table is discoverable by anyone who queries it directly.

alter table public.archived_profiles enable row level security;

drop policy if exists "archived_profiles_select_anon" on public.archived_profiles;
create policy "archived_profiles_select_anon"
  on public.archived_profiles for select
  to anon, authenticated
  using (true);

drop policy if exists "archived_profiles_delete_authenticated" on public.archived_profiles;
create policy "archived_profiles_delete_authenticated"
  on public.archived_profiles for delete
  to authenticated
  using (true);

-- Inserts into archived_profiles happen only from the delete-account Edge
-- Function, which uses the service-role key and therefore bypasses RLS -
-- no insert policy is defined for anon/authenticated on purpose.

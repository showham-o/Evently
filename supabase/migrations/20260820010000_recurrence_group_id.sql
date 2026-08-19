-- Evently: group recurring-event occurrences so listings can display the
-- series once instead of one card per occurrence.
-- Run once in the Supabase SQL editor, after the previous migrations.

ALTER TABLE public.events ADD COLUMN IF NOT EXISTS recurrence_group_id uuid;

CREATE INDEX IF NOT EXISTS events_recurrence_group_id_idx ON public.events (recurrence_group_id);

-- Backfill: recurring series created before this column existed have
-- recurrence_label set but no recurrence_group_id, so the app can't tell
-- their occurrences apart from unrelated events - group them now by
-- (title, created_by, recurrence_label), which is what actually identifies
-- "the same series" for events created before this column existed.
with legacy_groups as (
  select distinct title, created_by, recurrence_label
  from public.events
  where recurrence_label is not null and recurrence_group_id is null
),
assigned as (
  select title, created_by, recurrence_label, gen_random_uuid() as gid
  from legacy_groups
)
update public.events e
set recurrence_group_id = a.gid
from assigned a
where e.recurrence_label is not null
  and e.recurrence_group_id is null
  and e.title = a.title
  and e.recurrence_label = a.recurrence_label
  and e.created_by is not distinct from a.created_by;

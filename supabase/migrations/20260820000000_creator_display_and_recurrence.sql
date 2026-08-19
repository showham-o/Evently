-- Evently: support displaying the event creator, and a descriptive label
-- for recurring events created as a batch of independent occurrences.
-- Run once in the Supabase SQL editor, after the previous migrations.

ALTER TABLE public.events ADD COLUMN IF NOT EXISTS recurrence_label text;

-- events.created_by already references public.profiles(id) - no new FK
-- needed, this just documents that the app now reads it via an embedded
-- PostgREST select (profiles!created_by(...)) to show "Created by" on the
-- event details page, event cards, and the manager dashboard.

# Evently — Session Notes

Running summary of what's been built, key decisions, and what's still
outstanding. Not permanent project documentation — a handoff/reference doc
kept up to date across this build.

## Current Supabase project

**This is the second Supabase project** — the original (`xcvwthvfmuibqobjhktr`)
was deleted and recreated with the same app name partway through the build.

- URL: `https://gpnykvehqrqrqujbxnym.supabase.co`
- `.env` / `.env.example` point at it (anon key only — the service-role key
  is never in client code, see Edge Function section below)
- Schema was **hand-written by the project owner**, not by the migration
  files under `supabase/migrations/`. `20260818000000_initial_schema.sql`
  is a reference copy of what an equivalent from-scratch schema would look
  like — it was never actually run, since the owner had already applied
  their own version first. The three migrations after it (`010000` fixes,
  `020000` guest registration, `030000` guest recovery) plus
  `20260819000000_event_logistics_lockdown.sql` are real corrective/additive
  migrations layered on top of that hand-written schema, and **all four have
  been run** (confirmed).

## Stack

React + Vite + TypeScript + Tailwind v3 + Rubik font + indigo/teal palette,
Supabase (`@supabase/supabase-js`), `react-router-dom`, `sonner` for toasts.
Full RTL Hebrew UI (`dir="rtl" lang="he"`). Dev server: `npm run dev` →
`http://localhost:5173`. Repo: `https://github.com/showham-o/Evently`
(`main`).

## What's built

**Public/auth**: Home (event browse), Login, Register (with archive- and
guest-history recovery pre-fill, see below), `/forgot-password` +
`/reset-password` (email-based; phone reset deferred — needs a paid SMS
provider not yet configured), `/profile` (self-service name/email/password
edit + account deletion).

**Events**: Event Details/RSVP (`/e/:id`), manager dashboard (create/edit/
**delete**), co-manager panel (up to 3 managers per event, self-removal
guarded so an event is never left with zero managers), invitee management
table, **logistics/suppliers panel** (add/edit/delete items via a modal —
item, supplier, quantity, cost, status), **guest registration** (events can
be opened to non-registered visitors, who RSVP with name/email/phone/age;
their details are reused if they later create a real account and their RSVP
gets linked to the new profile), `/admin` (super_admin only — promote/
demote, force-delete via the Edge Function).

**RSVP rules**: capacity + minimum-age gating (`utils/rsvp.ts`), computed
client-side — known race condition on capacity right at the limit, flagged
but not fixed (would need a Postgres RPC/transaction to close fully).
Registered users get three RSVP options (attending/declined/maybe); guests
only get two (attending/declined — no "maybe" for unregistered visitors).

**Validation**: shared email/phone validators (`utils/validation.ts`),
used in Register, the guest RSVP form, and the profile page. Name, email,
phone, and age are mandatory on both registration forms.

**Core auth-flicker bug** (from the very first build, still valid): fixed
via `AuthProvider` (`src/context/AuthProvider.tsx`) — `loading` only flips
to `false` once, after the *first* session + profile resolution, and every
page checks `loading` before `user`.

## Security work (important context for future changes)

The hand-written schema had a **critical privilege-escalation hole**: any
authenticated user could update *any* column on their own `profiles` row via
a blanket RLS policy — including `role`, letting them self-promote to
`super_admin` with a single REST call. Fixed via column-level `GRANT`s
(role is no longer directly updatable by anyone) plus two
`SECURITY DEFINER` RPCs that are now the only legitimate paths to a role
change:
- `elevate_to_event_manager()` — self-service, registered_user → event_manager, called when a user creates their first event
- `admin_set_role(target_profile_id, new_role)` — checks the caller is super_admin server-side

Also fixed: `events.manager_ids` "at least 1 manager" check had a NULL-vs-
empty-array bug that let it silently pass on an empty array; `events.created_by`
was `ON DELETE CASCADE` (deleting a user would delete every event they ever
created, even ones with active co-managers) — changed to `ON DELETE SET NULL`;
several tables (`event_invitees`, `event_logistics`) had `USING (true)` for
anon/authenticated, since nothing used them yet — narrowed to the actual
access each table needs (public read where the UI genuinely needs it, e.g.
capacity counts; manager-only for logistics/supplier data).

**Still not addressed**: `rsvp_tokens` table exists in the schema but is
unused and still has a permissive policy — no app code touches it yet, so
it's latent rather than exploitable through the app, but worth locking down
before building anything against it.

## Account deletion / Edge Function

Self-deletion and admin force-delete both need the Supabase **service-role
key**, which must never ship in client code. Built as
`supabase/functions/delete-account/` (archive → reassign orphaned events →
delete profile → delete auth user, destructive steps last).

### ⚠️ Outstanding: **not yet confirmed deployed** on the current project.
```
supabase login
supabase link --project-ref gpnykvehqrqrqujbxnym
supabase functions deploy delete-account
```
Until this is done, account deletion (self-service and admin force-delete)
fails with "Failed to send a request to the Edge Function" — confirmed via
a live test call.

## The "first user becomes super_admin" trigger

Not something originally written by this build — discovered on the first
Supabase project, then deliberately recreated (`handle_new_user()`) on the
second project per the owner's choice, along with fixing it to also capture
`phone`/`age` from signup metadata (the version pasted in for the second
project didn't do either).

## Known test-account cleanup debt

Verification passes this session registered a number of throwaway accounts
(`verify*`, `mgr-dbg*`, `mgr-logi*`, etc.). Their **events were deleted**
(each manager has DELETE rights on their own event via RLS, so this could be
done directly). Their **profiles/auth accounts could not be deleted** —
that requires the Edge Function (not deployed) or manual cleanup:
```sql
delete from public.profiles where email like 'verify%@example.com'
   or email like 'mgr-%@example.com' or email like '%guest%@example.com'
   or email like 'third-dbg4%@example.com' or email like 'recovered-guest%@example.com';
```
Then remove the same accounts under Authentication → Users. Real data (the
project owner's own `showham@walla.co.il` account and any events created
through normal use) was never touched by any cleanup pass.

## Known gotchas / open items for later

- RLS on `event_logistics` and the tightened `event_invitees` policies are
  reasonable-but-unaudited-in-depth — a dedicated review pass would be worth
  it before this goes to real users.
- Supabase's default/shared auth email sender has a low rate limit — hit
  repeatedly during testing (signup confirmation emails, password recovery).
  For reliable production email, configure custom SMTP in Supabase Auth
  settings.
- `rsvp_tokens` table is unused and still permissively policied (see above).
- Capacity-check race condition in RSVP submission (client-side
  read-then-write) — would need a Postgres RPC to fully close.
- RTL bidi gotcha to remember for any future numeric fraction display
  (e.g. "3 / 10"): wrap it in `dir="ltr"` or it renders visually reversed
  inside RTL text — this bit the attendee-count display once already.

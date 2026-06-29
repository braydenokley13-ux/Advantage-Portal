# The Advantage Writers League

A season-based competitive writing system built into the portal. Student
writers submit pieces, a rotating editorial board reviews them, and points are
awarded **automatically** — every transition is driven by database triggers and
Next.js API routes, with zero manual point entry. This document is the map.

## At a glance

| Concern | Where it lives |
| --- | --- |
| Schema, triggers, RLS, realtime, view | `supabase/migrations/0020_writers_league.sql` |
| Board roster, point values, journal inbox | `lib/league/config.ts` |
| Types + row→app mappers | `lib/league/types.ts` |
| Editor rotation (pure) | `lib/league/assign.ts` (+ `.test.ts`) |
| Overdue scanner (pure) | `lib/league/overdue.ts` (+ `.test.ts`) |
| Branded HTML emails | `emails/league-templates.ts` |
| Email orchestration (CC rules) | `lib/league/emails.ts` |
| Board auth + standings helpers | `lib/league/server.ts` |
| Submission intake | `app/api/league/submissions/route.ts` |
| Status change | `app/api/league/submissions/[id]/status/route.ts` |
| Feature on homepage | `app/api/league/submissions/[id]/feature/route.ts` |
| Weekly awards | `app/api/league/awards/route.ts` |
| Overdue cron (08:00) | `app/api/cron/league-overdue/route.ts` |
| Public leaderboard | `app/league/page.tsx` |
| Public submission form | `app/league/submit/page.tsx` |
| Board admin | `app/(app)/admin/league/page.tsx` |

## Data model

Six tables (all `public`):

- **`writers`** — the league roster. Independent of `public.users`: writers are
  students who may never hold a portal account. `is_active` flips `true` on
  their first published piece.
- **`league_submissions`** — one row per submitted piece. Named with the
  `league_` prefix to avoid colliding with the existing newsroom `submissions`
  table. Carries the assigned editor, status, editor feedback, the homepage
  `featured_at` marker, and three `*_sent_at` columns the overdue cron uses to
  de-dupe.
- **`league_points`** — a materialised per-writer aggregate (total, published
  count, award count, feature count). **Never written by hand.**
- **`point_events`** — the immutable audit trail: one row for every point ever
  awarded, with the source submission/award.
- **`seasons`** — named seasons; exactly one `is_active`. Drives the leaderboard
  header. `season_id` is stamped on every points-bearing row so history is
  preserved across seasons (the system scales to many seasons with no schema
  change).
- **`weekly_awards`** — one row per award handed out.

## The points pipeline (why it can never drift)

`point_events` is the **single source of truth**. Everything funnels through it:

```
publish a submission ─┐
feature a submission ─┼─► INSERT point_events ─► tg_point_event_aggregate ─► league_points
record a weekly award ┘        (audit trail)         (one trigger)            (leaderboard)
```

- `tg_league_submission_published` — on the `→ published` transition, inserts a
  100-point event and flips the writer active.
- `tg_league_submission_featured` — on `featured_at` null→set, inserts a
  25-point event.
- `tg_weekly_award_points` — on a `weekly_awards` insert, inserts a 50-point
  event.
- `tg_point_event_aggregate` — the only thing that touches `league_points`,
  folding each event into the right counter.

Because the aggregate is derived from the audit trail by trigger, the
leaderboard total and the point history can never disagree, and there is no code
path that awards points "manually."

## Submission flow

1. A student submits at `/league/submit` → `POST /api/league/submissions`.
2. The route upserts the writer by email, assigns a board editor by round-robin
   rotation (`assignEditorByRotation`), and inserts the submission as
   `under_review`.
3. Two emails go out: a confirmation to the writer (CC journal) and a full
   notification to the journal inbox.

## Status automation

All status changes go through `POST /api/league/submissions/[id]/status`, which
the board admin is the only UI for — so points and emails are never bypassed.

- **published** → trigger awards 100 pts + activates the writer; the route emails
  the writer a celebration with their live total and rank, and notifies the
  journal with the same standings.
- **rejected** → the route emails the writer a warm, encouraging note that
  includes the editor's feedback when present, and notifies the journal.
- **approved / under_review** → no email (intermediate states).

`POST /api/league/submissions/[id]/feature` (25 pts) and `POST
/api/league/awards` (50 pts each, up to three winners + a journal summary) work
the same way: the trigger moves points, the route sends the mail.

## Overdue system

`/api/cron/league-overdue` runs at **08:00** (`vercel.json`; a free hourly
GitHub Actions backstop is in `.github/workflows/league-overdue.yml`). For each
piece still `under_review`:

- **> 5 days** → reminder to the assigned editor
- **> 7 days** → escalation to the journal inbox
- **≥ 10 days** → urgent escalation to the journal inbox

The decision logic (including "never the same nudge twice in one day") is the
pure `scanOverdueSubmissions` scanner; the cron stamps `reminder_sent_at` /
`escalation_sent_at` / `urgent_escalation_sent_at` after each send. It is
protected by `CRON_SECRET`.

## Emails

Every template (`emails/league-templates.ts`) is branded HTML with the Advantage
Journal wordmark, a gold accent for points/awards, the writer's name used
personally, and a clear subject line. `lib/league/emails.ts` enforces the league
mail rules in one place:

- **Every email to a writer is CC'd to `theadvantagejournal@gmail.com`** for a
  complete paper trail.
- Most events also send a separate, richer notification straight to the journal.

Delivery is best-effort: an unconfigured or failing send is logged and counted
but never throws, so a mail hiccup can't undo committed database work.

## Privacy

The public `/league` page reads the `league_leaderboard` **view**, which exposes
only competition-safe columns (name, school, totals). Writer emails and grades
live on the `writers` base table, which is readable by leaders/admins only. The
aggregate tables (`league_points`, `point_events`, `weekly_awards`, `seasons`)
carry no PII and are world-readable so the leaderboard and its realtime
subscription work with the anon key.

## Setup checklist

1. Apply `supabase/migrations/0020_writers_league.sql` (creates tables,
   triggers, RLS, the view, realtime, and a seeded "Season 1").
2. Set email env (`.env.example`): `EMAIL_FROM_ADDRESS` + Gmail credentials for
   the league sender.
3. Set `CRON_SECRET`; Vercel Cron picks up the 08:00 schedule automatically.
   Optionally add `LEAGUE_OVERDUE_URL` + `CRON_SECRET` repo secrets for the
   GitHub Actions backstop.
4. Edit the board roster and point values in `lib/league/config.ts` if needed.

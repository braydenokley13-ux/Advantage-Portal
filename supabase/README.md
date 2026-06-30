# Supabase migrations

This directory holds the SQL schema for the Advantage Journal portal and a demo seed file. The schema mirrors the in-memory store so the application's adapter layer (`lib/api/supabase-adapter.ts`) can swap in transparently.

## Files

- `migrations/0001_init.sql` — initial schema: enums, tables, indexes, triggers, RLS policies (MVP-grade).
- `migrations/0002_newsroom_workflow.sql` — newsroom workflow tables (sections, issues, pitches, slots, checklists, sensitive flags) and optional task columns.
- `migrations/0003_newsroom_rls.sql` — RLS policies for the newsroom workflow tables.
- `migrations/0004_auth_user_sync.sql` — trigger that mirrors every new `auth.users` row into `public.users` so RLS and `current_app_role()` work after signup. Required before enabling Supabase Auth in production.
- `migrations/0012_submission_review_rpc.sql` — atomic `create_submission` / `create_review` RPCs (SECURITY DEFINER). They run the whole submission/review → task-status transition in one transaction and authorize the writer/editor in-function, so the task status advances even though `tasks_write` is leader/admin-only. The app prefers these and falls back to direct writes when they aren't deployed.
- `migrations/0013_submission_review_triggers.sql` — **required** SECURITY DEFINER triggers that advance a task's status when a submission or review is inserted (submission → `submitted`; review → `complete` / `in_progress`). Without this (or 0012), a writer's submission and an assigned editor's review are saved but the task never moves under RLS, so the portal never recognizes the work as submitted/reviewed. Idempotent with 0012 — apply both.
- `migrations/0015_article_archive.sql` — the `article_archive` view: one live, RLS-respecting row per story (task) joined to its section, issue, byline, length, and latest submission. Backs the in-app Archive and is queryable directly. `security_invoker` makes it honour each querying user's row-level security, so it exposes exactly the stories that user can already see.
- `migrations/0020_writers_league.sql` — The Advantage Writers League: `writers`, `league_submissions` (named to avoid the existing `submissions` table), `league_points`, `point_events`, `seasons`, and `weekly_awards`. `point_events` is the single source of truth for scoring; one aggregate trigger folds every event into `league_points`, and higher-level triggers turn a "published" status, a homepage feature, and a weekly award into 100/25/50-point events automatically (zero manual point entry). The public `league_leaderboard` view exposes only competition-safe columns (name, school, totals) to the anon role while writer emails/grades stay locked to leaders/admins. The no-PII aggregate tables are added to the realtime publication so the `/league` leaderboard updates live. See `docs/writers-league.md`.
- `seed.sql` / `seed_newsroom.sql` — optional demo data for poking around before real users exist.

> ⚠️ Run the seed files only against dev / staging projects. They overwrite section metadata. There is no production guard in the SQL — gate it with your env.

## Apply locally with the Supabase CLI

```bash
# one-time
npm i -D supabase
npx supabase login
npx supabase init                    # creates ./supabase/config.toml if missing
npx supabase link --project-ref <your-ref>

# apply the migration to the linked project
npx supabase db push

# load the demo seed (optional)
psql "$SUPABASE_DB_URL" -f supabase/seed.sql
```

If you prefer the SQL editor in the dashboard, paste `migrations/0001_init.sql` and run it; then optionally paste `seed.sql`.

## Running the app against Supabase

Set `NEXT_PUBLIC_DATA_MODE=supabase` plus the Supabase env vars (see `.env.example`). With those set, the app's `ApiClientProvider` activates the Supabase adapter. With them unset (or `NEXT_PUBLIC_DATA_MODE=mock`), the in-memory mock store is used — no Supabase round-trip occurs.

If `NEXT_PUBLIC_DATA_MODE=supabase` but the env vars are missing or invalid, the provider logs a console warning and falls back to mock so the dev server stays usable.

## RLS posture

The MVP policies in `0001_init.sql` are intentionally narrow on reads (per-role scoping) and broad on writes (any authenticated user can write rows their role permits). The application-layer permission helpers in `lib/permissions.ts` are the second line of defense. Tighten the write policies in a follow-up migration once the production permission matrix is locked in.

The moderation reports table has the strictest read policy: only `leader` or `admin` roles can read. Inserts are allowed for any reporter. Status changes (`open` → `in_review` → `resolved` / `dismissed`) are restricted to leaders/admins.

## Adding a new migration

Follow zero-padded numeric prefixes:

```
supabase/migrations/0001_init.sql
supabase/migrations/0002_<descriptive_slug>.sql
```

Never rewrite a previously-applied migration; add a new one that performs the change.

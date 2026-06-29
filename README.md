# Advantage Portal

A newsroom operating system for **The Advantage** — a student publication. It runs the
editorial pipeline end to end: pitches → assignments → submissions → reviews → issues, plus
team messaging, notifications, moderation, an essay-competition platform, a feedback queue,
and an admin-configurable workflow.

## Tech stack

- **Next.js 16** (App Router) + **React 19** + **TypeScript** (strict)
- **Supabase** (Postgres + Auth + Realtime) — the single backend
- **Tailwind CSS** with shadcn/Radix UI primitives, Lucide icons, Framer Motion
- **Zod** contracts, **Vitest** for unit tests, **Nodemailer** for transactional email

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in Supabase + SMTP values
npm run dev                  # http://localhost:3000
```

The app is Supabase-only and "fails loud": without valid Supabase env vars the UI renders a
clear misconfiguration state instead of fake data. Set at minimum:

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server routes), SMTP vars for email (see `.env.example`)

### Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` / `npm run start` | Production build / serve |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run test` | Vitest unit tests |

## Database & migrations

SQL migrations live in `supabase/migrations/` and run in order. Apply them to your project with
the Supabase CLI (`supabase db push`) or by pasting each file into the SQL editor. Seed demo data
with `supabase/seed.sql` then `supabase/seed_newsroom.sql`.

Recent migrations:

- `0016_notification_kinds.sql` — adds `feedback` + `competition` notification kinds
- `0017_app_settings.sql` — single-row site configuration table
- `0018_feedback.sql` — feedback submissions + triage
- `0019_competitions.sql` — competitions, entries, and rubric scores

## Architecture

A clean, layered data flow — UI never touches the database directly:

```
SQL migrations → Zod contracts (lib/contracts) → TS types (lib/types)
  → ApiClient interface (lib/api/client.ts) → SupabaseApiClient (lib/api/supabase-adapter.ts)
  → StoreProvider cache (lib/store.tsx) + data hooks (lib/hooks) → pages & components
```

- **Pages** live under `app/(app)/` (protected) with route groups; `middleware.ts` guards auth.
- **Self-asserted writes** (a user acting as themselves) go through `useApiClient()`, which
  carries the signed-in user id; broad reads/caches go through the store.
- **Realtime**: `useRealtimeRefetch([...tables], refetch)` keeps live surfaces in sync.
- **Permissions**: small role-gate helpers in `lib/permissions.ts`; Postgres RLS is the
  second line of defense.

## Features

- **Task board & reviews** — kanban workflow, submissions, editor decisions, comments.
- **Newsroom** — pitches, issues/run-sheets, editorial checklists, sensitive-story escalations.
- **Essay competitions** (`/competitions`) — members submit one essay per competition; editors
  and leaders score entries against a rubric (blind until announced); a leaderboard ranks by
  average score and a leader announces the winner.
- **Feedback** — a top-bar button lets anyone send feedback on anything; leaders/admins triage
  it at `/admin/feedback`.
- **Messaging, announcements, notifications, moderation, team & archive.**

## Configuration (Admin → Settings)

`/admin/settings` makes the portal configurable without a redeploy. Settings are stored as a
single JSON row (`app_settings`) and deep-merged over `lib/site-config-defaults.ts`:

- **Branding** — name, tagline, and accent gradient (no more hardcoded "Advantage Newsroom").
- **Features** — turn competitions/feedback on or off (per role).
- **Statuses** — rename the four task statuses and tune their colour and next-step copy.
- **Checklist** — edit the seeded editorial checklist items per group.
- **Notifications** — set which notification kinds email by default (members still override).

`SiteConfigProvider` exposes the resolved config via `useSiteConfig()` and pushes workflow
overrides into the dependency-free policy modules.

> Future opportunity: surface open competitions and a "give feedback" prompt directly on the
> dashboard.

## Testing

```bash
npm run typecheck && npm run lint && npm run test
```

Unit tests cover the contracts, status taxonomy, notification policy, competition scoring math
(`lib/competition.test.ts`), and the site-config resolvers (`lib/site-config.test.ts`).

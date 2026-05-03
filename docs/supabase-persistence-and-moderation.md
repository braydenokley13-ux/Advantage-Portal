# Supabase persistence + moderation queue (Phase 2)

This phase wires the Advantage Journal portal to Supabase persistence behind a runtime data-mode switch and ships a real moderation queue for teen-safety reports. The in-memory mock store stays untouched as a fallback for offline development; nothing about the existing UI/architecture was rewritten.

---

## What was implemented

- **Schema**: `supabase/migrations/0001_init.sql` covering every entity in `lib/types.ts` plus moderation reports and an audit-events table. Uses Postgres enums for status fields, has an `updated_at` trigger, defines indexes for the hot queries, and ships MVP-grade RLS policies.
- **Demo seed**: `supabase/seed.sql` mirrors the in-memory mock so a fresh project demos identically.
- **Supabase clients**: `lib/supabase/{env,browser,server}.ts`. `env.ts` validates configuration and forces a graceful downgrade to mock when supabase mode is requested but credentials are missing or malformed.
- **SupabaseAdapter**: `lib/api/supabase-adapter.ts` implements the typed `ApiClient` against the schema. Bidirectional snake_case ↔ camelCase translation; priority workflows (tasks, extensions, messages, moderation reports, notifications) are fully wired.
- **Provider switch**: `lib/api/provider.tsx` selects `MockApiClient` or `SupabaseApiClient` based on `NEXT_PUBLIC_DATA_MODE`. Mock fallback never breaks the UI; a single console warning surfaces the downgrade reason for developers.
- **Moderation reports model**: new `ModerationReport` type, Zod contract, and `moderation_reports` table. Reporter-message dedup is enforced in both the mock store and Postgres (unique index on `(message_id, reporter_id)`).
- **`/admin/moderation` queue**: leaders + admins triage reported messages. Filters, stat cards, row selection with bulk actions, and a detail dialog that supports decisions (Mark in review / Resolve / Dismiss), hide-message, internal-note audit trail, and safety-guidance copy.
- **Real report flow**: chat-view's per-message Report button now opens a reason-picker dialog (Inappropriate language / Bullying or harassment / Personal info / Off-topic or spam / Other) with an optional note. Submission calls `api.createModerationReport`. Hidden messages render `[message hidden by a moderator]` to non-moderators.
- **Sidebar nav** picks up a Moderation entry for leader + admin roles.

---

## Supabase setup steps

1. Create a Supabase project. Note the **Project URL** and **anon public key** under *Project Settings → API*.
2. Apply the schema:

   ```bash
   # via the CLI
   npx supabase login
   npx supabase link --project-ref <your-ref>
   npx supabase db push     # applies supabase/migrations/0001_init.sql
   psql "$SUPABASE_DB_URL" -f supabase/seed.sql   # optional demo data
   ```

   Or paste `supabase/migrations/0001_init.sql` (and optionally `supabase/seed.sql`) into the Supabase SQL editor.

3. Copy `.env.example` to `.env.local` and fill in the values. To run against Supabase set `NEXT_PUBLIC_DATA_MODE=supabase`.

4. Restart `npm run dev`. The provider will pick up the data mode at boot.

### Required env vars

| Variable | Purpose | Public? |
|---|---|---|
| `NEXT_PUBLIC_DATA_MODE` | `mock` (default) or `supabase` | yes |
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL | yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Anon API key | yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only; invites, server actions | NO |
| `SUPABASE_DB_URL` | Postgres URL for migrations / psql | NO |
| `NEXT_PUBLIC_APP_URL` | Used for auth redirect URLs | yes |

The build/dev server runs without any of these set; the app will operate in mock mode.

---

## Tables created

| Table | Purpose |
|---|---|
| `users` | App profiles (mirrors `auth.users`) |
| `tasks` | Assignments with `wordCountTarget`, `citationsRequired`, `current_submission_id` |
| `submissions` | Versions of a task's draft (file / google_doc / inline) |
| `reviews` | Editor decisions on a submission |
| `comments` | General + inline (per-line) comments on submissions |
| `conversations` | DMs, groups, issues, all-team, **`admins_only`** |
| `conversation_members` | Membership table |
| `messages` | Chat messages with `pinned_at`, **`hidden_at`** |
| `notifications` | Per-user notification feed |
| `extension_requests` | Writer requests + leader/admin decisions |
| `moderation_reports` | Reported messages with status / severity / reasons |
| `audit_events` | Append-only event log (admin-only read) |

Indexes cover the common queries (tasks by writer/editor/status/deadline, messages by conversation+created_at, notifications by user+read+created, moderation reports by status/severity/created/reported user, extensions by task/status with a partial unique index ensuring one pending request per task).

---

## Adapter architecture

```
            ┌──────────────────────────┐
            │  Components / pages       │
            │  (TaskRow, ChatView, ...) │
            └────────────┬──────────────┘
                         │ useApiClient()
                         ▼
            ┌──────────────────────────┐
            │  ApiClientProvider        │
            │  reads NEXT_PUBLIC_DATA_  │
            │  MODE; falls back to mock │
            └─────┬────────────────┬────┘
                  │                │
        mock      ▼                ▼  supabase
   ┌──────────────────┐  ┌─────────────────────┐
   │ MockApiClient    │  │ SupabaseApiClient   │
   │ → useStore (RAM) │  │ → @supabase/supabase│
   └──────────────────┘  └─────────────────────┘
```

- `lib/api/client.ts` defines the typed interface.
- `lib/api/mock-adapter.tsx` adapts the in-memory store.
- `lib/api/supabase-adapter.ts` adapts a Supabase project.
- `lib/api/http-adapter.ts` is the legacy stub kept conformant for future REST APIs.

The mock store also stays the source of truth for views that need synchronous in-place lookups (e.g. resolving a writer name from `users` while rendering a card). When a list is mutated by the adapter, the relevant data hook calls `refetch()`.

---

## Moderation queue behavior

- Visibility: `canModerate(role)` — leaders + admins. Writers + editors hit a friendly access-denied card.
- Stat cards: Open / High priority / Resolved today / Repeat-reported users.
- Filter tabs: Open / In review / Resolved / Dismissed / All.
- Row table shows reported message excerpt, reporter, reason, status, severity, age. Click a row to open the detail dialog.
- Bulk actions: select rows, then mark in review / resolve / dismiss in one shot.
- Detail dialog:
  - Surfaces the message body, reporter name, reason, severity, status.
  - Reporter's note (if any).
  - Inline safety-guidance card.
  - Internal-note textarea — required-mindset for resolving (not enforced today; recommend tightening once a moderation policy is finalized).
  - Decision buttons (mark in review / resolve / dismiss).
  - Hide / unhide message toggle.
- Resolution sets `resolved_at` and `resolved_by_id` for the audit trail.

The Report flow on the chat side dedupes on (reporter, message). Subsequent reports by the same user on the same message bump the `reporter_note` instead of inserting a new row.

---

## Mock fallback behavior

- Default: `NEXT_PUBLIC_DATA_MODE=mock` (unset → mock).
- All workflows including reports, hide-message, extensions, decisions, and the moderation queue are functional in mock mode using the in-memory store. State resets on page reload.
- If `NEXT_PUBLIC_DATA_MODE=supabase` but URL/anon key are missing, the provider logs `[advantage-portal] NEXT_PUBLIC_DATA_MODE=supabase but URL or anon key is missing — falling back to mock.` and the app continues in mock.
- If the URL is malformed, a similar warning surfaces. The UI never breaks.

---

## Known limitations

1. **Submissions / reviews / comments** writes are not yet wired through `SupabaseApiClient`. List paths work; the create/update paths throw a clear `501` so the error is visible. Mock mode covers the full UI flow today.
2. **Auth** is still the localStorage shim from phase 1. Wiring Supabase Auth is the next step (`docs/supabase-setup-guide.md` §4–7 already covers the migration plan).
3. **RLS** policies are MVP-grade. Tighten in a follow-up migration once production policies are locked in (master plan §8).
4. **Realtime** is not wired. With the schema in place, subscribe to `moderation_reports`, `messages`, and `notifications` from the data hooks for live updates (sketch in `docs/supabase-setup-guide.md` §10).
5. **Audit events table** exists but is unused — the Admin page still derives a mock log from `notifications`. Wiring real audit emission (role changes, moderation decisions, login events) is a small follow-up.
6. **Data-mode switching** is build-time, not runtime — flipping `NEXT_PUBLIC_DATA_MODE` requires restarting `next dev` so the env is re-read.
7. **Service role flows** (admin invites, server actions) are not yet implemented; the `service_role` key field exists in `.env.example` for when they land.

---

## Next roadmap

1. Wire Supabase Auth: replace `lib/session.tsx` per `docs/supabase-setup-guide.md` §5–7. Add `middleware.ts` for protected-route redirects.
2. Finish persistent submission / review / comment writes in `SupabaseApiClient`.
3. Add `realtime` subscriptions in `lib/hooks/index.ts` so the moderation queue, chat, and notifications stream live.
4. Tighten RLS to the master-plan policy set; add a regression test that an unauthenticated `select * from <table>` returns zero rows.
5. Audit-event emission: write rows to `audit_events` from the moderation actions, role updates, and extension decisions, and read them on `/admin`.
6. Storage buckets for file submissions (per `docs/supabase-setup-guide.md` §9).
7. Optional: a `/admin/moderation/[id]` deep link so moderators can paste a report URL into the admins-only chat.

## Phase 3 — Newsroom persistence (added)

The newsroom workflow entities introduced in the newsroom phase
(sections, issues, issue_slots, pitches, editorial_checklists,
sensitive_flags) now persist through `SupabaseApiClient`. See
`docs/newsroom-persistence-supabase.md` for schema + RLS + QA details.
The new migrations are `supabase/migrations/0002_newsroom_workflow.sql`
and `0003_newsroom_rls.sql`; the new seed is `supabase/seed_newsroom.sql`.
Mock mode is preserved.

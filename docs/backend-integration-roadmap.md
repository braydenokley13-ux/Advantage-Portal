# Backend Integration Roadmap

The frontend MVP is now fully shaped to accept a real backend. This document
lays out the recommended order of work for the backend phase. The default
target is **Supabase** (Postgres + Auth + Storage + Realtime), but every
step below also applies to a custom Node/Postgres or Hono/Drizzle stack.

The full Supabase-specific setup is in `docs/supabase-setup-guide.md`.

---

## Guiding principles

1. **Contracts first.** Anything that touches the wire goes through
   `lib/contracts/`. Adding a new endpoint = adding a Zod schema first,
   wiring the API client second, calling it from a hook third.
2. **One adapter swap.** The frontend already routes through
   `ApiClient`. The HTTP backend just needs to fill `HttpApiClient`
   methods; UI files do not change.
3. **No big-bang migration.** Wire one entity end-to-end (e.g. tasks)
   before touching the next. Mock and HTTP can coexist while you migrate.

---

## Phase 1 — Auth (do this first)

Why first: every other table is row-level-security-gated by the user, so
nothing else is safe to write until auth is real.

- [ ] Create the Supabase project and enable email + magic-link providers.
- [ ] Add the Supabase JS client (`@supabase/supabase-js` and, for Next 15,
      `@supabase/ssr`).
- [ ] Replace the body of `SessionProvider` (`lib/session.tsx`):
  - `currentUser` ← Supabase user mapped through `users` table
  - `signInAsDemoUser` ← real sign-in (email/password or magic link)
  - `signOut` ← `supabase.auth.signOut()`
- [ ] Keep the same return shape so `useSession`, `useRole`, and the
      `AuthGate` continue to work without UI changes.
- [ ] Mirror Supabase auth users into a `users` row at first login. Role
      defaults to `writer`; admin promotes from the `/admin` page.
- [ ] Apply RLS policies on `users` so members can read everyone but only
      admins can mutate roles / activation.

## Phase 2 — Contracts + database schema

- [ ] Create one Postgres table per Zod schema in `lib/contracts/`:
      `users, tasks, submissions, reviews, comments, conversations,
      conversation_members, messages, notifications`.
- [ ] Adopt `id text primary key` mirroring the prefixed string IDs the
      frontend expects (`u_…, t_…, s_…, r_…, c_…, conv_…, m_…, n_…`) OR
      switch to UUIDs and update the seed data — pick one and stick with it.
- [ ] Add `created_at timestamptz default now()` everywhere the schema has
      `createdAt`.
- [ ] Generate types from the database (e.g. `supabase gen types
      typescript`) and validate they line up with the Zod schemas. The
      Zod schemas remain authoritative for the wire format.

## Phase 3 — Tasks + visibility

- [ ] Implement `listTasks / getTask / createTask / updateTask /
      setTaskStatus` in `HttpApiClient`.
- [ ] Encode visibility as RLS:
  - writer → `writer_id = auth.uid()` (or mapped equivalent)
  - editor → `editor_id = auth.uid()`
  - leader / admin → all rows
- [ ] Encode the kanban transitions as a server-side check:
  `not_started → in_progress` (writer or admin),
  `in_progress → submitted` only via `createSubmission` (server move),
  `submitted → complete` only via `createReview`.
- [ ] Verify on the frontend by switching the `ApiClientProvider` mode to
      `"http"` for the dashboard + board first.

## Phase 4 — Submissions + reviews

- [ ] Implement `listSubmissions / createSubmission / listReviews /
      createReview` in `HttpApiClient`.
- [ ] Add a Supabase Storage bucket for `file` submissions
      (`submissions-files`). Public-read off; signed URLs for downloads.
- [ ] Server side: when a submission is created, flip the prior
      `isCurrent` rows to false and set the task status to `submitted`.
- [ ] Server side: when a review is created, set the task status:
      `approved | rejected → complete`, `changes_requested → in_progress`.
- [ ] Implement `listComments / createComment / toggleResolveComment`.
      Inline comments must include `submission_id` AND `line_number` so
      they cannot float across versions.

## Phase 5 — Messaging

- [ ] Implement `listConversations / createConversation / listMessages /
      sendMessage / togglePinMessage`.
- [ ] Add a `conversation_members` join table with RLS limiting reads to
      `auth.uid() in (select user_id from conversation_members where
      conversation_id = id)`.
- [ ] For the `all_team` channel, only allow inserts from leader/admin.
- [ ] Subscribe the chat view to `messages:conversation_id=eq.<id>` via
      Supabase Realtime.

## Phase 6 — Notifications + deadlines

- [ ] Implement `listNotifications / pushNotification /
      markNotificationRead / markAllNotificationsRead`.
- [ ] Replace the manual `runDeadlineScan` demo control with a scheduled
      job (Supabase Edge Function or `pg_cron`) that runs the same
      scanner logic from `lib/deadline-reminders.ts` server-side.
- [ ] Subscribe the notifications popover + page to
      `notifications:user_id=eq.<me>` via Realtime so the bell updates
      live.

## Phase 7 — Calendar

- [ ] No new endpoints — calendar already derives from `listTasks`.
- [ ] Optional: add a server-side ICS export endpoint that returns the
      same set, so external calendars (Google / Apple) can subscribe.

## Phase 8 — Cleanup

- [ ] Delete `MockAdapter` entry-points only after every page is fully on
      the HTTP adapter. The mock is useful for tests + Storybook.
- [ ] Add error boundaries above each major route to catch `ApiError`s
      and show the existing `EmptyState` / `AccessDenied` cards.
- [ ] Wire a Sentry / OpenTelemetry exporter at the `request<T>`
      helper level so backend latency surfaces immediately.

---

## Out of scope for the first backend pass

- Search across tasks/messages/people.
- @mentions, typing indicators, read receipts.
- File version diffs, true Markdown rendering, comment threading.
- Audit logs / activity feed beyond notifications.
- Multi-tenant org separation.

These are tracked in the master plan but should NOT block the first
mock → real swap.

# Newsroom persistence — Supabase (Phase 3)

This phase makes the newsroom workflow real in the data layer. The
in-memory mock store still owns the UI by default; with
`NEXT_PUBLIC_DATA_MODE=supabase`, every newsroom entity round-trips to
Postgres so reloading the page shows the same pitches, issues, slots,
checklists, and sensitive flags. Mock mode is preserved.

The Advantage Journal is a student newspaper / online publication. This
document describes how the newsroom workflow tables back the portal.

---

## What was added

- `supabase/migrations/0002_newsroom_workflow.sql`
  - new tables: `sections`, `issues`, `issue_slots`, `pitches`,
    `editorial_checklists`, `sensitive_flags`
  - new task columns: `section_id`, `pitch_id`, `issue_id`,
    `copy_editor_id`, `fact_checker_id`, `slug`, `assignment_brief`
    (jsonb), `word_count_actual`
- `supabase/migrations/0003_newsroom_rls.sql` — RLS for the new tables
- `supabase/seed_newsroom.sql` — realistic seed mirroring `lib/mock-data.ts`
- `lib/contracts/index.ts` — Zod schemas for `Section`, `Pitch`, `Issue`,
  `IssueSlot`, `EditorialChecklist`, `SensitiveFlag`, `AssignmentBrief`,
  plus task fields
- `lib/api/client.ts` — extended `ApiClient` interface
- `lib/api/mock-adapter.tsx` — newsroom methods delegating to the store
- `lib/api/supabase-adapter.ts` — newsroom methods against Postgres
- `lib/api/http-adapter.ts` — placeholder methods to keep it conforming
- `lib/hooks/index.ts` — `useSections`, `usePitches`, `useIssues`,
  `useIssueSlots`, `useEditorialChecklist`, `useSensitiveFlags`

The newsroom UI (pitches, issues, escalations, story drawer) is unchanged.
It still reads from `useStore()` for tightness, while the new hooks and
adapter are the migration path for moving those reads to a backed source
in a follow-up.

---

## Schema overview

| Table                   | Purpose                                                      |
|-------------------------|--------------------------------------------------------------|
| `sections`              | Newspaper sections (News, Opinion, Markets, etc.)            |
| `issues`                | Scheduled editions with publish date and status              |
| `issue_slots`           | Stories slotted into an edition's run sheet                  |
| `pitches`               | Writer pitches awaiting an editorial decision                |
| `editorial_checklists`  | Per-task checklist (items as `jsonb`)                        |
| `sensitive_flags`       | Editorial escalation flags on stories                        |
| `tasks` (extended)      | Existing table with newsroom metadata columns                |

### Why store checklist items as `jsonb`?

The mock model has always treated the checklist as one logical bundle:
the editor toggles items by stable key (`g_lede`, `b_market_date`, …).
Reads are always whole-list; writes are whole-list (the whole array is
re-saved on each toggle). A separate `editorial_checklist_items` table
buys nothing here and adds round trips. `jsonb` keeps each toggle one
row update with no joins, while still letting you index into items via
`items @> '[{"key":"g_lede","checked":true}]'::jsonb` if needed later.

### New `tasks` columns

All additive and nullable. Existing inserts and selects keep working.
The Supabase adapter's `rowToTask` reads them and exposes them under the
existing camelCase shape (`sectionId`, `pitchId`, `issueId`,
`copyEditorId`, `factCheckerId`, `slug`, `brief`, `wordCountActual`).

### Indexes added

- `tasks(section_id)`, `tasks(issue_id)`, `tasks(copy_editor_id)`,
  `tasks(fact_checker_id)`, `tasks(pitch_id)`
- `pitches(writer_id, status)`, `pitches(section_id, status)`,
  `pitches(status, created_at desc)`
- `issues(status, publish_date)`
- `issue_slots(issue_id)`, `issue_slots(task_id)`,
  `unique(issue_id, task_id)`
- `editorial_checklists(updated_at desc)`
- `sensitive_flags(task_id)`, `sensitive_flags(status, raised_at desc)`,
  `sensitive_flags(reason)`, partial unique on
  `(task_id) where status in ('open','holding')`

---

## Data-mode behaviour

| `NEXT_PUBLIC_DATA_MODE` | Behaviour                                                            |
|-------------------------|----------------------------------------------------------------------|
| `mock` (default)        | In-memory store; no DB calls. State resets on reload.                |
| `supabase`              | SupabaseAdapter against the configured project. Persists everything. |
| `supabase` + bad creds  | Provider downgrades to mock automatically with a console warning.    |

The data-mode switch is build-time. Restart `next dev` to pick up env
changes.

### Mock mode

The new hooks resolve through the mock adapter, which delegates to the
existing `useStore()`. All newsroom flows you saw last phase keep
working: pitch submit/approve/decline/convert, checklist toggle,
sensitive raise/clear/hold, issue plan/publish. State still resets on
page reload — by design, for offline development.

### Supabase mode

The Supabase adapter implements every newsroom method:

1. `listSections()` — read sections.
2. `listIssues()` / `getIssue(id)` / `updateIssue(id, patch)` /
   `publishIssue(id)`. Publishing also flips every slotted task to
   `status='complete'` so the derived stage is `published`.
3. `listIssueSlots(issueId?)` / `upsertIssueSlot()` /
   `removeIssueSlot(id)`. `upsertIssueSlot` also writes
   `tasks.issue_id` for convenience; `removeIssueSlot` detaches the
   matching `tasks.issue_id` if it's still pointing at the removed slot.
4. `listPitches(filter)` / `createPitch()` / `decidePitch()` /
   `convertPitch()`. `convertPitch` runs the same flow as the mock
   store: insert a `tasks` row carrying the brief (`assignment_brief`
   jsonb), set the pitch to `converted`, link `pitches.task_id`, and
   upsert an `issue_slot` if the leader chose an issue.
5. `getEditorialChecklist(taskId)` / `updateChecklistItem()`.
   `updateChecklistItem` lazily seeds defaults (using `defaultChecklistItems`
   based on section slug + active sensitive flag) on first toggle.
6. `listSensitiveFlags(filter)` / `raiseSensitiveFlag()` /
   `decideSensitiveFlag()`. Raising a flag also seeds the sensitive
   checklist group on the parent task to mirror mock behaviour.

Errors surface via `ApiError` with the original Postgres message. The
service-role key is never used client-side; the adapter only ever uses
the browser anon key plus the user's auth context.

---

## Apply the schema

```bash
# from project root
npx supabase login
npx supabase link --project-ref <your-ref>
npx supabase db push  # applies 0001 + 0002 + 0003

# optional demo data — mirrors lib/mock-data.ts
psql "$SUPABASE_DB_URL" -f supabase/seed.sql
psql "$SUPABASE_DB_URL" -f supabase/seed_newsroom.sql
```

Or paste the migration files into the Supabase SQL editor in numerical
order (`0001_init.sql`, `0002_newsroom_workflow.sql`, `0003_newsroom_rls.sql`),
then optionally `seed.sql` and `seed_newsroom.sql`.

The seeds are idempotent for entities that have a stable id (`on conflict
do nothing` / `on conflict do update`). Re-running them updates section
metadata and issue dates without duplicating rows.

Then:

```bash
cp .env.example .env.local
# fill in NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY
echo 'NEXT_PUBLIC_DATA_MODE=supabase' >> .env.local
npm run dev
```

---

## RLS policy model (0003)

Phase 3 RLS is conservative. Unauthenticated requests get zero rows on
every newsroom table.

| Table                  | Read                                                    | Write                          |
|------------------------|----------------------------------------------------------|--------------------------------|
| `sections`             | any authenticated user                                  | leader / admin                 |
| `issues`               | any authenticated user                                  | leader / admin                 |
| `issue_slots`          | leader/admin or any user on the underlying task         | leader / admin                 |
| `pitches` — select     | own writer or editor / leader / admin                   | —                              |
| `pitches` — insert     | —                                                        | the writer themselves          |
| `pitches` — update     | —                                                        | editor / leader / admin        |
| `pitches` — delete     | —                                                        | leader / admin                 |
| `editorial_checklists` | anyone with task access (writer / editor / copy / fact / leader / admin) | editor / leader / admin |
| `sensitive_flags` — select | anyone with task access (so blockers are visible)   | —                              |
| `sensitive_flags` — insert | —                                                    | the raiser themselves, with task access |
| `sensitive_flags` — update (clear/hold) | —                                       | leader / admin only            |

Tasks themselves keep the policies from `0001_init.sql`. The new
columns inherit the row's visibility — there is no per-column RLS.

Auth assumptions:

- `auth.uid()` matches `public.users.id` (the mirror table). Once
  Supabase Auth is wired (`docs/supabase-setup-guide.md` §5–7), a
  signup trigger inserts a profile row with this id.
- `public.current_app_role()` resolves to the user's `app_role` JWT
  claim, falling back to `public.users.role`.

Until Supabase Auth lands the existing `lib/session.tsx` localStorage
shim still drives the UI and the adapter passes a `currentUserId` of
the demo profile in scope — RLS effectively limits to
"the local demo profile sees everything that profile would see in
production".

---

## Migration notes (Phase 4)

The newsroom UI now reads through the hooks in `lib/hooks/index.ts`
instead of directly from `useStore()`. Mock mode still uses the
in-memory store under the hood (the mock adapter delegates to it), so
the offline development experience is unchanged. Supabase mode now
persists *reads* on reload as well as writes.

Pages and components migrated:

| Surface                                  | Source-of-truth reads via                                    |
|------------------------------------------|--------------------------------------------------------------|
| `app/(app)/pitches/page.tsx`             | `usePitches`, `useSections`, `useIssues` + `useApiClient` mutations |
| `app/(app)/issues/page.tsx`              | `useIssues`, `useIssueSlots`, `useTasks`, `useSections`, `useChecklists` |
| `app/(app)/admin/escalations/page.tsx`   | `useTasks` (latest active sensitive flag attached to each task) + `useApiClient` |
| `components/task/editorial-checklist.tsx`| `useEditorialChecklist(task.id)` + `api.updateChecklistItem` |
| `components/task/sensitive-panel.tsx`    | `api.raiseSensitiveFlag` / `api.decideSensitiveFlag` with parent `onChanged` callback |
| `components/task/task-drawer.tsx`        | `useTasks` for the open task; `useEditorialChecklist` for stage derivation |

Sync caches kept on `useStore()`:

- `users` — hot per-id name/avatar resolution.
- `sections` lookups inside the drawer (small reference set).
- `submissions` — phase 2 gap; submission writes still flow through the store.
- Extension request flow (`requestExtension` / `decideExtension`) — unchanged this phase.
- `issues` lookups inside the drawer (read for the badge label only).

A new bulk method `listChecklists(taskIds?)` and the matching
`useChecklists()` hook were added so the issues page can derive
readiness across many slotted tasks without N round trips.

A small **Data mode badge** was added to `/admin` showing whether the
session is running mock, Supabase, or "Supabase requested → fallback to
mock" so QA can verify which adapter is live before testing.

## Known limitations

1. ~~**Auth still pending.**~~ ✅ **Resolved.** Supabase Auth is wired
   in `lib/session.tsx` and `supabase/migrations/0004_auth_user_mirror.sql`
   installs the `handle_new_user` trigger so every `auth.users` row
   gets a matching `public.users` row with `id = auth.uid()`. RLS
   policies in `0001_init.sql` and `0003_newsroom_rls.sql` are now
   functionally testable end-to-end. See
   `docs/supabase-setup-guide.md` §7 for the manual signup/login
   smoke test.
2. **Realtime not wired.** Pitches, issues, sensitive flags, and
   checklists only refresh on `refetch()` until subscriptions land in
   `lib/hooks/index.ts`.
3. **`updateIssue` patches in mock mode only honour `status`** (we go
   through the existing `setIssueStatus` path). Supabase mode persists
   every field.
4. **`upsertIssueSlot` priority change in mock mode** is implemented as
   remove + re-add to keep the store API tight. Supabase mode does a
   real upsert.
5. **No backfill for existing tasks** — every pre-existing task row
   gets the new columns at NULL. The seed file fills them for the demo
   set.
6. ~~**Submissions / reviews / comments** writes still go through
   `useStore` directly (phase 2 limitation).~~ ✅ **Resolved.** Migration
   `0005_writes_triggers_rls.sql` adds SECURITY DEFINER triggers that
   flip task status and emit notifications when a submission or review
   is inserted, plus splits the comments RLS into separate insert /
   update / delete policies so any task participant can toggle resolve.
   `lib/api/supabase-adapter.ts` implements `createSubmission`,
   `createReview`, `createComment`, and `toggleResolveComment`.
   Components were rewired (`submission-form`, `review-panel`,
   `comments-panel`, `inline-markdown-viewer`, `submission-history`,
   `task-drawer` extension flow) to call the API client and refetch
   via the existing hooks instead of touching `useStore` directly.
7. ~~**Kanban board + admin pages still read submissions/reviews from
   `useStore`**~~ ✅ **Resolved for kanban / dashboard / reviews queue.**
   `components/kanban/board.tsx`, `app/(app)/dashboard/page.tsx`, and
   `app/(app)/reviews/page.tsx` now read tasks / submissions / reviews /
   pitches / issues / issue_slots / checklists through the API hooks
   (`useTasks`, `useSubmissions`, `useReviews`, `usePitches`, `useIssues`,
   `useIssueSlots`, `useChecklists`). The kanban's setTaskStatus drag
   action routes through `useApiClient().setTaskStatus` and refetches.
   `app/(app)/admin/page.tsx` still reads `users` / `tasks` /
   `notifications` from `useStore` for synthetic audit-log + counts —
   carried over as the lowest-impact follow-up; admin role isn't on
   the writer/editor critical path.
8. **Notifications inserted by triggers** are not yet realtime —
   the bell still re-fetches via the polling hook.

---

## Manual QA checklist

### Mock mode (`NEXT_PUBLIC_DATA_MODE` unset or `mock`)

- [ ] Start `npm run dev`.
- [ ] Visit `/admin` → Data mode badge reads **Mock**.
- [ ] Sign in as a writer (Alex Rivera).
  - [ ] Visit `/pitches`, submit a new pitch. Confirm it appears under
        "My pitches".
  - [ ] Open a task drawer; tick a checklist item. The progress bar
        updates.
  - [ ] On a story you can see, raise a sensitive flag. Confirm the
        banner appears in the drawer and the story shows up on the
        admin/leader escalations queue when you switch role.
- [ ] Switch to editor (Casey Lee) and:
  - [ ] Visit `/pitches?tab=queue`, accept one pitch, decline another.
  - [ ] Open a story drawer and tick general/business items.
- [ ] Switch to leader (Riley Brooks) and:
  - [ ] Convert an accepted pitch to an assignment with an issue + deadline.
  - [ ] On `/issues`, mark Issue #42 published. All slotted tasks turn
        complete and the stage badge reads "Published".
  - [ ] On `/admin/escalations`, clear / hold the open sensitive flag.
- [ ] Reload the page. (Expected) all the in-memory changes are gone —
      mock mode is by design.

### Supabase mode (`NEXT_PUBLIC_DATA_MODE=supabase`)

- [ ] Apply migrations: `npx supabase db push` (or paste the SQL files
      into the Supabase SQL editor).
- [ ] Run `psql "$SUPABASE_DB_URL" -f supabase/seed.sql` and
      `psql "$SUPABASE_DB_URL" -f supabase/seed_newsroom.sql`.
- [ ] Set `NEXT_PUBLIC_DATA_MODE=supabase`, fill `NEXT_PUBLIC_SUPABASE_URL`
      and `NEXT_PUBLIC_SUPABASE_ANON_KEY`, restart `npm run dev`.
- [ ] Visit `/admin` → Data mode badge reads **Supabase**.
- [ ] Confirm the existing pages (tasks, kanban, calendar, chat,
      moderation queue) still load.
- [ ] Repeat the mock-mode flows above. After each step **reload the
      page** and confirm the change persisted:
  - [ ] Pitch submit → reload → pitch still in queue.
  - [ ] Pitch accept → reload → pitch still accepted.
  - [ ] Pitch convert → reload → new task exists with the brief
        attached and (if chosen) the issue slot is present.
  - [ ] Checklist tick → reload → still ticked.
  - [ ] Sensitive raise → reload → flag still on the task and on
        `/admin/escalations`.
  - [ ] Sensitive clear → reload → cleared.
  - [ ] Mark issue published → reload → tasks remain `complete`.
- [ ] Confirm graceful fallback: temporarily blank
      `NEXT_PUBLIC_SUPABASE_ANON_KEY` and reload — the `/admin` Data mode
      badge should read **Mock (fallback)** with the downgrade reason
      printed below; the console should also log the warning.

---

## Why mock mode wasn't replaced

The product brief calls for additive, backwards-compatible changes —
mock mode is the offline development surface. Phase 4 keeps it intact:
every newsroom page that was migrated to hooks still resolves through
the mock adapter when `NEXT_PUBLIC_DATA_MODE` is unset, and the mock
adapter delegates to `useStore()`. So the in-memory store remains the
authoritative cache for mock mode and the source of name/avatar
lookups across the app.

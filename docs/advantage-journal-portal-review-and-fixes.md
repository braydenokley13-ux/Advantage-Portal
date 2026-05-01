# Advantage Journal Portal — Review & Fixes

This document captures the architect-led review pass, the fixes implemented in this round, and the open product questions that need decisions before the next iteration.

The portal is a teen-focused journal platform with four roles (Admin, Writer, Editor, Leader). The MVP runs entirely against an in-memory store with a typed `ApiClient` adapter, so the UI is already wired to swap to a real backend without component changes.

---

## Role-by-role review

### Admin — what's good / bad / better
**Good**
- Hard gate (`canManageUsers`) protects the Admin route at the component level.
- `UserList` already supports role changes and deactivation via dropdown actions.
- System-wide visibility: admins can see every task on the board and calendar.

**Bad (before this pass)**
- Admin and Team pages rendered the same `UserList` with the same management dropdown. There was no clear reason to keep both.
- No permissions reference — admins had to read source to know who can do what.
- No audit-log surface, even as a mock. Hard to demo "system-level oversight."
- Admin dashboard collapsed into the same stat layout as Leader.

**Better (this pass)**
- Team became a read-only directory with a Workload column. Admin became the controls + reference page.
- New **Roles & permissions matrix** card gives an at-a-glance overview of every capability per role.
- New **Recent activity** feed (mock audit log derived from the notification stream) demonstrates where a real audit log would live.
- Admin dashboard now surfaces analytics-style cards: submissions/wk, overdue, average review cycle (mock), role breakdown.
- An **Admins & Leaders** chat is seeded so ops chatter has a home that writers/editors can't see.

### Writer — what's good / bad / better
**Good**
- `visibleTasks` already restricts writer view to only their own tasks.
- Drag rules in `kanban-rules.ts` are correct: writers move only between Not Started ↔ In Progress; submission and completion are gated through the review flow.
- The Submission flow supports inline / file / Google Doc + version history.

**Bad (before this pass)**
- Sidebar exposed `/tasks` for writers but no such route existed → 404 (and content blockers occasionally surfaced this as `ERR_BLOCKED_BY_CLIENT`).
- TaskRow echoed the writer's own name back at them in their own task list ("My tasks · Alex Rivera").
- No surfaced "what should I do next" — writers had to deduce it from status pills.
- No way to ask for more time.
- Status labels were terse and lacked teen-readable definitions.

**Better (this pass)**
- `/tasks` route now exists as a grouped queue (needs your work / awaiting feedback / completed).
- TaskRow suppresses the writer's own name when the viewer is the writer.
- Dashboard rail: **What to do next** with `Continue draft / Submit draft / View feedback` tiles.
- Dashboard sidebar: **Editor feedback** card surfacing review decisions and comments addressed to the writer.
- Brief tab in the task drawer: a "what this status means" panel with role-tailored next-action copy.
- **Request extension** flow: writers pick a new date and a reason; leaders/admins approve or deny; on approval the deadline slides forward and the writer is notified.
- Word-count target and citation requirement now visible on the card / row / drawer.

### Editor — what's good / bad / better
**Good**
- Review panel offers three decisions (approve, request changes, reject) with effect copy and a notes textarea.
- Editor visibility is correctly scoped: editors only see tasks they're assigned to.
- Inline + general comments on submissions are already wired.

**Bad (before this pass)**
- Sidebar exposed `/reviews` but no such route existed → 404.
- No queue view at all — the editor had to use the board to find work to review.
- Reviewers had to type free-form feedback every time, even for the same five recurring patterns.
- No way to flag a piece as "needs better sources" without typing.

**Better (this pass)**
- `/reviews` route now exists with: needs decision / resubmitted / overdue / reviewed groupings.
- Dashboard rail: **Review queue** widget (links to `/reviews`).
- **Editor feedback templates** in the review panel: 5 reusable, one-click templates (approve, sources, clarity, length, citations) — pre-fills both the decision and the notes; editor can still edit before submitting.
- Editors can flag `citationsRequired` on a task (in the form) — surfaces as a badge on the card and a panel in the drawer.

### Leader — what's good / bad / better
**Good**
- Master visibility on the board and calendar.
- Can pin announcements (`canPinMessage` permits leaders + admins).
- Can create groups and issue channels.

**Bad (before this pass)**
- Leader dashboard was identical to Admin's, just with a different role badge. No "manager-of-the-journal" feel.
- No view of editor backlog or publication readiness.
- Could not approve extension requests (none existed).

**Better (this pass)**
- Leader dashboard:
  - Stat cards: **In flight**, **Deadline risk**, **Pinned**, **Team headcount**.
  - Ops panel: **Publication readiness %** (approved / active), **Editor backlog** (per-editor count of drafts awaiting decision), most recent **Pinned** announcements.
- Leaders can approve or deny extension requests (alongside admins).
- Leaders can post to the new admins-only chat alongside admins.

---

## Changes implemented this pass

### Checkpoint 1 — Navigation reliability
- Added `/app/(app)/tasks/page.tsx` (Writer "My Tasks" queue).
- Added `/app/(app)/reviews/page.tsx` (Editor review queue).
- Added `/app/not-found.tsx`.
- Converted a bare `<a href="/board">` in the dashboard to `next/link`.

### Checkpoint 2 — Role dashboards
- Added writer next-actions tiles, writer feedback card.
- Added editor review-queue widget.
- Added leader stats + ops panel (readiness %, editor backlog, pinned).
- Added admin analytics stats (submissions/wk, avg review cycle mock, overdue, role breakdown).
- TaskRow no longer echoes the writer's own name to themselves.

### Checkpoint 3 — Team / Admin distinction
- Team is read-only directory + workload column.
- Admin gained a Roles & permissions matrix and a mock audit-log feed.
- Microcopy on both pages explains the split.

### Checkpoint 4 — Status taxonomy + task clarity
- Added `lib/status.ts`: single-source-of-truth definitions, descriptions, and per-role next-action copy.
- Surfaced descriptions on board column headers (text + tooltip), TaskRow status pill (tooltip), and the task drawer (a "what this status means" panel).
- Extended Task schema with optional `wordCountTarget`, `citationsRequired`, `extensionRequest`. Surfaced as badges on cards/rows and a panel in the drawer.
- Derived a "Changes Requested" sub-state for `in_progress` tasks that returned after a `changes_requested` review (no new status; doesn't break the transition matrix).

### Checkpoint 5 — Notifications + announcements
- Seeded two pinned all-team announcements so the page lights up on first load.
- `pushNotification` now dedupes identical (userId+kind+title) notifications fired within a 60s window. Real backend would dedupe at delivery; mock dedupe keeps the demo clean.
- Rewrote notification labels and descriptions in plain teen-friendly copy.
- Added a "how we keep this quiet" explainer to the preferences page.

### Checkpoint 6 — Teen safety + editorial workflow
- New conversation kind: **`admins_only`** with red Shield iconography. Seeded an Admins & Leaders channel; only admins can create them, only admins+leaders can post.
- Moderation banner above non-DM, non-admins-only chats.
- Per-message **Report** action: flags the message and pushes a notification to every admin.
- **Extension request** entity + store actions + inline UI in the task drawer. Writers request, leaders/admins decide.
- **Editor feedback templates** (5 templates) with one-click insert in the review panel.
- Word count and citations are first-class fields in the task form.

### Checkpoint 7 — This document.

---

## Validation

Run:

```bash
npm run typecheck   # tsc --noEmit
npm run lint        # next lint
npm run build       # next build
```

Validation results from this pass are recorded in the final summary in the PR description.

---

## Product decisions captured this pass

These were open in the prior review; they are answered here so the codebase has a record of why behavior is what it is.

| # | Question | Decision |
|---|---|---|
| 1 | What qualifies as Submitted vs In Review vs Complete? | **Submitted** is the canonical "in review" state — when a writer turns in a draft, the editor has it. **Complete** is set by an editor's `approved` (or `rejected`) review. The four canonical statuses stay (`not_started`, `in_progress`, `submitted`, `complete`); we surface a derived "Changes Requested" sub-state when an `in_progress` task most recently received a `changes_requested` review. |
| 2 | Can writers request extensions, and who approves? | **Yes.** Writers submit a new date + reason. **Leaders OR admins** can approve. On approval the deadline slides forward and the writer is notified. |
| 3 | Who can pin announcements? | **Admin and Leader.** Editors and writers cannot. Enforced in `canPinMessage`. |
| 4 | Moderation rules for teen messages/comments? | **Two channels.** All-team chat is moderated and visible to everyone (writers/editors can read; only leaders/admins can post). A separate **Admins-only** chat (`admins_only` kind) is restricted to admins+leaders for ops chatter. Per-message Report action fans out to admins. |
| 5 | Should citations be required for every article? | **No blockers.** Editor decides per task via `citationsRequired`. The flag surfaces a reminder on the card and a panel in the drawer; submission is never blocked by it. |
| 6 | Should notifications be deduped across in-app/email/push? | **Yes.** Implemented in `pushNotification`: identical (userId+kind+title) within 60s is dropped. A real backend would dedupe at delivery time. |
| 7 | Do leaders have approval power, or only visibility? | **Approval power.** Leaders can pin announcements, approve extensions, and post to the admins-only channel. Only admins can change roles or deactivate users. |

---

## Remaining limitations / TODOs

These are deliberately scoped out of this pass to avoid expanding the surface area beyond what the in-memory store can support:

1. **Real auth.** `lib/session.tsx` is a localStorage shim. Swapping to Supabase (per `docs/supabase-setup-guide.md`) would let role enforcement happen server-side.
2. **Persistent extension requests.** Lives only in component-level Task state. Move to a dedicated `extension_requests` table when the backend lands.
3. **Audit log.** Currently derived from the notification stream. A real audit log needs its own append-only store with immutable events and richer event types (auth, role change, moderation action).
4. **Moderation for reports.** Per-message Report sends notifications to admins. There is no moderation queue UI yet — admins triage out-of-band. Build a `/admin/moderation` route once volume warrants it.
5. **Mention parsing in comments / messages.** Comments support inline notes per line; full `@mention` resolution (auto-complete, notification fan-out) is not wired.
6. **Review-cycle metric.** The Admin dashboard's "Avg review cycle" is a static mock string. Compute from actual `submission.createdAt → review.createdAt` deltas once the backend persists timestamps reliably.
7. **Citation enforcement.** Writers see the badge but submission is not gated. If editors want a soft block ("are you sure? this assignment requires citations"), wire that into `SubmissionForm`.
8. **Conversation creation UI for admins-only.** The conversation-list `+` button is currently a stub. Once we have a "new conversation" dialog, surface `admins_only` as an option for admins.

---

## Suggested next roadmap

In rough priority order:

1. **Wire Supabase** for auth, tasks, submissions, reviews, comments, conversations, messages, notifications, and extension requests. Replace the `MockAdapter` import with `HttpAdapter` in `lib/api/provider.tsx`. The contracts in `lib/contracts/index.ts` already match.
2. **Moderation queue** at `/admin/moderation` for triaging reported messages with bulk actions (dismiss, warn, deactivate).
3. **Mentions** with auto-complete in comments and chat, plus per-mention notifications.
4. **Email/Push channels** behind the existing notification preferences. Today they're toggles only; wire delivery providers next.
5. **Issue assembly view** for leaders: assemble multiple complete tasks into an "Issue" record with publish/preview.
6. **Word count enforcement** with a soft warning in the submission form when the inline body length is well under or over `wordCountTarget`.
7. **Inline diff viewer** for resubmissions so editors can see what changed between versions.
8. **Calendar drag-to-reschedule** for leaders (deadline drag on the month view).

---

## Phase 2 completed

The next round of work shipped Supabase persistence and the real moderation queue. Highlights:

- Full schema + migrations in `supabase/migrations/0001_init.sql` (with seeds in `supabase/seed.sql`).
- `lib/supabase/{env,browser,server}.ts` and `.env.example` for the data-mode switch.
- `lib/api/supabase-adapter.ts` implementing the typed `ApiClient` against Postgres for the priority workflows (tasks, extensions, messages, moderation reports, notifications). Mock adapter remains for offline / demo.
- `/admin/moderation` queue: filters, bulk actions, detail dialog with hide-message + internal-note audit trail, teen-safety guidance copy. Visible to leaders + admins.
- Per-message **Report** UI now opens a reason picker with optional note, dedupes per (reporter, message), and creates a real `ModerationReport`. Hidden messages render `[message hidden by a moderator]` to non-moderators.

Full details + setup steps live in `docs/supabase-persistence-and-moderation.md`.

## Files changed this pass

See `git log claude/setup-opus-architect-5mL0q` for per-checkpoint commit messages. High-level surface:

- `app/(app)/tasks/page.tsx` (new)
- `app/(app)/reviews/page.tsx` (new)
- `app/not-found.tsx` (new)
- `app/(app)/dashboard/page.tsx` (rewritten with role panels)
- `app/(app)/team/page.tsx` (rewritten — directory + microcopy)
- `app/(app)/admin/page.tsx` (rewritten — controls + matrix + audit)
- `lib/status.ts` (new)
- `lib/types.ts`, `lib/contracts/index.ts` (extended for word count, citations, extensions, admins_only chat)
- `lib/store.tsx` (extension flow, dedup notifications)
- `lib/permissions.ts` (admins_only chat permissions)
- `lib/notifications.ts` (teen-friendly copy)
- `lib/mock-data.ts` (pinned announcements, admins-only seed, sample task fields)
- `lib/kanban-rules.ts` (re-export from `lib/status.ts`)
- `components/kanban/board.tsx`, `components/kanban/task-card.tsx`
- `components/task/task-row.tsx`, `components/task/task-drawer.tsx`, `components/task/review-panel.tsx`, `components/task/task-form-dialog.tsx`
- `components/messages/chat-view.tsx`, `components/messages/conversation-list.tsx`
- `components/team/user-list.tsx` (workload column)
- `app/(app)/notifications/preferences/page.tsx` (dedup explainer)

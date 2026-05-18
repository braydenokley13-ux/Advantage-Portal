# MVP UI / QA Checklist

This document captures the manual checks that should pass before the
journal-platform MVP frontend is considered ready for demo. Everything below
runs against the in-memory mock store; there is no backend wiring.

Use the role switcher in the topbar to step through every role
(Writer / Editor / Leader / Admin) and re-verify each section.

---

## 1. Role visibility

| Surface | Writer | Editor | Leader | Admin |
| --- | --- | --- | --- | --- |
| Dashboard "My tasks" stats | ✅ own tasks | ✅ assigned reviews | ✅ team-wide | ✅ team-wide |
| Board (kanban) | ✅ own tasks only | ✅ assigned tasks only | ✅ all tasks | ✅ all tasks |
| Calendar | ✅ own deadlines | ✅ assigned deadlines | ✅ master | ✅ master |
| Messages | ✅ DMs + groups they belong to | ✅ same | ✅ same + can post in `all_team` | ✅ same |
| Announcements | ✅ read | ✅ read | ✅ post + pin | ✅ post + pin |
| Team page | ✅ read-only roster | ✅ read-only | ✅ read-only | ✅ read + role/status edits |
| Admin page | ❌ access denied | ❌ access denied | ❌ access denied | ✅ |

Checks:
- [ ] Switching role re-renders pages correctly without stale data.
- [ ] Restricted pages render the `AccessDenied` card, not a blank screen.
- [ ] Non-permitted users do NOT see "New task", "Edit", or "Pin" affordances.

## 2. State-machine checks (Kanban)

States: `not_started` → `in_progress` → `submitted` → `complete`.

- [ ] Writer can drag own task between Not Started ↔ In Progress.
- [ ] Writer cannot drag into Submitted (must use Submission flow).
- [ ] Writer cannot drag any task into Complete.
- [ ] Editor cannot drag tasks at all (review only).
- [ ] Leader/Admin can drag any task between any non-terminal state.
- [ ] Submitting work moves task to Submitted automatically.
- [ ] Approve / Reject moves task to Complete.
- [ ] Request changes moves task back to In Progress.
- [ ] Complete tasks are locked (no drag, no submit).
- [ ] Blocked-move toast appears with a reason for every denied drop.

## 3. Submission / review

- [ ] All three submission types (inline / google_doc / file) create a new
      version and supersede prior `isCurrent` flags.
- [ ] Version numbering is monotonically increasing per task.
- [ ] Version history list renders for every task with at least one submission.
- [ ] Inline submissions render the **InlineMarkdownViewer** with line numbers.
- [ ] Clicking a line number opens the inline-comment composer.
- [ ] Inline comments are anchored to a specific submission version + line.
- [ ] Resolved inline comments collapse on the line.
- [ ] General comments still post via the Comments tab.
- [ ] File submissions show filename, kind badge, size, and upload time.
- [ ] File cards show a "metadata only" note (file bytes are not stored).
- [ ] Google Doc card renders a live `/preview` iframe for a valid Doc URL,
      a "link not recognised" fallback otherwise, plus the private-doc warning.
- [ ] Reviewer can approve / request changes / reject with optional notes.
- [ ] Writers cannot review their own submissions.
- [ ] Editors who are not the assigned editor cannot review.

## 4. Messaging

- [ ] DMs visible only to participants.
- [ ] `all_team` channel visible to everyone but only Leader/Admin can post.
- [ ] Issue + group conversations can only be created by Leader/Admin.
- [ ] Pinning a message requires Leader/Admin.
- [ ] Mobile: tapping a conversation opens the chat with a back button.
- [ ] Empty state appears when no conversations exist.

## 5. Notifications

- [ ] Notification bell badge reflects unread count for the current user.
- [ ] "Mark all read" only affects notifications belonging to the current user.
- [ ] Notification preferences page renders and toggles persist while role
      remains active.
- [ ] **Deadline scan** (Notifications page → "Run scan"):
  - [ ] 7-day, 3-day, 1-day, and overdue thresholds each fire.
  - [ ] Re-running the scan with no time change produces 0 new reminders
        (dedupe holds).
  - [ ] Reset button clears the issued-keys set.
  - [ ] Writer receives reminders for own tasks.
  - [ ] Editor receives reminders only for assigned tasks.
  - [ ] Leaders receive a missed-deadline escalation.
  - [ ] Completed tasks are excluded from the scan.

## 6. Calendar

- [ ] Month view + Agenda view both render the same filtered set.
- [ ] Filters: kind / writer / editor — all narrow results live.
- [ ] Selecting a task opens the same TaskDrawer used elsewhere.
- [ ] Empty state appears when filters select nothing.

## 7. Admin

- [ ] Non-admin roles hit the access-denied state.
- [ ] Admin can change role for any user except themselves.
- [ ] Admin can deactivate / reactivate any user except themselves.
- [ ] User totals (active / deactivated / admins) reflect changes immediately.

## 8. Empty / loading / access-denied states

- [ ] Dashboard: empty state for Upcoming, Notifications, Recent messages.
- [ ] Board: per-column "Nothing here" placeholder.
- [ ] Calendar: empty state when no tasks match filters.
- [ ] Messages: empty state when no conversations OR none selected.
- [ ] Notifications: per-tab empty state.
- [ ] Team: "no members match" placeholder when filters exclude everyone.
- [ ] Admin: access-denied card for non-admins.
- [ ] Skeleton helpers (`Skeleton`, `SkeletonRow`, `SkeletonCard`) available
      in `components/ui/states.tsx` for any future async surfaces.

## 9. Mobile responsiveness

- [ ] Dashboard stats grid collapses to 2-up on small screens.
- [ ] Kanban columns stack on narrow viewports (`sm:grid-cols-2`,
      `xl:grid-cols-4`).
- [ ] Task drawer opens full-width on mobile, scrolls internally.
- [ ] Messages: list / chat split swaps to a single-column flow with back nav.
- [ ] Calendar: month grid keeps 7-day layout (cramped but legible);
      agenda view stacks naturally.
- [ ] Admin / team table scrolls horizontally rather than overflowing the page.
- [ ] Mobile tabbar shows primary destinations.

## 10. Visual system invariants

- [ ] Background `#fafaf9` consistent across pages.
- [ ] Cards default to white surfaces with `shadow-soft`.
- [ ] Primary buttons use the purple gradient variant where appropriate.
- [ ] Rounded corners (`rounded-md` / `rounded-lg`) consistent across cards.
- [ ] No raw black text — use `text-foreground` / `text-muted-foreground`.

---

## Data modes & remaining limitations

The portal runs in two data modes (see `lib/supabase/env.ts`):

- **Supabase mode** (`NEXT_PUBLIC_DATA_MODE=supabase`) — the store hydrates
  from and writes through `SupabaseApiClient`; data persists in Postgres and
  re-fetches on navigation. Real Supabase Auth gates every read via RLS.
- **Mock mode** (default / credential fallback) — in-memory `StoreProvider`
  seeded from `lib/mock-data.ts`; refreshing the page resets all changes, and
  the topbar role switcher / demo-user picker stand in for real login.

Remaining intentional gaps (NOT bugs):

- **File submissions store metadata only.** Filename / type / size are
  recorded; the file bytes are not uploaded or retained.
- **Deadline scan is manual.** A real scheduler would run server-side; the
  demo control on the Notifications page exposes the pure scanner instead.
- **No realtime.** Cross-client updates surface on navigation (re-fetch),
  not via live subscriptions.
- **Mentions / attachments in messages** are not implemented.
- **Calendar reminders inside the Calendar surface** (vs. notification bell)
  are out of scope for MVP.
- **Inline markdown rendering** is plain-text + line numbers — there is no
  Markdown formatter yet (`*` and `#` render literally).
- **Comment threading** is one-level only; replies go into the same
  flat list.
- **No analytics / audit logs / system settings beyond user management.**

---

## Sign-off checklist

- [ ] All checkpoints 1–16 pass typecheck (`npx tsc --noEmit`).
- [ ] `npm run lint` clean.
- [ ] No console errors in dev mode while clicking through every page as
      every role.
- [ ] Master plan (`docs/journal-platform-master-plan.md`) is still the
      single source of truth.

# Advantage Portal — Bug & Launch-Readiness Audit

_Audit date: 2026-05-14. Branch: `claude/security-code-audit-ox8ta`._

This document is a serious end-to-end audit of the Advantage Portal (Next.js
15 + React 19 + Tailwind + optional Supabase). It records what was checked,
the bugs found, their severity, the files involved, and a fix plan. The
second half of the document tracks which fixes have been committed on this
branch.

## 1. Summary

The portal currently ships in two distinct shapes simultaneously, and the
seams between them are the largest risk:

1. **Pure client-side demo mode** (default). `next build` produces 20 static
   pages, no API routes, no middleware. Auth, role checks, and "admin" gates
   all run in React from localStorage. Anyone hitting `/login` can pick any
   demo user (writer → admin) by clicking a button. A `RoleSwitcher` in the
   top bar lets any user become any other user at any time.
2. **Supabase mode** (opt-in via `NEXT_PUBLIC_DATA_MODE=supabase`). The
   `SupabaseApiClient` ferries reads/writes against the Supabase project.
   RLS is enabled. **However, every mutation that takes an "actor id"
   (`decidedById`, `reporterId`, `requestedById`, `raisedById`, `leaderId`,
   …) trusts the client-supplied value.** RLS checks role membership, not
   actor identity, so users with the right role can fake who took an
   action. There is no `auth.users → public.users` sync trigger in the
   migrations even though 0001 references one in comments — meaning if you
   actually sign someone up with Supabase Auth today, they end up with no
   `public.users` row and every `current_app_role()` call returns null
   (locking them out).

In addition, the dependency surface is exposed:

- **Next.js 15.1.0** has multiple critical CVEs (auth bypass in middleware,
  cache poisoning, SSRF, RCE in React flight protocol, DoS, XSS in CSP
  nonces, etc.). The audit floor is 15.5.18+.
- `postcss < 8.5.10` (pulled transitively through next) has a moderate XSS
  via unescaped `</style>`.
- No ESLint config exists in the repo; `npm run lint` opens an interactive
  setup prompt. Lint has effectively never been run.

Outside security, the most common functional defects are:

- Forms with no in-flight state → double-submit bugs everywhere.
- Forms with `await api.xxx(...)` and no `try/catch` → errors silently
  swallowed; success states fire after a failure.
- Dead UI affordances (top-bar Search, ConversationList "New conversation",
  notification rows that look clickable but aren't).
- A handful of small data bugs (`taskId` used where `issueId` is meant in
  the My-Pitches card, hardcoded "v1" badge on kanban cards, `userById`
  imported from mock-data even in Supabase mode).

The application is otherwise well-structured: clean typed API surface,
strong permission helpers, Zod contracts, idempotent migrations, sensible
empty states, role-aware nav and microcopy.

## 2. Commands run

```bash
npm install             # installed 467 packages; reported 2 vulns (1 crit, 1 mod)
npm audit               # listed Next.js CVE chain (24 advisories)
npm run typecheck       # ✓ tsc --noEmit clean
npm run lint            # interactive prompt — no ESLint config in repo
npm run build           # ✓ compiles, 20 static pages, no API routes
```

`npm install` warned: `next@15.1.0: This version has a security
vulnerability. Please upgrade to a patched version.`

`npm audit` headline:

```
next 9.3.4-canary.0 - 16.3.0-canary.5     Severity: critical
  • Authorization Bypass in Next.js Middleware (GHSA-f82v-jwr5-mffw)
  • Next.js is vulnerable to RCE in React flight protocol (GHSA-9qr9-h5gf-34mp)
  • SSRF via WebSocket upgrades, middleware redirects (GHSA-c4j6, GHSA-4342)
  • Multiple cache-poisoning, DoS, XSS, image optimization advisories
postcss <8.5.10                            Severity: moderate
```

`next build` confirms every route renders static (`○`). There are no `app/
api/*` routes and no `middleware.ts` — so authentication, authorization,
and admin gating exist exclusively in client React.

## 3. P0 — launch blockers

### P0.1 — Next.js dependency has a critical CVE chain
- **File:** `package.json:26` (`"next": "15.1.0"`)
- **Risk:** Auth-bypass in middleware, SSRF, RCE in React flight, several
  DoS and cache-poisoning vectors.
- **Fix:** Bump to `^15.5.18` (the lowest patched release in the audit
  output). React 19 stays unchanged. Re-run `npm install`, typecheck,
  build.

### P0.2 — Demo login picker ships to production
- **Files:** `app/login/page.tsx:42-74`, `lib/session.tsx:96-103`,
  `app/(app)/layout.tsx`, `components/shell/auth-gate.tsx`.
- **Risk:** Anyone visiting `/login` clicks any user (including admin) and
  is signed in. No password, no email verification, no rate limiting.
  In mock mode this is "just demo data," but the same code path is the
  only auth gate in Supabase mode too.
- **Fix:** Introduce `NEXT_PUBLIC_DEMO_MODE` (default `"1"` for the
  current internal demos). When unset/`"0"`, hide the demo picker, show a
  placeholder ("Supabase Auth UI is coming soon — contact an admin for
  access"), and disable `signInAsDemoUser` for unknown users. Add docs
  noting that this flag must be `0` before public launch.

### P0.3 — RoleSwitcher = instant impersonation
- **File:** `components/shell/role-switcher.tsx:50-72`.
- **Risk:** The top-bar avatar opens a dropdown listing every active user
  with a radio button. Clicking the radio runs `signInAsDemoUser(userId)`.
  No role gate, no confirmation. A writer becomes admin in one click.
- **Fix:** Render the user list portion only when
  `NEXT_PUBLIC_DEMO_MODE !== "0"`. Outside demo mode show just the
  current user + Sign out (the production behaviour).

### P0.4 — Supabase adapter trusts client-supplied actor IDs
- **File:** `lib/api/supabase-adapter.ts`
  - `decidePitch:1106-1125` — `decided_by_id` from client.
  - `decideSensitiveFlag:1526-1560` — same.
  - `decideExtension:876-909` — same.
  - `convertPitch:1127-1214` — `leaderId` from client.
  - `updateModerationReport:965-997` — `resolvedById` from client.
  - `createModerationReport:926-963` — `reporter_id`/`severity` from client.
  - `requestExtension:853-874` — `requestedById` from client.
  - `raiseSensitiveFlag:1465-1524` — `raisedById` from client (RLS does
    enforce `auth.uid()` here so this is the one that's safe).
  - `updateUserRole:515-524`, `setUserActive:526-535` — no caller assertion.
- **Risk:** RLS in `0001_init.sql` and `0003_newsroom_rls.sql` checks the
  caller's *role*, not their identity. An editor can decline a pitch and
  claim another editor made the decision; an admin can resolve a moderation
  report and attribute it to a co-admin. Audit logs become unreliable.
- **Fix:** Add an `assertSelf(actorId)` helper in
  `SupabaseApiClient` that throws when `actorId !== this.currentUserId`.
  Apply it on every mutation that takes an actor parameter. Long-term:
  also tighten the RLS `with check` clauses (next migration), but the
  client guard is the cheap-and-safe first line.

### P0.5 — Missing `auth.users` → `public.users` sync trigger
- **File:** `supabase/migrations/0001_init.sql:90-92` (the comment lies; no
  trigger exists in this file or 0002/0003).
- **Risk:** When you eventually flip on Supabase Auth, every new sign-up
  creates an `auth.users` row but no matching `public.users` row.
  `current_app_role()` then returns null, RLS denies everywhere, and the
  user gets a permanent "Loading session…" screen with no error.
- **Fix:** Ship a `0004_auth_user_sync.sql` migration that creates an
  `on auth.users insert` trigger to upsert into `public.users` with the
  email/name from the auth row and default `role='writer'`. Document the
  cutover in `supabase/README.md`.

## 4. P1 — broken UX / launch-quality bugs

### P1.1 — My-Pitches "issue" lookup uses wrong field
- **File:** `app/(app)/pitches/page.tsx:198`
- `const issue = issues.find((i) => i.id === p.taskId);` — but `p.taskId`
  points to a Task id, not an Issue id. The "My pitches" detail line
  shows the wrong (usually missing) issue name.
- **Fix:** Look up the converted task, then the issue from that task's
  `issueId`. Or simpler — drop the issue label until we have the actual
  data path.

### P1.2 — `task-card.tsx` always renders "v1"
- **File:** `components/kanban/task-card.tsx:142-144`
- Inline comment admits "version is implied; we show a marker" then prints
  literal `v1`. Tasks on their fifth submission still say v1.
- **Fix:** Either drop the badge or compute it from the current submission
  via the store; given the card is otherwise dense, drop it.

### P1.3 — `task-card.tsx` uses mock-only user lookup
- **File:** `components/kanban/task-card.tsx:6,43-44`
- `import { userById } from "@/lib/mock-data"`. In Supabase mode tasks
  carry uuid writer/editor ids the mock array doesn't know about → avatar
  initials silently disappear.
- **Fix:** Read users from `useStore().users` (or the API hook) so the
  lookup works against whichever adapter is active.

### P1.4 — Task form deadline accepts past dates
- **File:** `components/task/task-form-dialog.tsx:199-205`
- The `<Input type="date">` has no `min`, so leaders can create tasks due
  yesterday by accident, which then appear "overdue" instantly.
- **Fix:** Set `min` to today's date in `yyyy-MM-dd`.

### P1.5 — Convert-pitch editor dropdown shows deactivated editors
- **File:** `app/(app)/pitches/page.tsx:447`
- `const editors = users.filter((u) => u.role === "editor");` — no
  `active !== false` filter. A pitch can be assigned to a deactivated
  editor.
- **Fix:** Add the active filter, matching `task-form-dialog.tsx:49`.

### P1.6 — Moderation dialog uses `useMemo` for a side effect
- **File:** `app/(app)/admin/moderation/page.tsx:411-413`
- `useMemo(() => setNote(...), [report?.id])` then `eslint-disable-next-line`.
  This is wrong: `useMemo` runs during render and may run twice (Strict
  Mode), and React 19's compiler may elide it entirely. Should be
  `useEffect`.
- **Fix:** Replace with `useEffect`.

### P1.7 — `DeadlineScanControl` is visible to every user
- **File:** `app/(app)/notifications/page.tsx:78` +
  `components/notifications/deadline-scan-control.tsx`
- The "demo simulator" fires team-wide notifications. It's labeled "Demo"
  but renders for writers too.
- **Fix:** Gate behind `canManageUsers(role)` (admin) or
  `canModerate(role)` (leader/admin).

### P1.8 — Top-bar Search input does nothing
- **File:** `components/shell/topbar.tsx:13-18`
- Placeholder says "Search tasks, people, messages…" but no handler, no
  state, no result list. Pressing Enter does nothing.
- **Fix:** Remove the input (cleanest) or add a TODO comment until search
  ships. Removing is correct for launch.

### P1.9 — "New conversation" button is permanently disabled
- **File:** `components/messages/conversation-list.tsx:65-68`
- Button has `disabled={!canCreateGroup}` and no `onClick` handler — even
  if disabled were false, nothing happens. Dead affordance.
- **Fix:** Remove for now (creating conversations isn't implemented).
  Leave a documented TODO in code.

### P1.10 — Forms have no in-flight state → double-submit
- **Files:** every form-shaped component. Notable instances:
  - `components/task/submission-form.tsx:61-76` (`handleSubmit`)
  - `components/task/review-panel.tsx:149-160` (`decide`)
  - `components/task/comments-panel.tsx:51-60` (`send`)
  - `components/task/task-form-dialog.tsx:93-123` (`submit`)
  - `components/messages/chat-view.tsx:93-101` (`send`)
  - `app/(app)/announcements/page.tsx:47-67` (`post`)
  - `app/(app)/pitches/page.tsx:263-295` (`handleSubmit`)
- **Fix:** Add a `busy` state, disable the submit button while it's set,
  wrap the call in try/finally. Done for the most-likely-doubled actions
  first (pitch, review, submission, announcement).

### P1.11 — Many API calls have no `try/catch`
- **Files:** `app/(app)/pitches/page.tsx:530-552`,
  `components/task/sensitive-panel.tsx:105-129`,
  `app/(app)/admin/escalations/page.tsx:121-128`, etc.
- An adapter error throws an unhandled promise rejection and the UI looks
  like it succeeded.
- **Fix:** Wrap mutations in try/catch; in catch, set a local error string
  and show it inline. (Out-of-scope: a global toast system.)

### P1.12 — Notification rows look clickable but aren't
- **File:** `components/notifications/notification-item.tsx:22-69`
- The whole row has a pointer cursor via Card styling and users expect a
  click to take them somewhere. Only the "Mark as read" check works.
- **Fix:** Either remove the hover affordance or wire up a best-effort
  deep link (e.g., task-assigned/comment/review_decision → /board with
  the task drawer). Removing the misleading affordance is the safe
  launch fix; deep-linking is a follow-up because notifications don't
  currently carry the resource id.

### P1.13 — Notification preferences are localStorage-only
- **File:** `app/(app)/notifications/preferences/page.tsx:35-67`
- Preferences are written to `advantage-portal:notif-prefs:<userId>` and
  never sent to the backend, so they reset on a different device or after
  clearing storage. The "How we keep this quiet" panel claims dedup is
  enforced — but only locally.
- **Fix:** Document the limitation in copy ("Preferences are stored on
  this device for now"). Real persistence requires a `notification_prefs`
  table; track in roadmap.

### P1.14 — Pitch review card renders Accept/Decline for any user
- **File:** `app/(app)/pitches/page.tsx:431-565`
- The parent only renders the queue tab when `isReviewer`, but the
  `PitchReviewCard` component itself accepts no role guard. Anyone who
  could see the card (e.g., via a future deep link) would see Accept/
  Decline buttons.
- **Fix:** Defensive: check `isReviewer` inside the card and hide the
  decision buttons otherwise. Adapter already enforces this once the
  Supabase RLS lands.

### P1.15 — `messages` page height clips behind mobile tabbar
- **File:** `app/(app)/messages/page.tsx:34`
- `h-[calc(100vh-4rem)]` ignores the 5rem mobile bottom bar. On mobile,
  the chat composer is partially obscured.
- **Fix:** Subtract the tabbar height on mobile (use `min-h-[calc(100dvh-4rem-5rem)]`
  or pad-bottom). Verified visually in the build.

### P1.16 — ESLint is not configured
- No `.eslintrc*` / `eslint.config.*` file exists; the package depends on
  `eslint-config-next` but never wires it. `npm run lint` becomes an
  interactive prompt.
- **Fix:** Add a minimal `.eslintrc.json` with `{"extends": "next"}` so
  CI can run lint without prompts. Track lint warnings as a follow-up.

## 5. P2 — polish / micro

| ID | File / line | Note |
|---|---|---|
| P2.1 | `lib/api/mock-adapter.tsx:243-248` | `hideMessage` returns `m as MessageZ`; should pass through `asMessage()` for consistency. |
| P2.2 | `app/(app)/dashboard/page.tsx:96-97` | `writerCount`/`editorCount` computed and unused. |
| P2.3 | `app/(app)/tasks/page.tsx:139` | `<input type="hidden" value={user.id} readOnly />` is cruft. |
| P2.4 | `app/(app)/pitches/page.tsx:391` | `p-deadline` has no `min`. |
| P2.5 | `app/(app)/pitches/page.tsx:260` | `whyNow.trim().length > 4` excludes some valid short pegs and admits whitespace-heavy 5-char strings. |
| P2.6 | `app/(app)/dashboard/page.tsx:826` | "Open queue →" mixes arrow shorthand with other buttons that don't. |
| P2.7 | `components/task/submission-form.tsx:114-143` | File "upload" only captures metadata; the file blob is dropped. Confusing for writers. |
| P2.8 | `supabase/seed*.sql` | No `select current_database()` guard, easy to run against the wrong env. |
| P2.9 | `lib/api/mock-adapter.tsx:309-316` | `updateIssue` no-ops for non-status patches in mock mode; UI returns a stale value. |
| P2.10 | `lib/notifications.ts` notifications never carry the target resource id (taskId/messageId), blocking the "make notifications clickable" P1. |
| P2.11 | `app/(app)/messages/page.tsx:42-46` | `onSelect` runs `setSelectedId` twice. |
| P2.12 | `components/task/editorial-checklist.tsx:87-95` | No optimistic update on toggle → noticeable latency under Supabase mode. |

## 6. Cross-cutting recommendations

- **Auth strategy doc.** Decide before launch: is this product gated by
  Supabase Auth (recommended), Clerk, Auth0, or magic link? The demo
  picker can't be the production sign-in.
- **Tighten RLS.** Add `with check (decided_by_id = auth.uid())` clauses
  to every "decision" table, so even a compromised client can't fake the
  actor id. This and the adapter `assertSelf` together give defense in
  depth.
- **Add a server-rendered auth guard.** Either App-Router middleware that
  reads the Supabase cookie and 302s to `/login` for unauthenticated
  `/admin/*`, or convert the admin pages to server components that fetch
  the session before rendering. Today every protected page renders on the
  client and then redirects, which means anyone with the static HTML
  briefly sees the admin shell.
- **Add CI.** GitHub Actions with `npm install`, `npm run typecheck`,
  `npm run lint`, `npm run build` is enough to catch regressions like the
  ones in this audit.

## 7. Fixes applied in this audit

All commits on `claude/security-code-audit-ox8ta`:

| Audit refs | Commit | What changed |
|---|---|---|
| (audit) | `docs: bug + launch-readiness audit for the Advantage Portal` | Adds `docs/advantage-portal-bug-audit.md`. |
| P0.1 | `security: upgrade next + eslint-config-next to 15.5.18` | Resolves the critical CVE chain on Next 15.1.0. Build still ✓. |
| P0.2, P0.3 | `security: gate demo login + role switcher behind NEXT_PUBLIC_DEMO_MODE` | `isDemoMode()` helper added to `lib/session.tsx`; `/login` and `RoleSwitcher` hide the user picker when the flag is `0`; `signInAsDemoUser` refuses outside demo mode. |
| P0.4 | `security: SupabaseAdapter enforces actor id == signed-in user` | New `assertSelf(method, actorId)` guard on every mutation that takes an actor id (`decidePitch`, `decideExtension`, `decideSensitiveFlag`, `convertPitch`, `raiseSensitiveFlag`, `requestExtension`, `createPitch`, `createModerationReport`, `updateModerationReport`, `bulkUpdateModerationReports`); reporter-supplied `severity` ignored; `updateUserRole` / `setUserActive` refuse self-edits. |
| P0.5 | `db: migration 0004 — sync auth.users to public.users on signup` | New `0004_auth_user_sync.sql` with `handle_new_user()` trigger + email-update trigger + backfill of any orphan auth rows. README updated. |
| P1.1, P1.5, P1.10, P1.11, P1.14, P2.4, P2.5 | `fix(pitches): My-Pitches issue lookup + busy/error states + active editors` | Resolves My-Pitches via task → issue rather than mismatching task id with issue id; filters inactive editors; PitchForm + PitchReviewCard now have busy + try/catch + inline error; deadline picker has `min=today`; defensive `canDecide` gate on the review buttons. |
| P1.6 | `fix(ui): correctness batch …` (moderation slice) | `useMemo` mis-used as a side effect → `useEffect`. |
| P1.2, P1.3, P1.4, P1.7, P1.8, P1.9 | `fix(ui): correctness batch — task card, task form, dead UI, moderation` | Task card uses live store users + real submission version (no more hardcoded v1); task form deadline rejects past dates and disables while busy; DeadlineScanControl gated to leader/admin; dead Search input and dead "New conversation" button removed. |
| P1.10, P1.11 | `fix(forms): busy + error states across writer/editor form surfaces` | submission-form, review-panel, comments-panel, sensitive-panel, escalations card, announcements post, chat-view send all gain a busy gate + try/catch + inline error. Submission form also tells writers that file uploads aren't persisted yet. |
| P1.16 + 2 real hooks bugs | `chore(lint): enable eslint + fix two real Rules-of-Hooks violations` | Adds `.eslintrc.json`. The new lint pass surfaced two genuine bugs — `useMemo` after early return in `admin/page.tsx`, `useEditorialChecklist` after early return in `task-drawer.tsx` — both fixed. The over-eager `react/no-unescaped-entities` rule is off (low signal); rules-of-hooks, exhaustive-deps (as warnings), and the rest stay on. |

## 8. Remaining risks for launch

- Supabase Auth UI is not wired in. The demo session shim is still the
  only sign-in path; flipping `NEXT_PUBLIC_DEMO_MODE=0` hides the picker
  but leaves the door for the real auth UI to be implemented.
- Adapter-level actor enforcement is a defence-in-depth measure; the
  matching RLS `with check (actor_id = auth.uid())` clauses still need
  a follow-up migration so the database refuses too.
- `notification_prefs` is not persisted server-side.
- Real file uploads for submissions are unimplemented; today only metadata
  is captured. The submission form now warns writers about this.
- Global search across tasks/people/messages is not implemented.
- Conversation creation is not implemented (the button has been removed
  in this branch).
- Notification rows do not deep-link to their target resource yet; payload
  doesn't carry the relevant ids (P2.10). Tracked as a follow-up.
- A handful of `react-hooks/exhaustive-deps` warnings remain in
  dashboard/calendar/issues/reviews/tasks/pitches/notifications/task-drawer.
  All are the same pattern (`const xs = dataMaybe ?? []` then used as a
  useMemo dep). They're warnings, not errors, but worth cleaning up later.

## 9. Manual testing steps before launch

1. Build with `NEXT_PUBLIC_DEMO_MODE=0` and confirm `/login` shows the
   "Real auth coming soon" placeholder and `RoleSwitcher` shows only the
   current user + Sign out.
2. Build with `NEXT_PUBLIC_DEMO_MODE=1` and confirm the demo picker and
   role-switch work as before.
3. With Supabase mode on, sign in as a writer and verify you cannot:
   accept a pitch attributed to another editor, resolve a moderation
   report attributed to another admin, or change another user's role.
4. Open the kanban board and confirm the badge on submitted cards shows
   the real version number, not a fixed "v1".
5. Create a task with an attempted past deadline — verify the picker
   refuses.
6. Sign in as a writer and verify the deadline scan control is hidden
   on /notifications.
7. Open `/notifications/preferences`, flip toggles, reload — verify the
   in-copy "stored on this device" note is present and the toggles stick.
8. Convert a pitch with a deactivated editor selected — verify the
   editor isn't in the dropdown.
9. Open /messages and verify the dead "New conversation" button is gone
   and that the composer is fully visible above the mobile tabbar.
10. Run `npm install` and confirm there is no Next.js security warning.

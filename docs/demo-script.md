# Demo Script — Advantage Portal MVP

A 7-minute, end-to-end walkthrough that exercises every major surface
across every role. Run from a freshly opened browser tab in dev mode
(`npm run dev`) so the seed data is fresh.

> Each step lists the actor, the action, and what the audience should see.
> Use the avatar menu (top-right) to switch demo users between scenes.

---

## Setup (15 seconds)

1. Open the app — you land on `/login`.
2. Sign in as **Riley Brooks (leader)**.
3. You arrive at `/dashboard`. Confirm the leader-tier stat cards render
   (Tasks / In flight / Overdue / Team).

## Scene 1 — Leader creates a task (60 seconds)

1. Top-right of dashboard, click **"New task"**.
2. Fill in:
   - **Title:** _Profile: Dr. Patel's research lab_
   - **Instructions:** _Long-form, 1500 words. Two interviews._
   - **Writer:** Alex Rivera
   - **Editor:** Casey Lee
   - **Deadline:** 5 days from today
   - **Priority color:** amber
3. Submit. The drawer closes; a new card appears at the top of the
   "Upcoming deadlines" list.
4. Open `/board` — confirm the card sits in the **Not Started** column.

> Talk track: leaders own task creation. Writers and editors do not see
> a New Task affordance.

## Scene 2 — Writer submits work (90 seconds)

1. Switch user to **Alex Rivera (writer)** via the avatar menu.
2. Dashboard now shows _writer-tier_ stats and the new task in
   "My tasks".
3. Open the task drawer (click the card).
4. Drag the card from **Not Started** → **In Progress** (board) — note
   the move is allowed because Alex owns it.
5. Reopen the drawer, switch to the **Submission** tab.
6. Submit an inline draft. Paste a few paragraphs of placeholder text
   (3–5 lines).
7. Click **Submit work**. The task status flips to **Submitted** and
   the writer is locked out of further drag transitions.

> Talk track: writers cannot drag into Submitted. They have to use the
> submission flow. Likewise they can't reach Complete — only an editor
> review can do that.

## Scene 3 — Editor reviews (90 seconds)

1. Switch user to **Casey Lee (editor)**.
2. Dashboard shows the editor-tier "Awaiting review" stat. Click it
   or open the task from the kanban.
3. The drawer opens on the **Review** tab automatically because Casey
   has reviewer authority on this task.
4. Inside the **InlineMarkdownViewer**, click any line number — the
   inline composer opens.
5. Add a per-line comment: _"Tighten this paragraph."_
6. Add another inline comment on a different line.
7. Switch to the **Comments** tab to confirm both inline comments are
   listed under "Inline comments" with line numbers (L2, L4, …) and
   the General-comments section is empty but available.
8. Back on the Review tab, pick **Request changes** and add the note
   _"Two small line edits attached."_, then **Submit decision**.
9. Task status moves back to **In Progress**; Alex receives a notification.

> Talk track: inline comments are anchored to a specific submission
> version. If Alex submits v2, the v1 comments stay tied to v1.

## Scene 4 — Notification + deadline simulator (60 seconds)

1. Switch back to **Alex Rivera (writer)**.
2. Bell icon (top right) shows an unread badge — open it. The
   "Changes requested" notification is at the top.
3. Open `/notifications` — the **Deadline Reminder Simulator** sits at
   the top.
4. Hit **Run scan**. The control reports the new reminders that fired
   (anything matching 7d / 3d / 1d / overdue thresholds).
5. Hit **Run scan** again — count is 0. Dedupe is working.
6. Hit **Reset** to clear the issued-key set if you want to demo
   re-firing.

> Talk track: in production this is a server-side cron, not a demo
> button. The pure scanner in `lib/deadline-reminders.ts` is the same
> code that will run in the Edge Function.

## Scene 5 — Calendar reflects the new task (30 seconds)

1. Open `/calendar`. The new "Profile: Dr. Patel's research lab" entry
   sits on its deadline cell (amber dot).
2. Toggle to **Agenda** view — same task appears with full metadata.
3. Apply a writer filter to "Alex Rivera" — only Alex's tasks remain.
4. Click the new task's chip — the same TaskDrawer opens, showing
   Alex's view (Brief + Submission tabs).

## Scene 6 — Announcement (30 seconds)

1. Switch to **Riley Brooks (leader)**.
2. Open `/announcements`.
3. Post a new announcement: _"Issue #43 ships next Friday — Profile
   pieces lead the front."_ Submit.
4. Pin it. Confirm the pin badge.

> Talk track: announcements are posted into the all-team channel.
> Anyone can read; only leader/admin can post or pin.

## Scene 7 — Admin changes a user role (45 seconds)

1. Switch to **Taylor Singh (admin)**.
2. Open `/team`. Confirm role badges render for everyone.
3. Click the **Admin tools** button → `/admin`.
4. In the user table, change **Sam Patel** from `Writer` → `Editor`.
5. The row updates immediately; the totals (admins / active /
   deactivated) refresh.
6. Switch to **Sam Patel** — you now see the editor-tier dashboard
   ("Awaiting review", "Active assignments", …).

> Talk track: admin mutations route through `useStore` today. With the
> Supabase backend wired, the same flow becomes a row update under RLS.

## Scene 8 — Sign out (15 seconds)

1. Click the avatar menu, choose **Sign out**.
2. You land back on `/login`. The session is cleared from
   `localStorage`.

---

## Reset between demos

If you want a clean board for the next run:

1. Sign out.
2. Open DevTools → Application → Local Storage → clear
   `advantage-portal:session`.
3. Refresh — the page redirects to `/login` and the in-memory store
   reseeds on the next route.

That's it. The whole cycle (create → submit → review → notify →
calendar → announce → admin) takes about seven minutes and exercises
every permission gate, every state transition, and every UI surface.

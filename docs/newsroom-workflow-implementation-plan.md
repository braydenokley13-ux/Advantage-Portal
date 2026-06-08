# Newsroom Workflow — Implementation Plan & Phase Notes

Brand clarification first: **The Advantage Journal** is the brand name of a
student newspaper / online publication (theadvantagejournal.org). It is *not*
a personal-finance journal or diary product. This portal is the newsroom
operating system that backs that publication.

This document captures the architectural plan for the newsroom workflow phase
and lists what shipped in this checkpoint set so future contributors can pick
up the thread without re-auditing.

## Why a newspaper-specific model

The first phases shipped a generic task tracker with role splits and
moderation. Real newsroom work doesn't fit a 4-status flow — a story moves
through pitch, drafting, section edit, copy edit, fact-check, final approval,
publish-ready, and only then published. Editors are not a single role:
section editors, copy editors, and fact-checkers each have a queue. Issues
have a planned date and a budget of stories. Some stories require leader or
admin escalation before they can run.

This phase makes the portal feel like a newsroom while preserving the
existing task-based foundation.

## Domain model (this phase, additive)

| Concept                | Carrier                                     | Notes |
|------------------------|---------------------------------------------|-------|
| Section                | `Section` (lib/types.ts)                    | News, Opinion, Business, Markets & Finance, Community, Culture, Sports, World, Features. |
| Pitch                  | `Pitch`                                     | Submitted by writers; reviewed by editors/leaders. Approved pitches convert to a Task with the brief copied across. |
| Story / Article        | Existing `Task`, with newsroom fields       | Adds `sectionId`, `pitchId`, `issueId`, `copyEditorId`, `factCheckerId`, `slug`, `assignmentBrief`, `wordCountActual`, `sensitive`. |
| Issue / Edition        | `Issue`                                     | Has a publishDate and a list of slotted stories with `must_run`/`nice_to_run` priority. |
| Assignment brief       | `AssignmentBrief` (embedded on Task)        | Angle, must-answer questions, required sources, quotes, visuals, publishing notes. |
| Editorial checklist    | `EditorialChecklist`                        | Per-task list keyed by item; grouped general / business / sensitive. |
| Publication stage      | Derived `StoryStage`                        | `pitch \| drafting \| section_edit \| copy_edit \| fact_check \| final_approval \| publish_ready \| published \| archived`. Computed from existing TaskStatus + checklist + sensitive flag (see `lib/newsroom-stage.ts`). |
| Sensitive escalation   | `SensitiveFlag` (embedded on Task)          | reason, notes, status (`open`/`cleared`/`holding`), raisedById, decidedById. |

The canonical `TaskStatus` (`not_started | in_progress | submitted |
complete`) is **not removed**. Newsroom stage is layered on top so the
existing kanban, permissions, and visibility logic keep working without a
migration.

## Workflow stages (derived)

`pitch` is reached only when a Story has a parent Pitch but no draft yet.
Once drafting starts (status moves off `not_started`), stage becomes
`drafting`. On submission (`submitted`), stage advances through
`section_edit → copy_edit → fact_check → final_approval` based on which
checklist groups are complete. When the editorial checklist's "Ready for
final approval" item is checked **and** any sensitive flag is `cleared`,
stage becomes `publish_ready`. Marking an Issue published moves all its
slotted stories to `published`.

## Role responsibilities

- **Writer** — submits pitches, drafts assigned stories, responds to
  feedback, can request extensions, raises sensitive flags when in doubt.
- **Section editor (`editor`)** — reviews pitches, runs section edit,
  hands off to copy desk, requests revisions.
- **Copy editor (`editor`)** — copy edit pass; can be the same editor or
  someone else assigned via `copyEditorId`.
- **Fact-checker (`editor`)** — fact-check pass; assigned via
  `factCheckerId`.
- **Leader / managing editor** — owns issue readiness, resolves
  escalations, approves publish-ready stories, monitors backlog.
- **Admin** — system & safety. Reviews escalations alongside leaders,
  manages users/roles, oversees moderation reports.

## Pitch workflow

1. Writer opens `/pitches`, fills out a pitch (headline, section, angle,
   why now, proposed sources, word count, preferred deadline, note).
2. Pitch enters editor/leader queue at `/pitches?tab=review`.
3. Editor accepts → pitch is `accepted`. Leader/admin can convert to an
   assignment, which creates a Task with the brief copied across and
   marks the pitch `converted`.
4. Editor declines → pitch is `declined` with an editor note. Writer sees
   it on their pitches tab.

Mock-mode only this phase. Supabase persistence has clean TODO markers in
`lib/store.tsx` and `lib/api/mock-adapter.tsx`. The Supabase adapter
continues to serve everything it did before; new entities are read from
the in-memory store regardless of `NEXT_PUBLIC_DATA_MODE`.

## Issue planning

`/issues` lists every Issue. Selecting one shows section coverage, slotted
stories with `must_run`/`nice_to_run`, readiness percentages, blockers
(stories with open sensitive flags or missing checklist items), and the
backlog by stage (copy edit / fact check). Leaders and admins can mark an
Issue published, which advances every slotted story to `published`.

## Editorial checklists

Built-in groups:

- **General** — headline accurate · lede clear · claims supported · sources
  named · quotes attributed · opinion labeled · grammar pass · ready for
  final approval.
- **Business / Markets** — financial claims sourced · market data dated ·
  no investment-advice language · terms explained for teen readers.
- **Sensitive** — privacy reviewed · escalation completed · language fair
  & precise · second editor reviewed.

Checklists drive the publication stage: a story can't reach
`publish_ready` while any required item is unchecked.

## Sensitive story escalation

Distinct from message moderation (which handles teen-safety in chat).
Editorial escalation flags a *story* for leader/admin review before
publication. Reasons:

- Student privacy
- Politics / geopolitics
- Financial claims
- Allegations / accusations
- Medical / mental health
- Other sensitive issue

A story with an `open` flag shows a clear banner in the drawer, blocks
publish-ready, and surfaces in the leader/admin dashboards. Leaders or
admins can `clear` (allow) or `hold` (block until resolved) the flag.

## Implemented this phase

- Domain types (`Section`, `Pitch`, `Issue`, `IssueSlot`,
  `AssignmentBrief`, `EditorialChecklist`, `SensitiveFlag`,
  `StoryStage`); extended `Task` with optional newsroom fields.
- Mock data: 7 sections, 2 issues, 7 pitches across sections, 7 sample
  stories with realistic teen-newsroom content, sensitive flag examples,
  populated assignment briefs and checklists.
- Newsroom stage helper (`lib/newsroom-stage.ts`) with stage-aware
  next-action microcopy per role.
- Pitches route at `/pitches` with two tabs (Submit, Review). Writers
  see their pitches; editors, leaders, and admins see the queue and can
  accept, decline, or convert to an assignment.
- Story drawer upgraded: section badge, stage chip, copy editor, fact
  checker, issue label, sensitive escalation banner, assignment brief
  card, editorial checklist with persisted toggles.
- Issues planning at `/issues`: edition list and detail view with
  section coverage, must-run progress, blocker list, and backlogs.
- Sensitive escalation flow: raise on the drawer; leader/admin Clear or
  Hold actions inline.
- Dashboards: writer "My pitches", editor "Pitch queue" / "Copy & fact
  desks", leader "Issue readiness" + "Sensitive escalations", admin
  "Sensitive escalations" overview.

## Phase 3 update — newsroom persistence (this update)

Done in `docs/newsroom-persistence-supabase.md`:

- Migration `0002_newsroom_workflow.sql` adds `sections`, `issues`,
  `issue_slots`, `pitches`, `editorial_checklists`, `sensitive_flags`,
  plus optional task columns (`section_id`, `pitch_id`, `issue_id`,
  `copy_editor_id`, `fact_checker_id`, `slug`, `assignment_brief jsonb`,
  `word_count_actual`).
- Migration `0003_newsroom_rls.sql` adds RLS policies that match the
  role responsibilities above (writer reads/inserts own pitches; editor
  triages; leader/admin owns issue planning + sensitive decisions).
- Seed file `seed_newsroom.sql` mirrors `lib/mock-data.ts`.
- `lib/api/client.ts`, `mock-adapter.tsx`, `supabase-adapter.ts`, and
  `lib/hooks/index.ts` gained newsroom methods/hooks. The newsroom UI is
  unchanged; mock mode keeps working untouched.

## Phase 4 update — newsroom UI on hooks (this update)

Done in `docs/newsroom-persistence-supabase.md` (Migration notes):

- `/pitches`, `/issues`, `/admin/escalations` now read source-of-truth
  data via `useSections / usePitches / useIssues / useIssueSlots /
  useTasks / useChecklists`. Mutations call `useApiClient()` and
  `refetch()` the affected resources.
- `EditorialChecklist`, `SensitivePanel`, and the relevant parts of
  `TaskDrawer` were migrated too. The drawer reads tasks via `useTasks`
  and the checklist via `useEditorialChecklist(task.id)`.
- New API: `listChecklists(taskIds?)` plus the `useChecklists()` hook
  for bulk checklist reads (used by the issues readiness derivation).
- New `/admin` Data mode badge so QA can see whether the active session
  is mock, Supabase, or supabase-requested-but-fallback.

## Phase 5 update — realtime board + pitch queue (this update)

- New `useRealtimeRefetch(tables, onChange)` hook
  (`lib/hooks/use-realtime.ts`) subscribes to Supabase Postgres changes and
  debounce-refetches. It is a no-op in mock mode / when Supabase env is
  absent, so every page can call it unconditionally.
- `/pitches` subscribes to `pitches`; the queue now updates live when any
  reviewer accepts, declines, or converts a pitch.
- `/issues` subscribes to `issues`, `issue_slots`, `tasks`,
  `editorial_checklists`, and `sensitive_flags`; readiness, blockers, and
  backlogs re-derive live as the slate changes.
- Migration `0009_realtime_newsroom.sql` adds those tables to the
  `supabase_realtime` publication (idempotent) and sets `REPLICA IDENTITY
  FULL`. RLS still governs what each subscriber receives.

## Phase 6 update — review loop off the store (this update)

The submission → review → comment editing surfaces no longer write through
`useStore`; they call the API client directly and refetch focused hooks,
matching the `SensitivePanel` / `EditorialChecklist` pattern from phase 4.

- `SubmissionForm`, `ReviewPanel`, `CommentsPanel`, and
  `InlineMarkdownViewer` now write via `useApiClient()` and read via
  `useSubmissions` / `useReviews(submissionId)` / `useComments(submissionId)`.
- `TaskDrawer` owns the task's submissions through `useSubmissions(taskId)`
  and passes an `afterTaskWrite` refetch (submissions + tasks) to the submit
  and review surfaces so the status cascade round-trips. `SubmissionHistory`
  now takes a `submissions` prop instead of reading the store.
- `/reviews` reads the review list via `useReviews()`.
- The workflow emails the store used to fan out (new submission → editor,
  decision → writer, comment → writer) moved to `lib/email/workflow.ts` so
  they're preserved on the API-client path.
- The store dropped `createSubmission`, `submitReview`, `addComment`,
  `toggleResolveComment`, and the now-unused `comments` collection. To keep
  the board / dashboard caches live with the new write path, `StoreProvider`
  subscribes to `submissions`, `reviews`, `comments`, `tasks` via
  `useRealtimeRefetch`. Migration `0010_realtime_review_loop.sql` adds those
  tables to the `supabase_realtime` publication.

## Phase 7 update — messages, moderation & extensions off the store (this update)

The last write surfaces that still went through `useStore` now write through the
API client directly and read through the data hooks, matching the phase-6
review-loop pattern. The store no longer mediates chat, moderation, or
extension writes — and no longer caches `conversations` / `messages` at all.

- **Messages.** `ChatView`, `ConversationList`, and the announcements composer
  read conversations + messages via `useConversations` / `useMessages` and send
  / pin / create through `useApiClient()`, refetching focused state after each
  write. `MessagesPage` and the top-bar search read conversations via the hook
  too. Each chat surface pairs its reads with `useRealtimeRefetch` so a thread
  stays live when another member posts — chat that previously only updated on a
  full store re-hydrate is now genuinely realtime.
- **Moderation.** The queue reads reported messages + users via `useMessages` /
  `useUsers` and subscribes to `moderation_reports` and `messages`. Hiding a
  message refetches the message list instead of poking the store; the
  report-from-chat flow still emails admins/leaders, now via
  `lib/email/workflow.ts`.
- **Extensions.** The task drawer requests and decides extensions through the
  API client and refetches tasks via the existing `afterTaskWrite` path. The
  "extension requested → leaders" and "decision → writer" emails moved to
  `lib/email/workflow.ts` so they survive off the store.
- **Store cleanup.** `sendMessage`, `togglePinMessage`, `createConversation`,
  `requestExtension`, `decideExtension`, `createModerationReport`,
  `updateModerationReport`, and `hideMessage` are gone from `StoreProvider`,
  along with the `conversations` and `messages` collections it used to hydrate.
- Migration `0011_realtime_messages_moderation.sql` adds `messages`,
  `conversations`, and `moderation_reports` to the `supabase_realtime`
  publication (idempotent) and sets `REPLICA IDENTITY FULL`. RLS still governs
  what each subscriber receives.

Still on the store after this phase: the task board (`setTaskStatus`), task
create/update (`createTask` / `updateTask`), user administration
(`updateUserRole` / `setUserActive`), and the notifications surface
(`markNotificationRead` / `markAllRead` / `pushNotification`). These are the
next migration candidates. The newsroom mutators the store still exposes
(pitch / issue / checklist / sensitive-flag writes) are already unused by the
UI — the pages call the API client directly — so they can be pruned whenever
the store is next touched.

## Future work

- Migrate the remaining store writes (task board + CRUD, user admin,
  notifications) onto hooks, and prune the now-unused newsroom mutators from
  `StoreProvider`. Chat, moderation, extensions, the review loop, and newsroom
  planning reads are now off the store.
- Per-stage SLAs and escalation-on-delay.
- Photo/visual asset model and rights tracking.
- Public-site sync (theadvantagejournal.org) for `published` stories.

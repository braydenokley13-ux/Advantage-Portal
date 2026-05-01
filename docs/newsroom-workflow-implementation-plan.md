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

## Future work

- Persist all new entities through Supabase. Schema sketch:
  `sections`, `issues`, `issue_slots`, `pitches`, `editorial_checklists`,
  `sensitive_flags`, plus `tasks` columns: `section_id`, `pitch_id`,
  `issue_id`, `copy_editor_id`, `fact_checker_id`, `slug`,
  `assignment_brief` (jsonb), `sensitive_id`.
- Real Supabase Auth (still pending from earlier phases).
- Row-Level Security on the new tables — writers see their pitches and
  assigned stories; editors see their queue; leaders/admins see all.
- Realtime subscription for the issue board and pitch queue.
- Per-stage SLAs and escalation-on-delay.
- Photo/visual asset model and rights tracking.
- Public-site sync (theadvantagejournal.org) for `published` stories.

-- ─────────────────────────────────────────────────────────────────────────────
-- Advantage Journal Portal — reconcile tasks stuck with a submission that the
-- portal never recognized.
--
-- Background: before the 0013 triggers existed, a WRITER inserting a submission
-- could not advance their task's status. `tasks_write` (0001) only lets
-- leaders/admins update tasks, so the client's follow-up
-- `UPDATE tasks SET status='submitted'` matched zero rows under RLS. The
-- submission landed, but the task stayed in `in_progress` (or `not_started`).
-- In the UI this shows as the "Drafting · No submission yet" stage even though
-- Version 1 is sitting right there in the version history — and because review
-- eligibility keys off `status = 'submitted'`, nobody can move the story
-- forward.
--
-- 0013 fixed this for every NEW submission, but triggers don't fire on rows that
-- already exist. This migration is a one-time repair of those stranded tasks.
--
-- Safety — we only touch tasks where the CURRENT submission has never been
-- reviewed. That uniquely identifies the stuck-on-submit case:
--   * A fresh submission with no review SHOULD be `submitted`.
--   * A task that's legitimately back in `in_progress` after an editor asked
--     for changes has a `changes_requested` review on its current submission,
--     so it is excluded and left exactly as-is.
-- Completed tasks are never touched.
-- ─────────────────────────────────────────────────────────────────────────────

update public.tasks t
   set status = 'submitted',
       current_submission_id = s.id
  from public.submissions s
 where s.task_id = t.id
   and s.is_current
   and t.status in ('not_started', 'in_progress')
   and not exists (
     select 1 from public.reviews r where r.submission_id = s.id
   );

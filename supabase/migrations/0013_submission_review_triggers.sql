-- ─────────────────────────────────────────────────────────────────────────────
-- Advantage Journal Portal — task-status triggers for the submission/review loop.
--
-- `tasks_write` (0001) only lets leaders/admins update tasks. So when a WRITER
-- inserts a submission, or an assigned (non-leader) EDITOR inserts a review, the
-- follow-up "advance the task status" UPDATE the client issued matched zero rows
-- under RLS — the submission/review was saved but the task never moved, so the
-- portal never recognized the work as submitted / reviewed.
--
-- These SECURITY DEFINER triggers move the status server-side, atomically with
-- the insert, regardless of who inserted or which client path ran (the
-- create_submission / create_review RPCs in 0012, or a plain insert). They are
-- idempotent with those RPCs — both set the same status, so applying 0012 and
-- 0013 together is safe.
-- ─────────────────────────────────────────────────────────────────────────────

-- A new submission puts its task into review and becomes the current version.
create or replace function public.tg_submission_advances_task()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.tasks
     set status = 'submitted',
         current_submission_id = new.id
   where id = new.task_id;
  return new;
end;
$$;

revoke all on function public.tg_submission_advances_task() from public;

drop trigger if exists submissions_advance_task on public.submissions;
create trigger submissions_advance_task
  after insert on public.submissions
  for each row
  execute function public.tg_submission_advances_task();

-- A new review rolls its task's status: approved/rejected close it,
-- changes_requested reopens it for revision.
create or replace function public.tg_review_rolls_task()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_task_id uuid;
begin
  select task_id into v_task_id
    from public.submissions
   where id = new.submission_id;

  if v_task_id is not null then
    update public.tasks
       set status = case
         when new.decision in ('approved', 'rejected') then 'complete'
         else 'in_progress'
       end
     where id = v_task_id;
  end if;

  return new;
end;
$$;

revoke all on function public.tg_review_rolls_task() from public;

drop trigger if exists reviews_roll_task on public.reviews;
create trigger reviews_roll_task
  after insert on public.reviews
  for each row
  execute function public.tg_review_rolls_task();

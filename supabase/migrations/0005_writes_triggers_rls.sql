-- ─────────────────────────────────────────────────────────────────────────────
-- Writes — triggers + RLS for submissions / reviews / comments
--
-- Phase 5 of the backend integration. Writers can INSERT into submissions
-- (RLS already allows that), but they cannot UPDATE the parent task row to
-- flip its status — `tasks_write` is leader/admin-only by design. Same for
-- the writer-side cross-cutting concern of marking prior submissions stale,
-- setting current_submission_id, and queuing an editor notification.
--
-- These cross-table effects move into SECURITY DEFINER triggers so they
-- execute privileged work without weakening table-level RLS. Reviews follow
-- the same pattern: editor inserts a review row, trigger flips the task and
-- notifies the writer.
--
-- Comments RLS is split: insert requires task access (defense-in-depth) and
-- update no longer requires `author_id = auth.uid()` so any task participant
-- can toggle resolve, matching `canComment` in lib/permissions.ts.
--
-- All statements are idempotent and safe on repeated runs.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Submissions trigger ───────────────────────────────────────────────
create or replace function public.tg_submission_after_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  task_row public.tasks%rowtype;
begin
  -- Fetch the parent task once.
  select * into task_row from public.tasks where id = new.task_id;
  if not found then
    return new;
  end if;

  -- Demote prior submissions on the same task.
  update public.submissions
    set is_current = false
    where task_id = new.task_id and id <> new.id and is_current = true;

  -- Promote the new one (in case the client supplied is_current=false).
  update public.submissions set is_current = true where id = new.id;

  -- Bump the parent task's status + current_submission_id.
  update public.tasks
    set status = 'submitted',
        current_submission_id = new.id
    where id = new.task_id;

  -- Notify the assigned editor (best-effort, ignore if no editor).
  if task_row.editor_id is not null then
    insert into public.notifications (user_id, kind, title, body)
    values (
      task_row.editor_id,
      'submission',
      'New submission: ' || task_row.title,
      'Version ' || new.version || ' ready for review.'
    );
  end if;

  return new;
end;
$$;

drop trigger if exists submissions_after_insert on public.submissions;
create trigger submissions_after_insert
  after insert on public.submissions
  for each row execute function public.tg_submission_after_insert();

-- ── 2. Reviews trigger ───────────────────────────────────────────────────
create or replace function public.tg_review_after_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  related_task public.tasks%rowtype;
  next_status task_status;
  notif_title text;
begin
  -- Walk submission → task.
  select t.* into related_task
  from public.submissions s
    join public.tasks t on t.id = s.task_id
  where s.id = new.submission_id;

  if not found then
    return new;
  end if;

  next_status := case
    when new.decision in ('approved', 'rejected') then 'complete'::task_status
    else 'in_progress'::task_status
  end;

  update public.tasks
    set status = next_status
    where id = related_task.id;

  -- Notify the writer.
  notif_title := case
    when new.decision = 'approved'           then 'Approved: '
    when new.decision = 'rejected'           then 'Rejected: '
    else                                          'Changes requested: '
  end || related_task.title;

  insert into public.notifications (user_id, kind, title, body)
  values (
    related_task.writer_id,
    'review_decision',
    notif_title,
    new.notes
  );

  return new;
end;
$$;

drop trigger if exists reviews_after_insert on public.reviews;
create trigger reviews_after_insert
  after insert on public.reviews
  for each row execute function public.tg_review_after_insert();

-- ── 3. Comments RLS split ────────────────────────────────────────────────
-- Replace the single `comments_write` policy (which restricted UPDATE to
-- author_id = auth.uid()) with separate INSERT / UPDATE policies that
-- match `canComment` in lib/permissions.ts: any task participant can
-- comment AND toggle resolve.
drop policy if exists comments_write on public.comments;

create policy comments_insert on public.comments
  for insert
  with check (
    author_id = auth.uid()
    and exists (
      select 1
      from public.submissions s
        join public.tasks t on t.id = s.task_id
      where s.id = comments.submission_id
        and (
          t.writer_id = auth.uid()
          or t.editor_id = auth.uid()
          or public.current_app_role() in ('leader','admin')
        )
    )
  );

create policy comments_update on public.comments
  for update
  using (
    exists (
      select 1
      from public.submissions s
        join public.tasks t on t.id = s.task_id
      where s.id = comments.submission_id
        and (
          t.writer_id = auth.uid()
          or t.editor_id = auth.uid()
          or public.current_app_role() in ('leader','admin')
        )
    )
  )
  with check (
    -- Prevent reassigning author / submission across an update.
    author_id = (select author_id from public.comments where id = comments.id)
    and submission_id = (select submission_id from public.comments where id = comments.id)
  );

-- Comment authors retain delete privileges for their own comments.
create policy comments_delete on public.comments
  for delete
  using (
    author_id = auth.uid()
    or public.current_app_role() in ('leader','admin')
  );

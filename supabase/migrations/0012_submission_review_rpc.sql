-- ─────────────────────────────────────────────────────────────────────────────
-- Advantage Journal Portal — atomic submission & review transitions.
--
-- The submission → review loop changes TWO tables together: it writes a
-- submissions/reviews row AND advances the parent task's status (and, for a
-- submission, its current_submission_id pointer). The client used to do this in
-- several separate statements, which had two problems:
--
--   1. Not atomic. A failure between the insert and the task update could leave
--      a task with a new submission but a stale status, or — when demoting the
--      previous current version — with NO current submission at all.
--
--   2. Blocked by RLS. `tasks_write` (0001) only lets leaders/admins update
--      tasks, so a writer submitting work or an assigned (non-leader) editor
--      rendering a decision could not move the task's status. The UPDATE
--      silently matched zero rows and the task never advanced.
--
-- These SECURITY DEFINER functions do the whole transition atomically and
-- enforce authorization in-function (mirroring lib/permissions.ts), so the
-- restrictive table policies stay intact while the workflow still works.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── create_submission ────────────────────────────────────────────────────────
-- Writer turns in a new version: compute the next version under a row lock (so
-- concurrent submits can't collide on version), demote the prior current
-- version, insert the new one as current, and advance the task into review.
create or replace function public.create_submission(
  p_task_id uuid,
  p_type public.submission_type,
  p_content text,
  p_file_filename text default null,
  p_file_mime_type text default null,
  p_file_size_bytes bigint default null
)
returns public.submissions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_task    public.tasks;
  v_version integer;
  v_row     public.submissions;
  v_is_file boolean := p_type = 'file';
begin
  -- Lock the task row so version numbering and the is_current handoff are
  -- serialized against concurrent submissions for the same task.
  select * into v_task from public.tasks where id = p_task_id for update;
  if not found then
    raise exception 'Task % not found', p_task_id using errcode = 'P0002';
  end if;

  -- Only the assigned writer may submit, and never on a locked (complete) task.
  if v_task.writer_id is distinct from auth.uid() then
    raise exception 'Only the assigned writer can submit work'
      using errcode = '42501';
  end if;
  if v_task.status = 'complete' then
    raise exception 'This task is complete and locked'
      using errcode = '42501';
  end if;
  if p_content is null or length(btrim(p_content)) = 0 then
    raise exception 'Submission content is required' using errcode = '22023';
  end if;

  select coalesce(max(version), 0) + 1
    into v_version
    from public.submissions
   where task_id = p_task_id;

  -- Demote the previous current version; the partial unique index
  -- `(task_id) where is_current` permits only one current row per task.
  update public.submissions
     set is_current = false
   where task_id = p_task_id
     and is_current;

  insert into public.submissions (
    task_id, type, version, content,
    file_filename, file_mime_type, file_size_bytes, is_current
  ) values (
    p_task_id, p_type, v_version, p_content,
    case when v_is_file then p_file_filename  else null end,
    case when v_is_file then p_file_mime_type else null end,
    case when v_is_file then p_file_size_bytes else null end,
    true
  )
  returning * into v_row;

  -- Advance the task into review and point it at the new current version.
  update public.tasks
     set status = 'submitted',
         current_submission_id = v_row.id
   where id = p_task_id;

  return v_row;
end;
$$;

revoke all on function public.create_submission(
  uuid, public.submission_type, text, text, text, bigint
) from public;
grant execute on function public.create_submission(
  uuid, public.submission_type, text, text, text, bigint
) to authenticated;

-- ── create_review ────────────────────────────────────────────────────────────
-- Editor (or leader/admin) renders a decision: record the review and roll the
-- task's status — approved/rejected close it, changes_requested reopens it for
-- revision. The reviewer is always the caller (auth.uid()), never client input.
create or replace function public.create_review(
  p_submission_id uuid,
  p_decision public.review_decision,
  p_notes text default null
)
returns public.reviews
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sub  public.submissions;
  v_task public.tasks;
  v_row  public.reviews;
  v_role public.app_role := public.current_app_role();
  v_next public.task_status;
begin
  select * into v_sub from public.submissions where id = p_submission_id;
  if not found then
    raise exception 'Submission % not found', p_submission_id using errcode = 'P0002';
  end if;

  select * into v_task from public.tasks where id = v_sub.task_id for update;
  if not found then
    raise exception 'Task not found' using errcode = 'P0002';
  end if;

  -- Authorize: a leader/admin or the assigned editor, and never the writer.
  if v_task.writer_id = auth.uid() then
    raise exception 'Writers cannot review their own submissions'
      using errcode = '42501';
  end if;
  if not (v_role in ('leader', 'admin') or v_task.editor_id = auth.uid()) then
    raise exception 'Only the assigned editor or a leader/admin can review'
      using errcode = '42501';
  end if;
  if v_task.status <> 'submitted' then
    raise exception 'There is no submission awaiting review'
      using errcode = '42501';
  end if;

  insert into public.reviews (submission_id, reviewer_id, decision, notes)
  values (
    p_submission_id,
    auth.uid(),
    p_decision,
    nullif(btrim(coalesce(p_notes, '')), '')
  )
  returning * into v_row;

  v_next := case
    when p_decision in ('approved', 'rejected') then 'complete'
    else 'in_progress'
  end;
  update public.tasks set status = v_next where id = v_task.id;

  return v_row;
end;
$$;

revoke all on function public.create_review(
  uuid, public.review_decision, text
) from public;
grant execute on function public.create_review(
  uuid, public.review_decision, text
) to authenticated;

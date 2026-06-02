-- ─────────────────────────────────────────────────────────────────────────
-- Deadline reminder de-duplication.
--
-- The /api/cron/deadline-reminders endpoint scans open tasks and emails the
-- writer/editor (and leaders on overdue stories) at the 7d / 3d / 1d / overdue
-- marks. This table records which (task, kind, recipient) reminders have
-- already gone out so a cron that runs more than once a day — or an overdue
-- task that stays open — never re-sends the same nudge.
--
-- Only the service-role cron touches this table, so RLS is enabled with no
-- policies (service role bypasses RLS; everyone else is denied).
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.deadline_reminders_sent (
  task_id  uuid not null references public.tasks(id) on delete cascade,
  kind     text not null,
  user_id  uuid not null references public.users(id) on delete cascade,
  sent_at  timestamptz not null default now(),
  primary key (task_id, kind, user_id)
);

create index if not exists idx_deadline_reminders_sent_task
  on public.deadline_reminders_sent (task_id);

alter table public.deadline_reminders_sent enable row level security;

-- ─────────────────────────────────────────────────────────────────────────────
-- 0018 — feedback (submit on anything → triage queue)
--
-- Any signed-in member can send feedback about anything in the Advantage — the
-- portal, a story, the essay competition, or a general idea. Leaders and admins
-- triage it in a queue (mirrors the moderation_reports shape). An optional
-- target_* pointer lets a piece of feedback reference the specific thing it's
-- about without a hard foreign key.
-- ─────────────────────────────────────────────────────────────────────────────

create type feedback_category as enum (
  'portal_bug',
  'feature_idea',
  'story_or_content',
  'competition',
  'general',
  'other'
);

create type feedback_status as enum (
  'open',
  'triaged',
  'planned',
  'resolved',
  'declined',
  'archived'
);

create table if not exists public.feedback (
  id              uuid primary key default gen_random_uuid(),
  author_id       uuid not null references public.users(id) on delete cascade,
  category        feedback_category not null default 'general',
  subject         text not null,
  message         text not null,
  rating          smallint check (rating is null or (rating between 1 and 5)),
  -- Optional pointer to whatever the feedback is about; all free-form/nullable.
  target_kind     text,
  target_id       uuid,
  target_label    text,
  status          feedback_status not null default 'open',
  assigned_to_id  uuid references public.users(id) on delete set null,
  admin_note      text,
  resolved_by_id  uuid references public.users(id) on delete set null,
  resolved_at     timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_feedback_status on public.feedback (status);
create index if not exists idx_feedback_author on public.feedback (author_id);
create index if not exists idx_feedback_created on public.feedback (created_at desc);

create trigger feedback_set_updated_at
  before update on public.feedback
  for each row execute function public.tg_set_updated_at();

-- ── RLS ─────────────────────────────────────────────────────────────────────
alter table public.feedback enable row level security;

-- Submitters see their own feedback; leaders/admins see all of it to triage.
create policy feedback_select on public.feedback
  for select using (
    author_id = auth.uid()
    or public.current_app_role() in ('leader', 'admin')
  );

-- Anyone signed in can submit, but only attributed to themselves.
create policy feedback_insert on public.feedback
  for insert with check (author_id = auth.uid());

-- Triage (status, assignment, internal note) is leader/admin only.
create policy feedback_update on public.feedback
  for update using (public.current_app_role() in ('leader', 'admin'))
              with check (public.current_app_role() in ('leader', 'admin'));

-- ── Realtime ────────────────────────────────────────────────────────────────
do $$
declare
  t text;
begin
  foreach t in array array['feedback']
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

alter table public.feedback replica identity full;

-- ─────────────────────────────────────────────────────────────────────────────
-- 0019 — essay competitions (internal, scored judging)
--
-- Members submit one essay per competition; editors/leaders/admins score each
-- entry against a rubric; a leader announces a winner. Mirrors the existing
-- pitch/submission/review shapes:
--   competition  ≈ issue/pitch parent
--   entry        ≈ submission (reuses submission_type)
--   score        ≈ review (with a rubric + numeric total)
-- ─────────────────────────────────────────────────────────────────────────────

create type competition_status as enum (
  'draft',
  'open',
  'judging',
  'announced',
  'archived'
);

create type entry_status as enum (
  'submitted',
  'shortlisted',
  'winner',
  'not_selected',
  'withdrawn'
);

create table if not exists public.competitions (
  id                 uuid primary key default gen_random_uuid(),
  title              text not null,
  prompt             text not null default '',
  description        text not null default '',
  rules              text not null default '',
  word_limit         integer check (word_limit is null or word_limit > 0),
  opens_at           timestamptz not null default now(),
  closes_at          timestamptz not null,
  status             competition_status not null default 'draft',
  anonymized_judging boolean not null default true,
  winner_entry_id    uuid,
  created_by_id      uuid references public.users(id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists idx_competitions_status on public.competitions (status);

create trigger competitions_set_updated_at
  before update on public.competitions
  for each row execute function public.tg_set_updated_at();

create table if not exists public.competition_entries (
  id              uuid primary key default gen_random_uuid(),
  competition_id  uuid not null references public.competitions(id) on delete cascade,
  author_id       uuid not null references public.users(id) on delete cascade,
  title           text not null,
  type            submission_type not null default 'inline',
  content         text not null default '',
  file_filename   text,
  file_mime_type  text,
  file_size_bytes bigint check (file_size_bytes is null or file_size_bytes >= 0),
  word_count      integer check (word_count is null or word_count >= 0),
  status          entry_status not null default 'submitted',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  -- one entry per member per competition (editable until close)
  unique (competition_id, author_id)
);

create index if not exists idx_competition_entries_competition
  on public.competition_entries (competition_id);
create index if not exists idx_competition_entries_author
  on public.competition_entries (author_id);

create trigger competition_entries_set_updated_at
  before update on public.competition_entries
  for each row execute function public.tg_set_updated_at();

-- Wire the winner FK now that the entries table exists.
alter table public.competitions
  add constraint competitions_winner_entry_fk
    foreign key (winner_entry_id)
    references public.competition_entries(id)
    on delete set null
    deferrable initially deferred;

create table if not exists public.competition_scores (
  id          uuid primary key default gen_random_uuid(),
  entry_id    uuid not null references public.competition_entries(id) on delete cascade,
  judge_id    uuid not null references public.users(id) on delete cascade,
  score       integer not null check (score >= 0),
  rubric      jsonb not null default '{}'::jsonb,
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  -- one (revisable) score per judge per entry
  unique (entry_id, judge_id)
);

create index if not exists idx_competition_scores_entry
  on public.competition_scores (entry_id);

create trigger competition_scores_set_updated_at
  before update on public.competition_scores
  for each row execute function public.tg_set_updated_at();

-- ── RLS ─────────────────────────────────────────────────────────────────────
alter table public.competitions        enable row level security;
alter table public.competition_entries enable row level security;
alter table public.competition_scores  enable row level security;

-- Competitions: everyone sees non-draft; managers (leader/admin) see drafts too.
create policy competitions_select on public.competitions
  for select using (
    status <> 'draft'
    or public.current_app_role() in ('leader', 'admin')
  );
create policy competitions_write on public.competitions
  for all using (public.current_app_role() in ('leader', 'admin'))
       with check (public.current_app_role() in ('leader', 'admin'));

-- Entries: authors see their own; judges/managers see all entries to score.
create policy competition_entries_select on public.competition_entries
  for select using (
    author_id = auth.uid()
    or public.current_app_role() in ('editor', 'leader', 'admin')
  );
create policy competition_entries_insert on public.competition_entries
  for insert with check (author_id = auth.uid());
create policy competition_entries_update on public.competition_entries
  for update using (
    author_id = auth.uid()
    or public.current_app_role() in ('leader', 'admin')
  ) with check (
    author_id = auth.uid()
    or public.current_app_role() in ('leader', 'admin')
  );

-- Scores: judges/managers read; a judge writes their own, managers write any.
create policy competition_scores_select on public.competition_scores
  for select using (public.current_app_role() in ('editor', 'leader', 'admin'));
create policy competition_scores_write on public.competition_scores
  for all using (
    public.current_app_role() in ('editor', 'leader', 'admin')
    and (judge_id = auth.uid() or public.current_app_role() in ('leader', 'admin'))
  ) with check (
    public.current_app_role() in ('editor', 'leader', 'admin')
    and (judge_id = auth.uid() or public.current_app_role() in ('leader', 'admin'))
  );

-- ── Realtime ────────────────────────────────────────────────────────────────
do $$
declare
  t text;
begin
  foreach t in array array[
    'competitions', 'competition_entries', 'competition_scores'
  ]
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

alter table public.competitions        replica identity full;
alter table public.competition_entries replica identity full;
alter table public.competition_scores  replica identity full;

-- ─────────────────────────────────────────────────────────────────────────────
-- Advantage Journal Portal — newsroom workflow schema (phase 3)
--
-- Adds the newspaper-specific entities introduced in the newsroom workflow
-- phase so they persist alongside the existing task graph:
--
--   sections                — News, Opinion, Markets & Finance, …
--   issues                  — scheduled editions of the publication
--   issue_slots             — stories slotted into an edition's run sheet
--   pitches                 — writer pitches awaiting an editorial decision
--   editorial_checklists    — per-story checklist (items as jsonb)
--   sensitive_flags         — per-story editorial escalation
--
-- Plus optional newsroom columns on `tasks` so the existing task graph can
-- carry section / pitch / issue / copy / fact-check / slug / brief / actual
-- word count without a destructive migration.
--
-- Design notes:
--   * Checklist items live on `editorial_checklists.items` as jsonb. The mock
--     model already treats the item set as one logical bundle (group + key +
--     checked + checkedById + checkedAt). A separate items table would add
--     roundtrips and offer little value: writes are always whole-list and
--     reads are always whole-list. Item key uniqueness inside the array is
--     enforced at the application layer (toggle-by-key).
--   * Identifiers stay `uuid`. The mock store uses string ids like "sec-news"
--     and "p1"; the seed file maps those to stable uuids so dev data stays
--     coherent across environments.
--   * RLS is enabled here. Concrete policies live in 0003_newsroom_rls.sql so
--     this migration is a clean schema diff that can be reviewed in isolation.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── enums (idempotent guards via DO blocks) ───────────────────────────────
do $$ begin
  create type pitch_status as enum ('submitted', 'accepted', 'declined', 'converted');
exception when duplicate_object then null; end $$;

do $$ begin
  create type issue_status as enum ('planning', 'production', 'published', 'archived');
exception when duplicate_object then null; end $$;

do $$ begin
  create type issue_slot_priority as enum ('must_run', 'nice_to_run');
exception when duplicate_object then null; end $$;

do $$ begin
  create type sensitive_status as enum ('open', 'cleared', 'holding');
exception when duplicate_object then null; end $$;

do $$ begin
  create type sensitive_reason as enum (
    'student_privacy',
    'politics',
    'financial_claims',
    'allegations',
    'medical_or_mental_health',
    'other'
  );
exception when duplicate_object then null; end $$;

-- ── sections ─────────────────────────────────────────────────────────────
create table if not exists public.sections (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  name        text not null,
  description text not null default '',
  accent      text not null default 'sky',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists idx_sections_slug on public.sections (slug);

create trigger sections_set_updated_at
  before update on public.sections
  for each row execute function public.tg_set_updated_at();

-- ── issues ───────────────────────────────────────────────────────────────
create table if not exists public.issues (
  id            uuid primary key default gen_random_uuid(),
  number        integer not null,
  name          text not null,
  publish_date  timestamptz not null,
  status        issue_status not null default 'planning',
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (number)
);

create index if not exists idx_issues_status_publish_date
  on public.issues (status, publish_date);

create trigger issues_set_updated_at
  before update on public.issues
  for each row execute function public.tg_set_updated_at();

-- ── pitches ──────────────────────────────────────────────────────────────
create table if not exists public.pitches (
  id                  uuid primary key default gen_random_uuid(),
  proposed_headline   text not null,
  section_id          uuid not null references public.sections(id) on delete restrict,
  angle               text not null default '',
  why_now             text not null default '',
  proposed_sources    text[] not null default '{}'::text[],
  expected_word_count integer check (expected_word_count is null or expected_word_count > 0),
  deadline_pref       timestamptz,
  writer_note         text,
  writer_id           uuid not null references public.users(id) on delete restrict,
  status              pitch_status not null default 'submitted',
  editor_note         text,
  decided_by_id       uuid references public.users(id) on delete set null,
  decided_at          timestamptz,
  task_id             uuid,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists idx_pitches_writer_status
  on public.pitches (writer_id, status);
create index if not exists idx_pitches_section_status
  on public.pitches (section_id, status);
create index if not exists idx_pitches_status_created
  on public.pitches (status, created_at desc);

create trigger pitches_set_updated_at
  before update on public.pitches
  for each row execute function public.tg_set_updated_at();

-- ── tasks: optional newsroom columns ─────────────────────────────────────
-- All additive and nullable. Existing rows are unaffected; existing inserts
-- continue to work because every new column has a sensible default or is
-- nullable.
alter table public.tasks
  add column if not exists section_id        uuid references public.sections(id) on delete set null,
  add column if not exists pitch_id          uuid references public.pitches(id) on delete set null,
  add column if not exists issue_id          uuid,
  add column if not exists copy_editor_id    uuid references public.users(id) on delete set null,
  add column if not exists fact_checker_id   uuid references public.users(id) on delete set null,
  add column if not exists slug              text,
  add column if not exists assignment_brief  jsonb not null default '{}'::jsonb,
  add column if not exists word_count_actual integer check (word_count_actual is null or word_count_actual >= 0);

-- We attach the issue FK after issues exists. Use a deferrable FK so the
-- seed file can insert tasks and issues in either order inside a tx.
do $$ begin
  alter table public.tasks
    add constraint tasks_issue_id_fkey
    foreign key (issue_id)
    references public.issues(id)
    on delete set null
    deferrable initially deferred;
exception when duplicate_object then null; end $$;

create index if not exists idx_tasks_section_id on public.tasks (section_id);
create index if not exists idx_tasks_issue_id on public.tasks (issue_id);
create index if not exists idx_tasks_copy_editor_id on public.tasks (copy_editor_id);
create index if not exists idx_tasks_fact_checker_id on public.tasks (fact_checker_id);
create index if not exists idx_tasks_pitch_id on public.tasks (pitch_id);

-- After tasks gained pitch_id, close the loop on pitches.task_id so a pitch
-- can resolve back to its converted task.
do $$ begin
  alter table public.pitches
    add constraint pitches_task_id_fkey
    foreign key (task_id)
    references public.tasks(id)
    on delete set null
    deferrable initially deferred;
exception when duplicate_object then null; end $$;

-- ── issue_slots ──────────────────────────────────────────────────────────
create table if not exists public.issue_slots (
  id         uuid primary key default gen_random_uuid(),
  issue_id   uuid not null references public.issues(id) on delete cascade,
  task_id    uuid not null references public.tasks(id) on delete cascade,
  priority   issue_slot_priority not null default 'nice_to_run',
  created_at timestamptz not null default now(),
  -- one slot per (issue, task) — flipping priority is an update, not a new row
  unique (issue_id, task_id)
);

create index if not exists idx_issue_slots_issue on public.issue_slots (issue_id);
create index if not exists idx_issue_slots_task on public.issue_slots (task_id);

-- ── editorial_checklists ─────────────────────────────────────────────────
-- One row per task. `items` is the full set of checklist items as jsonb so
-- the toggle API can read/write atomically. Each item shape:
--   { key, label, group: 'general'|'business'|'sensitive',
--     required: bool, checked: bool, checkedById?: uuid, checkedAt?: iso }
create table if not exists public.editorial_checklists (
  task_id     uuid primary key references public.tasks(id) on delete cascade,
  items       jsonb not null default '[]'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists idx_editorial_checklists_updated
  on public.editorial_checklists (updated_at desc);

create trigger editorial_checklists_set_updated_at
  before update on public.editorial_checklists
  for each row execute function public.tg_set_updated_at();

-- ── sensitive_flags ──────────────────────────────────────────────────────
-- One open flag per task. Decided flags coexist as historical record.
create table if not exists public.sensitive_flags (
  id              uuid primary key default gen_random_uuid(),
  task_id         uuid not null references public.tasks(id) on delete cascade,
  reason          sensitive_reason not null default 'other',
  notes           text not null default '',
  status          sensitive_status not null default 'open',
  raised_by_id    uuid not null references public.users(id) on delete restrict,
  raised_at       timestamptz not null default now(),
  decided_by_id   uuid references public.users(id) on delete set null,
  decided_at      timestamptz,
  decision_note   text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_sensitive_flags_task
  on public.sensitive_flags (task_id);
create index if not exists idx_sensitive_flags_status
  on public.sensitive_flags (status, raised_at desc);
create index if not exists idx_sensitive_flags_reason
  on public.sensitive_flags (reason);

-- Only one open or holding flag per task at a time; cleared flags coexist.
create unique index if not exists ux_sensitive_flags_one_active
  on public.sensitive_flags (task_id)
  where status in ('open', 'holding');

create trigger sensitive_flags_set_updated_at
  before update on public.sensitive_flags
  for each row execute function public.tg_set_updated_at();

-- ── RLS toggles ──────────────────────────────────────────────────────────
-- Concrete policies are defined in 0003_newsroom_rls.sql.
alter table public.sections             enable row level security;
alter table public.issues                enable row level security;
alter table public.pitches               enable row level security;
alter table public.issue_slots           enable row level security;
alter table public.editorial_checklists  enable row level security;
alter table public.sensitive_flags       enable row level security;

-- ─────────────────────────────────────────────────────────────────────────────
-- 0020 — The Advantage Writers League
--
-- A season-based competitive writing system layered onto the portal. Student
-- writers submit pieces, a rotating board editor reviews them, and points are
-- awarded automatically as work is published, wins a weekly award, or is
-- featured on the homepage. Every point movement is recorded in an immutable
-- audit trail (`point_events`); `league_points` is a materialised aggregate
-- kept in lockstep by trigger so the leaderboard never needs manual tallying.
--
-- Design notes
--   * NAMING: the portal already has a load-bearing `public.submissions` table
--     (newsroom drafts tied to tasks). The league's submissions are a distinct
--     concept (a writer's article + Google Doc), so they live in
--     `public.league_submissions` to avoid colliding with that table.
--   * POINTS PIPELINE: `point_events` is the single source of truth. Every
--     higher-level trigger (publish / award / feature) does nothing but INSERT
--     a point event; one aggregate trigger then folds that event into
--     `league_points`. This guarantees the totals can never drift from the
--     audit trail and that there is zero manual point entry anywhere.
--   * SEASONS: `season_id` is carried on every points-bearing row so history is
--     preserved across seasons. New rows default to the active season, so the
--     system scales to many seasons without any schema change.
--   * PRIVACY: the public `/league` leaderboard reads through the
--     `league_leaderboard` view, which projects only competition-safe columns
--     (name, school, totals) — writer emails and grades never leave the
--     leader/admin-scoped base table.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── enums ─────────────────────────────────────────────────────────────────
-- A league submission's lifecycle. Mirrors the prompt's "under review",
-- "approved", "rejected", "published" using snake_case values.
create type league_submission_status as enum (
  'under_review',
  'approved',
  'rejected',
  'published'
);

-- The three kinds of point-earning events. Keeping this an enum (rather than
-- free text) means the aggregate trigger can fold each kind into the right
-- counter with no chance of a typo silently dropping a point.
create type league_point_event_type as enum (
  'published',
  'award',
  'feature'
);

-- The three weekly award categories the board hands out.
create type league_award_type as enum (
  'best_argument',
  'best_use_of_data',
  'editors_pick'
);

-- ── seasons ───────────────────────────────────────────────────────────────
-- A competition runs in named seasons. Exactly one is active at a time; the
-- leaderboard reads the active season's name and end date for its header.
create table if not exists public.seasons (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  start_date  date not null default current_date,
  end_date    date not null,
  is_active   boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists idx_seasons_active on public.seasons (is_active);

create trigger seasons_set_updated_at
  before update on public.seasons
  for each row execute function public.tg_set_updated_at();

-- ── writers ───────────────────────────────────────────────────────────────
-- The league roster. Writers are students who may never hold a portal auth
-- account, so this table is independent of `public.users`. `is_active` starts
-- false and flips true the first time one of their pieces is published.
create table if not exists public.writers (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  email       text not null unique,
  school      text not null default '',
  grade       text not null default '',
  signup_date timestamptz not null default now(),
  is_active   boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists idx_writers_email on public.writers (email);
create index if not exists idx_writers_active on public.writers (is_active);

create trigger writers_set_updated_at
  before update on public.writers
  for each row execute function public.tg_set_updated_at();

-- ── league_submissions ────────────────────────────────────────────────────
-- One row per submitted piece. The board editor is assigned by rotation in the
-- submission API and stored here by name. The reminder timestamps back the
-- overdue cron's "never send the same nudge twice in one day" guarantee.
create table if not exists public.league_submissions (
  id                        uuid primary key default gen_random_uuid(),
  writer_id                 uuid not null references public.writers(id) on delete cascade,
  article_title             text not null,
  google_doc_link           text not null,
  submission_date           timestamptz not null default now(),
  assigned_editor           text not null,
  status                    league_submission_status not null default 'under_review',
  reviewed_date             timestamptz,
  -- Editor's note shown to the writer on rejection (and useful context on any
  -- decision). Optional — the rejection email only includes it when present.
  editor_feedback           text,
  -- Set when the piece is featured on the homepage; the feature trigger fires
  -- on the null → not-null transition so a feature is only ever scored once.
  featured_at               timestamptz,
  -- Overdue-cron de-dupe markers (one per escalation tier).
  reminder_sent_at          timestamptz,
  escalation_sent_at        timestamptz,
  urgent_escalation_sent_at timestamptz,
  -- Season this submission belongs to; defaulted to the active season on insert.
  season_id                 uuid references public.seasons(id) on delete set null,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

create index if not exists idx_league_submissions_writer on public.league_submissions (writer_id);
create index if not exists idx_league_submissions_status on public.league_submissions (status);
create index if not exists idx_league_submissions_editor on public.league_submissions (assigned_editor);

create trigger league_submissions_set_updated_at
  before update on public.league_submissions
  for each row execute function public.tg_set_updated_at();

-- ── league_points ─────────────────────────────────────────────────────────
-- Materialised per-writer aggregate. Never written by hand: the aggregate
-- trigger below is the only thing that touches the counters. `writer_id` is
-- unique so the trigger can upsert by writer.
create table if not exists public.league_points (
  id              uuid primary key default gen_random_uuid(),
  writer_id       uuid not null unique references public.writers(id) on delete cascade,
  total_points    integer not null default 0,
  published_count integer not null default 0,
  award_count     integer not null default 0,
  feature_count   integer not null default 0,
  updated_at      timestamptz not null default now()
);

create index if not exists idx_league_points_total on public.league_points (total_points desc);

-- ── point_events ──────────────────────────────────────────────────────────
-- Immutable audit trail: one row for every point ever awarded. Optional source
-- pointers make each event traceable back to the submission or award that
-- produced it.
create table if not exists public.point_events (
  id                   uuid primary key default gen_random_uuid(),
  writer_id            uuid not null references public.writers(id) on delete cascade,
  event_type           league_point_event_type not null,
  points_awarded       integer not null,
  source_submission_id uuid references public.league_submissions(id) on delete set null,
  source_award_id      uuid,
  season_id            uuid references public.seasons(id) on delete set null,
  created_at           timestamptz not null default now()
);

create index if not exists idx_point_events_writer on public.point_events (writer_id, created_at desc);
create index if not exists idx_point_events_type on public.point_events (event_type);

-- ── weekly_awards ─────────────────────────────────────────────────────────
-- One row per award handed out. Inserting a row is all the board has to do —
-- the points trigger turns it into a 50-point point event automatically.
create table if not exists public.weekly_awards (
  id             uuid primary key default gen_random_uuid(),
  writer_id      uuid not null references public.writers(id) on delete cascade,
  award_type     league_award_type not null,
  week_of        date not null default current_date,
  points_awarded integer not null default 50,
  season_id      uuid references public.seasons(id) on delete set null,
  created_at     timestamptz not null default now()
);

create index if not exists idx_weekly_awards_writer on public.weekly_awards (writer_id);
create index if not exists idx_weekly_awards_week on public.weekly_awards (week_of desc);

-- Wire the point_events → weekly_awards source pointer now that both exist.
alter table public.point_events
  add constraint point_events_source_award_fk
    foreign key (source_award_id)
    references public.weekly_awards(id)
    on delete set null;

-- ─────────────────────────────────────────────────────────────────────────────
-- Functions & triggers
-- ─────────────────────────────────────────────────────────────────────────────

-- active_season_id() — the id of the currently active season, or null.
-- STABLE + SECURITY DEFINER so triggers and RLS-bound callers can resolve the
-- default season without needing their own read access to `seasons`.
create or replace function public.active_season_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id
    from public.seasons
   where is_active = true
   order by start_date desc
   limit 1;
$$;

-- tg_league_default_season() — BEFORE INSERT default: stamp a row with the
-- active season when the caller didn't specify one. Shared by submissions,
-- point events, and weekly awards so season tagging is consistent everywhere.
create or replace function public.tg_league_default_season()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.season_id is null then
    new.season_id := public.active_season_id();
  end if;
  return new;
end;
$$;

create trigger league_submissions_default_season
  before insert on public.league_submissions
  for each row execute function public.tg_league_default_season();

create trigger weekly_awards_default_season
  before insert on public.weekly_awards
  for each row execute function public.tg_league_default_season();

create trigger point_events_default_season
  before insert on public.point_events
  for each row execute function public.tg_league_default_season();

-- tg_writer_seeds_points() — give every new writer a zeroed league_points row
-- so they appear in admin views immediately (and the aggregate upsert below
-- always has a row to update).
create or replace function public.tg_writer_seeds_points()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.league_points (writer_id)
  values (new.id)
  on conflict (writer_id) do nothing;
  return new;
end;
$$;

create trigger writers_seed_points
  after insert on public.writers
  for each row execute function public.tg_writer_seeds_points();

-- tg_point_event_aggregate() — THE points engine. Every point event is folded
-- into league_points here and nowhere else, so the leaderboard total and the
-- audit trail can never disagree. Idempotent per event: each insert moves the
-- aggregate by exactly that event's points/counter.
create or replace function public.tg_point_event_aggregate()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.league_points as lp (
    writer_id, total_points, published_count, award_count, feature_count, updated_at
  )
  values (
    new.writer_id,
    new.points_awarded,
    case when new.event_type = 'published' then 1 else 0 end,
    case when new.event_type = 'award'     then 1 else 0 end,
    case when new.event_type = 'feature'   then 1 else 0 end,
    now()
  )
  on conflict (writer_id) do update set
    total_points    = lp.total_points    + new.points_awarded,
    published_count = lp.published_count  + (case when new.event_type = 'published' then 1 else 0 end),
    award_count     = lp.award_count      + (case when new.event_type = 'award'     then 1 else 0 end),
    feature_count   = lp.feature_count    + (case when new.event_type = 'feature'   then 1 else 0 end),
    updated_at      = now();
  return new;
end;
$$;

create trigger point_events_aggregate
  after insert on public.point_events
  for each row execute function public.tg_point_event_aggregate();

-- tg_league_submission_published() — when a submission first reaches the
-- 'published' state: award 100 points (via a point event) and activate the
-- writer. Guarded on the status transition so re-saving a published row never
-- double-scores. The point event triggers the aggregate update above.
create or replace function public.tg_league_submission_published()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'published' and old.status is distinct from 'published' then
    insert into public.point_events (
      writer_id, event_type, points_awarded, source_submission_id, season_id
    )
    values (new.writer_id, 'published', 100, new.id, new.season_id);

    -- Flip the writer live on their first publish (no-op once already active).
    update public.writers
       set is_active = true
     where id = new.writer_id
       and is_active = false;
  end if;
  return new;
end;
$$;

create trigger league_submissions_published
  after update on public.league_submissions
  for each row execute function public.tg_league_submission_published();

-- tg_league_submission_featured() — when a piece is featured on the homepage
-- (featured_at goes null → set): award 25 points. Guarded on the transition so
-- a feature is only ever scored once.
create or replace function public.tg_league_submission_featured()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.featured_at is not null and old.featured_at is null then
    insert into public.point_events (
      writer_id, event_type, points_awarded, source_submission_id, season_id
    )
    values (new.writer_id, 'feature', 25, new.id, new.season_id);
  end if;
  return new;
end;
$$;

create trigger league_submissions_featured
  after update on public.league_submissions
  for each row execute function public.tg_league_submission_featured();

-- tg_weekly_award_points() — inserting a weekly award awards its points (50 by
-- default) through a point event, which the aggregate trigger folds into the
-- writer's award_count and total. The board never has to touch league_points.
create or replace function public.tg_weekly_award_points()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.point_events (
    writer_id, event_type, points_awarded, source_award_id, season_id
  )
  values (new.writer_id, 'award', coalesce(new.points_awarded, 50), new.id, new.season_id);
  return new;
end;
$$;

create trigger weekly_awards_award_points
  after insert on public.weekly_awards
  for each row execute function public.tg_weekly_award_points();

-- ─────────────────────────────────────────────────────────────────────────────
-- Public leaderboard view
--
-- Projects only competition-safe columns and ranks by total points. Created
-- WITHOUT security_invoker so it can be granted to the anon role for the public
-- `/league` page while the underlying `writers` table (which holds emails and
-- grades) stays locked to leaders/admins. Inner-joins league_points and shows
-- only writers who have actually scored (every writer gets a zeroed
-- league_points row at sign-up; a writer earns their first points — and a board
-- spot — when their first piece is published), matching "all writers from
-- league_points joined with the writers table, sorted by total points".
-- ─────────────────────────────────────────────────────────────────────────────
create or replace view public.league_leaderboard as
select
  w.id                 as writer_id,
  w.name               as name,
  w.school             as school,
  lp.total_points      as total_points,
  lp.published_count   as published_count,
  lp.award_count       as award_count,
  lp.feature_count     as feature_count,
  rank() over (
    order by lp.total_points desc, lp.published_count desc, w.name asc
  )                    as rank
from public.league_points lp
join public.writers w on w.id = lp.writer_id
where lp.total_points > 0;

grant select on public.league_leaderboard to anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- Row Level Security
--
-- Posture:
--   * writers / league_submissions — hold PII or editorial routing; readable by
--     leaders/admins only. All writes go through the service-role API routes,
--     so no write policies are defined (service role bypasses RLS).
--   * league_points / point_events / seasons / weekly_awards — competition data
--     with no PII; world-readable so the public leaderboard and its realtime
--     subscription work with the anon key.
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.writers            enable row level security;
alter table public.league_submissions enable row level security;
alter table public.league_points      enable row level security;
alter table public.point_events       enable row level security;
alter table public.seasons            enable row level security;
alter table public.weekly_awards      enable row level security;

-- writers — leader/admin read only (protects email + grade).
create policy writers_select on public.writers
  for select using (public.current_app_role() in ('leader', 'admin'));

-- league_submissions — leader/admin read only (editorial routing surface).
create policy league_submissions_select on public.league_submissions
  for select using (public.current_app_role() in ('leader', 'admin'));

-- league_points — world readable (drives the public leaderboard + realtime).
create policy league_points_select on public.league_points
  for select using (true);

-- point_events — world readable (audit trail powers the public click-to-expand
-- history and the admin point log; carries no PII).
create policy point_events_select on public.point_events
  for select using (true);

-- seasons — world readable (leaderboard header reads the active season).
create policy seasons_select on public.seasons
  for select using (true);

-- weekly_awards — world readable (public award history; no PII).
create policy weekly_awards_select on public.weekly_awards
  for select using (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- Realtime — the public leaderboard subscribes to point movements so totals
-- update live. Add the no-PII aggregate tables to the realtime publication and
-- set REPLICA IDENTITY FULL so updates carry their full row payload.
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare
  t text;
begin
  foreach t in array array[
    'league_points', 'point_events', 'weekly_awards', 'seasons'
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

alter table public.league_points replica identity full;
alter table public.point_events  replica identity full;
alter table public.weekly_awards replica identity full;
alter table public.seasons       replica identity full;

-- ─────────────────────────────────────────────────────────────────────────────
-- Seed the first season so the leaderboard has an active season on day one.
-- Guarded so re-running the migration (or running it on a project that already
-- has seasons) is a no-op.
-- ─────────────────────────────────────────────────────────────────────────────
insert into public.seasons (name, start_date, end_date, is_active)
select 'Season 1', current_date, current_date + interval '90 days', true
where not exists (select 1 from public.seasons);

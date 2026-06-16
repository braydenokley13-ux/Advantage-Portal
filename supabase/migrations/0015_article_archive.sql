-- ─────────────────────────────────────────────────────────────────────────────
-- Advantage Journal Portal — the Article Archive
--
-- A single, queryable catalogue of every story the newsroom has produced.
-- Each task is one article; this view denormalises the context a reader or an
-- analytics surface wants without forcing six joins at every call site:
--
--   task → section → issue → writer / editor → latest submission
--
-- Design notes:
--   * It is a plain (non-materialised) VIEW, so it is always live — no refresh
--     job, no drift. Articles appear the moment a task is created and update
--     as drafts land and issues ship.
--   * `security_invoker = true` makes the view honour the *querying user's*
--     row-level security on the underlying tables (Postgres 15+/Supabase).
--     A writer sees only their stories; leaders/admins see everything — the
--     exact same visibility the app enforces in lib/visibility.ts.
--   * The "current" submission is chosen the same way the app does: the row
--     flagged `is_current`, falling back to the highest version. A LATERAL
--     keeps that to one row per article.
--   * Shape mirrors `ArchiveArticle` in lib/article-archive.ts so a record is
--     interchangeable whether it is built client-side from the store or read
--     straight from this view (e.g. a future server-side export endpoint).
-- ─────────────────────────────────────────────────────────────────────────────

create or replace view public.article_archive
with (security_invoker = true) as
select
  t.id                                                   as task_id,
  t.title,
  t.slug,
  t.status,
  t.color,
  t.deadline,
  t.created_at,
  coalesce(cur.created_at, t.created_at)                 as updated_at,
  t.citations_required,
  t.word_count_target,
  -- Best-known length: the logged actual, else words counted from an inline
  -- draft (regexp_split mirrors countWords' whitespace tokenisation), else 0.
  coalesce(
    nullif(t.word_count_actual, 0),
    case
      when cur.type = 'inline' and length(btrim(cur.content)) > 0
        then array_length(regexp_split_to_array(btrim(cur.content), '\s+'), 1)
      else 0
    end
  )                                                       as word_count,
  -- section
  t.section_id,
  sec.name                                               as section_name,
  sec.slug                                               as section_slug,
  sec.accent                                             as section_accent,
  -- issue
  t.issue_id,
  iss.number                                             as issue_number,
  iss.name                                               as issue_name,
  iss.status                                             as issue_status,
  iss.publish_date                                       as issue_publish_date,
  case when iss.status = 'published' then iss.publish_date end as published_at,
  -- byline
  t.writer_id                                            as author_id,
  wr.name                                                as author_name,
  t.editor_id,
  ed.name                                                as editor_name,
  -- current submission
  cur.id                                                 as current_submission_id,
  cur.type                                               as submission_type,
  cur.version                                            as submission_version,
  cur.created_at                                         as submission_created_at,
  -- editorial escalation
  exists (
    select 1 from public.sensitive_flags sf
    where sf.task_id = t.id and sf.status in ('open', 'holding')
  )                                                      as has_active_sensitive_flag
from public.tasks t
  left join public.sections sec on sec.id = t.section_id
  left join public.issues   iss on iss.id = t.issue_id
  left join public.users    wr  on wr.id  = t.writer_id
  left join public.users    ed  on ed.id  = t.editor_id
  left join lateral (
    select s.*
    from public.submissions s
    where s.task_id = t.id
    order by s.is_current desc, s.version desc
    limit 1
  ) cur on true;

comment on view public.article_archive is
  'Live, RLS-respecting catalogue of every story (one row per task) with its '
  'section, issue, byline, length, and latest submission. Mirrors '
  'lib/article-archive.ts ArchiveArticle.';

-- PostgREST / app clients read the archive as the signed-in user; the
-- security_invoker view then applies each table''s own RLS.
grant select on public.article_archive to authenticated, service_role;

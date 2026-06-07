-- ─────────────────────────────────────────────────────────────────────────
-- Realtime for the submission → review → comment loop.
--
-- The drawer's editing surfaces now write submissions, reviews, and comments
-- through the API client directly (rather than the store's full re-hydrate).
-- The store subscribes to these tables (lib/hooks/use-realtime.ts) so the
-- board, dashboard, and admin caches stay live when work moves through review
-- — including when a *different* user submits, decides, or comments.
--
-- `tasks` is already in the publication (migration 0009). Add the remaining
-- review-loop tables here. RLS still governs what each subscriber receives.
-- ─────────────────────────────────────────────────────────────────────────
do $$
declare
  t text;
begin
  foreach t in array array['submissions', 'reviews', 'comments']
  loop
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = t
    ) then
      execute format(
        'alter publication supabase_realtime add table public.%I',
        t
      );
    end if;
  end loop;
end $$;

-- Carry the full old row on DELETE so subscribers always have context; we use
-- the event only as a refetch trigger, but this keeps the stream complete.
alter table public.submissions replica identity full;
alter table public.reviews     replica identity full;
alter table public.comments    replica identity full;

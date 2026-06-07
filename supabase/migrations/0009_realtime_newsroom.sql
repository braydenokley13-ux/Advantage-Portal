-- ─────────────────────────────────────────────────────────────────────────
-- Realtime for the newsroom board + pitch queue.
--
-- The Issues planning page and the Pitches queue subscribe to Postgres
-- changes (via lib/hooks/use-realtime.ts) so they refetch live when another
-- user mutates the same data — an editor decides a pitch, a leader slots a
-- story, a checklist item is ticked, a sensitive flag is cleared.
--
-- Supabase only streams changes for tables that belong to the
-- `supabase_realtime` publication, so add the newsroom tables here. RLS still
-- governs what each subscriber is allowed to receive. `ADD TABLE` errors if a
-- table is already a member, so each is wrapped in a guard.
-- ─────────────────────────────────────────────────────────────────────────
do $$
declare
  t text;
begin
  foreach t in array array[
    'pitches',
    'issues',
    'issue_slots',
    'tasks',
    'editorial_checklists',
    'sensitive_flags'
  ]
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

-- DELETE events only carry the primary key by default. Set REPLICA IDENTITY
-- FULL so the old row is available to subscribers; harmless here since we only
-- use the event as a refetch trigger, but keeps the stream complete.
alter table public.pitches              replica identity full;
alter table public.issues               replica identity full;
alter table public.issue_slots          replica identity full;
alter table public.tasks                replica identity full;
alter table public.editorial_checklists replica identity full;
alter table public.sensitive_flags      replica identity full;

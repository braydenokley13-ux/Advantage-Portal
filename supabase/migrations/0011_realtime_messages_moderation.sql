-- ─────────────────────────────────────────────────────────────────────────
-- Realtime for messages, conversations, and moderation reports.
--
-- The chat surfaces (chat view, conversation list, announcements) and the
-- moderation queue now write through the API client directly instead of the
-- store's full re-hydrate. Each surface reads its data through the API hooks
-- and pairs them with `useRealtimeRefetch` so the view stays live when another
-- member posts a message, a moderator hides one, or a new report lands.
--
-- Add the backing tables to the realtime publication here (idempotent) and set
-- REPLICA IDENTITY FULL so DELETE events carry the old row. RLS still governs
-- what each subscriber actually receives.
-- ─────────────────────────────────────────────────────────────────────────
do $$
declare
  t text;
begin
  foreach t in array array['messages', 'conversations', 'moderation_reports']
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

alter table public.messages           replica identity full;
alter table public.conversations      replica identity full;
alter table public.moderation_reports replica identity full;

-- Fix infinite recursion in conversation_members RLS policies.
--
-- The original conversation_members_select policy contained a self-referential
-- subquery (querying conversation_members from within the policy on
-- conversation_members), causing Postgres to raise "infinite recursion detected
-- in policy for relation conversation_members" on every call to listConversations
-- or listMessages.
--
-- Solution: introduce a SECURITY DEFINER helper that performs the membership
-- check outside of RLS, then rewrite the affected policies to use it.
--
-- Safety guards: if 0001_init.sql was only partially applied (e.g. a CREATE TYPE
-- failed because the type already existed), the three tables below may not exist
-- yet. The create-if-not-exists blocks below are no-ops when 0001 ran cleanly.

do $$
begin
  if not exists (
    select 1 from pg_type
    where typname = 'conversation_kind'
      and typnamespace = 'public'::regnamespace
  ) then
    create type public.conversation_kind as enum (
      'dm', 'group', 'all_team', 'issue', 'admins_only'
    );
  end if;
end;
$$;

create table if not exists public.conversations (
  id              uuid primary key default gen_random_uuid(),
  kind            public.conversation_kind not null,
  title           text not null,
  last_message_at timestamptz,
  created_at      timestamptz not null default now()
);

create table if not exists public.conversation_members (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id         uuid not null references public.users(id)          on delete cascade,
  joined_at       timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

create index if not exists idx_conversation_members_user
  on public.conversation_members (user_id);

create table if not exists public.messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  author_id       uuid not null references public.users(id)          on delete restrict,
  body            text not null,
  pinned_at       timestamptz,
  hidden_at       timestamptz,
  created_at      timestamptz not null default now()
);

alter table public.conversations        enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages             enable row level security;

-- Helper: returns true if auth.uid() is a member of the given conversation.
-- SECURITY DEFINER means this runs as the function owner (bypassing RLS),
-- which breaks the self-referential loop.
create or replace function public.is_conversation_member(conv_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  return exists (
    select 1 from public.conversation_members
    where conversation_id = conv_id
      and user_id = auth.uid()
  );
end;
$$;

-- conversation_members: drop the recursive policy, replace with helper-based one.
-- Users can see their own row (user_id = auth.uid()) OR all member rows for any
-- conversation they belong to (is_conversation_member).
drop policy if exists conversation_members_select on public.conversation_members;

create policy conversation_members_select on public.conversation_members
  for select using (
    user_id = auth.uid()
    or public.is_conversation_member(conversation_id)
  );

-- conversations: replace direct subquery with the helper to be consistent and
-- avoid any indirect recursion chain through conversation_members_select.
drop policy if exists conversations_select on public.conversations;

create policy conversations_select on public.conversations
  for select using (
    public.is_conversation_member(id)
    or (public.current_app_role() in ('leader','admin') and kind = 'all_team')
  );

-- messages: same — replace direct subquery with the helper.
drop policy if exists messages_select on public.messages;

create policy messages_select on public.messages
  for select using (
    public.is_conversation_member(conversation_id)
  );

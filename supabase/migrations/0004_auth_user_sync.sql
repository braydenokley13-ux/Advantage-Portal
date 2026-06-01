-- ─────────────────────────────────────────────────────────────────────────────
-- Advantage Journal Portal — sync auth.users → public.users
--
-- Closes the gap flagged in docs/advantage-portal-bug-audit.md (P0.5):
-- 0001_init.sql declares public.users with a comment claiming "A trigger
-- inserts a row at signup," but no such trigger ever shipped. The
-- consequence is that once Supabase Auth is enabled, every new sign-up
-- ends up in auth.users with no matching public.users row; the
-- `current_app_role()` helper returns NULL; every RLS check denies the
-- user; the portal renders a permanent "Loading session…" with no error.
--
-- This migration adds:
--   * `handle_new_user()` — SECURITY DEFINER trigger function that mirrors
--     a fresh auth.users row into public.users, preserving id, email,
--     name (derived from `raw_user_meta_data.full_name` if present,
--     otherwise the email local-part), and defaulting role to 'writer'.
--   * The trigger itself (`on auth.users after insert`).
--   * `handle_user_email_update()` to keep email in sync if Supabase
--     Auth's email-change flow is used.
--
-- Idempotent — safe to re-run. `do $$ ... exception` blocks tolerate the
-- trigger/function already existing.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Helpers ───────────────────────────────────────────────────────────────
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  derived_name text;
begin
  -- Prefer the explicit `full_name` from the auth metadata, fall back to
  -- the local-part of the email. We never leave `name` null — the UI
  -- assumes a printable string everywhere it shows a user.
  derived_name := coalesce(
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    nullif(new.raw_user_meta_data ->> 'name', ''),
    split_part(new.email, '@', 1),
    'New user'
  );

  insert into public.users (id, name, email, role)
  values (new.id, derived_name, new.email, 'writer')
  on conflict (id) do update
    set email = excluded.email
        -- Don't clobber a name the admin already curated.
        , name = case
                   when public.users.name is null or public.users.name = ''
                     then excluded.name
                   else public.users.name
                 end;

  return new;
end;
$$;

create or replace function public.handle_user_email_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email is distinct from old.email then
    update public.users
       set email = new.email
     where id = new.id;
  end if;
  return new;
end;
$$;

-- ── Triggers ──────────────────────────────────────────────────────────────
do $$ begin
  create trigger on_auth_user_created
    after insert on auth.users
    for each row execute function public.handle_new_user();
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create trigger on_auth_user_email_updated
    after update of email on auth.users
    for each row execute function public.handle_user_email_update();
exception
  when duplicate_object then null;
end $$;

-- ── Backfill any existing auth.users rows that lack a profile ─────────────
-- Safe to re-run; conflicts no-op via the `on conflict (id) do update`
-- branch above. Useful when running this migration on a project that
-- already had Supabase Auth signups before the trigger landed.
insert into public.users (id, name, email, role)
select
  au.id,
  coalesce(
    nullif(au.raw_user_meta_data ->> 'full_name', ''),
    nullif(au.raw_user_meta_data ->> 'name', ''),
    split_part(au.email, '@', 1),
    'New user'
  ) as name,
  au.email,
  'writer'::app_role as role
from auth.users au
where not exists (
  select 1 from public.users pu where pu.id = au.id
);

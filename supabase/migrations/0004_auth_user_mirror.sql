-- ─────────────────────────────────────────────────────────────────────────────
-- Auth integration — mirror auth.users into public.users
--
-- Phase 4 of the backend integration. Until now public.users was free-standing
-- with its own gen_random_uuid() default so the seed data could pre-populate
-- demo profiles. With Supabase Auth wired, every public.users row must share
-- its primary key with auth.users so that auth.uid() and the existing RLS
-- policies (writer_id = auth.uid(), etc.) function correctly.
--
-- This migration is idempotent and safe on repeated runs.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Drop the random-id default — auth.uid() is the source of truth from now on.
alter table public.users alter column id drop default;

-- 2. Add an FK to auth.users so deleting an auth user cascades into the
--    profile row. Wrapped in a DO block so the migration also runs in
--    standalone Postgres environments without the auth schema (CI / tests).
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'auth' and table_name = 'users'
  ) and not exists (
    select 1 from pg_constraint where conname = 'users_id_fk_auth'
  ) then
    alter table public.users
      add constraint users_id_fk_auth
        foreign key (id) references auth.users(id) on delete cascade;
  end if;
end $$;

-- 3. Trigger function: when a new auth.users row appears, mirror it into
--    public.users. Idempotent on conflict so re-runs (or a manual upsert
--    for a previously-seeded demo user) don't error.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  display_name text;
  resolved_role app_role;
begin
  display_name := coalesce(
    nullif(new.raw_user_meta_data ->> 'name', ''),
    split_part(new.email, '@', 1)
  );

  begin
    resolved_role := coalesce(
      nullif(new.raw_user_meta_data ->> 'role', '')::app_role,
      'writer'::app_role
    );
  exception when invalid_text_representation then
    -- raw_user_meta_data.role wasn't a valid enum value — fall back.
    resolved_role := 'writer'::app_role;
  end;

  insert into public.users (id, name, email, role, active)
  values (new.id, display_name, new.email, resolved_role, true)
  on conflict (id) do update
    set email = excluded.email,
        -- Keep an admin's existing display name unless the auth row provides one.
        name = case
          when new.raw_user_meta_data ->> 'name' is not null
            and length(new.raw_user_meta_data ->> 'name') > 0
          then excluded.name
          else public.users.name
        end;

  return new;
end;
$$;

-- 4. Wire the trigger. Drop-then-create keeps re-runs clean.
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'auth' and table_name = 'users'
  ) then
    drop trigger if exists on_auth_user_created on auth.users;
    create trigger on_auth_user_created
      after insert on auth.users
      for each row execute function public.handle_new_user();
  end if;
end $$;

-- 5. Helper view for diagnostics — quickly answer "is every auth.users row
--    mirrored into public.users?". Read-only, RLS-exempt because it only
--    surfaces ids.
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'auth' and table_name = 'users'
  ) then
    execute $v$
      create or replace view public.auth_users_unmirrored as
      select au.id, au.email, au.created_at
      from auth.users au
      left join public.users pu on pu.id = au.id
      where pu.id is null
    $v$;
  end if;
end $$;

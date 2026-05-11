-- ─────────────────────────────────────────────────────────────────────────────
-- Advantage Journal Portal — Auth wiring
--
-- Mirrors every row in `auth.users` into `public.users` so the rest of
-- the schema (and the frontend's `useSession().currentUser`) can resolve
-- a profile by `auth.uid()`.
--
-- Behaviour:
--   • On signup, insert a `public.users` row whose id == auth.uid().
--   • Default app-role is `writer`. An admin promotes from /admin.
--   • If a seed row already exists with the same email (demo data, or a
--     pre-provisioned account), we attach the auth uuid to that row
--     instead of creating a duplicate.
--   • Email updates on auth.users are propagated. Deletions cascade.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── helper ────────────────────────────────────────────────────────────────
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  display_name text;
  existing_id  uuid;
begin
  display_name := coalesce(
    nullif(new.raw_user_meta_data ->> 'name', ''),
    split_part(new.email, '@', 1)
  );

  -- Re-attach a pre-seeded profile that shares the new auth email.
  select id into existing_id
  from public.users
  where email = new.email
  limit 1;

  if existing_id is not null and existing_id <> new.id then
    update public.users
       set id = new.id
     where id = existing_id;
    return new;
  end if;

  insert into public.users (id, name, email, role, active)
  values (new.id, display_name, new.email, 'writer', true)
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── keep email in sync ────────────────────────────────────────────────────
create or replace function public.handle_user_email_change()
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

drop trigger if exists on_auth_user_email_change on auth.users;
create trigger on_auth_user_email_change
  after update of email on auth.users
  for each row execute function public.handle_user_email_change();

-- ── cleanup on hard-delete ────────────────────────────────────────────────
create or replace function public.handle_user_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.users where id = old.id;
  return old;
end;
$$;

drop trigger if exists on_auth_user_deleted on auth.users;
create trigger on_auth_user_deleted
  after delete on auth.users
  for each row execute function public.handle_user_delete();

-- ── self-service profile updates ──────────────────────────────────────────
-- Existing `users_write` policy restricts mutations to admins. Let every
-- authenticated user edit their own name / avatar (NOT role / active).
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename  = 'users'
      and policyname = 'users_update_self'
  ) then
    create policy users_update_self on public.users
      for update
      using (id = auth.uid())
      with check (
        id = auth.uid()
        and role = (select role from public.users where id = auth.uid())
        and active = (select active from public.users where id = auth.uid())
      );
  end if;
end$$;

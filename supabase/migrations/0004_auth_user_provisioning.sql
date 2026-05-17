-- ─────────────────────────────────────────────────────────────────────────────
-- Advantage Journal Portal — auth → profile provisioning.
--
-- Every `auth.users` row needs a matching `public.users` profile so the app
-- can resolve role, name, and active status. This migration installs the
-- trigger described in §7 of docs/supabase-setup-guide.md.
--
-- The new user's app role comes from `raw_user_meta_data->>'role'` when an
-- admin sets it on an invite (`auth.admin.inviteUserByEmail`), otherwise it
-- defaults to 'writer'. The display name falls back to the email local-part.
--
-- NOTE: do NOT run supabase/seed.sql against a project that uses real auth —
-- the seeded demo users carry random ids that will not match `auth.uid()`,
-- and their emails would collide with the unique constraint here.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, name, email, role, active)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data->>'name', ''),
      split_part(new.email, '@', 1)
    ),
    new.email,
    coalesce(
      nullif(new.raw_user_meta_data->>'role', '')::app_role,
      'writer'
    ),
    true
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

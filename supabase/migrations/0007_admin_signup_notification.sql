-- Notify all admins when a new user self-registers.
--
-- Replaces handle_new_user() with a version that, after inserting the profile
-- row, fans out a notification to every user whose role is 'admin'.
--
-- Also adds 'member_joined' to the notification_kind enum.

alter type public.notification_kind add value if not exists 'member_joined';

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_name text;
begin
  new_name := coalesce(
    nullif(new.raw_user_meta_data->>'name', ''),
    split_part(new.email, '@', 1)
  );

  insert into public.users (id, name, email, role, active)
  values (
    new.id,
    new_name,
    new.email,
    coalesce(
      nullif(new.raw_user_meta_data->>'role', '')::app_role,
      'writer'
    ),
    true
  )
  on conflict (id) do nothing;

  -- Fan out a notification to every admin.
  insert into public.notifications (user_id, kind, title, body)
  select
    u.id,
    'member_joined',
    'New member joined',
    new_name || ' (' || new.email || ') just created an account.'
  from public.users u
  where u.role = 'admin';

  return new;
end;
$$;

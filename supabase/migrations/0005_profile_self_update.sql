-- ─────────────────────────────────────────────────────────────────────────────
-- Advantage Journal Portal — self-service profile updates.
--
-- The `users_write` policy from 0001 is admin-only, so a writer/editor/leader
-- cannot update their own profile row directly. Onboarding's profile step
-- needs every user to set their display name and avatar.
--
-- This SECURITY DEFINER function lets the signed-in user update ONLY their
-- own `name` and `avatar_url`. It deliberately never touches `role` or
-- `active`, so it cannot be used for privilege escalation.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.update_my_profile(
  p_name text,
  p_avatar_url text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.users
     set name       = coalesce(nullif(trim(p_name), ''), name),
         avatar_url = nullif(trim(coalesce(p_avatar_url, '')), '')
   where id = auth.uid();
end;
$$;

revoke all on function public.update_my_profile(text, text) from public;
grant execute on function public.update_my_profile(text, text) to authenticated;

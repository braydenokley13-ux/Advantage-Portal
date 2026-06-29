-- ─────────────────────────────────────────────────────────────────────────────
-- 0017 — portal-wide configuration (app_settings)
--
-- A single-row key/value table holding the editable site configuration:
-- branding, per-feature toggles, and workflow overrides (task-status copy,
-- editorial checklist template, notification email defaults, feedback
-- categories). The app reads this through `SiteConfigProvider` and deep-merges
-- it over `DEFAULT_SITE_CONFIG` (lib/site-config-defaults.ts), so the stored
-- JSON only needs to carry the fields an admin has actually changed.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.app_settings (
  id          smallint primary key default 1 check (id = 1),
  config      jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);

create trigger app_settings_set_updated_at
  before update on public.app_settings
  for each row execute function public.tg_set_updated_at();

-- Seed the single row so updates always have a target to patch.
insert into public.app_settings (id, config)
values (1, '{}'::jsonb)
on conflict (id) do nothing;

-- ── RLS ─────────────────────────────────────────────────────────────────────
-- Branding + toggles are read by every authenticated user; only leaders and
-- admins can change the configuration.
alter table public.app_settings enable row level security;

create policy app_settings_select on public.app_settings
  for select using (auth.role() = 'authenticated');

create policy app_settings_write on public.app_settings
  for all using (public.current_app_role() in ('leader', 'admin'))
       with check (public.current_app_role() in ('leader', 'admin'));

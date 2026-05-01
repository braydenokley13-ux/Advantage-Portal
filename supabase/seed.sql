-- ─────────────────────────────────────────────────────────────────────────────
-- Demo seed mirroring `lib/mock-data.ts`. Useful for kicking the tires
-- against a real Supabase project before real users exist.
--
-- All ids are stable uuids so the demo data references each other safely.
-- Run after `0001_init.sql`. Idempotent via `on conflict do nothing`.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── users ────────────────────────────────────────────────────────────────
insert into public.users (id, name, email, role) values
  ('00000000-0000-0000-0000-000000000001', 'Alex Rivera',  'alex@advantage.co',   'writer'),
  ('00000000-0000-0000-0000-000000000002', 'Sam Patel',    'sam@advantage.co',    'writer'),
  ('00000000-0000-0000-0000-000000000003', 'Jordan Kim',   'jordan@advantage.co', 'writer'),
  ('00000000-0000-0000-0000-000000000004', 'Casey Lee',    'casey@advantage.co',  'editor'),
  ('00000000-0000-0000-0000-000000000005', 'Morgan Chen',  'morgan@advantage.co', 'editor'),
  ('00000000-0000-0000-0000-000000000006', 'Riley Brooks', 'riley@advantage.co',  'leader'),
  ('00000000-0000-0000-0000-000000000007', 'Taylor Singh', 'taylor@advantage.co', 'admin')
on conflict (id) do nothing;

-- ── tasks ────────────────────────────────────────────────────────────────
insert into public.tasks (id, title, instructions, writer_id, editor_id, deadline, status, color, word_count_target, citations_required) values
  ('10000000-0000-0000-0000-000000000001', 'Quarterly market outlook',
    '1500–2000 words. Lead with macro thesis, then sector breakdowns. Cite primary sources.',
    '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000004',
    now() + interval '2 days', 'in_progress', 'amber', 1800, true),
  ('10000000-0000-0000-0000-000000000002', 'Founder profile: Lina Wei',
    'Long-form profile. Conduct 2 interviews. Capture the founding-moment narrative.',
    '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000004',
    now() + interval '5 days', 'not_started', 'green', null, false),
  ('10000000-0000-0000-0000-000000000003', 'Weekly digest — Issue #42',
    'Curate top 8 stories. 200-word intro. 80-word blurbs each.',
    '00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000005',
    now() + interval '1 days', 'submitted', 'amber', null, false)
on conflict (id) do nothing;

-- ── conversations + members ──────────────────────────────────────────────
insert into public.conversations (id, kind, title) values
  ('20000000-0000-0000-0000-000000000001', 'all_team',   'All Team'),
  ('20000000-0000-0000-0000-000000000000', 'admins_only','Admins & Leaders')
on conflict (id) do nothing;

-- All team includes everyone. Admins-only includes admins + leaders.
insert into public.conversation_members (conversation_id, user_id)
  select '20000000-0000-0000-0000-000000000001', id from public.users
  on conflict do nothing;

insert into public.conversation_members (conversation_id, user_id)
  select '20000000-0000-0000-0000-000000000000', id
  from public.users where role in ('admin','leader')
  on conflict do nothing;

-- ── messages (with two pinned announcements) ─────────────────────────────
insert into public.messages (id, conversation_id, author_id, body, pinned_at, created_at) values
  ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000007',
    'House rules refresher — be kind in comments, cite your sources, and flag anything that feels off.',
    now() - interval '2 days', now() - interval '2 days'),
  ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000006',
    'Welcome to the new writers joining this issue! Open the brief, ask questions, and don''t be afraid to request an extension if you need one.',
    now() - interval '3 days', now() - interval '3 days'),
  ('30000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000000',
    '00000000-0000-0000-0000-000000000007',
    'Admins/leaders only — coordinate moderation and approvals here so writers don''t see ops chatter.',
    null, now() - interval '1 day')
on conflict (id) do nothing;

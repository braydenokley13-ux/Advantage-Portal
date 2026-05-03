-- ─────────────────────────────────────────────────────────────────────────────
-- Newsroom workflow seed — mirrors lib/mock-data.ts so a fresh project demos
-- the same way as `NEXT_PUBLIC_DATA_MODE=mock`. Run after 0001_init.sql,
-- 0002_newsroom_workflow.sql, and the original supabase/seed.sql.
--
-- All ids are stable uuids so re-runs of this seed are idempotent. The
-- `task` rows from supabase/seed.sql are extended in place with newsroom
-- metadata; new task rows are inserted for the rest of the mock corpus
-- (op-ed, book review, interview prep, internal task).
-- ─────────────────────────────────────────────────────────────────────────────

-- ── sections ─────────────────────────────────────────────────────────────
insert into public.sections (id, slug, name, description, accent) values
  ('40000000-0000-0000-0000-000000000001', 'news',      'News',
    'Reporting on school, local, and national stories that affect students.', 'sky'),
  ('40000000-0000-0000-0000-000000000002', 'opinion',   'Opinion',
    'Clearly-labeled commentary, op-eds, and editorials.', 'violet'),
  ('40000000-0000-0000-0000-000000000003', 'business',  'Business',
    'Companies, founders, and the economics behind student life.', 'emerald'),
  ('40000000-0000-0000-0000-000000000004', 'markets',   'Markets & Finance',
    'Markets explained for teen readers — never investment advice.', 'amber'),
  ('40000000-0000-0000-0000-000000000005', 'community', 'Community',
    'School clubs, events, and people doing things worth covering.', 'rose'),
  ('40000000-0000-0000-0000-000000000006', 'culture',   'Culture',
    'Books, music, film, internet, and the way teens are living.', 'fuchsia'),
  ('40000000-0000-0000-0000-000000000007', 'world',     'World',
    'International news framed for student readers.', 'indigo')
on conflict (id) do update
  set name = excluded.name,
      description = excluded.description,
      accent = excluded.accent;

-- ── issues ───────────────────────────────────────────────────────────────
insert into public.issues (id, number, name, publish_date, status, notes) values
  ('50000000-0000-0000-0000-000000000042', 42, 'Issue #42 — Spring Forward',
    now() + interval '6 days',  'production',
    'Cover: spring sports kickoff. Hold one Markets slot.'),
  ('50000000-0000-0000-0000-000000000043', 43, 'Issue #43 — Year-End Review',
    now() + interval '27 days', 'planning',
    'Year-in-review angles. Encourage long-form features.')
on conflict (id) do update
  set name = excluded.name,
      publish_date = excluded.publish_date,
      status = excluded.status,
      notes = excluded.notes;

-- ── tasks: extend existing seed rows with newsroom metadata ──────────────
update public.tasks
   set section_id = '40000000-0000-0000-0000-000000000004',
       issue_id   = '50000000-0000-0000-0000-000000000042',
       copy_editor_id  = '00000000-0000-0000-0000-000000000005',
       fact_checker_id = '00000000-0000-0000-0000-000000000004',
       slug = 'quarterly-market-outlook',
       assignment_brief = jsonb_build_object(
         'angle', 'After a volatile quarter, where do major sectors actually stand for student readers?',
         'mustAnswer', jsonb_build_array(
           'Which sectors moved the most this quarter and why?',
           'What does this mean for students saving for college or a first job?',
           'Where are the loudest analyst disagreements?'
         ),
         'requiredSources', jsonb_build_array(
           'Two cited primary data sources (FRED, SEC filings, exchange data).',
           'One named analyst or economist quote.'
         ),
         'quoteRequirements', 'At least one on-the-record quote from a named analyst.',
         'visualNeeds', 'One chart of sector returns; pull quote from analyst.',
         'publishingNotes', 'House style on numbers — spell out percentages on first use.'
       )
 where id = '10000000-0000-0000-0000-000000000001';

update public.tasks
   set section_id = '40000000-0000-0000-0000-000000000003',
       issue_id   = '50000000-0000-0000-0000-000000000042',
       slug = 'founder-profile-lina-wei',
       word_count_target = 2000,
       assignment_brief = jsonb_build_object(
         'angle', 'How a high-school senior turned a side project into a real business — and what other students can learn.',
         'mustAnswer', jsonb_build_array(
           'What did the founding moment actually look like?',
           'What''s the first thing she''d tell another student trying to start a company?',
           'What is the business doing today, with verifiable numbers?'
         ),
         'requiredSources', jsonb_build_array(
           'Two interviews with the founder (recorded).',
           'One interview with an early customer or teammate.'
         ),
         'quoteRequirements', 'Three on-the-record quotes minimum, named.',
         'visualNeeds', 'Portrait photo with permission; product screenshot if relevant.',
         'publishingNotes', 'Long-form feature; aim for 1,800–2,200 words.'
       )
 where id = '10000000-0000-0000-0000-000000000002';

update public.tasks
   set section_id = '40000000-0000-0000-0000-000000000001',
       issue_id   = '50000000-0000-0000-0000-000000000042',
       slug = 'weekly-digest-42',
       word_count_target = 900,
       word_count_actual = 920
 where id = '10000000-0000-0000-0000-000000000003';

-- ── tasks: add newspaper-specific stories that aren't in the base seed ──
insert into public.tasks (
  id, title, instructions, writer_id, editor_id, deadline, status, color,
  word_count_target, citations_required, section_id, issue_id, slug,
  assignment_brief, word_count_actual
) values
  ('10000000-0000-0000-0000-000000000004', 'Op-ed: AI policy at the Hill',
   'Strong stance. 900 words. House style.',
   '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000005',
   now() - interval '1 days', 'submitted', 'red',
   900, false,
   '40000000-0000-0000-0000-000000000002', '50000000-0000-0000-0000-000000000042',
   'ai-policy-at-the-hill',
   jsonb_build_object(
     'angle', 'Why student journalists should be in the room when AI policy gets written.',
     'mustAnswer', jsonb_build_array(
       'What is the policy actually proposing?',
       'Who benefits and who is left out?',
       'What''s the writer''s stance, and what''s the strongest counterargument?'
     ),
     'requiredSources', jsonb_build_array(
       'Cite the bill / policy text directly.',
       'One linked source for any factual claim.'
     ),
     'quoteRequirements', 'Quotes optional; if used, must be on-the-record.',
     'visualNeeds', 'Optional. Pull quote recommended.',
     'publishingNotes', 'Mark clearly as Opinion at top of piece.'
   ),
   940),
  ('10000000-0000-0000-0000-000000000005', 'Book review: ''The New Map''',
   'Critical review, 700 words.',
   '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000004',
   now() + interval '7 days', 'complete', 'green',
   700, false,
   '40000000-0000-0000-0000-000000000006', null,
   'book-review-the-new-map', '{}'::jsonb, 715),
  ('10000000-0000-0000-0000-000000000006', 'Interview prep: Senator Ortiz',
   '20 questions. Background brief. House style.',
   '00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000005',
   now() + interval '4 days', 'not_started', 'green',
   600, false,
   '40000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000043',
   'interview-prep-ortiz', '{}'::jsonb, null),
  ('10000000-0000-0000-0000-000000000007', 'Newsroom guidelines refresh',
   'Compile feedback from last quarter. Draft v2.',
   '00000000-0000-0000-0000-000000000001', null,
   now() + interval '10 days', 'in_progress', 'green',
   null, false,
   null, null, null, '{}'::jsonb, null)
on conflict (id) do nothing;

-- ── issue_slots ──────────────────────────────────────────────────────────
insert into public.issue_slots (id, issue_id, task_id, priority) values
  ('60000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000042',
    '10000000-0000-0000-0000-000000000001', 'must_run'),
  ('60000000-0000-0000-0000-000000000002', '50000000-0000-0000-0000-000000000042',
    '10000000-0000-0000-0000-000000000003', 'must_run'),
  ('60000000-0000-0000-0000-000000000003', '50000000-0000-0000-0000-000000000042',
    '10000000-0000-0000-0000-000000000004', 'nice_to_run'),
  ('60000000-0000-0000-0000-000000000004', '50000000-0000-0000-0000-000000000042',
    '10000000-0000-0000-0000-000000000002', 'nice_to_run'),
  ('60000000-0000-0000-0000-000000000005', '50000000-0000-0000-0000-000000000043',
    '10000000-0000-0000-0000-000000000006', 'must_run')
on conflict (issue_id, task_id) do update
  set priority = excluded.priority;

-- ── pitches ──────────────────────────────────────────────────────────────
insert into public.pitches (
  id, proposed_headline, section_id, angle, why_now, proposed_sources,
  expected_word_count, deadline_pref, writer_note, writer_id, status,
  editor_note, decided_by_id, decided_at, created_at
) values
  ('70000000-0000-0000-0000-000000000001', 'Inside the school''s quiet AI grading pilot',
   '40000000-0000-0000-0000-000000000001',
   'Two teachers are using an LLM to triage essay drafts. Students didn''t know.',
   'Pilot quietly expanded last week — first time it''s touched required coursework.',
   array['Two of the teachers running the pilot','Three students whose work was graded','District policy doc on AI in classrooms'],
   1200, now() + interval '8 days',
   'I have one teacher already willing to talk on the record.',
   '00000000-0000-0000-0000-000000000002', 'submitted',
   null, null, null, now() - interval '1 day'),
  ('70000000-0000-0000-0000-000000000002', 'Why the cafeteria meal-plan price jumped 14%',
   '40000000-0000-0000-0000-000000000003',
   'Track the procurement contract change that hit families this term.',
   'Bill goes into effect next month.',
   array['District procurement filings','PTA board members','Two named families'],
   900, now() + interval '11 days', null,
   '00000000-0000-0000-0000-000000000001', 'submitted',
   null, null, null, now() - interval '2 days'),
  ('70000000-0000-0000-0000-000000000003', 'Markets explainer: what ''inverted yield curve'' means for your first job',
   '40000000-0000-0000-0000-000000000004',
   'Make a scary-sounding macro signal concrete for a teen reader.',
   'Curve un-inverted last week — first time in 18 months.',
   array['FRED data','Quote from one named economist'],
   800, null, null,
   '00000000-0000-0000-0000-000000000003', 'accepted',
   'Great hook. Keep it under 800 and avoid investment advice phrasing.',
   '00000000-0000-0000-0000-000000000004', now(), now() - interval '3 days'),
  ('70000000-0000-0000-0000-000000000004', 'Op-ed: bring back the school newspaper print run',
   '40000000-0000-0000-0000-000000000002',
   'Argue the case for a quarterly print edition alongside the site.',
   'Budget meeting next week.',
   array['Last year''s circulation numbers'],
   700, null, null,
   '00000000-0000-0000-0000-000000000001', 'declined',
   'Strong voice but argument is thin without cost data. Re-pitch with numbers.',
   '00000000-0000-0000-0000-000000000005', now() - interval '1 day', now() - interval '5 days'),
  ('70000000-0000-0000-0000-000000000005', 'Robotics team''s nationals run, in their own words',
   '40000000-0000-0000-0000-000000000005',
   'Oral history of the season told by five team members.',
   'Nationals start in three weeks.',
   array['Five team members','Coach'],
   1500, null, null,
   '00000000-0000-0000-0000-000000000003', 'submitted', null, null, null, now()),
  ('70000000-0000-0000-0000-000000000006', 'Every senior film of the year, ranked',
   '40000000-0000-0000-0000-000000000006',
   'Light, fun ranking of the senior thesis films, with clips.',
   'Festival is next month.',
   array['Festival program','Two film teachers'],
   1100, null, null,
   '00000000-0000-0000-0000-000000000002', 'submitted', null, null, null, now()),
  ('70000000-0000-0000-0000-000000000007', 'The week the dollar story changed',
   '40000000-0000-0000-0000-000000000007',
   'What''s actually behind the recent dollar moves and why teen savers should notice.',
   'FX desks called it ''the most important week in months''.',
   array['Bank policy statements','Two named economists'],
   1000, null, null,
   '00000000-0000-0000-0000-000000000001', 'submitted', null, null, null, now())
on conflict (id) do nothing;

-- ── editorial_checklists ─────────────────────────────────────────────────
-- Items are seeded as jsonb arrays. The default item set is duplicated here
-- so the seed file can be applied without an application running. The keys
-- match `lib/mock-data.ts → defaultChecklistItems`.

-- t1 (markets): general + business, with two items pre-checked.
insert into public.editorial_checklists (task_id, items) values
  ('10000000-0000-0000-0000-000000000001', jsonb_build_array(
    jsonb_build_object('key','g_headline','label','Headline is accurate','group','general','required',true,'checked',false),
    jsonb_build_object('key','g_lede','label','Lede is clear and specific','group','general','required',true,'checked',true,'checkedById','00000000-0000-0000-0000-000000000004','checkedAt', to_char(now() at time zone 'utc','YYYY-MM-DD"T"HH24:MI:SS"Z"')),
    jsonb_build_object('key','g_claims','label','Claims are supported by sources','group','general','required',true,'checked',false),
    jsonb_build_object('key','g_sources','label','Sources are linked or named','group','general','required',true,'checked',false),
    jsonb_build_object('key','g_quotes','label','Quotes are attributed','group','general','required',true,'checked',false),
    jsonb_build_object('key','g_opinion','label','Opinion is clearly labeled (if applicable)','group','general','required',false,'checked',false),
    jsonb_build_object('key','g_grammar','label','Grammar / copy pass complete','group','general','required',true,'checked',false),
    jsonb_build_object('key','g_final','label','Ready for final approval','group','general','required',true,'checked',false),
    jsonb_build_object('key','b_finance_sources','label','Financial claims have sources','group','business','required',true,'checked',false),
    jsonb_build_object('key','b_market_date','label','Market data date is stated','group','business','required',true,'checked',true,'checkedById','00000000-0000-0000-0000-000000000004','checkedAt', to_char(now() at time zone 'utc','YYYY-MM-DD"T"HH24:MI:SS"Z"')),
    jsonb_build_object('key','b_no_advice','label','No investment-advice language','group','business','required',true,'checked',false),
    jsonb_build_object('key','b_terms','label','Terms are explained for teen readers','group','business','required',true,'checked',false)
  ))
on conflict (task_id) do update set items = excluded.items;

-- t3 (digest): general only, with section-edit pass largely done.
insert into public.editorial_checklists (task_id, items) values
  ('10000000-0000-0000-0000-000000000003', jsonb_build_array(
    jsonb_build_object('key','g_headline','label','Headline is accurate','group','general','required',true,'checked',true,'checkedById','00000000-0000-0000-0000-000000000005','checkedAt', to_char(now() at time zone 'utc','YYYY-MM-DD"T"HH24:MI:SS"Z"')),
    jsonb_build_object('key','g_lede','label','Lede is clear and specific','group','general','required',true,'checked',true,'checkedById','00000000-0000-0000-0000-000000000005','checkedAt', to_char(now() at time zone 'utc','YYYY-MM-DD"T"HH24:MI:SS"Z"')),
    jsonb_build_object('key','g_claims','label','Claims are supported by sources','group','general','required',true,'checked',true,'checkedById','00000000-0000-0000-0000-000000000005','checkedAt', to_char(now() at time zone 'utc','YYYY-MM-DD"T"HH24:MI:SS"Z"')),
    jsonb_build_object('key','g_sources','label','Sources are linked or named','group','general','required',true,'checked',true,'checkedById','00000000-0000-0000-0000-000000000005','checkedAt', to_char(now() at time zone 'utc','YYYY-MM-DD"T"HH24:MI:SS"Z"')),
    jsonb_build_object('key','g_quotes','label','Quotes are attributed','group','general','required',true,'checked',false),
    jsonb_build_object('key','g_opinion','label','Opinion is clearly labeled (if applicable)','group','general','required',false,'checked',false),
    jsonb_build_object('key','g_grammar','label','Grammar / copy pass complete','group','general','required',true,'checked',false),
    jsonb_build_object('key','g_final','label','Ready for final approval','group','general','required',true,'checked',false)
  ))
on conflict (task_id) do update set items = excluded.items;

-- t4 (op-ed): general + sensitive group, all unchecked at seed time.
insert into public.editorial_checklists (task_id, items) values
  ('10000000-0000-0000-0000-000000000004', jsonb_build_array(
    jsonb_build_object('key','g_headline','label','Headline is accurate','group','general','required',true,'checked',false),
    jsonb_build_object('key','g_lede','label','Lede is clear and specific','group','general','required',true,'checked',false),
    jsonb_build_object('key','g_claims','label','Claims are supported by sources','group','general','required',true,'checked',false),
    jsonb_build_object('key','g_sources','label','Sources are linked or named','group','general','required',true,'checked',false),
    jsonb_build_object('key','g_quotes','label','Quotes are attributed','group','general','required',true,'checked',false),
    jsonb_build_object('key','g_opinion','label','Opinion is clearly labeled (if applicable)','group','general','required',false,'checked',false),
    jsonb_build_object('key','g_grammar','label','Grammar / copy pass complete','group','general','required',true,'checked',false),
    jsonb_build_object('key','g_final','label','Ready for final approval','group','general','required',true,'checked',false),
    jsonb_build_object('key','s_privacy','label','Privacy risk reviewed','group','sensitive','required',true,'checked',false),
    jsonb_build_object('key','s_escalation','label','Admin / leader escalation completed','group','sensitive','required',true,'checked',false),
    jsonb_build_object('key','s_language','label','Language is fair and precise','group','sensitive','required',true,'checked',false),
    jsonb_build_object('key','s_second_editor','label','A second editor reviewed','group','sensitive','required',true,'checked',false)
  ))
on conflict (task_id) do update set items = excluded.items;

-- ── sensitive_flags ──────────────────────────────────────────────────────
insert into public.sensitive_flags (
  id, task_id, reason, notes, status, raised_by_id, raised_at
) values
  ('80000000-0000-0000-0000-000000000001',
   '10000000-0000-0000-0000-000000000004',
   'politics',
   'Strong stance on a contested policy. Wants a leader read before publication.',
   'open',
   '00000000-0000-0000-0000-000000000005',
   now() - interval '1 day')
on conflict (id) do nothing;

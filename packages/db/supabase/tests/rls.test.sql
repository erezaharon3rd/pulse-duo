-- בדיקות RLS בין שני חשבונות (pgTAP). רץ ב-CI: supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

-- שני משתמשים בצימוד אחד, ומשתמש שלישי בצימוד אחר
insert into auth.users (id) values
  ('00000000-0000-0000-0000-00000000000a'),
  ('00000000-0000-0000-0000-00000000000b'),
  ('00000000-0000-0000-0000-00000000000c');
insert into pairings (pairing_id, agreement) values
  ('10000000-0000-0000-0000-000000000001', 'non_exclusive'),
  ('10000000-0000-0000-0000-000000000002', 'non_exclusive');
insert into pairing_members values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a', now()),
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000b', now()),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000000b', now()),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000000c', now());
insert into sessions (session_id, pairing_id, scheduled_at, origin) values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', now(), 'schedule');
insert into debriefs (session_id, user_id, effort, pain, feeling) values
  ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000b', 3, 0, 'did_not_want');
insert into willingness (session_id, user_id, answer) values
  ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000b', 'not_today');
insert into my_pairing_settings (user_id, pairing_id, spice_level) values
  ('00000000-0000-0000-0000-00000000000b', '10000000-0000-0000-0000-000000000001', 1);

-- מתחזים ל-A
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000a"}';

select is((select count(*) from debriefs)::int, 0, 'A לא רואה את התחקור של B');
select is((select count(*) from my_pairing_settings)::int, 0, 'A לא רואה את השובבות והגבולות של B');
select is((select count(*) from pairings)::int, 1, 'A רואה רק את הצימוד שלו');
select is((select count(*) from pairing_members where pairing_id = '10000000-0000-0000-0000-000000000002')::int, 0,
  'A לא יכול לגלות שלב B יש צימוד נוסף');
select throws_ok($$ select plan_enc from sessions $$, '42501', null, 'A לא יכול לקרוא את התוכנית לפני החשיפה');
select is((select count(*) from sessions_public)::int, 1, 'A רואה את המפגש שלו בלי התוכנית');
select throws_ok($$ insert into pairings (couple_name) values ('xx') $$, '42501', null, 'לקוח לא יכול ליצור צימוד ישירות');
select is_empty($$ update willingness set answer = 'yes' returning 1 $$,
  'לקוח לא יכול לשנות תשובת רצון ישירות (גם לא של הצד השני)');

select * from finish();
rollback;

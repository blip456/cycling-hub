-- pgTAP tests for public.test_weeks and public.test_sessions: RLS on, own rows only, constraints,
-- a session cannot join another user's week, deleting a week deletes its sessions.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(21);

select has_table('public', 'test_weeks', 'test_weeks table exists');
select has_table('public', 'test_sessions', 'test_sessions table exists');
select is(
  (select relrowsecurity from pg_class where oid = 'public.test_weeks'::regclass),
  true,
  'RLS is enabled on test_weeks'
);
select is(
  (select relrowsecurity from pg_class where oid = 'public.test_sessions'::regclass),
  true,
  'RLS is enabled on test_sessions'
);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
values
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'user-a@test.invalid', '', now(), now(), now()),
  ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'user-b@test.invalid', '', now(), now(), now());

insert into public.test_weeks (id, user_id, protocol)
values ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '22222222-2222-2222-2222-222222222222', 'ramp');
insert into public.test_sessions (user_id, week_id, position, kind)
values ('22222222-2222-2222-2222-222222222222', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 1, 'test');

-- As user A
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);

select lives_ok(
  $$ insert into public.test_weeks (id, protocol) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '20min') $$,
  'user A can create a test week (status defaults to planned)'
);
select lives_ok(
  $$ insert into public.test_sessions (week_id, position, kind) values
       ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 1, 'opener'),
       ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 2, 'recovery'),
       ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 3, 'test') $$,
  'user A can add ordered sessions to their week'
);

select throws_ok(
  $$ insert into public.test_weeks (protocol) values ('cooper') $$,
  '23514', null, 'an unknown protocol is rejected'
);
select throws_ok(
  $$ insert into public.test_weeks (protocol, status) values ('ramp', 'done') $$,
  '23514', null, 'an unknown status is rejected'
);
select throws_ok(
  $$ insert into public.test_sessions (week_id, position, kind) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 4, 'sprint') $$,
  '23514', null, 'an unknown session kind is rejected'
);
select throws_ok(
  $$ insert into public.test_sessions (week_id, position, kind) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 1, 'test') $$,
  '23505', null, 'a position is used once per week'
);
select throws_ok(
  $$ insert into public.test_sessions (week_id, position, kind) values ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 2, 'test') $$,
  '23503', null, 'a session cannot be added to another user''s week'
);
select throws_ok(
  $$ insert into public.test_weeks (user_id, protocol) values ('22222222-2222-2222-2222-222222222222', 'ramp') $$,
  '42501', null, 'user A cannot create a week for user B'
);

select lives_ok(
  $$ update public.test_sessions set scheduled_on = '2026-11-04', result_avg_power_w = 250, result_ftp_w = 238
     where position = 3 $$,
  'user A can pick a date and enter a result'
);
select is(
  (select scheduled_on from public.test_sessions where position = 1),
  null,
  'scheduled_on is empty until the user picks a date'
);
select is((select count(*)::int from public.test_weeks), 1, 'user A sees only their own week');
select is((select count(*)::int from public.test_sessions), 3, 'user A sees only their own sessions');

select lives_ok(
  $$ update public.test_weeks set status = 'in_progress' where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' $$,
  'user A can move their week on'
);
select lives_ok(
  $$ delete from public.test_weeks where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' $$,
  'user A can delete their week'
);

-- As anon
reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select throws_ok(
  $$ select count(*) from public.test_weeks $$,
  '42501', null, 'anon has no access to test_weeks'
);

-- Back as superuser: effects
reset role;
select is(
  (select count(*)::int from public.test_sessions where user_id = '11111111-1111-1111-1111-111111111111'),
  0,
  'deleting a week deletes its sessions'
);
select is(
  (select count(*)::int from public.test_sessions where user_id = '22222222-2222-2222-2222-222222222222'),
  1,
  'user B''s session is untouched'
);

select * from finish();
rollback;

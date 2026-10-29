-- pgTAP tests for public.training_plans: RLS on, own rows only, defaults, constraints, one active plan per user,
-- anon blocked, deleting a plan deletes its sessions and change log.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(22);

select has_table('public', 'training_plans', 'training_plans table exists');
select is(
  (select relrowsecurity from pg_class where oid = 'public.training_plans'::regclass),
  true,
  'RLS is enabled on training_plans'
);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
values
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'user-a@test.invalid', '', now(), now(), now()),
  ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'user-b@test.invalid', '', now(), now(), now());

insert into public.training_plans (id, user_id, start_date, intake, ftp_w, engine_version, input_fingerprint)
values ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '22222222-2222-2222-2222-222222222222', '2026-11-02', '{}', 280, '1', 'fp-b');

-- As user A
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);

select lives_ok(
  $$ insert into public.training_plans (id, start_date, intake, ftp_w, weight_kg, engine_version, input_fingerprint)
     values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '2026-11-02', '{"level":"committed"}', 250, 75.1, '1', 'fp-1') $$,
  'user A can create a plan'
);
select is((select weeks from public.training_plans), 12::smallint, 'weeks defaults to 12');
select is((select status from public.training_plans), 'active', 'status defaults to active');
select is((select count(*)::int from public.training_plans), 1, 'user A sees only their own plan');
select is((select undone_fingerprint from public.training_plans), null, 'no fingerprint is undone by default');

select throws_ok(
  $$ insert into public.training_plans (start_date, intake, ftp_w, engine_version, input_fingerprint)
     values ('2026-11-09', '{}', 250, '1', 'fp-2') $$,
  '23505', null, 'a second active plan is rejected'
);
select lives_ok(
  $$ update public.training_plans set status = 'replaced', updated_at = '2000-01-01' where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' $$,
  'user A can replace the plan'
);
select isnt(
  (select updated_at from public.training_plans where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  '2000-01-01'::timestamptz,
  'updated_at is kept current by the trigger'
);
select lives_ok(
  $$ insert into public.training_plans (id, start_date, weeks, intake, ftp_w, engine_version, input_fingerprint)
     values ('a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1', '2026-11-09', 8, '{}', 250, '1', 'fp-2') $$,
  'a new plan can follow once the old one is replaced (8 weeks, event close by)'
);
select lives_ok(
  $$ insert into public.training_plans (start_date, intake, ftp_w, engine_version, input_fingerprint, status)
     values ('2026-01-05', '{}', 240, '1', 'fp-old', 'completed') $$,
  'any number of finished plans are kept'
);

select throws_ok(
  $$ insert into public.training_plans (start_date, weeks, intake, ftp_w, engine_version, input_fingerprint, status)
     values ('2026-11-09', 13, '{}', 250, '1', 'x', 'cancelled') $$,
  '23514', null, 'more than 12 weeks is rejected'
);
select throws_ok(
  $$ insert into public.training_plans (start_date, weeks, intake, ftp_w, engine_version, input_fingerprint, status)
     values ('2026-11-09', 3, '{}', 250, '1', 'x', 'cancelled') $$,
  '23514', null, 'fewer than 4 weeks is rejected'
);
select throws_ok(
  $$ insert into public.training_plans (start_date, intake, ftp_w, engine_version, input_fingerprint, status)
     values ('2026-11-09', '{}', 250, '1', 'x', 'paused') $$,
  '23514', null, 'an unknown status is rejected'
);
select throws_ok(
  $$ insert into public.training_plans (start_date, intake, ftp_w, engine_version, input_fingerprint, status)
     values ('2026-11-09', '[]', 250, '1', 'x', 'cancelled') $$,
  '23514', null, 'the intake must be an object'
);
select throws_ok(
  $$ insert into public.training_plans (start_date, intake, ftp_w, engine_version, input_fingerprint, status)
     values ('2026-11-09', '{}', 20, '1', 'x', 'cancelled') $$,
  '23514', null, 'an FTP snapshot below 30 W is rejected'
);
select throws_ok(
  $$ insert into public.training_plans (user_id, start_date, intake, ftp_w, engine_version, input_fingerprint, status)
     values ('22222222-2222-2222-2222-222222222222', '2026-11-09', '{}', 250, '1', 'x', 'cancelled') $$,
  '42501', null, 'user A cannot create a plan for user B'
);

-- As anon
reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select throws_ok(
  $$ select count(*) from public.training_plans $$,
  '42501', null, 'anon has no access to training_plans'
);

-- Back as superuser: cascade and isolation
reset role;
insert into public.planned_sessions (user_id, plan_id, week_number, phase, session_date, kind, title, duration_min)
values ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 1, 'base', '2026-11-04', 'endurance', 'Endurance', 60);
insert into public.plan_changes (user_id, plan_id, reason, changes)
values ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Missed session', '[]');
delete from public.training_plans where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
select is(
  (select count(*)::int from public.planned_sessions where plan_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  0,
  'deleting a plan deletes its sessions'
);
select is(
  (select count(*)::int from public.plan_changes where plan_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  0,
  'deleting a plan deletes its change log'
);
select is(
  (select count(*)::int from public.training_plans where user_id = '22222222-2222-2222-2222-222222222222'),
  1,
  'user B''s plan is untouched'
);

select * from finish();
rollback;

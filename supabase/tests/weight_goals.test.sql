-- pgTAP tests for public.weight_goals: RLS on, own rows only, defaults, constraints, one active goal per user, anon blocked.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(18);

select has_table('public', 'weight_goals', 'weight_goals table exists');
select is(
  (select relrowsecurity from pg_class where oid = 'public.weight_goals'::regclass),
  true,
  'RLS is enabled on weight_goals'
);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
values
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'user-a@test.invalid', '', now(), now(), now()),
  ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'user-b@test.invalid', '', now(), now(), now());

insert into public.weight_goals (user_id, target_weight_kg, target_date, start_weight_kg, start_date)
values ('22222222-2222-2222-2222-222222222222', 70, '2027-03-01', 75, '2026-10-28');

-- As user A
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);

select lives_ok(
  $$ insert into public.weight_goals (target_weight_kg, target_date, start_weight_kg, start_date)
     values (73, '2026-12-13', 75.1, '2026-10-28') $$,
  'user A can set a goal (status defaults to active)'
);
select is((select status from public.weight_goals), 'active', 'a new goal is active');
select is((select count(*)::int from public.weight_goals), 1, 'user A sees only their own goal');

select throws_ok(
  $$ insert into public.weight_goals (target_weight_kg, target_date, start_weight_kg, start_date)
     values (72, '2027-01-01', 75.1, '2026-10-28') $$,
  '23505', null, 'a second active goal is rejected'
);
select throws_ok(
  $$ insert into public.weight_goals (user_id, target_weight_kg, target_date, start_weight_kg, start_date)
     values ('22222222-2222-2222-2222-222222222222', 72, '2027-01-01', 75.1, '2026-10-28') $$,
  '42501', null, 'user A cannot set a goal for user B'
);
select lives_ok(
  $$ update public.weight_goals set status = 'cancelled' $$,
  'user A can cancel the goal'
);
select lives_ok(
  $$ insert into public.weight_goals (target_weight_kg, target_date, start_weight_kg, start_date)
     values (72, '2027-01-01', 75.1, '2026-10-28') $$,
  'a new goal can follow once the old one is cancelled'
);
select lives_ok(
  $$ insert into public.weight_goals (target_weight_kg, target_date, start_weight_kg, start_date, status)
     values (71, '2027-02-01', 75.1, '2026-10-28', 'reached') $$,
  'several finished goals are kept as history'
);
select throws_ok(
  $$ insert into public.weight_goals (target_weight_kg, target_date, start_weight_kg, start_date, status)
     values (29.9, '2027-02-01', 75.1, '2026-10-28', 'cancelled') $$,
  '23514', null, 'a target below 30 kg is rejected'
);
select throws_ok(
  $$ insert into public.weight_goals (target_weight_kg, target_date, start_weight_kg, start_date, status)
     values (75.1, '2027-02-01', 75.1, '2026-10-28', 'cancelled') $$,
  '23514', null, 'a target at the start weight is rejected'
);
select throws_ok(
  $$ insert into public.weight_goals (target_weight_kg, target_date, start_weight_kg, start_date, status)
     values (70, '2026-10-28', 75.1, '2026-10-28', 'cancelled') $$,
  '23514', null, 'a target date on or before the start date is rejected'
);
select throws_ok(
  $$ insert into public.weight_goals (target_weight_kg, target_date, start_weight_kg, start_date, status)
     values (70, '2027-02-01', 75.1, '2026-10-28', 'paused') $$,
  '23514', null, 'an unknown status is rejected'
);
select lives_ok(
  $$ delete from public.weight_goals where status = 'reached' $$,
  'user A can delete a goal'
);

-- As anon
reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select throws_ok(
  $$ select count(*) from public.weight_goals $$,
  '42501', null, 'anon has no access to weight_goals'
);

-- Back as superuser
reset role;
select is(
  (select start_date from public.weight_goals where user_id = '22222222-2222-2222-2222-222222222222'),
  '2026-10-28'::date,
  'user B''s goal is untouched'
);
insert into public.weight_goals (user_id, target_weight_kg, target_date, start_weight_kg, status)
values ('11111111-1111-1111-1111-111111111111', 70, '2999-01-01', 75, 'cancelled');
select is(
  (select (now() at time zone 'Europe/Brussels')::date = start_date
   from public.weight_goals where target_date = '2999-01-01'),
  true,
  'start_date defaults to today in Brussels'
);

select * from finish();
rollback;

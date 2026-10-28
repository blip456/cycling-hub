-- pgTAP tests for the athlete profile columns on public.profiles (P44, P46): defaults, constraints, own row only.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(14);

select has_column('public', 'profiles', 'display_name', 'has display_name');
select has_column('public', 'profiles', 'birth_year', 'has birth_year');
select has_column('public', 'profiles', 'available_days', 'has available_days');
select has_column('public', 'profiles', 'goal', 'has goal');

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
values
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'user-a@test.invalid', '', now(), now(), now()),
  ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'user-b@test.invalid', '', now(), now(), now());

-- Defaults on the row the trigger created
select is(
  (select weight_reminder_day from public.profiles where id = '11111111-1111-1111-1111-111111111111'),
  0::smallint,
  'weight reminder day defaults to Sunday (0)'
);
select is(
  (select weight_reminder_enabled from public.profiles where id = '11111111-1111-1111-1111-111111111111'),
  true,
  'weight reminder is on by default'
);
select is(
  (select display_name from public.profiles where id = '11111111-1111-1111-1111-111111111111'),
  null,
  'profile fields are empty by default'
);

-- As user A
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);

select lives_ok(
  $$ update public.profiles
     set display_name = 'Test', birth_year = 1985, available_days = '{1,3,6}', goal = 'Ride more',
         weight_reminder_day = 6, weight_reminder_enabled = false
     where id = '11111111-1111-1111-1111-111111111111' $$,
  'user A can fill in the athlete fields'
);
select is(
  (select available_days from public.profiles where id = '11111111-1111-1111-1111-111111111111'),
  '{1,3,6}'::smallint[],
  'available days are stored'
);

select throws_ok(
  $$ update public.profiles set birth_year = 1850 where id = '11111111-1111-1111-1111-111111111111' $$,
  '23514', null, 'birth year below 1900 is rejected'
);
select throws_ok(
  $$ update public.profiles set available_days = '{7}' where id = '11111111-1111-1111-1111-111111111111' $$,
  '23514', null, 'available day 7 is rejected'
);
select throws_ok(
  $$ update public.profiles set weight_reminder_day = 7 where id = '11111111-1111-1111-1111-111111111111' $$,
  '23514', null, 'reminder day 7 is rejected'
);
select throws_ok(
  $$ update public.profiles set goal = repeat('x', 501) where id = '11111111-1111-1111-1111-111111111111' $$,
  '23514', null, 'a goal over 500 characters is rejected'
);

update public.profiles set display_name = 'hacked' where id = '22222222-2222-2222-2222-222222222222';

reset role;
select is(
  (select display_name from public.profiles where id = '22222222-2222-2222-2222-222222222222'),
  null,
  'user A cannot change user B''s profile'
);

select * from finish();
rollback;

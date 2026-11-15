-- pgTAP tests for the training settings columns on public.profiles (P96 to P98): empty by default, the
-- Zone 2 target stays inside the Coggan band, limits and steps, own row only.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(24);

select has_column('public', 'profiles', 'zone2_target_percent', 'has zone2_target_percent');
select has_column('public', 'profiles', 'max_long_ride_min', 'has max_long_ride_min');
select has_column('public', 'profiles', 'max_weekly_hours', 'has max_weekly_hours');
select has_column('public', 'profiles', 'ride_history_stat', 'has ride_history_stat');
select has_column('public', 'profiles', 'intensity_balance', 'has intensity_balance');

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
values
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'user-a@test.invalid', '', now(), now(), now()),
  ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'user-b@test.invalid', '', now(), now(), now());

select is(
  (select zone2_target_percent::text || max_long_ride_min::text || max_weekly_hours::text || ride_history_stat
   from public.profiles where id = '11111111-1111-1111-1111-111111111111'),
  null,
  'the settings are empty by default (null means the default)'
);

-- As user A
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);

select lives_ok(
  $$ update public.profiles
     set zone2_target_percent = 70, max_long_ride_min = 240, max_weekly_hours = 8.5, ride_history_stat = 'average'
     where id = '11111111-1111-1111-1111-111111111111' $$,
  'user A can fill in the settings'
);
select is(
  (select max_weekly_hours from public.profiles where id = '11111111-1111-1111-1111-111111111111'),
  8.5,
  'half hours are stored'
);
select lives_ok(
  $$ update public.profiles set zone2_target_percent = 56 where id = '11111111-1111-1111-1111-111111111111' $$,
  'the bottom of the Zone 2 band is allowed'
);
select lives_ok(
  $$ update public.profiles set zone2_target_percent = 75 where id = '11111111-1111-1111-1111-111111111111' $$,
  'the top of the Zone 2 band is allowed'
);
select throws_ok(
  $$ update public.profiles set zone2_target_percent = 55 where id = '11111111-1111-1111-1111-111111111111' $$,
  '23514', null, 'a Zone 2 target below the band is rejected'
);
select throws_ok(
  $$ update public.profiles set zone2_target_percent = 76 where id = '11111111-1111-1111-1111-111111111111' $$,
  '23514', null, 'a Zone 2 target above the band is rejected'
);
select throws_ok(
  $$ update public.profiles set max_long_ride_min = 60 where id = '11111111-1111-1111-1111-111111111111' $$,
  '23514', null, 'a long ride maximum below 90 minutes is rejected'
);
select throws_ok(
  $$ update public.profiles set max_long_ride_min = 500 where id = '11111111-1111-1111-1111-111111111111' $$,
  '23514', null, 'a long ride maximum above 480 minutes is rejected'
);
select throws_ok(
  $$ update public.profiles set max_long_ride_min = 243 where id = '11111111-1111-1111-1111-111111111111' $$,
  '23514', null, 'a long ride maximum that is not a multiple of 5 is rejected'
);
select throws_ok(
  $$ update public.profiles set max_weekly_hours = 2.5 where id = '11111111-1111-1111-1111-111111111111' $$,
  '23514', null, 'a weekly maximum below 3 hours is rejected'
);
select throws_ok(
  $$ update public.profiles set max_weekly_hours = 25.5 where id = '11111111-1111-1111-1111-111111111111' $$,
  '23514', null, 'a weekly maximum above 25 hours is rejected'
);
select throws_ok(
  $$ update public.profiles set max_weekly_hours = 8.2 where id = '11111111-1111-1111-1111-111111111111' $$,
  '23514', null, 'a weekly maximum that is not whole or half hours is rejected'
);
select lives_ok(
  $$ update public.profiles set intensity_balance = 'balanced' where id = '11111111-1111-1111-1111-111111111111' $$,
  'the balanced intensity balance is allowed'
);
select lives_ok(
  $$ update public.profiles set intensity_balance = 'high' where id = '11111111-1111-1111-1111-111111111111' $$,
  'the high intensity balance is allowed'
);
select throws_ok(
  $$ update public.profiles set intensity_balance = 'extreme' where id = '11111111-1111-1111-1111-111111111111' $$,
  '23514', null, 'an unknown intensity balance is rejected'
);
select throws_ok(
  $$ update public.profiles set ride_history_stat = 'mode' where id = '11111111-1111-1111-1111-111111111111' $$,
  '23514', null, 'an unknown history statistic is rejected'
);
select lives_ok(
  $$ update public.profiles
     set zone2_target_percent = null, max_long_ride_min = null, max_weekly_hours = null, ride_history_stat = null
     where id = '11111111-1111-1111-1111-111111111111' $$,
  'every setting can go back to the default (null)'
);

update public.profiles set zone2_target_percent = 72 where id = '22222222-2222-2222-2222-222222222222';

reset role;
select is(
  (select zone2_target_percent from public.profiles where id = '22222222-2222-2222-2222-222222222222'),
  null,
  'user A cannot change user B''s settings'
);

select * from finish();
rollback;

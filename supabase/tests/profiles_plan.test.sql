-- pgTAP tests for the plan input columns on public.profiles (P60, P62, P65, P66): defaults, constraints, own row only.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(25);

select has_column('public', 'profiles', 'riding_environment', 'has riding_environment');
select has_column('public', 'profiles', 'weekly_hours', 'has weekly_hours');
select has_column('public', 'profiles', 'training_purposes', 'has training_purposes');
select has_column('public', 'profiles', 'level', 'has level');
select has_column('public', 'profiles', 'level_answers', 'has level_answers');
select has_column('public', 'profiles', 'event_name', 'has event_name');
select has_column('public', 'profiles', 'event_date', 'has event_date');

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
values
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'user-a@test.invalid', '', now(), now(), now()),
  ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'user-b@test.invalid', '', now(), now(), now());

select is(
  (select riding_environment || weekly_hours::text || training_purposes::text || level || level_answers::text || event_name || event_date::text
   from public.profiles where id = '11111111-1111-1111-1111-111111111111'),
  null,
  'the plan fields are empty by default'
);

-- As user A
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);

select lives_ok(
  $$ update public.profiles
     set riding_environment = 'both', weekly_hours = 6.5, training_purposes = '{weight_loss,endurance}', level = 'committed',
         level_answers = '{"l1":2,"l2":1,"l3":1,"l4":2,"l5":1}', event_name = 'Winter sportive', event_date = '2026-12-12'
     where id = '11111111-1111-1111-1111-111111111111' $$,
  'user A can fill in the plan fields'
);
select is(
  (select training_purposes from public.profiles where id = '11111111-1111-1111-1111-111111111111'),
  '{weight_loss,endurance}'::text[],
  'the purposes keep their order'
);
select is(
  (select weekly_hours from public.profiles where id = '11111111-1111-1111-1111-111111111111'),
  6.5,
  'half hours are stored'
);
select lives_ok(
  $$ update public.profiles set event_name = null, event_date = '2026-12-12' where id = '11111111-1111-1111-1111-111111111111' $$,
  'an event date without a name is allowed'
);
select lives_ok(
  $$ update public.profiles set training_purposes = '{muscle_building,weight_loss,endurance,speed}'
     where id = '11111111-1111-1111-1111-111111111111' $$,
  'all four purposes can be ranked'
);

select throws_ok(
  $$ update public.profiles set riding_environment = 'treadmill' where id = '11111111-1111-1111-1111-111111111111' $$,
  '23514', null, 'an unknown riding environment is rejected'
);
select throws_ok(
  $$ update public.profiles set weekly_hours = 0.5 where id = '11111111-1111-1111-1111-111111111111' $$,
  '23514', null, 'hours below 1 are rejected'
);
select throws_ok(
  $$ update public.profiles set weekly_hours = 25.5 where id = '11111111-1111-1111-1111-111111111111' $$,
  '23514', null, 'hours above 25 are rejected'
);
select throws_ok(
  $$ update public.profiles set weekly_hours = 6.2 where id = '11111111-1111-1111-1111-111111111111' $$,
  '23514', null, 'hours that are not whole or half hours are rejected'
);
select throws_ok(
  $$ update public.profiles set training_purposes = '{endurance,endurance}' where id = '11111111-1111-1111-1111-111111111111' $$,
  '23514', null, 'a duplicate purpose is rejected'
);
select throws_ok(
  $$ update public.profiles set training_purposes = '{climbing}' where id = '11111111-1111-1111-1111-111111111111' $$,
  '23514', null, 'an unknown purpose is rejected'
);
select throws_ok(
  $$ update public.profiles set training_purposes = '{}' where id = '11111111-1111-1111-1111-111111111111' $$,
  '23514', null, 'an empty purpose list is rejected (use null)'
);
select throws_ok(
  $$ update public.profiles set level = 'pro' where id = '11111111-1111-1111-1111-111111111111' $$,
  '23514', null, 'an unknown level is rejected'
);
select throws_ok(
  $$ update public.profiles set level_answers = '[1,2]' where id = '11111111-1111-1111-1111-111111111111' $$,
  '23514', null, 'level answers must be an object'
);
select throws_ok(
  $$ update public.profiles set event_name = repeat('x', 81) where id = '11111111-1111-1111-1111-111111111111' $$,
  '23514', null, 'an event name over 80 characters is rejected'
);
select throws_ok(
  $$ update public.profiles set event_name = 'Sportive', event_date = null where id = '11111111-1111-1111-1111-111111111111' $$,
  '23514', null, 'an event name without a date is rejected'
);

update public.profiles set level = 'semi_pro' where id = '22222222-2222-2222-2222-222222222222';

reset role;
select is(
  (select level from public.profiles where id = '22222222-2222-2222-2222-222222222222'),
  null,
  'user A cannot change user B''s profile'
);

select * from finish();
rollback;

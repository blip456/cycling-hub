-- pgTAP tests for public.profiles: RLS on, own row only, anon sees nothing.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(14);

-- Structure
select has_table('public', 'profiles', 'profiles table exists');
select col_is_pk('public', 'profiles', 'id', 'id is the primary key');
select has_column('public', 'profiles', 'last_seen_version', 'has last_seen_version');
select is(
  (select relrowsecurity from pg_class where oid = 'public.profiles'::regclass),
  true,
  'RLS is enabled on profiles'
);

-- Two users; the trigger creates their profiles.
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
values
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'user-a@test.invalid', '', now(), now(), now()),
  ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'user-b@test.invalid', '', now(), now(), now());

-- Only the test users are counted, so the test also passes on a local database with a real login.
select is((select count(*)::int from public.profiles where id in ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222')), 2, 'trigger creates a profile per new auth user');

-- As user A
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);

select is((select count(*)::int from public.profiles), 1, 'user A sees exactly one profile');
select is(
  (select id from public.profiles),
  '11111111-1111-1111-1111-111111111111'::uuid,
  'user A sees only their own profile'
);

select lives_ok(
  $$ update public.profiles set last_seen_version = '0.1.0' where id = '11111111-1111-1111-1111-111111111111' $$,
  'user A can update their own profile'
);

update public.profiles set last_seen_version = 'hacked' where id = '22222222-2222-2222-2222-222222222222';

select throws_ok(
  $$ insert into public.profiles (id) values ('22222222-2222-2222-2222-222222222222') $$,
  '42501',
  null,
  'user A cannot insert a profile for user B'
);

select throws_ok(
  $$ update public.profiles set id = '33333333-3333-3333-3333-333333333333' where id = '11111111-1111-1111-1111-111111111111' $$,
  '42501',
  null,
  'user A cannot move their row to another id'
);

-- As anon
reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

select throws_ok(
  $$ select count(*) from public.profiles $$,
  '42501',
  null,
  'anon has no access to profiles'
);

-- Back as superuser to check effects
reset role;
select is(
  (select last_seen_version from public.profiles where id = '11111111-1111-1111-1111-111111111111'),
  '0.1.0',
  'own update was applied'
);
select is(
  (select last_seen_version from public.profiles where id = '22222222-2222-2222-2222-222222222222'),
  null,
  'update on another user''s row changed nothing'
);

delete from auth.users where id = '22222222-2222-2222-2222-222222222222';
select is((select count(*)::int from public.profiles where id in ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222')), 1, 'profile is deleted with its auth user');

select * from finish();
rollback;

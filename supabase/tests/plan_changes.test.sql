-- pgTAP tests for public.plan_changes: RLS on, own rows only, only undone_at can be updated, constraints,
-- a change cannot join another user's plan, anon blocked.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(16);

select has_table('public', 'plan_changes', 'plan_changes table exists');
select is(
  (select relrowsecurity from pg_class where oid = 'public.plan_changes'::regclass),
  true,
  'RLS is enabled on plan_changes'
);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
values
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'user-a@test.invalid', '', now(), now(), now()),
  ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'user-b@test.invalid', '', now(), now(), now());

insert into public.training_plans (id, user_id, start_date, intake, ftp_w, engine_version, input_fingerprint)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', '2026-11-02', '{}', 250, '1', 'fp-a'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '22222222-2222-2222-2222-222222222222', '2026-11-02', '{}', 280, '1', 'fp-b');

insert into public.plan_changes (user_id, plan_id, reason, changes)
values ('22222222-2222-2222-2222-222222222222', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'New FTP', '[]');

-- As user A
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);

select lives_ok(
  $$ insert into public.plan_changes (id, plan_id, reason, changes)
     values ('c0000000-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Missed session',
             '[{"session_id":"x","reason":"missed","before":{"session_date":"2026-11-04"},"after":null}]') $$,
  'user A can log a plan change'
);
select is((select undone_at from public.plan_changes), null, 'a new change is not undone');
select is((select count(*)::int from public.plan_changes), 1, 'user A sees only their own changes');

select lives_ok(
  $$ update public.plan_changes set undone_at = now() where id = 'c0000000-0000-0000-0000-000000000001' $$,
  'user A can undo a change (undone_at)'
);
select isnt(
  (select undone_at from public.plan_changes where id = 'c0000000-0000-0000-0000-000000000001'),
  null,
  'undone_at is stored'
);
select throws_ok(
  $$ update public.plan_changes set reason = 'Rewritten' where id = 'c0000000-0000-0000-0000-000000000001' $$,
  '42501', null, 'the reason cannot be edited (column grant)'
);
select throws_ok(
  $$ update public.plan_changes set changes = '[]' where id = 'c0000000-0000-0000-0000-000000000001' $$,
  '42501', null, 'the changes cannot be edited (column grant)'
);

select throws_ok(
  $$ insert into public.plan_changes (plan_id, reason, changes) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '', '[]') $$,
  '23514', null, 'an empty reason is rejected'
);
select throws_ok(
  $$ insert into public.plan_changes (plan_id, reason, changes) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'x', '{}') $$,
  '23514', null, 'changes must be an array'
);
select throws_ok(
  $$ insert into public.plan_changes (plan_id, reason, changes) values ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'x', '[]') $$,
  '23503', null, 'a change cannot be added to another user''s plan'
);
select throws_ok(
  $$ insert into public.plan_changes (user_id, plan_id, reason, changes)
     values ('22222222-2222-2222-2222-222222222222', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'x', '[]') $$,
  '42501', null, 'user A cannot create a change for user B'
);
select lives_ok(
  $$ delete from public.plan_changes where id = 'c0000000-0000-0000-0000-000000000001' $$,
  'user A can delete a change'
);

-- As anon
reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select throws_ok(
  $$ select count(*) from public.plan_changes $$,
  '42501', null, 'anon has no access to plan_changes'
);

-- Back as superuser
reset role;
select is(
  (select count(*)::int from public.plan_changes where user_id = '22222222-2222-2222-2222-222222222222'),
  1,
  'user B''s change is untouched'
);

select * from finish();
rollback;

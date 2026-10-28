-- pgTAP tests for public.weight_entries: RLS on, own rows only, one entry per day, ranges, anon sees nothing.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(16);

select has_table('public', 'weight_entries', 'weight_entries table exists');
select is(
  (select relrowsecurity from pg_class where oid = 'public.weight_entries'::regclass),
  true,
  'RLS is enabled on weight_entries'
);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
values
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'user-a@test.invalid', '', now(), now(), now()),
  ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'user-b@test.invalid', '', now(), now(), now());

insert into public.weight_entries (user_id, entry_date, weight_kg)
values ('22222222-2222-2222-2222-222222222222', '2026-10-01', 80);

-- As user A
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);

select lives_ok(
  $$ insert into public.weight_entries (entry_date, weight_kg, note) values ('2026-10-01', 72.5, 'morning') $$,
  'user A can log a weight (user_id defaults to auth.uid())'
);
select is((select count(*)::int from public.weight_entries), 1, 'user A sees only their own entry');

select throws_ok(
  $$ insert into public.weight_entries (entry_date, weight_kg) values ('2026-10-01', 73) $$,
  '23505', null, 'a day has one entry'
);
select lives_ok(
  $$ insert into public.weight_entries (entry_date, weight_kg) values ('2026-10-01', 73.25)
     on conflict (user_id, entry_date) do update set weight_kg = excluded.weight_kg $$,
  'logging the same day again can replace the entry (upsert)'
);
select is(
  (select weight_kg from public.weight_entries where entry_date = '2026-10-01'),
  73.25::numeric,
  'the day now holds the replaced weight'
);
select throws_ok(
  $$ insert into public.weight_entries (entry_date, weight_kg) values ('2026-10-02', 29.99) $$,
  '23514', null, 'weight under 30 kg is rejected'
);
select throws_ok(
  $$ insert into public.weight_entries (entry_date, weight_kg) values ('2026-10-02', 250.01) $$,
  '23514', null, 'weight over 250 kg is rejected'
);
select throws_ok(
  $$ insert into public.weight_entries (entry_date, weight_kg, note) values ('2026-10-03', 70, repeat('x', 101)) $$,
  '23514', null, 'a note over 100 characters is rejected'
);
select throws_ok(
  $$ insert into public.weight_entries (user_id, entry_date, weight_kg) values ('22222222-2222-2222-2222-222222222222', '2026-10-05', 70) $$,
  '42501', null, 'user A cannot insert an entry for user B'
);

delete from public.weight_entries where user_id = '22222222-2222-2222-2222-222222222222';
select lives_ok(
  $$ delete from public.weight_entries where entry_date = '2026-10-01' $$,
  'user A can delete their own entry'
);

-- As anon
reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select throws_ok(
  $$ select count(*) from public.weight_entries $$,
  '42501', null, 'anon has no access to weight_entries'
);

reset role;
select is(
  (select count(*)::int from public.weight_entries where user_id = '22222222-2222-2222-2222-222222222222'),
  1,
  'user A could not delete user B''s entry'
);
select is(
  (select count(*)::int from public.weight_entries where user_id = '11111111-1111-1111-1111-111111111111'),
  0,
  'user A''s entry is gone after delete'
);

delete from auth.users where id = '22222222-2222-2222-2222-222222222222';
select is(
  (select count(*)::int from public.weight_entries where user_id = '22222222-2222-2222-2222-222222222222'),
  0,
  'entries are deleted with their auth user'
);

select * from finish();
rollback;

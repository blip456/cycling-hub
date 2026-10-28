-- pgTAP tests for the ride streams in Storage (migration 20261028120000, decision T12): the private
-- bucket, the policies on storage.objects (own folder only) and the new activities columns.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(24);

-- Structure ----------------------------------------------------------------------------------------
select is((select count(*)::int from storage.buckets where id = 'streams'), 1, 'the streams bucket exists');
select is((select public from storage.buckets where id = 'streams'), false, 'the streams bucket is private');
select is(
  (select allowed_mime_types from storage.buckets where id = 'streams'),
  array['application/gzip', 'application/json'],
  'the streams bucket only takes gzip or JSON'
);
select ok((select file_size_limit from storage.buckets where id = 'streams') > 0, 'the streams bucket has a file size limit');
select policies_are(
  'storage', 'objects',
  array['streams_select_own', 'streams_insert_own', 'streams_update_own', 'streams_delete_own'],
  'storage.objects has exactly the four streams policies'
);
select has_column('public', 'activities', 'streams_sha256', 'activities has streams_sha256');
select has_column('public', 'activities', 'streams_points', 'activities has streams_points');
select throws_ok(
  $$insert into public.activities
    (user_id, strava_id, name, sport_type, start_local, start_at, distance_m, moving_time_s, elevation_m, raw, streams_sha256)
    values ('00000000-0000-0000-0000-000000000000', 1, 'x', 'Ride', now(), now(), 0, 0, 0, '{}', 'not-a-hash')$$,
  '23514',
  null,
  'streams_sha256 must be a SHA-256 hex string'
);

-- Users --------------------------------------------------------------------------------------------
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
values
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'user-a@test.invalid', '', now(), now(), now()),
  ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'user-b@test.invalid', '', now(), now(), now());

-- Rows changed by each step, written by the role under test.
create temporary table changed (step text primary key, n integer) on commit drop;
grant select, insert on changed to authenticated, anon;

-- Deletes from storage tables are blocked unless this is set (the Storage API sets it); the policies
-- are what is tested here.
select set_config('storage.allow_delete_query', 'true', true);

-- As user A ----------------------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);

select lives_ok(
  $$insert into storage.objects (bucket_id, name) values
      ('streams', '11111111-1111-1111-1111-111111111111/1001.json.gz'),
      ('streams', '11111111-1111-1111-1111-111111111111/1002.json.gz')$$,
  'user A can save streams in their own folder'
);
select throws_ok(
  $$insert into storage.objects (bucket_id, name) values ('streams', '22222222-2222-2222-2222-222222222222/1001.json.gz')$$,
  '42501',
  null,
  'user A cannot save streams in user B''s folder'
);
select throws_ok(
  $$insert into storage.objects (bucket_id, name) values ('streams', '1001.json.gz')$$,
  '42501',
  null,
  'user A cannot save streams outside a folder'
);
select is(
  (select count(*)::int from storage.objects where bucket_id = 'streams'),
  2,
  'user A sees their own streams'
);

with u as (
  update storage.objects set metadata = '{"size": 1}'
  where bucket_id = 'streams' and name = '11111111-1111-1111-1111-111111111111/1001.json.gz'
  returning 1
)
insert into changed select 'a_update_own', count(*) from u;
select is((select n from changed where step = 'a_update_own'), 1, 'user A can replace their own streams');

select throws_ok(
  $$update storage.objects set name = '22222222-2222-2222-2222-222222222222/1001.json.gz'
    where bucket_id = 'streams' and name = '11111111-1111-1111-1111-111111111111/1001.json.gz'$$,
  '42501',
  null,
  'user A cannot move their streams into user B''s folder'
);

-- As user B ----------------------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);

select is(
  (select count(*)::int from storage.objects where bucket_id = 'streams'),
  0,
  'user B cannot read user A''s streams'
);

with u as (
  update storage.objects set metadata = '{"size": 2}' where bucket_id = 'streams' returning 1
)
insert into changed select 'b_update_a', count(*) from u;
select is((select n from changed where step = 'b_update_a'), 0, 'user B cannot change user A''s streams');

with d as (delete from storage.objects where bucket_id = 'streams' returning 1)
insert into changed select 'b_delete_a', count(*) from d;
select is((select n from changed where step = 'b_delete_a'), 0, 'user B cannot delete user A''s streams');

select lives_ok(
  $$insert into storage.objects (bucket_id, name) values ('streams', '22222222-2222-2222-2222-222222222222/2001.json.gz')$$,
  'user B can save streams in their own folder'
);
select is(
  (select array_agg(name) from storage.objects where bucket_id = 'streams'),
  array['22222222-2222-2222-2222-222222222222/2001.json.gz'],
  'user B sees only their own streams'
);

-- As anon ------------------------------------------------------------------------------------------
reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

select is(
  (select count(*)::int from storage.objects where bucket_id = 'streams'),
  0,
  'anon cannot read any streams'
);
select throws_ok(
  $$insert into storage.objects (bucket_id, name) values ('streams', '11111111-1111-1111-1111-111111111111/9.json.gz')$$,
  '42501',
  null,
  'anon cannot save streams'
);
with d as (delete from storage.objects where bucket_id = 'streams' returning 1)
insert into changed select 'anon_delete', count(*) from d;
select is((select n from changed where step = 'anon_delete'), 0, 'anon cannot delete streams');

-- User A deletes their own -------------------------------------------------------------------------
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);

with d as (delete from storage.objects where bucket_id = 'streams' returning 1)
insert into changed select 'a_delete_own', count(*) from d;
select is((select n from changed where step = 'a_delete_own'), 2, 'user A can delete only their own streams');

reset role;
select is(
  (select count(*)::int from storage.objects where bucket_id = 'streams'
     and name like '22222222-2222-2222-2222-222222222222/%'),
  1,
  'user B''s streams are still there'
);

select * from finish();
rollback;

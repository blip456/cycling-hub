-- Per-second ride data ("streams") from export v2 (decision T12, backlog v0.3.0 items 11 and 13,
-- docs/export-format.md). Additive: a private Storage bucket and two nullable columns on activities.
--
-- One gzipped JSON file per ride: streams/{auth.uid()}/{strava_id}.json.gz. The import uploads it
-- after import_activities() has saved the file; the activity row keeps only the averages and maxima
-- plus the hash of the stored streams, so a later import uploads only new or changed streams.

-- ---------------------------------------------------------------------------------------------------
-- Bucket: private, gzip or JSON, at most 10 MB per ride (a 10 h ride at 1 s is about 2 MB of JSON)
-- ---------------------------------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('streams', 'streams', false, 10485760, array['application/gzip', 'application/json']);

-- ---------------------------------------------------------------------------------------------------
-- Policies on storage.objects: the signed-in user reads and writes only their own folder (A2)
-- ---------------------------------------------------------------------------------------------------
create policy "streams_select_own" on storage.objects
  for select to authenticated
  using (bucket_id = 'streams' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "streams_insert_own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'streams' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- Upsert (a changed ride) needs update next to insert.
create policy "streams_update_own" on storage.objects
  for update to authenticated
  using (bucket_id = 'streams' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'streams' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "streams_delete_own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'streams' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- anon has no policy for this bucket, so it sees and changes nothing in it. The table grants on
-- storage.objects are Supabase's defaults and are not changed here.

-- ---------------------------------------------------------------------------------------------------
-- activities: which streams are stored for the ride
-- ---------------------------------------------------------------------------------------------------
alter table public.activities
  add column streams_sha256 text check (streams_sha256 ~ '^[0-9a-f]{64}$'),
  add column streams_points integer check (streams_points >= 0);

comment on column public.activities.streams_sha256 is
  'SHA-256 (hex) of the canonical streams JSON stored in Storage at streams/{user_id}/{strava_id}.json.gz; null when none is stored (T12). Not compared by import_activities().';
comment on column public.activities.streams_points is
  'Number of points in the stored streams (length of streams.time); null when none is stored (T12).';

-- T11 corrects T5: the import now converts a v1 startDateLocal with a trailing Z from UTC. The column
-- still holds Brussels wall-clock time and start_at is still derived from it.
comment on column public.activities.start_local is
  'Start as Europe/Brussels wall-clock time: startDateLocal without zone as is, with Z or an offset converted by the import (T11).';

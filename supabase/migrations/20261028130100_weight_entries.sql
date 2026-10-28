-- Weight log (P45, backlog v0.4.0 item 4a): one entry per user per day; editing a day replaces it (update or upsert).
-- RLS scoped to auth.uid() (A2). Metric units only (P6).

create table public.weight_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  entry_date date not null,
  weight_kg numeric(5, 2) not null check (weight_kg between 30 and 250),
  note text check (note is null or char_length(note) <= 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint weight_entries_user_date_key unique (user_id, entry_date)
);

comment on table public.weight_entries is 'Body weight log, one entry per user per day (P45).';
comment on column public.weight_entries.entry_date is 'The day the weight belongs to (a calendar date, no time zone).';
comment on column public.weight_entries.weight_kg is 'Weight in kilograms, 30 to 250, two decimals (P6).';

-- Newest-first reads. The unique constraint's index is (user_id, entry_date); a descending index serves the list and the trend.
create index weight_entries_user_date_desc_idx on public.weight_entries (user_id, entry_date desc);

alter table public.weight_entries enable row level security;

create policy "weight_entries_select_own" on public.weight_entries
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "weight_entries_insert_own" on public.weight_entries
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "weight_entries_update_own" on public.weight_entries
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "weight_entries_delete_own" on public.weight_entries
  for delete to authenticated
  using ((select auth.uid()) = user_id);

revoke all on table public.weight_entries from anon, authenticated;
grant select, insert, update, delete on table public.weight_entries to authenticated;

create trigger weight_entries_set_updated_at
  before update on public.weight_entries
  for each row execute function public.set_updated_at();

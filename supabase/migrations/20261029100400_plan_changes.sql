-- Plan change log (Sprint 4, wireframes R3 and R4; engine-rules.md section 12): what a re-evaluation recalculated,
-- why, and the old version for Undo. One row per "Plan updated" notice. RLS scoped to auth.uid() (A2).
-- Only undone_at is meant to change after the insert (Undo): the update grant is limited to that column, so a
-- change record cannot be rewritten. Deleting is allowed (clearing the list); rows also go with the plan.

create table public.plan_changes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  plan_id uuid not null,
  created_at timestamptz not null default now(),
  -- The headline reason, in plain words (for example "Missed session", "New FTP"); codes are in section 12.
  reason text not null check (char_length(reason) between 1 and 500),
  -- Per session: [{session_id, reason, before, after}], with before and after the stored session fields
  -- (null before for an added session, null after for a removed one). Undo restores the "before" values.
  changes jsonb not null check (jsonb_typeof(changes) = 'array'),
  undone_at timestamptz,
  constraint plan_changes_plan_fkey foreign key (plan_id, user_id)
    references public.training_plans (id, user_id) on delete cascade
);

comment on table public.plan_changes is 'Change log of the plan: what a re-evaluation changed and why, with Undo (R3, R4).';
comment on column public.plan_changes.reason is 'Headline reason in plain words.';
comment on column public.plan_changes.changes is 'JSON array with the before and after of each changed session; the app validates the shape.';
comment on column public.plan_changes.undone_at is 'When the athlete undid this change; the only column that is updated after insert (column grant).';

create index plan_changes_plan_created_idx on public.plan_changes (plan_id, created_at desc);
create index plan_changes_user_created_idx on public.plan_changes (user_id, created_at desc);

alter table public.plan_changes enable row level security;

create policy "plan_changes_select_own" on public.plan_changes
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "plan_changes_insert_own" on public.plan_changes
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "plan_changes_update_own" on public.plan_changes
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "plan_changes_delete_own" on public.plan_changes
  for delete to authenticated using ((select auth.uid()) = user_id);

revoke all on table public.plan_changes from anon, authenticated;
grant select, insert, delete on table public.plan_changes to authenticated;
grant update (undone_at) on table public.plan_changes to authenticated;

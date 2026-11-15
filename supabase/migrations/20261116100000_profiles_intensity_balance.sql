-- Intensity balance on the existing profiles row (decision P99; rules in docs/plan/engine-rules.md section 3b
-- and section 7.5). Additive and nullable: null means base-focused, the plan as it was before this setting.
-- The existing RLS policies, the table-level grants and the updated_at trigger already cover new columns.

alter table public.profiles
  add column intensity_balance text check (
    intensity_balance is null or intensity_balance in ('base', 'balanced', 'high')
  );

comment on column public.profiles.intensity_balance is 'How much of the riding is hard: base (the original plan), balanced (a VO2 session a week from Build and a sprint ride) or high. Null means base.';

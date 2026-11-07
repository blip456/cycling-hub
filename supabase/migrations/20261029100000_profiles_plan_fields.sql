-- Plan inputs on the existing profiles row (Sprint 4, v0.5.0; P60 intake, P62 indoor or outdoor, P65 purposes,
-- P66 event; wireframes R1, R1b in docs/wireframes/V3/adapt.html; rules in docs/plan/engine-rules.md).
-- Additive: every new column is nullable, so existing rows and the app keep working. The existing RLS policies,
-- the table-level grants (select, insert, update) and the updated_at trigger already cover new columns.
--
-- Rules that stay in the app (Zod) because they depend on today's date or on other tables:
--   * event_date must be at least 4 weeks after today when it is written (R1b); a past event simply stays stored.
--   * the level answers are five answers L1 to L5, each 0 to 3 (engine-rules.md section 3); the database only
--     checks that the value is a JSON object, so the questions can change without a migration.
--   * hours per week are clamped to the level range by the engine (section 3); the profile allows 1 to 25.

alter table public.profiles
  add column riding_environment text check (riding_environment is null or riding_environment in ('indoor', 'outdoor', 'both')),
  -- 1 to 25 hours, half hours allowed (R1b helper text): a value times two must be a whole number.
  add column weekly_hours numeric(3, 1) check (
    weekly_hours is null
    or (weekly_hours between 1 and 25 and weekly_hours * 2 = trunc(weekly_hours * 2))
  ),
  -- Ranked, most important first. The wireframe lets the athlete pick one or more of the four and rank them; the
  -- engine uses the first two (main and secondary, Q-E2-13). Values are valid, there are no duplicates (each
  -- allowed value present counts once, and that count must equal the array length) and it is never empty.
  add column training_purposes text[] check (
    training_purposes is null
    or (
      cardinality(training_purposes) between 1 and 4
      and training_purposes <@ array['muscle_building', 'weight_loss', 'endurance', 'speed']::text[]
      and (
        (array_position(training_purposes, 'muscle_building') is not null)::int
        + (array_position(training_purposes, 'weight_loss') is not null)::int
        + (array_position(training_purposes, 'endurance') is not null)::int
        + (array_position(training_purposes, 'speed') is not null)::int
      ) = cardinality(training_purposes)
    )
  ),
  -- The level the plan assumes (P60). Scored from level_answers by the app, and the athlete can change it (engine-rules.md section 3).
  add column level text check (level is null or level in ('amateur', 'committed', 'semi_pro')),
  add column level_answers jsonb check (level_answers is null or jsonb_typeof(level_answers) = 'object'),
  add column event_name text check (event_name is null or char_length(event_name) between 1 and 80),
  add column event_date date,
  -- A name without a date is not an event (R1b: a date without a name is allowed).
  add constraint profiles_event_name_needs_date check (event_name is null or event_date is not null);

comment on column public.profiles.riding_environment is 'Where the athlete rides: indoor, outdoor or both (P62). Null means not set; the engine then plans for both.';
comment on column public.profiles.weekly_hours is 'Average hours per week the athlete wants to train, 1 to 25 in half hours (P60). Null means not set.';
comment on column public.profiles.training_purposes is
  'Training purposes in order of importance: muscle_building, weight_loss, endurance, speed (P65). No duplicates, 1 to 4 items; the engine uses the first two (main and secondary). Null means not set (the engine defaults to endurance).';
comment on column public.profiles.level is 'amateur, committed or semi_pro (P60); scored from level_answers by the app and editable by the athlete.';
comment on column public.profiles.level_answers is 'The intake level answers L1 to L5 as a JSON object (engine-rules.md section 3); shape validated by the app.';
comment on column public.profiles.event_name is 'Optional name of the target event (P66), 1 to 80 characters; needs event_date.';
comment on column public.profiles.event_date is 'Optional event date (P66), a calendar date. At least 4 weeks ahead when written (app rule).';

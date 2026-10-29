# Plan engine rules

Sprint 4 (v0.5.0), part A. **Draft for the PO to review before any build.** The training load rules are
the biggest risk of this sprint (see the risks in [`../backlog.md`](../backlog.md)), so this page states
every rule and every number. The worked examples are in [`example-plans.md`](example-plans.md).

Decisions this follows: P40 (Coggan zones), P58 to P67 (rule-based plan, 12 weeks, intake, missed
sessions, indoor / outdoor, calendar, no power data, purposes, event with taper, summaries). Working
defaults Q-E2-9 to Q-E2-16 are assumptions until the PO corrects them.

## How to read this page

- The engine is a **pure function**: the same inputs always give the same plan. No randomness, no
  AI service, no clock except today's date.
- **Every number is a default** the PO can change. All numbers are collected in section 16 with a name.
- The **Basis** marks where a rule comes from. **C** = conventional coaching practice (widely used,
  not a law). **M** = my choice or assumption for this app; challenge these first.
- Plain words: "hard session" means a **structured session** (tempo, sweet spot, threshold, VO2,
  sprint, low-cadence torque, test). Endurance, recovery, long ride and openers are not hard sessions.
- Watts and bpm always come from the existing zone code (`powerZones`, `heartRateZones`) so the plan, the
  zones page and the ride pages agree.

**Order in which rules win** (a rule higher in the list can overrule a rule lower in the list):

1. Safety caps (section 5) and the weight loss rate cap (section 9).
2. The event and the taper (section 4).
3. The days and hours the PO has (section 6).
4. The main purpose, then the secondary purpose (section 8).
5. Nice-to-have shaping (variety, indoor or outdoor variants).

## 1. Inputs

| Input                                | Comes from                                                       | Used for                                       | If missing                                                    |
| ------------------------------------ | ---------------------------------------------------------------- | ---------------------------------------------- | ------------------------------------------------------------- |
| Today                                | Brussels date (`brusselsDate`)                                   | What is past, today, future                    | Never missing                                                 |
| Plan start date                      | Intake; default the next Monday (today if it is a Monday)        | Week 1                                         | Default                                                       |
| Available days                      | Profile `availableDays` (Mon to Sun)                             | Which days get a session                       | Fewer than 2 days: no plan, the PO is asked to add days       |
| Hours per week (H)                   | Profile (new, P60)                                               | The weekly ceiling                             | Intake asks; no plan without it                               |
| Level answers (5)                    | Intake (section 3)                                               | Level                                          | Intake asks; no plan without them                             |
| Purposes, ranked                     | Intake (P65); the top two are used                               | The session mix                                | Default: endurance                                            |
| Indoor / outdoor / both              | Profile (P62)                                                    | Session variants                               | Default: both                                                 |
| Event: name, date, expected duration | Intake (P66)                                                     | Taper                                          | No event: plan without taper                                  |
| FTP                                  | Baseline (`ftp.ts`), zones from `powerZones(ftp)`                | All power targets                              | **No plan**: empty state "Plan needs a baseline" (item 9)     |
| LTHR or max HR                       | Baseline, zones from `heartRateZones({ lthr, maxHr })`           | bpm ranges                                     | Sessions show watts only                                      |
| Weight log, target weight, date      | `weight.ts` (`trend`, `summarize`); target from intake           | Weight loss rules (section 9)                  | Weight rules are off, the plan is built without them          |
| Ride history                         | Imported rides: date, moving time, average power, average HR, tags | Week 1 volume, matching, warnings, re-planning | No history: week 1 starts at the default fraction             |
| Plan state                           | Session statuses, matches, last fingerprint                      | Re-evaluation (section 12)                     | New plan                                                      |

Types reused from `src/features/athlete/`: `Weekday`, `IsoDate` and the date helpers (`dates.ts`), `Zone`
(`zones.ts`), `WeightEntry` and `trend` (`weight.ts`). Hours per week is clamped to the level range
(section 3); the plan says so when it does.

## 2. Terms used by the rules

| Term                  | Meaning                                                                                                                                                       |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Planned load          | Training-stress style number. Per step: `minutes / 60 x (percent of FTP / 100)^2 x 100`. A session or week is the sum. One easy hour at 65 % FTP is 42 (C).  |
| Quality minutes       | Minutes of work steps with a target of **88 % FTP or more** (sweet spot, threshold, VO2, sprint). Rests and warm-ups do not count (M).                         |
| Above threshold       | Minutes of work steps above **105 % FTP** (VO2, sprint, anaerobic). Z5 and up (C).                                                                            |
| Loading week          | A normal week that builds. A recovery week and a taper week are not loading weeks.                                                                            |
| Previous loading week | The latest loading week before this one (a recovery week is skipped).                                                                                         |
| Structured session    | A hard session as defined above. The budget per level is in section 3.                                                                                        |

## 3. Level: amateur, committed, semi-pro

### Intake questions (proposed)

Each question has visible labels and fixed answers (radio buttons), no example values in inputs. Each
answer scores 0 to 3.

| #    | Question                                                  | 0         | 1          | 2             | 3               |
| ---- | --------------------------------------------------------- | --------- | ---------- | ------------- | --------------- |
| L1   | How long have you been riding regularly?                  | Under 1 year | 1 to 2 years | 3 to 5 years | More than 5 years |
| L2   | How many hours a week did you ride in the last 3 months?  | Under 4   | 4 to 7     | 8 to 11       | 12 or more      |
| L3   | How often do you train with intervals?                    | Never     | Sometimes  | Most weeks    | Every week, by a plan |
| L4   | What is your longest ride in the last 3 months?           | Under 2 h | 2 to 3.5 h | 3.5 to 5 h    | Over 5 h        |
| L5   | How many hard sessions a week can you handle comfortably? | None      | One        | Two           | Three or more   |

Separate intake questions (not scored): hours per week you want to train (H), purposes (ranked),
indoor / outdoor / both (profile), event (yes or no, name, date, expected duration: under 3 h, 3 to 6 h,
over 6 h), and, with weight loss in the top two, target weight and target date.

### Scoring (M)

Score = L1 + L2 + L3 + L4 + L5 (0 to 15).

| Score      | Level     |
| ---------- | --------- |
| 0 to 5     | Amateur   |
| 6 to 10    | Committed |
| 11 to 15   | Semi-pro  |

**Hours gate:** semi-pro needs H of 10 or more, committed needs H of 6 or more; otherwise the level drops one
step (an amateur riding 4 hours cannot be semi-pro). The PO sees the level on the intake summary and can
change it. The ride history never changes the level; it only lowers the starting volume (section 5).

### What the level changes

| Setting                              | Amateur           | Committed         | Semi-pro          | Basis |
| ------------------------------------ | ----------------- | ----------------- | ----------------- | ----- |
| Hours per week range (H is clamped)  | 3 to 6 h          | 6 to 10 h         | 10 to 16 h        | M     |
| Rides per week (min to max)          | 3 to 4            | 4 to 5            | 5 to 6            | M     |
| Structured sessions per week (budget)| 1                 | 2                 | 3                 | M     |
| Long ride (minutes)                  | 90 to 180         | 120 to 270        | 150 to 330        | M     |
| Structured session length (minutes)  | 45 to 90          | 60 to 120         | 90 to 150         | M     |
| Easy ride length (minutes)           | 30 to 90          | 45 to 120         | 45 to 150         | M     |
| Warm-up / cool-down (minutes)        | 10 / 5            | 15 / 10           | 15 / 10           | C     |
| Quality minutes cap (share of week)  | 15 %              | 20 %              | 25 %              | M     |
| Above threshold cap (share of week)  | 5 %               | 7 %               | 9 %               | M     |
| Allowed intensity                    | Z1 to Z5; no sprint | Z1 to Z7        | Z1 to Z7          | M     |
| Third structured session             | No                | No                | Long ride with tempo blocks (Build, Peak) | M |

Every level has at least one day without a ride (6 rides is the maximum) (C).

## 4. The 12-week structure

### Without an event

| Weeks | Block    | Phase label | Hours                       | Purpose of the block                                  |
| ----- | -------- | ----------- | --------------------------- | ----------------------------------------------------- |
| 1 to 3 | Base    | Base        | Loading, +8 % a week        | Routine, easy volume, tempo and sweet spot (C)        |
| 4      | Base     | Recovery    | 70 % of week 3              | Absorb the work (C)                                   |
| 5 to 7 | Build   | Build       | Loading, up to H            | Purpose-specific sessions get harder (C)              |
| 8      | Build    | Recovery    | 70 % of week 7              | Absorb the work                                       |
| 9 to 11 | Peak   | Peak        | At H                        | Most specific work, longest long rides                |
| 12     | Peak     | Recovery    | 70 % of week 11             | Rest, then an FTP test instead of the first hard session (P39) |

- A recovery week comes **every 4th week** (3 loading weeks, then 1 easy week) (C, M for the choice of 3:1).
  A setting can change it to every 3rd week (2 loading weeks, 1 easy week) for riders who want more rest.
- Week 12 holds the FTP test (20-minute or ramp test, the PO picks, P39) in place of the Wednesday session.
  After the test the new FTP only changes **future** sessions (section 14).

### With an event (built backwards)

The event date decides the last week. The plan is built from the event date back to week 1.

1. The **event week** is the last week of the plan (week N). It holds the event on its date.
2. The **taper** is the last 1 or 2 weeks, by expected event duration (C, the lengths are M):

| Event takes (intake) | Taper weeks | Week before event week | Event week (without the event) |
| -------------------- | ----------- | ---------------------- | ------------------------------ |
| Under 3 h            | 1           | -                      | 50 % of H                      |
| 3 to 6 h             | 2           | 75 % of H              | 45 % of H                      |
| Over 6 h             | 2           | 75 % of H              | 45 % of H                      |

3. **Keep short intensity, cut volume** (C): in the taper the Wednesday session keeps the peak session type
   with a lighter set (the week before: one ladder step lower; event week: the shortest set), the second
   hard session and the blocks in the long ride are dropped (they become plain endurance), the long ride
   stays but is shorter because the hours are lower.
4. **Openers** (section 7) go on the day before the event, also when that day is not an available day (the PO
   can remove it). The event itself is a session of kind "Event" on its date; its time is **not** counted
   in the week's hours or in the caps.
5. Weeks 1 to N minus taper follow the normal 3:1 pattern, cut off at the taper. The **last week before
   the taper is never a recovery week** (it becomes a loading week) because the taper is the recovery.
6. Phase labels: week 1 to 4 Base, 5 to 8 Build, 9 and later Peak, then Taper. (A plan shorter than 12
   weeks takes the three phases as thirds of its training weeks.)

**Event not 12 weeks away:**

- Event less than 12 weeks away: the plan is N weeks long, from the start to the event week (minimum 4
  weeks). A shorter plan has no recovery week unless it is 5 weeks or more.
- Event more than 12 weeks away: the plan starts **12 weeks before the event week** (week 12 is the event
  week). The app tells the PO the start date. The PO can instead start now without the event (open question).
- Only one event is supported (Q-E2-16).

## 5. Weekly hours, load progression and caps

### Hours per week

Let H be the hours per week, clamped to the level range. Hours are in minutes and rounded **down** to 5
minutes. **A week's hours are a ceiling**: sessions may add up to less (because of session length limits),
never to more.

| Week type | Hours                                                                                         | Basis |
| --------- | --------------------------------------------------------------------------------------------- | ----- |
| Week 1    | `V0` = 75 % of H. With history (see below): `clamp(1.10 x A, 60 % of H, 90 % of H)`          | M     |
| Loading   | `min(H, previous loading week x 1.08)`                                                        | C     |
| Recovery  | 70 % of the previous loading week                                                             | C     |
| Taper     | Percent of H from the table in section 4                                                      | C     |

`A` is the average weekly riding hours of the last 4 weeks, used only when at least 2 of those weeks have
rides. This stops a rider who says 8 h but rides 2 h from starting at 6 h.

H is a **full normal week**, so the plan average over 12 weeks is lower than H (the plans in
[`example-plans.md`](example-plans.md) show about 82 to 86 %). Open question for the PO: or should H be the
average?

### Hard caps

The engine checks every week after the sessions are built. When a cap is broken, it applies the fixes in
the last column, in order, until the week passes.

| #  | Cap                                                                                    | Value                       | Why                                                                                          | Basis | Fix when broken                                           |
| -- | -------------------------------------------------------------------------------------- | --------------------------- | -------------------------------------------------------------------------------------------- | ----- | --------------------------------------------------------- |
| C1 | Weekly hours at most H and at most the level maximum                                   | H; 6 / 10 / 16 h            | The PO's own time limit                                                                      | C     | Shorten easy rides, drop the shortest easy ride           |
| C2 | Weekly hours growth against the previous loading week                                  | at most +10 % (target +8 %) | Common 5 to 10 % guideline; a steady ramp is easier to absorb                                | C     | Shorten the longest easy ride                             |
| C3 | Weekly load growth against the previous loading week                                   | at most +15 %               | Load can rise with intensity while hours stay flat; this keeps phase changes from jumping    | M     | Lower the longest main set one step                       |
| C4 | Long ride growth against the previous loading week's long ride                         | at most +10 %               | Long rides are the easiest way to overdo a week                                              | M     | Shorten the long ride                                     |
| C5 | Quality minutes (88 % FTP and up) as share of the week                                 | 15 / 20 / 25 %              | Hard work stays a small part of the week (C: most time is easy)                              | M     | Lower the longest main set one step                       |
| C6 | Above threshold minutes (over 105 % FTP) as share of the week                          | 5 / 7 / 9 %                 | Short, hard work is the costliest per minute                                                 | M     | Lower the VO2 / sprint set one step                       |
| C7 | Structured sessions per week                                                           | 1 / 2 / 3                   | Hard-easy pattern (C); the number is M                                                       | C     | The lowest-priority structured session becomes endurance  |
| C8 | Structured sessions on **consecutive days**                                            | Never                       | Hard days need an easy day after (C)                                                         | C     | Move to another day, else make it endurance               |
| C9 | Recovery week hours                                                                    | at most 70 % of the previous loading week | Recovery weeks work only when they are clearly lighter (C)                      | C     | Shorten the sessions                                      |
| C10| Rides per week and one free day                                                        | 4 / 5 / 6 rides at most     | At least one day off a week (C)                                                              | C     | Drop the shortest easy ride                               |

"Fix" order inside a cap with several fixes: the longest first, 5 minutes at a time, never below the
level minimum for that session. A fix never moves minutes to another session; the ceiling is not
refilled.

## 6. The weekly template and where sessions go

### Slots (what a normal week contains)

| Slot                | Default day                                   | Present when                                   |
| ------------------- | --------------------------------------------- | ---------------------------------------------- |
| Long ride           | Sunday; else Saturday; else the last available day | Always                                    |
| Structured 1 (Q1)   | **Wednesday**; else the available day nearest to Wednesday (a tie goes to the earlier day, away from the long ride) | Always |
| Structured 2 (Q2)   | An available day at least 2 days from Q1 and from the long ride; the one farthest from both wins (Friday in a Mon to Sun week) | Level budget 2 or more and the purpose has a Q2 session (section 8) |
| Easy rides          | The remaining available days, farthest from other rides first, a tie goes to the later day | Until the ride count of the level is reached |
| Long ride with blocks (third hard) | The long ride slot                | Semi-pro, Build and Peak loading weeks, main purpose is not weight loss |

The number of rides is `round(H / 1.6)` limited to the level range and to the number of available days
(weight loss as main purpose: as many rides as available days, up to the level maximum). If the minimum
session lengths do not fit in the week's hours, the shortest easy ride is dropped, then the next, down to
2 rides. If no day is far enough from Q1 and the long ride, Q2 is not planned (it becomes an easy ride).
Hard days are never next to each other (C8), so a profile with consecutive days only can lose its Q2.

### How the hours are shared

1. Weights: long ride 2.8 (amateur 2.2), Q1 1.5, Q2 1.3, each easy ride 1.0 (amateur 1.2), openers 0.5.
   These are shares of the week's hours (M).
2. Share the week's minutes by weight. Clamp each ride to the min and max of its type (section 3) and
   share what is left among the rides that are not clamped. In a recovery week Q1 is at most the level
   minimum + 15 minutes, easy rides at most 60, the long ride at most 65 % of the previous loading week's long ride.
3. The long ride is also limited by cap C4.
4. Round down to 5 minutes; hand out the left-over 5-minute blocks by the largest remainder, ties to the
   heavier weight.
5. The main set (section 7) is then fitted into the session. If the main set does not fit, the set goes one
   ladder step down until it does. The time left over in a structured session is easy endurance after the
   main set.

Fewer days than sessions: drop in this order: easy rides, Q2, Q1. The long ride is the last to go.

## 7. The session library

The zones are the Coggan zones from `zones.ts` (P40). Watts below use an FTP of 250 W, the same example as
the example plans: Z1 0 to 138, Z2 139 to 188, Z3 189 to 225, Z4 226 to 263, Z5 264 to 300, Z6 301 to 375,
Z7 376 and up. The engine stores steps in **percent of FTP** and turns them into watts with the current
FTP; heart rate comes from the zone of the same number.

### 7.1 Targets per session type

| Type               | Power zone         | Target (band)                      | Watts at 250 W FTP         | HR zone      | Cadence       | Reason line shown on the session                                           |
| ------------------ | ------------------ | ---------------------------------- | -------------------------- | ------------ | ------------- | -------------------------------------------------------------------------- |
| Recovery spin      | Z1                 | 50 % (40 to 55 %)                  | 125 W (100 to 138)         | Z1           | free, easy    | Gets the legs moving without adding load.                                  |
| Endurance          | Z2                 | 65 % (56 to 75 %)                  | 163 W (139 to 188)         | Z2           | 85 to 95 rpm  | Builds the aerobic base. Easy enough to talk.                              |
| Long ride          | Z2                 | 65 % (56 to 75 %), steady          | 163 W (139 to 188)         | Z2           | free          | The longest ride of the week. Time in the saddle at an easy effort.        |
| Tempo              | Z3                 | 83 % (76 to 90 %)                  | 208 W (189 to 225)         | Z3           | 85 to 95 rpm  | Steady, firm effort that builds endurance for long rides.                  |
| Sweet spot         | top of Z3, bottom of Z4 | 91 % (88 to 94 %)             | 228 W (220 to 235)         | Z3 to Z4     | 85 to 95 rpm  | Hard but repeatable work just under threshold. Raises FTP efficiently.     |
| Threshold          | Z4                 | 100 % (95 to 105 %)                | 250 W (238 to 263)         | Z4           | 85 to 100 rpm | Work at FTP. Raises the power you can hold for an hour.                    |
| VO2 max            | Z5                 | 112 % (106 to 120 %)               | 280 W (265 to 300)         | Z5 (lags; power leads) | 90 to 105 rpm | Short hard intervals. Raises your top aerobic power.                  |
| Sprint (neuromuscular) | Z7             | All-out, over 150 % (over 375 W)   | max effort, 8 to 15 s      | none (too short) | free      | Short sprints for punch and speed. Long rests, fresh legs.                 |
| Low-cadence torque | Z3 (76 to 82 %)    | 78 % (76 to 82 %)                  | 195 W (190 to 205)         | Z3           | 50 to 60 rpm, seated | Big-gear work to build leg strength on the bike. Stay smooth.        |
| Openers            | Z4 for 1 min       | 105 % for 1 min, rest 50 %         | 263 W for 1 min            | Z1 to Z2 between | free      | Wakes the legs before the event. Short, not tiring.                        |
| Test               | all-out            | 20-minute test, or ramp test (P39) | the PO's best 20 min       | -            | free          | Measures FTP so the zones stay right.                                      |

HR zones for the session follow the power zone (Z1 to Z1, up to Z5 to Z5). Example zones for an LTHR of
165 bpm: Z1 0 to 112, Z2 113 to 137, Z3 138 to 155, Z4 156 to 173, Z5 174 and up. Without LTHR the max HR
bands from `heartRateZones` are used. Power leads for intervals shorter than 3 minutes (heart rate lags).

### 7.2 Structure and length

Every session is: **warm-up, main set, easy endurance to fill the time, cool-down.** Warm-up is a ramp from
50 to 70 % FTP (counted as 60 %); cool-down is 50 %. Rests between repeats are at 50 % FTP.

| Type               | Structure                                                                                 | Total length (min) amateur / committed / semi-pro |
| ------------------ | ----------------------------------------------------------------------------------------- | -------------------------------------------------- |
| Recovery spin      | One easy block (Z1)                                                                       | 30 to 60 (all levels)                              |
| Endurance          | One steady block (Z2)                                                                     | 30 to 90 / 45 to 120 / 45 to 150                   |
| Long ride          | One steady block (Z2). Semi-pro in Build and Peak: tempo blocks inside (see 7.3)          | 90 to 180 / 120 to 270 / 150 to 330                |
| Tempo              | Warm-up, repeats of tempo, 5 min rests, endurance to fill, cool-down                      | 45 to 90 / 60 to 120 / 90 to 150                   |
| Sweet spot         | As tempo, with sweet spot repeats                                                         | same                                               |
| Threshold          | As tempo, with threshold repeats                                                          | same                                               |
| VO2 max            | Repeats with a rest of the same length (at least 2 min)                                   | same                                               |
| Sprint             | Warm-up, then a sprint every 3 minutes (sprint plus easy spinning), endurance, cool-down  | same (committed and semi-pro only)                 |
| Low-cadence torque | Repeats at 50 to 60 rpm with 5 min rests                                                  | same                                               |
| Openers            | 15 min warm-up, 3 x (1 min at 105 %, 2 min easy), endurance, 5 min cool-down              | 40 to 45 (all levels)                              |
| Test               | 20 min warm-up, 5 min at 110 %, 10 min easy, 20 min all-out, 15 min cool-down; or the ramp test | 70 (20-minute test) or 45 (ramp test)       |

In a recovery week an easy ride is a recovery spin and Q1 is a short tempo session (or torque for muscle
building as main purpose) at the lowest step.

### 7.3 Main sets per level (the ladder)

Each structured type has a ladder of main sets (repeats x minutes; sprint: repeats x seconds). The engine
starts at step 1 and moves up one step each loading week the type is used.

| Type               | Amateur                     | Committed                       | Semi-pro                         |
| ------------------ | --------------------------- | ------------------------------- | -------------------------------- |
| Tempo              | 2x10, 2x15, 3x10, 3x12      | 2x15, 3x12, 3x15, 3x20          | 3x15, 3x20, 2x30, 3x25           |
| Sweet spot         | 2x10, 2x12, 2x15, 3x10      | 2x15, 3x12, 3x15, 2x25          | 3x15, 3x20, 4x15, 3x25           |
| Threshold          | 2x8, 2x10, 2x12, 3x8        | 2x12, 3x10, 2x20, 3x12          | 3x12, 3x15, 4x12, 3x20           |
| VO2 max            | 4x2, 3x3, 4x3               | 5x3, 5x4, 6x4, 5x5              | 5x4, 6x4, 5x5, 6x5               |
| Low-cadence torque | 3x5, 4x5, 4x6, 3x8          | 4x6, 4x8, 5x8, 5x10             | 4x8, 5x8, 5x10, 6x10             |
| Sprint (seconds)   | not used                    | 6x8, 6x10, 8x10, 8x10           | 8x10, 10x10, 8x15, 10x15         |

**How the step is chosen:**

- Loading week: step = the number of earlier loading weeks in this plan in which the type was done or is still
  planned (missed or skipped weeks do not count), counted once per week, at most the top step. A missed
  session therefore repeats its step next time, it is not made up.
- Recovery week: step 1. Taper week before the event: last step minus 1. Event week: step 1.
- If the main set does not fit the session length or breaks a cap, go one step down.
- Long ride with blocks (semi-pro): tempo blocks at step 1 of the tempo ladder in Build and step 2 in Peak.

### 7.4 Indoor and outdoor are in section 10; matching in section 11.

## 8. Purposes

Four purposes (P65): endurance, speed, muscle building, weight loss. The PO ranks them in the intake; the
engine uses **rank 1 (main)** and **rank 2 (secondary)**. Lower ranks are stored but not used (open question).

### What each purpose changes (main purpose)

Q1 is the Wednesday session, Q2 the second hard session. "End" means a plain endurance ride (no hard slot used).

| Purpose         | Base (weeks 1 to 4)       | Build (5 to 8)              | Peak (9 and later)          | Long ride                                  | Extra                                                      |
| --------------- | ------------------------- | --------------------------- | --------------------------- | ------------------------------------------ | ---------------------------------------------------------- |
| Endurance       | Q1 Tempo, Q2 Sweet spot   | Q1 Sweet spot, Q2 Threshold | Q1 Threshold, Q2 Sweet spot | Largest share of the week (semi-pro: with tempo blocks) | Most time at Z2                           |
| Speed           | Q1 Sweet spot, Q2 Tempo   | Q1 VO2, Q2 Threshold        | Q1 VO2, Q2 Sprint           | Plain endurance                            | Short hard intervals; sprint needs committed or semi-pro   |
| Muscle building | Q1 Torque, Q2 Tempo       | Q1 Torque, Q2 Sweet spot    | Q1 Torque, Q2 Threshold     | Plain endurance (semi-pro: with tempo blocks) | Off-bike strength notes (below)                         |
| Weight loss     | Q1 Tempo, Q2 End          | Q1 Sweet spot, Q2 End       | Q1 Sweet spot, Q2 End       | Plain endurance, a slightly larger share   | A ride on every available day (up to the level maximum); one hard session less than the budget for committed (semi-pro: Q2 is Tempo) |

Recovery weeks, taper and the test week follow sections 4 and 7 whatever the purpose.

### Strength notes (muscle building)

On-bike strength work is the torque session. Off-bike strength work is only a **note** in the plan; there is
no exercise library (Q-E2-12).

- Main purpose muscle building: 2 notes a week (amateur 1). Secondary: 1 note a week.
- On the day of a hard session, after the ride (so easy days stay easy) (C). Never on the day before an event
  or a test; none in the taper; 1 light note in a recovery week.
- Text: "Strength, 20 to 40 minutes, off the bike. Legs and core, 2 to 3 sets of 6 to 10 repetitions with a
  weight you can control. Choose your own exercises." Not part of the cycling hours or the load caps.

### Combining main and secondary

| Case                          | Rule                                                                                                      |
| ----------------------------- | --------------------------------------------------------------------------------------------------------- |
| Level has a Q2 slot (budget 2 or more) | Q1 follows the **main** purpose. Q2 follows the **secondary** purpose's Q1 type (weight loss as secondary: Q2 stays endurance). |
| Amateur (only Q1)             | Q1 follows the main purpose. In the 3rd loading week of each block (weeks 3, 7, 11) Q1 follows the secondary purpose. |
| Long ride and volume          | Always follow the main purpose.                                                                           |
| Only one purpose chosen       | The main purpose's own Q1 and Q2 columns apply.                                                           |

### What wins on conflict

| Conflict                                     | Winner and how                                                                                              |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Weight loss (main) against muscle building   | Weight loss sets the volume (a ride on every available day, easy volume). Muscle building gets the Q2 slot only if the level has one; torque never lifts the hard-session budget. The rate cap (section 9) always applies. |
| Muscle building (main) against weight loss   | Muscle building shapes Q1 and Q2. The weight rate cap and the weekly check (section 9) still apply; the plan adds no extra volume to lose weight faster. |
| Endurance against speed                      | The main purpose gets Q1 and the long ride. The secondary one gets Q2 (or one week in three for an amateur). |
| Anything against safety caps or the event    | Caps and the taper win (order of rules, top of this page).                                                  |

## 9. Weight loss rules

**No calorie advice, no fuelling advice, no medical claims** (P1, E6 is out of scope). The engine only reads
weight and changes **training**, and shows plain facts.

### Setting a target (applies when weight loss is rank 1 or 2)

- The PO gives a target weight (kg) and a target date. Both are optional: without them the plan only shows the trend.
- **Weekly rate cap: 0.5 % of the start weight per week** (M; the backlog suggests 0.5 to 1 %, this is the
  conservative end). The PO can raise it in settings to at most 0.75 %. At 86 kg the cap is 0.43 kg a week.
- Needed rate = (start weight - target) / weeks to the date. If needed is above the cap, the plan uses the
  cap and shows the **earliest date at the cap** (for example "80 kg is reachable around week 14 at 0.43 kg
  a week"). It never plans faster than the cap.
- The planned weight line is linear: `start - rate x weeks`. The start weight is the latest trend value
  (`trend()` average) on the plan start date.
- A target at or above the current weight is not a weight loss target; the engine asks for another one.
- The engine has no height, so it **cannot say whether a target weight is sensible**. It says so, and does not
  judge. (Open question: add an optional height only to show a neutral note.)

### Weekly weight check (every Monday, with at least 3 weigh-ins in each of the two weeks)

Rate = (trend average 14 days ago - trend average now) / 2 kg per week, using `trend()` from `weight.ts`.

| State           | Condition                                                          | What the engine does                                                                                           |
| --------------- | ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| On track        | Rate between 0 and the cap                                          | Nothing                                                                                                        |
| Faster than cap | Rate above the cap in **2 checks in a row**                         | For the next 2 weeks: hours are held (the previous week is repeated, no growth), every main set goes one step down, no extra ride. Shows the facts and the reason. |
| Stalled         | Rate at or below 0.05 kg a week in **3 checks in a row**, not in a recovery or taper week | If a free available day exists and hours are below H: add one easy endurance ride of up to 45 minutes (at most once every 3 weeks, never above H, never a hard session). Otherwise only the notice. |
| Not enough data | Fewer than 3 weigh-ins in a window                                   | No state, no change                                                                                            |

The notices are facts, for example: "Your weight trend fell 0.7 kg a week in the last 2 weeks. The plan
holds your training hours this week." and "Your weight trend has been flat for 3 weeks. The plan has no free day
for more easy riding; add a riding day in your profile to allow more." No advice about eating, no medical claim.
**Wording to be approved by the PO.**

Stability: a state only changes after the checks above (a hysteresis), so one odd weigh-in does not change
the plan. The engine uses the state, not the raw weight, as input (section 12).

When muscle building or another purpose is main and weight loss is not in the top two, the engine only shows
the trend; no rate rules run.

## 10. Indoor and outdoor

| Setting | Rules                                                                                                                                                                  | Basis |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| Outdoor | Power targets are a band (plus or minus 5 %) because of wind and hills; use heart rate as a back-up. Torque on a climb or in a big gear. Sprints on a flat or slightly rising, safe road. The long ride has no fixed route. | C |
| Indoor  | Exact watt targets. A session is at most 120 minutes (amateur 90) and an easy endurance ride at most 90 minutes. Warm-up 5 minutes longer. Time over the limit is not moved; the week's ceiling drops and the plan says so. Heart rate often reads higher than outdoors, so power leads. | C / M |
| Both    | Structured sessions on weekdays indoors, Saturday and Sunday outdoors (M). The PO can switch a single session (stored on the session, no recalculation).                   | M     |

## 11. Matching rides to sessions

A ride is an imported activity. Matching links a ride to **one** planned session (`planned_sessions.activity_id`).
It is deterministic and runs again at every re-evaluation for sessions from 3 days ago up to tomorrow.

**Candidates.** A ride can match a session with status planned (or missed, within 3 days) when the dates are
the same, or differ by 1 day (a ride the day before or after, M). Rides tagged commute, or shorter than 20
minutes, are ignored unless the PO links them.

**Duration fit.** `r = ride moving time / planned minutes`.

| Session kind                    | Fits when       | Flag                                   |
| ------------------------------- | --------------- | -------------------------------------- |
| Recovery, endurance             | 0.60 to 1.50    | Short when r is below 0.85             |
| Structured, openers, test       | 0.70 to 1.30    | Short when r is below 0.85             |
| Long ride                       | 0.75 and up     | Short when r is below 0.85             |

**Intensity fit** (only with power data): the ride's average power as a share of FTP against the session's
planned average (time-weighted target). Ratio 0.80 to 1.25 is a fit. Intensity **never blocks** a match: a
lighter or harder ride is still done, with a flag ("easier than planned" or "harder than planned"). It breaks ties.

**Score** (lowest wins): date penalty (same day 0, one day apart 10) + `20 x |1 - r|` + intensity penalty
(`10 x |1 - ratio|`, 0 without power). The best pair is linked first; a ride and a session are used once.
Ties go to the earlier session, then the earlier ride.

**Long ride substitution (M).** An unmatched ride in the same Monday-to-Sunday week as a still-planned long
ride, with at least 0.75 of its length and no other long ride done that week, counts as that long ride, even
more than 1 day away. The session shows its original day and "done early".

**Two rides in one day.** Each ride takes its own best session. A second ride that fits nothing stays unplanned.
Rides are not added together in this version (open question).

**Unplanned rides** stay as extra rides: listed in the week, counted in the week's actual hours and load, and
used by re-evaluation (section 12). They never turn a missed session into done.

**Statuses.** planned, done (matched), missed (date is before today and nothing matches), skipped (the PO says
so). A session is missed from the first evaluation after its day. A late import that matches within 3 days
turns it to done again (and triggers one more re-evaluation).

**A PO fix is stored** as `activity_id` plus `match_source` = `auto` or `manual` (additive column for part B).
A manual link or unlink is **locked**: matching never changes it. Moving a ride to another session unlinks the
first one and locks it as unlinked. A fix is an input change, so it triggers a re-evaluation.

## 12. Re-evaluation and stability

### Triggers

An import has finished; the app is opened (also when it returns after 30 minutes or more); a ride has been
added; a setting that is an input changes (profile, intake answers, FTP, HR, event, target weight); the PO fixes
a match.

### Steps

1. Run matching (section 11) for sessions from 3 days ago to tomorrow.
2. Build the **fingerprint**: a hash of the inputs that matter: level, H, available days, purposes, indoor /
   outdoor, event, FTP and HR references, the weight state (not raw weights), the session statuses and
   matches, the minutes ridden this week rounded to 15, and the plan start date.
3. If the fingerprint equals the stored one: **stop, write nothing, show nothing.** (Opening the app 10
   times in a row changes nothing.)
4. Otherwise rebuild the plan with the same pure function from the inputs and the history (done sessions
   fix the ladder steps).
5. Keep everything that is frozen (below); replace the future sessions.
6. Compare old and new future sessions. If something changed in kind, minutes, main set or day, store the
   change as a "Plan updated" notice with reasons, and keep the old version for **Undo**. If only watts
   changed because of a new FTP, the notice says "Targets updated for your new FTP".
7. Store the new fingerprint.

### Never changed

- Sessions with a date before today; sessions with status done, missed or skipped.
- **Today's session when a ride for today already exists** (it has started).
- Sessions with a manual match (locked).
- The start date, the position of recovery weeks, the phases and the event with its taper (the calendar skeleton).
- The targets stored on a past session (they keep the FTP of that day).

### Stability rules

- Pure and deterministic: the same inputs give the same plan; running twice gives the same result.
- Only the fingerprint decides if anything is recalculated. The clock is used only to decide what is past.
- Weight enters only as a state with hysteresis (section 9), never as raw numbers.
- **Undo** restores the previous future sessions and stores "this fingerprint was undone": the same inputs are
  not recalculated again. Any new input change clears it.
- Reason codes in the notice: missed session, extra ride, ramp back, new FTP, new heart rate zones, settings
  changed, weight faster than cap, weight stalled, days changed, event changed.

## 13. Missed sessions

A missed session makes the engine recalculate the rest of the week and the weeks after (P61). It **never
makes up** the work and **never doubles up hard days**.

| Missed session               | This week                                                                                                         | Later weeks                                           |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| Structured (Q1, Q2, test)    | Moved once, to the next available day within 2 days **if** that day is free, not next to another structured day, and the week stays within its caps. Otherwise **dropped**. | Not made up. The ladder step repeats (section 7.3).   |
| Long ride                    | Moved to the next free available day this week if the day before is not structured. Otherwise dropped.            | The next long ride follows its normal plan, no extra. |
| Endurance, recovery          | Dropped                                                                                                           | No change                                             |
| Openers                      | Dropped                                                                                                           | No change                                             |
| Two or more structured missed within 7 days | As above                                                                           | Next week: structured budget minus 1 (at least 1)     |
| A week with no rides at all  | -                                                                                                                 | **Ramp back:** next week starts at 80 % of the last week with rides, then +8 % a week up to the planned hours. |
| 21 days without a ride       | -                                                                                                                 | The plan is not changed. A notice offers a new plan.  |

**Extra (unplanned) rides.** They count as done volume. The sessions of the week that have not happened are
shortened so the week stays at or below the planned hours plus 10 %: easy rides first (down to their minimum,
else dropped), then the long ride (down to its minimum, else dropped). Structured sessions are not shortened. If the
actual hours of a loading week end more than 25 % above plan (overload), the next week is not raised and its Q2
becomes endurance. A ride that looks hard (average power of 80 % FTP or more) counts as a structured day for
the no-consecutive-hard-days rule.

The week's hours never go above the ceiling after a move. The calendar skeleton (phases, event, taper) stays.

## 14. Warning without power data, and a new baseline

**No power data (P64).** A done session counts as "without power" when its matched ride has no power data. When
**4 or more** done sessions in the **last 28 days** are without power, show the warning card (status card at
the bottom of the page, P12) with the way to fix it (power meter, import). The plan does not change. The card
goes away when the count is below 4. (The backlog says four in a row or in the last weeks; one count covers both.)

**New baseline (P41).** When the PO confirms a new FTP, LTHR or max HR:

- Future sessions (from tomorrow, not frozen) get new watts or bpm. Their structure, minutes and mix stay
  the same, so no "Plan updated" restructuring, only the "Targets updated" notice.
- Past sessions and today's started session keep the FTP stored on them.
- The level, caps and hours do not change because of an FTP change.

## 15. Summaries (data fields, P67)

Plain text or markdown, metric units (P6), Brussels dates, `n/a` for missing values. No AI service. Three
switches from the working default Q-E2-15: include weight, include goals, and an instruction line at the top.

| Block (all summaries)  | Fields                                                                                                           |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Instruction line       | One line, can be switched off: "Analyse this training and give practical tips." (wording to be approved)         |
| Athlete                | Level, purposes ranked, hours per week, indoor / outdoor, event name and date (if any)                           |
| Zones                  | FTP, the 7 power zones with watts, LTHR or max HR, the 5 heart rate zones with bpm                               |
| Weight (switch)        | Latest weight, 4-week trend change, target weight and date, planned rate and state                               |
| Goals (switch)         | The profile's free-text goal                                                                                     |

| Summary | Extra fields                                                                                                                                                         |
| ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Session | Planned: date, title, kind, minutes, steps (minutes, percent FTP, watts, zone, bpm), reason. Done: ride name and date, moving time, average and normalised power if known, average and max HR, time in zones if streams exist, match status and flags (short, easier, harder). |
| Week    | Week number, phase, planned and actual hours, planned and actual load, quality minutes, one line per session (planned against done, missed, skipped), unplanned rides, plan changes that week with reasons, weight trend. |
| Month   | The weeks as one line each (phase, hours planned / actual, load planned / actual, sessions done of planned), FTP changes, weight change, the list of "Plan updated" notices, the warnings that were shown.        |

## 16. All defaults in one place

| Name                       | Default                                  | Basis | Why                                                         |
| -------------------------- | ---------------------------------------- | ----- | ----------------------------------------------------------- |
| `PLAN_WEEKS`               | 12                                       | PO    | P59                                                         |
| `START_FRACTION`           | 0.75 of H                                | M     | A gentle first week                                         |
| `START_FROM_HISTORY`       | `1.10 x A`, clamp 0.60 to 0.90 of H      | M     | Do not start far above what the PO actually rides           |
| `LOADING_GROWTH`           | +8 % a week (target)                     | C     | Inside the usual 5 to 10 % guideline                        |
| `HOURS_GROWTH_CAP`         | +10 %                                    | C     | C2                                                          |
| `LOAD_GROWTH_CAP`          | +15 %                                    | M     | C3                                                          |
| `LONG_RIDE_GROWTH_CAP`     | +10 %                                    | M     | C4                                                          |
| `RECOVERY_EVERY`           | 4 (every 4th week); alternative 3        | C     | 3 weeks up, 1 down                                          |
| `RECOVERY_FRACTION`        | 0.70                                     | C     | Clearly lighter                                             |
| `QUALITY_CAP`              | 15 / 20 / 25 % (88 % FTP and up)         | M     | C5                                                          |
| `ABOVE_THRESHOLD_CAP`      | 5 / 7 / 9 % (over 105 % FTP)             | M     | C6                                                          |
| `HARD_BUDGET`              | 1 / 2 / 3 structured sessions            | C / M | C7                                                          |
| `NO_BACK_TO_BACK_HARD`     | true                                     | C     | C8                                                          |
| `MAX_RIDES`                | 4 / 5 / 6                                | M     | C10                                                         |
| `TAPER_WEEKS`              | 1 (under 3 h), 2 (3 h and over)          | C / M | Short events need less taper                                |
| `TAPER_FRACTIONS`          | 1 week: 0.50; 2 weeks: 0.75 and 0.45     | C / M | Cut volume, keep short intensity                            |
| `WEIGHT_RATE_CAP`          | 0.5 % of start weight a week (max 0.75)  | M     | Conservative; backlog range 0.5 to 1 %                      |
| `WEIGHT_FASTER_CHECKS`     | 2 in a row                               | M     | Avoid reacting to noise                                     |
| `WEIGHT_STALLED`           | at most 0.05 kg a week, 3 checks in a row | M    | Avoid reacting to noise                                     |
| `MATCH_DATE_WINDOW`        | same day, plus or minus 1 day            | M     | Fits real weeks                                             |
| `MATCH_DURATION`           | 0.60 to 1.50 easy, 0.70 to 1.30 hard, 0.75 and up long | M | Allows normal ride-to-ride variation                  |
| `LATE_IMPORT_WINDOW`       | 3 days                                   | M     | Imports can arrive late                                     |
| `NO_POWER_WARNING`         | 4 sessions in 28 days                    | PO / M | P64 gives 4; the window is M                               |
| `RAMP_BACK_FRACTION`       | 0.80 of last ridden week                 | C / M | Return gently after a missed week                           |
| `FOREGROUND_RECHECK`       | 30 minutes                               | M     | The check is cheap, this only limits noise                  |

## 17. What this does not do

- It gives **no medical advice** and makes no health claims. It does not know about illness, injury, age
  limits, medication or pregnancy. The PO decides whether a session is right today.
- It gives **no calorie, nutrition or fuelling advice** (E6, E4 are out of scope) and does not judge if a target
  weight is healthy.
- It does not use fitness / fatigue / form, power curve or heart rate drift (E3). The load is a simple sum.
- It has no pacing plan for the event, no event distance or elevation (E4).
- It does not plan around weather, holidays or work travel, except through the profile days.
- It does not build an exercise library or a strength programme; strength is a note.
- It does not call an AI service. Summaries are text to copy.
- It does not add rides together, or follow more than one event, or more than two purposes.
- It does not change the past, and it does not make up for missed work.

## 18. What the PO should challenge first

1. H as a full normal week (plans average 82 to 86 % of it).
2. The caps (C3 to C7): 15 % load growth, 15 / 20 / 25 % quality, 5 / 7 / 9 % above threshold.
3. The level scoring and the hours gate.
4. Weight loss rate cap 0.5 % and the reactions to faster or stalled trends, and the notice wording.
5. Taper lengths by event duration.
6. The long ride substitution and the missed-session moves.
7. Ranked purposes beyond two, and a start date that moves when the event is more than 12 weeks away.

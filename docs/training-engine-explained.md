# How the training engine works, in simple words

This page explains the plan engine of Cycling Hub in simple English. Every special word is explained the first time it appears. A glossary is at the end.

The page describes what the code really does. Where the code makes a guess or a simplification, the text says **Assumption**.

Main code: `src/features/plan/engine/` (builds the plan), `src/features/plan/adapt/` (updates the plan after rides), `src/features/athlete/` (zones and FTP). The written rules are in `docs/plan/engine-rules.md`.

---

## 1. The big picture

The app builds a **12-week training plan** for one rider. The plan is a list of sessions. Each session has a day, a length, steps, and target watts and heart rate.

The engine is a **pure function**. This means: the same inputs always give the same plan. It has no randomness. It does not call an AI service. The only clock it uses is today's date, to know what is past. The main function is `buildPlan(input)` in `engine/build.ts`.

**What goes in:**

- **FTP.** Functional Threshold Power: the highest power, in watts, that you can hold for about one hour. All targets are a percentage of FTP. FTP comes from the Baseline page. Without FTP there is no plan ("Plan needs a baseline").
- **Heart rate reference.** LTHR (lactate threshold heart rate) or max heart rate. Without it, sessions show watts only.
- **Intake answers.** Five level questions, hours per week, ranked goals ("purposes"), indoor/outdoor/both, available weekdays, an optional event (name, date, expected duration), and an optional target weight and date.
- **Ride history.** Imported rides. They are matched to sessions and used to re-plan.
- **Weight log.** Used only for the weight-loss rules.

**What comes out:** a `Plan` with weeks, sessions, notices and warnings. Plans are stored in `training_plans` and `planned_sessions`. Plan updates are logged in `plan_changes`.

**How it stays up to date:** when a ride is imported, the app is opened, or a setting changes, a second part (`adapt/evaluate.ts`) checks the rides against the plan. It rebuilds only the future sessions, and only if the inputs really changed.

---

## 2. The science in simple words

The engine uses common coaching rules. It is not a research model. The rules document marks each rule as **C** (common coaching practice) or **M** (a choice made for this app). Many numbers are M.

### FTP and power zones

Power is measured in **watts** (W). **Zones** are ranges of power, and each zone trains something different. The app uses the 7 **Coggan zones** (decision P40, `powerZones` in `athlete/zones.ts`).

| Zone | Name | Upper limit (% of FTP) |
|---|---|---|
| Z1 | Active recovery | 55 |
| Z2 | Endurance | 75 |
| Z3 | Tempo | 90 |
| Z4 | Threshold | 105 |
| Z5 | VO2 max | 120 |
| Z6 | Anaerobic capacity | 150 |
| Z7 | Neuromuscular power | no limit |

Example: FTP = 250 W. The Z2 upper limit is 250 x 0.75 = 187.5, so 188 W. Z2 is 139 to 188 W. Z4 is 226 to 263 W.

Heart rate zones (`heartRateZones`) have 5 zones. With LTHR the limits are 68, 83, 94 and 105 percent of LTHR. Without LTHR the app uses max heart rate at 60, 70, 80 and 90 percent.

### How FTP is found

- **20-minute test:** FTP = 95 percent of your best 20-minute power. Example: 263 W gives 250 W.
- **Ramp test:** FTP = 75 percent of your best 1-minute power.
- **Suggestion from rides:** the app searches the newest 60 rides with power for the best 20-minute effort. You must confirm it. Nothing changes by itself.

**Assumption:** 95 and 75 percent are rules of thumb. They are not exact for every rider.

### Periodization

**Periodization** means planning training in blocks, so the load goes up and down on purpose. Three phases:

- **Base:** weeks 1 to 4. Easy volume, tempo and sweet spot.
- **Build:** weeks 5 to 8. Harder, more goal-specific work.
- **Peak:** weeks 9 to 12. The most specific work and the longest long rides.

Every 4th week is a **recovery week** (3 weeks up, 1 week down) with 70 percent of the hours of the last loading week. Week 12 holds an FTP test.

### Training load

"Load" is a simple number per session (`stepLoad` and `sessionLoad` in `engine/library.ts`):

    load = minutes / 60 x (percent of FTP / 100)^2 x 100

Example: one hour at 65 percent of FTP gives 1 x 0.65 x 0.65 x 100 = 42. One hour at FTP gives 100.

This is like **TSS** (Training Stress Score), where one hour at FTP is 100. It uses the planned target, not real ride data. The week load is the sum of its sessions.

**Assumption:** warm-up counts as 60 percent of FTP, rests as 50 percent.

### Hard limits ("caps")

The engine checks every week and cuts sessions when a rule is broken (`engine/constants.ts`).

- Weekly hours grow at most 10 percent per loading week. The target is +8 percent.
- Weekly load grows at most 15 percent.
- The long ride grows at most 10 percent.
- **Quality minutes** (work at 88 percent of FTP or more) are at most 15, 20 or 25 percent of the week (amateur, committed, semi-pro).
- **Above-threshold minutes** (work over 105 percent) are at most 5, 7 or 9 percent.
- Hard sessions per week: 1, 2 or 3 by level, never on two days in a row.
- There is always at least one rest day.

**Assumption:** +8 and +10 percent follow the common "5 to 10 percent a week" guideline. The 15 percent load cap and the quality shares are choices for this app (M). The rider is meant to review them.

---

## 3. Step by step: how the engine builds a plan

**Step 1. Clean the inputs** (`engine/resolve.ts`). The engine finds the level, clamps the hours, picks the top two goals and checks that FTP and at least 2 available days exist. If not, the plan is "blocked" with a warning.

**Step 2. Find the level** (`engine/level.ts`). Five answers score 0 to 3 each (experience, hours ridden, interval habit, longest ride, hard sessions). Total 0-5 is **amateur**, 6-10 **committed**, 11-15 **semi-pro**. An hours gate lowers the level when hours per week are too low (semi-pro needs 10 hours or more, committed 6 or more). The rider can override the level. Ride history never changes it.

| | Amateur | Committed | Semi-pro |
|---|---|---|---|
| Hours per week | 3-6 | 6-10 | 10-16 |
| Rides per week | 3-4 | 4-5 | 5-6 |
| Hard sessions per week | 1 | 2 | 3 |
| Long ride (minutes) | 90-180 | 120-270 | 150-330 |

**Step 3. Build the calendar** (`engine/calendar.ts`). Without an event: 12 weeks, phases at weeks 1-4, 5-8 and 9-12, a recovery week every 4th week and the FTP test in week 12. If the plan starts mid-week, week 1 is a partial week.

With an event the plan is built backwards: the last week holds the event; the **taper** (less volume, a little intensity, so you arrive fresh) is 1 week at 50 percent for events under 3 hours, or 2 weeks at 75 and 45 percent for longer ones; the day before gets "openers" (short efforts to wake the legs). If the event is more than 12 weeks away the plan starts 12 weeks before it; if closer, the plan is shorter, with a minimum of 4 weeks.

**Step 4. Set the hours per week** (`engine/budget.ts`). H is the rider's hours per week. It is a ceiling, not a target.

Example: H = 8 hours = 480 minutes. Week 1 is 75 percent: 360 min. Week 2: 360 x 1.08, rounded down to 5 minutes: 385. Week 3: 415. Week 4 (recovery): 415 x 0.70 = 290. Later weeks keep growing but never pass 480.

**Assumption:** week 1 is 75 percent of H, so the 12-week average is below H (about 82 to 86 percent, says the rules document). This is flagged for the rider to challenge.

**Step 5. Choose the sessions of the week** (`engine/mix.ts`, `PURPOSE_MIX` in `engine/constants.ts`). There are two hard slots (Q1, Q2), a long ride and easy rides. The main goal decides Q1, the second goal decides Q2. Amateurs have one hard slot.

| Goal | Base | Build | Peak |
|---|---|---|---|
| Endurance | Q1 tempo, Q2 sweet spot | Q1 sweet spot, Q2 threshold | Q1 threshold, Q2 sweet spot |
| Speed | Q1 sweet spot, Q2 tempo | Q1 VO2, Q2 threshold | Q1 VO2, Q2 sprint |
| Muscle building | Q1 torque, Q2 tempo | Q1 torque, Q2 sweet spot | Q1 torque, Q2 threshold |
| Weight loss | Q1 tempo, Q2 easy | Q1 sweet spot, Q2 easy | Q1 sweet spot, Q2 easy |

Session types: **tempo** is steady and firm (76-90 percent of FTP); **sweet spot** is hard but repeatable (88-94 percent); **threshold** is work at FTP (95-105 percent); **VO2 max** is short hard intervals (106-120 percent); **sprint** is all-out efforts of 8-15 seconds (not for amateurs); **torque** is a big gear at 50-60 rpm for leg strength; the **long ride** is the longest, easy ride. Semi-pro riders in Build and Peak can get tempo blocks inside the long ride. Muscle building adds off-bike "strength notes" (text only).

**Step 6. Choose the days** (`engine/allocate.ts`). The long ride goes on Sunday, else Saturday, else the last available day. Q1 goes on Wednesday or the closest day. Q2 is at least 2 days from Q1 and the long ride. Easy rides fill the rest. The number of rides is `round(H / 1.6)`, limited by level and available days. Indoor sessions are capped at 120 minutes (amateur 90).

**Step 7. Share the minutes.** The weights are: long ride 2.8 (amateur 2.2), Q1 1.5, Q2 1.3, easy ride 1.0 (amateur 1.2). Each ride is clamped to the min and max of its type and rounded down to 5 minutes.

**Step 8. Fill in the steps** (`engine/library.ts`). A hard session is a warm-up, a main set, easy riding to fill the time and a cool-down. The main set comes from a **ladder** (`LADDERS`): harder and harder sets per type and level.

Example, committed, threshold: 2x12, 3x10, 2x20, 3x12 ("2x12" means 2 intervals of 12 minutes). The first loading week with threshold uses 2x12, the next 3x10, and so on. A missed session does not move the ladder, so the same step comes again. If a set does not fit the time or breaks a cap, the engine goes one step down. Targets are stored as percent of FTP and turned into watts with the current FTP.

**Step 9. Check the caps.** If a cap is broken, the engine shortens or lowers sessions. It never moves minutes to another session. `engine/plan-checks.ts` lists any rule violation (used in tests).

**Step 10. Weight loss** (`engine/weight-loss.ts`, `adapt/weight-state.ts`). With weight loss in the top two goals, the plan never plans a loss faster than 0.5 percent of start weight per week (up to 0.75 as a setting). A weekly check on the 14-day trend: losing faster than the cap twice in a row means the hours are held and main sets go one step easier for 2 weeks; a stalled trend (0.05 kg a week or less) for 3 checks adds one easy ride of up to 45 minutes. There is no calorie, food or medical advice.

---

## 4. How rides are analysed

### 4a. Matching rides to sessions (`adapt/match.ts`)

An imported ride is linked to one planned session.

- Same day, or 1 day before or after. Rides under 20 minutes or tagged "commute" are ignored unless you link them by hand.
- **Duration fit:** r = ride moving time / planned minutes. Easy rides fit at 0.60-1.50, hard sessions at 0.70-1.30, long rides at 0.75 and up. Under 0.85 the match gets a "short" flag.
- **Intensity fit** (with power): ride average power is compared with the session's planned average. A ratio of 0.80-1.25 fits; outside it the match is flagged "easier" or "harder". Intensity never blocks a match.
- The lowest score wins (date penalty + 20 x |1 - r| + 10 x |1 - intensity ratio|).
- Example: 60 planned minutes on Wednesday, a 54-minute ride on Wednesday: r = 0.90, a fit with no flag.
- A manual link or unlink is locked. Matching never changes it.

A session becomes: planned, done, missed (the day passed, no match) or skipped.

### 4b. Numbers from the raw ride data (`summary/stream-metrics.ts`)

- **Normalised power (NP):** a 30-second rolling average, each value to the 4th power, averaged, then the 4th root. It gives more weight to hard efforts. A steady 200 W ride has NP near 200 W; a ride that alternates hard and easy has an NP above its plain average.
- **Time in each power zone and heart rate zone.**

These are used for the copy-and-paste summaries, not to change the plan.

### What is NOT computed

The code has no TSS from real rides, no IF (NP / FTP), no variability index and no CTL, ATL or TSB (long-term fitness, short-term fatigue and form). They are deferred in the backlog as E3.

---

## 5. How the plan changes after rides (re-evaluation)

Code: `adapt/evaluate.ts` (`evaluatePlan`), `adapt/rebuild.ts`, `adapt/merge.ts`, runner in `adaptation/runner.ts`.

**Triggers:** an import finishes, the app is opened, a setting changes, or you fix a match.

1. Match rides to sessions from 3 days ago to tomorrow.
2. Build a **fingerprint**: a hash of the inputs that matter (engine version, level, hours, days, goals, FTP, weight state, session statuses, minutes ridden this week rounded to 15).
3. Same fingerprint as stored: stop, write nothing.
4. Otherwise call `buildPlan` again and rebuild only the **future** sessions.
5. Store a "Plan updated" notice with reasons. The old version is kept for **Undo**.

**Never changed:** past sessions, done/missed/skipped sessions, today's session when a ride exists, manual matches, and the calendar skeleton (start date, recovery weeks, event, taper).

**Missed and extra rides:**
- A missed hard session is moved once (within 2 days, if the day is free) or dropped. It is never made up.
- Extra rides shorten the remaining easy rides, then the long ride, to keep the week at plan plus 10 percent.
- A week with no rides: next week starts at 80 percent of the last ridden week, then grows 8 percent a week.
- A loading week 25 percent over plan: the next week is not raised.
- 21 days without a ride: the plan is not changed and a notice offers a new plan.
- A new FTP only changes watts of future sessions.

**Warning without power data:** 4 or more done sessions in 28 days without power show a warning; the plan does not change.

**Assumption:** `adjustments.recentAverageHours` (week 1 from your real riding) exists in the engine, but no code outside tests sets it today.

---

## 6. New: ride feedback and "Re-plan now"

**Re-plan now** (Plan options menu) recalculates the future sessions with the engine as it is in the code today, even when the inputs did not change. Normally the fingerprint stops a recalculation. This is useful after the engine rules were tweaked without a new `ENGINE_VERSION`. Past sessions and manual matches stay. The result is a normal "Plan updated" notice with Undo; if nothing differs, the app says so.

**Ride feedback** (`adapt/effectiveness.ts`) runs on every evaluation and shows "How your plan is working" on the Overview. It compares finished sessions and weeks with the plan:

- **Time** is reliable. A hard session ridden for under 80 percent of its planned time is "cut short".
- **Power** is only reliable indoors (outdoors an average includes freewheeling). Indoors, under 90 percent of the planned average is "under target". At 110 percent or more is "over target" (believable anywhere).
- Per session type, the latest 3 sessions are looked at; 2 of 3 form a pattern. Cut short means the sessions may be too long. Under target means the targets may be too high. Over target means the plan may be too light or FTP has grown (an FTP test is suggested). All on target is a positive signal.
- Per full loading week: hours ridden against planned. Under 80 percent two weeks in a row means the plan asks too much. Over 115 percent means it may be too light. In between is a positive signal. Hard minutes delivered against planned are compared in the same way.
- Many missed hard sessions suggest too many hard days.

**One real adjustment:** a hard session that was ridden but cut short repeats its ladder step, like a missed session (`struggledStructured`, reason "ride feedback"). All other signals are advice for you; the plan changes only through Edit plan or your own choice. A ride alone cannot tell whether the plan or the day was the problem.

**Assumption:** all thresholds above are starting values (M), to be tuned with real rides.

---

## 7. Limitations

- **Not medical.** No illness, injury, age or medication.
- **No nutrition advice,** and no judgement of a target weight.
- **Load is planned, not measured.** It never uses NP or real power.
- **No fitness model** (no CTL, ATL, TSB), so the plan cannot react to real fatigue.
- **Many numbers are choices** (level scoring, the 75 percent start, the load cap, quality shares, taper lengths, weight rate).
- **FTP must be right.** The app only suggests a new FTP.
- **Only two goals and one event** are used.
- **Two rides in one day** are not added together.
- **No weather, holiday or travel planning.**
- **Old rides often have no power or heart rate,** so analysis covers only rides with the data.
- **Strength work** is only a text note.

---

## 8. Glossary

- **Amateur / committed / semi-pro:** the three levels; they set hours, hard sessions and caps.
- **ATL (Acute Training Load):** short-term load average, meaning fatigue. Not used.
- **Base / Build / Peak:** the three plan phases.
- **Cap:** a hard limit the engine will not pass.
- **CTL (Chronic Training Load):** long-term load average, meaning fitness. Not used.
- **Event:** a race or big ride the plan builds up to.
- **FTP:** power you can hold for about one hour, in watts.
- **IF (Intensity Factor):** NP divided by FTP. Not computed.
- **Ladder:** the list of main sets for a session type, easier to harder.
- **Load:** the app's simple stress number: minutes/60 x (%FTP/100)^2 x 100.
- **Loading week:** a normal week that builds on the last one.
- **LTHR:** the heart rate you can hold near threshold.
- **Main set:** the hard part of a session, such as 3x15 minutes.
- **NP (Normalised Power):** an average that weights hard efforts more.
- **Openers:** short efforts the day before an event.
- **Periodization:** planning training in blocks.
- **Quality minutes:** minutes of work at 88 percent of FTP or more.
- **Ramp test:** an FTP test with steps that get harder every minute.
- **Recovery week:** an easy week (70 percent) every 4th week.
- **Sweet spot:** hard but repeatable work at 88-94 percent of FTP.
- **Taper:** less volume before an event, with a little intensity.
- **Tempo:** steady, firm effort in zone 3.
- **TSB (Training Stress Balance):** CTL minus ATL, meaning form. Not used.
- **TSS (Training Stress Score):** how stressful a ride was; one hour at FTP is 100.
- **Watts (W):** the unit of power.
- **Zones:** ranges of power (7) or heart rate (5).

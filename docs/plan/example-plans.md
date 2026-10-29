# Example plans

Sprint 4 (v0.5.0), part A. Plans made **by hand-applying** the rules in [`engine-rules.md`](engine-rules.md),
for the PO to check the training load rules before any build. The numbers were produced by following the
rule set step by step (a throwaway script, not app code) and every week is checked against the caps.

## How to read the tables

- FTP is **250 W** for every plan. Zones from `zones.ts`: Z1 0 to 138, Z2 139 to 188, Z3 189 to 225, Z4 226 to
  263, Z5 264 to 300, Z6 301 to 375, Z7 376 and up (watts). Useful targets: endurance 163 W, tempo 208 W,
  sweet spot 228 W, threshold 250 W, VO2 280 W, torque 195 W.
- No ride history is assumed, so week 1 is 75 % of H. Weeks start on Monday; no dates are shown.
- Cell format: `type main set (minutes)`. A cell with only a number is the length in minutes. `off` is a rest day.
  `+S` is an off-bike strength note on that day (not counted in hours).
- Types: End = endurance, Rec = recovery spin, Long = long ride (`+3x15 Tmp` = tempo blocks inside), Tmp = tempo,
  SS = sweet spot, Thr = threshold, VO2, Spr = sprint, Trq = low-cadence torque, Opn = openers, Test = FTP test.
  Main sets are repeats x minutes (sprints: repeats x seconds).
- Hours = sum of the sessions. Load = planned load (see the terms in the rules). Both are rounded.
- Each plan has a self-check table. "Hours vs last loading week" and "Load vs last loading week" compare with the
  previous loading week (recovery weeks are skipped). Quality share is minutes at 88 % FTP or more; above
  threshold is minutes over 105 % FTP; both are shares of the week's minutes.

## A. Amateur, 4 h a week, endurance

- Level: amateur (score 4 of 15: L1 1, L2 1, L3 1, L4 1, L5 0). H = 4 h, within 3 to 6 h.
- Purposes: endurance only. Outdoor. Available days: Tue, Wed, Sat, Sun. No event.
- 3 rides (round(4 / 1.6) = 3): long ride Sunday, Q1 Wednesday, one easy ride Saturday (Saturday is farther from other rides than Tuesday by the tie rule, later day wins). Budget: 1 hard session.
- Mix: Base tempo (weeks 1 to 3), Build sweet spot (5 to 7), Peak threshold (9 to 11); week 12 is recovery with the FTP test instead of Q1.

| Wk | Phase | Mon | Tue | Wed | Thu | Fri | Sat | Sun | Hours | Load |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | ---: | ---: |
| 1 | Base | off | off | Tmp 2x10 (50) | off | off | End 40 | Long 90 | 3.00 | 132 |
| 2 | Base | off | off | Tmp 2x15 (55) | off | off | End 45 | Long 90 | 3.17 | 143 |
| 3 | Base | off | off | Tmp 3x10 (65) | off | off | End 50 | Long 90 | 3.42 | 152 |
| 4 | Recovery | off | off | Tmp 2x10 (45) | off | off | Rec 40 | Long 60 | 2.42 | 96 |
| 5 | Build | off | off | SS 2x10 (70) | off | off | End 60 | Long 95 | 3.75 | 168 |
| 6 | Build | off | off | SS 2x12 (80) | off | off | End 60 | Long 100 | 4.00 | 181 |
| 7 | Build | off | off | SS 2x15 (75) | off | off | End 60 | Long 105 | 4.00 | 185 |
| 8 | Recovery | off | off | Tmp 2x10 (55) | off | off | Rec 45 | Long 65 | 2.75 | 108 |
| 9 | Peak | off | off | Thr 2x8 (75) | off | off | End 60 | Long 105 | 4.00 | 180 |
| 10 | Peak | off | off | Thr 2x10 (75) | off | off | End 60 | Long 105 | 4.00 | 184 |
| 11 | Peak | off | off | Thr 2x12 (75) | off | off | End 60 | Long 105 | 4.00 | 188 |
| 12 | Recovery | off | off | Test 70 | off | off | Rec 35 | Long 60 | 2.75 | 123 |

Totals: 41.2 h over 12 weeks (average 3.44 h a week, 86 % of H), planned load 1841.

**Self-check**

| Wk | Target h | Planned h | Hours vs last loading week | Load | Load vs last loading week | Structured days | Quality share | Above threshold | Checks |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| 1 | 3.00 | 3.00 | - | 132 | - | 1 | 0.0 % | 0.0 % | ok |
| 2 | 3.17 | 3.17 | +5.6 % | 143 | +8.7 % | 1 | 0.0 % | 0.0 % | ok |
| 3 | 3.42 | 3.42 | +7.9 % | 152 | +6.4 % | 1 | 0.0 % | 0.0 % | ok |
| 4 | 2.42 | 2.42 | - | 96 | - | 1 | 0.0 % | 0.0 % | ok |
| 5 | 3.75 | 3.75 | +9.8 % | 168 | +10.3 % | 1 | 8.9 % | 0.0 % | ok |
| 6 | 4.00 | 4.00 | +6.7 % | 181 | +7.9 % | 1 | 10.0 % | 0.0 % | ok |
| 7 | 4.00 | 4.00 | +0.0 % | 185 | +2.2 % | 1 | 12.5 % | 0.0 % | ok |
| 8 | 2.75 | 2.75 | - | 108 | - | 1 | 0.0 % | 0.0 % | ok |
| 9 | 4.00 | 4.00 | +0.0 % | 180 | -2.6 % | 1 | 6.7 % | 0.0 % | ok |
| 10 | 4.00 | 4.00 | +0.0 % | 184 | +2.1 % | 1 | 8.3 % | 0.0 % | ok |
| 11 | 4.00 | 4.00 | +0.0 % | 188 | +2.1 % | 1 | 10.0 % | 0.0 % | ok |
| 12 | 2.75 | 2.75 | - | 123 | - | 1 | 12.1 % | 0.0 % | ok |

Plan-level checks (all pass): sessions only on Tue / Wed / Sat / Sun (only Wed, Sat, Sun used); one hard
session a week and never two on consecutive days; recovery weeks (4, 8, 12) are at most 70 % of the previous
loading week; the long ride grows from 90 to 105 minutes, never more than 10 % in a week; the peak weeks (9 to 11)
are at H = 4.00 h; the above threshold share is 0 % (amateur plans only reach VO2 as a secondary or main speed
purpose). The average of 3.4 h is 86 % of H, which is the open question about H in the rules.

## B. Committed, 8 h a week, speed, with an event (100 km in week 12)

- Level: committed (score 8 of 15: L1 2, L2 2, L3 2, L4 1, L5 1). H = 8 h, within 6 to 10 h.
- Purposes: speed only. Wednesday sessions indoors, the rest outdoors (setting: both). Available days: Tue, Wed, Fri, Sat, Sun.
- Event: a 100 km ride on the Sunday of week 12, expected to take 3 to 6 hours, so the taper is 2 weeks: week 11 is 75 % of H (6.00 h), week 12 is 45 % of H (3.58 h) without the event.
- 5 rides: long ride Sunday, Q1 Wednesday, Q2 Friday (2 days from Wednesday and from Sunday), easy rides Tuesday and Saturday. Budget: 2 hard sessions.
- Mix: Base sweet spot and tempo, Build VO2 and threshold, Peak VO2 and sprint. Recovery weeks 4 and 8. Weeks 1 to 10 are the 3:1 pattern cut off at the taper; week 10 is a loading week.
- Week 12: Tuesday endurance, Wednesday a short VO2 set at the lowest step, Friday endurance, Saturday openers, Sunday the event (not counted in the hours).

| Wk | Phase | Mon | Tue | Wed | Thu | Fri | Sat | Sun | Hours | Load |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | ---: | ---: |
| 1 | Base | off | End 50 | SS 2x15 (70) | off | Tmp 2x15 (60) | End 45 | Long 135 | 6.00 | 275 |
| 2 | Base | off | End 50 | SS 3x12 (75) | off | Tmp 2x15 (65) | End 50 | Long 145 | 6.42 | 296 |
| 3 | Base | off | End 55 | SS 3x15 (80) | off | Tmp 2x15 (70) | End 55 | Long 155 | 6.92 | 323 |
| 4 | Recovery | off | Rec 45 | Tmp 2x15 (65) | off | Rec 40 | Rec 40 | Long 100 | 4.83 | 176 |
| 5 | Build | off | End 60 | VO2 5x3 (90) | off | Thr 2x12 (75) | End 60 | Long 165 | 7.50 | 347 |
| 6 | Build | off | End 65 | VO2 5x4 (95) | off | Thr 3x10 (80) | End 65 | Long 175 | 8.00 | 378 |
| 7 | Build | off | End 65 | VO2 6x4 (95) | off | Thr 2x20 (80) | End 65 | Long 175 | 8.00 | 394 |
| 8 | Recovery | off | Rec 50 | Tmp 2x15 (75) | off | Rec 50 | Rec 50 | Long 110 | 5.58 | 200 |
| 9 | Peak | off | End 65 | VO2 5x5 (95) | off | Spr 6x8s (80) | End 65 | Long 175 | 8.00 | 358 |
| 10 | Peak | off | End 65 | VO2 5x5 (95) | off | Spr 6x10s (80) | End 65 | Long 175 | 8.00 | 359 |
| 11 | Taper | off | End 50 | VO2 6x4 (75) | off | End 50 | End 50 | Long 135 | 6.00 | 277 |
| 12 | Taper | off | End 50 | VO2 5x3 (75) | off | End 50 | Opn 40 | Event | 3.58 | 163 |

Totals: 78.8 h over 12 weeks (average 6.57 h a week, 82 % of H), planned load 3545.

**Self-check**

| Wk | Target h | Planned h | Hours vs last loading week | Load | Load vs last loading week | Structured days | Quality share | Above threshold | Checks |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| 1 | 6.00 | 6.00 | - | 275 | - | 2 | 8.3 % | 0.0 % | ok |
| 2 | 6.42 | 6.42 | +6.9 % | 296 | +7.3 % | 2 | 9.4 % | 0.0 % | ok |
| 3 | 6.92 | 6.92 | +7.8 % | 323 | +9.2 % | 2 | 10.8 % | 0.0 % | ok |
| 4 | 4.83 | 4.83 | - | 176 | - | 1 | 0.0 % | 0.0 % | ok |
| 5 | 7.50 | 7.50 | +8.4 % | 347 | +7.5 % | 2 | 8.7 % | 3.3 % | ok |
| 6 | 8.00 | 8.00 | +6.7 % | 378 | +9.0 % | 2 | 10.4 % | 4.2 % | ok |
| 7 | 8.00 | 8.00 | +0.0 % | 394 | +4.1 % | 2 | 13.3 % | 5.0 % | ok |
| 8 | 5.58 | 5.58 | - | 200 | - | 1 | 0.0 % | 0.0 % | ok |
| 9 | 8.00 | 8.00 | +0.0 % | 358 | -9.1 % | 2 | 5.4 % | 5.4 % | ok |
| 10 | 8.00 | 8.00 | +0.0 % | 359 | +0.3 % | 2 | 5.4 % | 5.4 % | ok |
| 11 | 6.00 | 6.00 | - | 277 | - | 1 | 6.7 % | 6.7 % | ok |
| 12 | 3.58 | 3.58 | - | 163 | - | 1 | 7.0 % | 7.0 % | ok |

Plan-level checks (all pass): the event week holds exactly one hard session, openers the day before, no long
ride; the taper keeps a short VO2 session in both weeks (intensity stays, volume drops); the above threshold
share peaks at 5.4 % (cap 7 %) and quality at 13.3 % (cap 20 %); load falls from 394 in week 7 to 277 in
week 11 and 163 in week 12.

## C. Semi-pro, 13 h a week, endurance plus muscle building

- Level: semi-pro (score 12 of 15: L1 3, L2 3, L3 2, L4 2, L5 2). H = 13 h (the PO range 12 to 14 h, middle value), within 10 to 16 h.
- Purposes: endurance (main), muscle building (secondary). Outdoor. Available days: Tue to Sun (Monday off). No event.
- 6 rides: long ride Sunday, Q1 Wednesday, Q2 Friday, easy rides Tuesday, Thursday, Saturday. Budget: 3 hard sessions on Wed, Fri, Sun (never next to each other).
- Q1 follows the main purpose (tempo, sweet spot, threshold). Q2 follows the secondary purpose: torque in every phase. In Build and Peak the long ride holds tempo blocks (the third hard session).
- Strength notes: 1 a week (secondary purpose), on Friday after the torque ride; 1 light note in recovery weeks, on Wednesday.

| Wk | Phase | Mon | Tue | Wed | Thu | Fri | Sat | Sun | Hours | Load |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | ---: | ---: |
| 1 | Base | off | End 70 | Tmp 3x15 (100) | End 70 | Trq 4x8 (90) +S | End 65 | Long 190 | 9.75 | 426 |
| 2 | Base | off | End 75 | Tmp 3x20 (110) | End 75 | Trq 5x8 (95) +S | End 70 | Long 205 | 10.50 | 465 |
| 3 | Base | off | End 80 | Tmp 2x30 (120) | End 80 | Trq 5x10 (100) +S | End 80 | Long 220 | 11.33 | 505 |
| 4 | Recovery | off | Rec 60 | Tmp 3x15 (95) +S | Rec 60 | Rec 60 | Rec 60 | Long 140 | 7.92 | 278 |
| 5 | Build | off | End 85 | SS 3x15 (130) | End 85 | Trq 6x10 (110) +S | End 85 | Long 240 +3x15 Tmp | 12.25 | 568 |
| 6 | Build | off | End 90 | SS 3x20 (135) | End 90 | Trq 6x10 (120) +S | End 90 | Long 255 +3x15 Tmp | 13.00 | 609 |
| 7 | Build | off | End 90 | SS 4x15 (135) | End 90 | Trq 6x10 (120) +S | End 90 | Long 255 +3x15 Tmp | 13.00 | 608 |
| 8 | Recovery | off | Rec 60 | Tmp 3x15 (105) +S | Rec 60 | Rec 60 | Rec 60 | Long 165 | 8.50 | 303 |
| 9 | Peak | off | End 90 | Thr 3x12 (135) | End 90 | Trq 6x10 (120) +S | End 90 | Long 255 +3x20 Tmp | 13.00 | 610 |
| 10 | Peak | off | End 90 | Thr 3x15 (135) | End 90 | Trq 6x10 (120) +S | End 90 | Long 255 +3x20 Tmp | 13.00 | 619 |
| 11 | Peak | off | End 90 | Thr 4x12 (135) | End 90 | Trq 6x10 (120) +S | End 90 | Long 255 +3x20 Tmp | 13.00 | 620 |
| 12 | Recovery | off | Rec 60 | Test 70 +S | Rec 60 | Rec 60 | Rec 60 | Long 165 | 7.92 | 282 |

Totals: 133.2 h over 12 weeks (average 11.10 h a week, 85 % of H), planned load 5893.

**Self-check**

| Wk | Target h | Planned h | Hours vs last loading week | Load | Load vs last loading week | Structured days | Quality share | Above threshold | Checks |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| 1 | 9.75 | 9.75 | - | 426 | - | 2 | 0.0 % | 0.0 % | ok |
| 2 | 10.50 | 10.50 | +7.7 % | 465 | +9.3 % | 2 | 0.0 % | 0.0 % | ok |
| 3 | 11.33 | 11.33 | +7.9 % | 505 | +8.5 % | 2 | 0.0 % | 0.0 % | ok |
| 4 | 7.92 | 7.92 | - | 278 | - | 1 | 0.0 % | 0.0 % | ok |
| 5 | 12.25 | 12.25 | +8.1 % | 568 | +12.4 % | 3 | 6.1 % | 0.0 % | ok |
| 6 | 13.00 | 13.00 | +6.1 % | 609 | +7.4 % | 3 | 7.7 % | 0.0 % | ok |
| 7 | 13.00 | 13.00 | +0.0 % | 608 | -0.2 % | 3 | 7.7 % | 0.0 % | ok |
| 8 | 9.08 | 8.50 | - | 303 | - | 1 | 0.0 % | 0.0 % | ok |
| 9 | 13.00 | 13.00 | +0.0 % | 610 | +0.4 % | 3 | 4.6 % | 0.0 % | ok |
| 10 | 13.00 | 13.00 | +0.0 % | 619 | +1.4 % | 3 | 5.8 % | 0.0 % | ok |
| 11 | 13.00 | 13.00 | +0.0 % | 620 | +0.2 % | 3 | 6.2 % | 0.0 % | ok |
| 12 | 9.08 | 7.92 | - | 282 | - | 1 | 4.2 % | 0.0 % | ok |

Plan-level checks (all pass): hard days Wed, Fri, Sun are 2 days apart; in recovery weeks 4, 8 and 12 the
hours are at most 70 % of the previous loading week (the ceiling is not refilled, week 8 is 8.50 h of 9.08 h
allowed); the long ride grows from 190 to 255 minutes without a week above +10 %; load growth peaks at +12.4 % in
week 5 (blocks and sweet spot start), under the 15 % cap. Quality share stays low (4 to 8 %, cap 25 %) because
this is an endurance plan; torque and tempo do not count as quality minutes.

## D. Amateur, weight loss as main purpose, with a target weight and date

- Level: amateur (score 5 of 15). H = 5 h, within 3 to 6 h. Purposes: weight loss only. Outdoor. Available days: Tue, Wed, Sat, Sun. No event.
- Weight loss as main purpose: a ride on every available day (4 rides, the amateur maximum), one hard session (Q1), no Q2, plain endurance long ride. More easy volume, not more hard work.
- Mix: Q1 tempo in Base, sweet spot in Build and Peak.

| Wk | Phase | Mon | Tue | Wed | Thu | Fri | Sat | Sun | Hours | Load |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | ---: | ---: |
| 1 | Base | off | End 40 | Tmp 2x10 (55) | off | off | End 40 | Long 90 | 3.75 | 163 |
| 2 | Base | off | End 45 | Tmp 2x15 (60) | off | off | End 45 | Long 90 | 4.00 | 178 |
| 3 | Base | off | End 50 | Tmp 3x10 (65) | off | off | End 50 | Long 95 | 4.33 | 191 |
| 4 | Recovery | off | Rec 40 | Tmp 2x10 (45) | off | off | Rec 35 | Long 60 | 3.00 | 110 |
| 5 | Build | off | End 55 | SS 2x10 (70) | off | off | End 55 | Long 100 | 4.67 | 207 |
| 6 | Build | off | End 60 | SS 2x12 (75) | off | off | End 60 | Long 105 | 5.00 | 224 |
| 7 | Build | off | End 60 | SS 2x15 (75) | off | off | End 60 | Long 105 | 5.00 | 228 |
| 8 | Recovery | off | Rec 45 | Tmp 2x10 (55) | off | off | Rec 45 | Long 65 | 3.50 | 127 |
| 9 | Peak | off | End 60 | SS 3x10 (75) | off | off | End 60 | Long 105 | 5.00 | 226 |
| 10 | Peak | off | End 60 | SS 3x10 (75) | off | off | End 60 | Long 105 | 5.00 | 226 |
| 11 | Peak | off | End 60 | SS 3x10 (75) | off | off | End 60 | Long 105 | 5.00 | 226 |
| 12 | Recovery | off | Rec 40 | Test 70 | off | off | Rec 35 | Long 65 | 3.50 | 143 |

Totals: 51.8 h over 12 weeks (average 4.31 h a week, 86 % of H), planned load 2249.

**Self-check**

| Wk | Target h | Planned h | Hours vs last loading week | Load | Load vs last loading week | Structured days | Quality share | Above threshold | Checks |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| 1 | 3.75 | 3.75 | - | 163 | - | 1 | 0.0 % | 0.0 % | ok |
| 2 | 4.00 | 4.00 | +6.7 % | 178 | +9.2 % | 1 | 0.0 % | 0.0 % | ok |
| 3 | 4.33 | 4.33 | +8.3 % | 191 | +7.1 % | 1 | 0.0 % | 0.0 % | ok |
| 4 | 3.00 | 3.00 | - | 110 | - | 1 | 0.0 % | 0.0 % | ok |
| 5 | 4.67 | 4.67 | +7.7 % | 207 | +8.2 % | 1 | 7.1 % | 0.0 % | ok |
| 6 | 5.00 | 5.00 | +7.1 % | 224 | +8.1 % | 1 | 8.0 % | 0.0 % | ok |
| 7 | 5.00 | 5.00 | +0.0 % | 228 | +1.8 % | 1 | 10.0 % | 0.0 % | ok |
| 8 | 3.50 | 3.50 | - | 127 | - | 1 | 0.0 % | 0.0 % | ok |
| 9 | 5.00 | 5.00 | +0.0 % | 226 | -0.6 % | 1 | 10.0 % | 0.0 % | ok |
| 10 | 5.00 | 5.00 | +0.0 % | 226 | +0.0 % | 1 | 10.0 % | 0.0 % | ok |
| 11 | 5.00 | 5.00 | +0.0 % | 226 | +0.0 % | 1 | 10.0 % | 0.0 % | ok |
| 12 | 3.50 | 3.50 | - | 143 | - | 1 | 9.5 % | 0.0 % | ok |

Plan-level checks (all pass): 4 rides on Tue, Wed, Sat, Sun with Monday, Thursday and Friday off; one hard
session a week; weekly hours never above H = 5 h; the hours growth is at most +8.3 % (cap +10 %).

### The weight loss rate cap in this plan

Start weight 86.0 kg (trend value on the start date). Target 80.0 kg on the last day of week 12.

| Item                                  | Value                                                                            |
| ------------------------------------- | -------------------------------------------------------------------------------- |
| Needed rate                           | (86.0 - 80.0) / 12 = 0.50 kg a week = 0.58 % of the start weight a week          |
| Cap (0.5 % of 86.0 kg)                | 0.43 kg a week                                                                    |
| Needed is above the cap, so the plan  | uses 0.43 kg a week and shows the earliest date at the cap                        |
| Planned weight, week 4 / 8 / 12       | 84.3 / 82.6 / 80.8 kg (86.0 minus 0.43 per week)                                  |
| Earliest date for 80.0 kg at the cap  | 6.0 / 0.43 = 13.95, so week 14, 2 weeks after this plan ends                      |
| Message to the PO                     | "At a safe rate of 0.43 kg a week, 80 kg is reachable around week 14, not week 12." |

The plan never uses the 0.50 kg a week the PO asked for, and it gives no food advice.

### What the engine does with the weekly weight check

| Situation (Monday checks)                                  | Engine reaction                                                                                          |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Rate 0.40 kg a week in weeks 3 and 4: on track            | Nothing changes.                                                                                         |
| Rate 0.80 kg a week in the checks of weeks 5 and 6: **faster than the cap** twice | Week 6 and 7 are held: week 6 repeats week 5 (4.67 h, SS 2x10) instead of growing to 5.00 h and SS 2x12. Notice: "Your weight trend fell 0.8 kg a week in the last 2 weeks. The plan holds your training hours." |
| Flat trend in the checks of weeks 6, 7 and 8: **stalled**   | All 4 available days already have a ride and H is reached, so the engine cannot add a ride. Only a notice: "Your weight trend has been flat for 3 weeks. The plan has no free day for more easy riding; add a riding day in your profile to allow more." |

Week 6 before and after the "faster than cap" hold:

| Week 6 | Tue    | Wed         | Sat    | Sun      | Hours |
| ------ | ------ | ----------- | ------ | -------- | ----: |
| Before | End 60 | SS 2x12 (75) | End 60 | Long 105 |  5.00 |
| After  | End 55 | SS 2x10 (70) | End 55 | Long 100 |  4.67 |

## Re-evaluation examples

### Example 1: a missed Wednesday (plan B, week 6, Build)

The PO is ill on Wednesday and rides nothing. On Thursday the app is opened.

1. Matching finds no ride within 1 day of Wednesday, so the VO2 session is **missed**. The fingerprint changed
   (a status changed), so the engine recalculates.
2. Can the session move? Available days after Wednesday are Fri, Sat, Sun. Friday holds the threshold session
   (a hard day, so no doubling up). Saturday is next to Friday's hard session. Sunday is the long ride. The
   session is **dropped**, not moved.
3. Nothing is made up: the rest of week 6 stays. Week 7 changes in one place: VO2 repeats step 2 (5x4 minutes)
   instead of going up to step 3 (6x4).

| Week 6   | Tue    | Wed (VO2 5x4, 95)  | Thu | Fri             | Sat    | Sun       | Hours | Load |
| -------- | ------ | ------------------ | --- | --------------- | ------ | --------- | ----: | ---: |
| Before   | End 65 | VO2 5x4 (95)       | off | Thr 3x10 (80)   | End 65 | Long 175  |  8.00 | 378 |
| After    | End 65 | missed (dropped)   | off | Thr 3x10 (80)   | End 65 | Long 175  |  6.42 | 293 |

| Week 7   | Tue    | Wed          | Fri           | Sat    | Sun      | Hours | Load |
| -------- | ------ | ------------ | ------------- | ------ | -------- | ----: | ---: |
| Before   | End 65 | VO2 6x4 (95) | Thr 2x20 (80) | End 65 | Long 175 |  8.00 | 394 |
| After    | End 65 | VO2 5x4 (95) | Thr 2x20 (80) | End 65 | Long 175 |  8.00 | 389 |

The notice reads: "Plan updated: Wednesday's VO2 session was missed and is not made up. Next week's VO2 repeats
5 x 4 minutes." Undo restores week 7 as before.

Variant to show the move rule: an amateur with Thursday available misses Wednesday's sweet spot. Thursday is free,
Friday has no hard session, so the session **moves to Thursday** (the hours stay the same, no doubling). If Friday
were a hard day the session would be dropped.

### Example 2: an extra unplanned long ride (plan A, week 6, Build)

The planned week is Wednesday SS 2x12 (80), Saturday End 60, Sunday Long 100
(4.00 h, load 181). On Thursday the PO rides an unplanned 150 minutes at an easy
effort (load 106). On Friday the app is opened after an import.

1. Matching: Wednesday is done. The Thursday ride is 2.5 times Saturday's easy ride and not near it. It is at
   least 0.75 of the planned long ride and no long ride was done this week, so by the **long ride substitution**
   it counts as the long ride (done early). Sunday's long ride is therefore done.
2. Weekly ceiling: the cap for a week is the planned hours plus 10 %: 264 minutes. Done so far:
   80 + 150 = 230 minutes. Left: 34 minutes. Saturday's easy ride is shortened from
   60 to 30 minutes (the left-over rounded down to 5; the easy minimum is 30).
3. Sunday is a rest day now. Hours this week 4.33 h against a plan of 4.00 h (+8 %),
   under the +25 % overload line, so next week is not changed (an overload week would hold the next week's hours
   and turn its Q2 into endurance).

| Week 6 | Wed          | Thu                 | Sat                      | Sun                  | Hours | Load |
| ------ | ------------ | ------------------- | ------------------------ | -------------------- | ----: | ---: |
| Before | SS 2x12 (80) | off                 | End 60                   | Long 100             |  4.00 | 181 |
| After  | SS 2x12 (80), done | extra ride 150, counts as the long ride | End 30 (shortened) | off (long ride done early) | 4.33 | 195 |

The notice reads: "Plan updated: your 150-minute ride on Thursday counts as this week's long ride. Saturday's ride
is shorter and Sunday is free." Undo restores the original Saturday and Sunday; the Thursday ride then stays an
unplanned extra ride.

## Open points seen while building the examples

- Hours: the plans average 82 to 86 % of H because of the gentle start and the recovery weeks. If the PO means H
  as the average, the start fraction and the recovery fraction must go up.
- Amateur plans never reach VO2 or sprint work unless speed is the main purpose, so plan A is easy by design.
- Recovery weeks are ceilings, not targets: with few, short allowed rides the week can be lighter than 70 %
  (plan C week 8 and week 12).
- Plan C: torque as the Q2 session in every phase keeps the muscle building purpose visible, but the endurance
  purpose then has no threshold work on Fridays. The PO may prefer torque only in Base and Build.

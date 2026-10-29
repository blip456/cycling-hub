# Cycling Hub wireframes v3 (low-fidelity, Sprint 4)

Wireframes for v0.5.0 "Training plan", part A (backlog item 3). Each file is a single self-contained HTML
page (no network needed), with the same machinery as [V2](../V2/README.md): stable screen IDs, numbered pins
with notes, a sprint tag, a feedback box per screen, open questions per section and a "Send your feedback"
section.

<!-- BEGIN plan -->

## Plan intake, Plan page and session: `plan.html`

Open `plan.html` in any browser. Notes are kept in the browser under
`cycling-hub-wireframes-v3-plan-feedback`; the feedback mail subject says "v3 plan".

Every screen has a phone layout and a desktop layout (P8). The desktop ID is the phone ID plus `d` (for
example `T5` and `T5d`); phone pins are `1`, desktop pins `D1`. Desktop screens use the recommended menu
(option A). Status cards follow P12 (bottom of the page) and P31 (bottom of the side menu on desktop).
Everything is gray except the training zones, which use the real `--zone-1` to `--zone-7` tokens (light
theme); a zone always shows its number and name as text. Numbers are illustrative (FTP 250 W, maximum
heart rate 188 bpm, as in the Sprint 3 zones). The intake screens draw a plan about to be built (start
Mon 2 Nov 2026); the plan screens draw a plan in week 5 of 12.

| ID          | Screen                                                                      | Sprint |
| ----------- | --------------------------------------------------------------------------- | ------ |
| T0a         | Menu, option A: Plan second, after Rides (recommended)                      | S4     |
| T0b         | Menu, option B: Plan after Baseline, before Settings                        | S4     |
| T0d         | Menu on desktop with the Plan page and its two tabs                         | S4     |
| T1.0        | Plan page with no plan yet (start of the intake)                            | S4     |
| T1.1        | Intake step 1: purposes, ranked (Move up / Move down), weight loss target   | S4     |
| T1.2        | Intake step 2: four level questions (amateur to semi-pro)                   | S4     |
| T1.3        | Intake step 3: hours per week, days and indoor / outdoor from the profile   | S4     |
| T1.4        | Intake step 4: start date and optional event (drawn with a date error)      | S4     |
| T2          | Intake summary, "What the plan will assume", Build my plan                  | S4     |
| T3          | Plan needs a baseline (empty state with three routes to an FTP)             | S4     |
| T4          | Plan overview: 12 weeks, phases, weekly load bar, current week              | S4     |
| T5          | Weekly view: phone list by day, desktop week grid                           | S4     |
| T6          | Today's session card at the top of the Plan page (and its other states)     | S4     |
| T7          | Session detail: steps with W and bpm, zones, why this session, variant     | S4     |
| T8a to T8d  | Session actions: menu, move, skip with confirmation, status card with Undo  | S4     |
| T9a to T9c  | Loading, load error, build in progress and build failed                     | S4     |

T1.1 to T1.4 and T2 are one stepper; T1.0 is the empty state that starts it (or T3 when there is no FTP).

### Navigation change

Side menu (P7, P48): Plan is a new item. Option A puts it second (Rides, **Plan**, Import, Weight, Profile,
Baseline, Settings); option B puts it before Settings (Rides, Import, Weight, Profile, Baseline, **Plan**,
Settings). **Recommendation: option A**, because Plan is the page opened on a training day (today's session
is on top), while Import, Weight, Profile and Baseline are set-up or occasional pages. The Plan page has two
tabs, Week (default) and Overview, each its own route.

### Open questions (also in the file)

- T0-PO1, T0-PO2: menu option, seven items.
- T1-PO1 to T1-PO9: how the level is set, weight loss target, days and indoor / outdoor in intake or
  profile, longest ride, start on a Monday, event outside the 12 weeks, taper length, replacing an existing
  plan, how many purposes.
- T3-PO1, T3-PO2: plan without an FTP, old FTP.
- T4-PO1 to T4-PO3, T5-PO1, T6-PO1, T6-PO2: load unit, default tab, weight card, rest days on the phone, two
  sessions on one day, Mark as done on the card.
- T7-PO1 to T7-PO4: watt range or target, indoor / outdoor switch, strength notes, ride mode.
- T8-PO1 to T8-PO4: move rules, skip reason, mark done without a ride, how long Undo works.
- T9-PO1, T9-PO2: unfinished intake as a draft, error card extras.

<!-- END plan -->

<!-- BEGIN adapt -->

## Adapt: profile, weight goal, re-planning, calendar and summaries (`adapt.html`)

Open `adapt.html` in any browser. Notes are kept in the browser under
`cycling-hub-wireframes-v3-adapt-feedback`; the feedback mail and copy text say "v3 adapt".

Every screen has a phone and a desktop layout (P8). The desktop ID is the phone ID plus `d` (for example
`R4` and `R4d`). Status cards follow P12 (bottom of the page) and P31 (bottom of the side menu on desktop).
Numbers are illustrative (FTP 250 W, about 75 kg). The Plan pages themselves (intake, overview, weekly
view, session detail) are drawn in the other V3 file; the plan views here are context only.

| ID           | Screen                                                                                    | Sprint |
| ------------ | ----------------------------------------------------------------------------------------- | ------ |
| R1, R1b      | Profile additions: view and edit (indoor / outdoor / both, hours, ranked purposes, level, event) | S4 |
| R2a          | Weight goal, option A: target weight and date (recommended)                               | S4     |
| R2b          | Weight goal, option B: only the trend                                                     | S4     |
| R2c          | Set the weight goal, rate above the cap (error and fix)                                   | S4     |
| R3           | Plan updated notice with See changes and Undo                                             | S4     |
| R4           | Plan changes list: what moved, why, Undo all                                              | S4     |
| R5           | Missed session: what the app does, mark as done or skipped, pick the ride                 | S4     |
| R6, R6b      | Ride matched to a session, and fixing the match                                           | S4     |
| R7, R7b      | Warning for four or more sessions without power data, and how to fix it                   | S4     |
| R8, R8b      | Event and taper on the overview, and the last-week session list                           | S4     |
| R9, R9b      | Weight and purpose reasons in the weekly view and the session detail                      | S4     |
| R10a, R10b   | Calendar export: ICS download (recommended) and subscription link                         | S4     |
| R11a to R11f | Summary for a session, a week (full example text), a month; where the buttons live; Copied | S4    |

R11d does not exist on purpose: a trailing `d` marks the desktop drawing.

### Option pairs and recommendations

- **R2a against R2b** (Q-E2-11): target weight and date, or only the trend. **Recommended: A.** It matches
  what the PO asked for, lets the plan pace the loss, and the weekly-rate cap (0.5 % of body weight, a
  working default) catches a bad date. B remains the state when no goal is set.
- **R10a against R10b** (Q-E2-10): ICS download, or subscription link. **Recommended: A for this sprint.**
  No server endpoint, no secret, no security review; the cost is downloading again after a change (the app
  says when the file is out of date).

### Open questions (also in the file)

R1-PO1 to R1-PO6 (goal text, level questions, hours range, purposes count, event distance, indoor per
session), R2-PO1 to R2-PO5 (A or B, cap size, default date, goal reached, no calories), R3-PO1, R3-PO2,
R4-PO1, R4-PO2 (undo window, silent when unchanged, per-session undo and redo, log length), R5-PO1,
R5-PO2, R6-PO1, R6-PO2, R7-PO1, R7-PO2 (when a session is missed, skipped against missed, matching
tolerance, rematching, warning window, card order), R8-PO1, R8-PO2, R9-PO1, R9-PO2 (taper length, after the
event, reason lines, weight wording), R10-PO1 to R10-PO5 (download or link, all-day or timed, description,
what to export, reminders), R11-PO1 to R11-PO6 (markdown, switch defaults, prompt line default, content of
the text, month range, quick copy).

<!-- END adapt -->

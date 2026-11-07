# Cycling Hub wireframes v2 (low-fidelity, Sprint 3)

Wireframes for v0.4.0 "Athlete profile, weight & zones", part A (backlog items 4 and 4a). Each file is a
single self-contained HTML page (no network needed), with the same machinery as
[V1](../V1/README.md): stable screen IDs, numbered pins with notes, a sprint tag, a feedback box per
screen, open questions per section and a "Send your feedback" section.

<!-- BEGIN athlete-and-weight -->

## Athlete profile and weight: `athlete.html`

Open `athlete.html` in any browser. Notes are kept in the browser under
`cycling-hub-wireframes-v2-athlete-feedback`.

Every screen has a phone layout and a desktop layout (P8). The desktop ID is the phone ID plus `d`
(for example `W2` and `W2d`). Desktop screens use the recommended menu (option A). Status cards follow P12
(bottom of the page) and P31 (bottom of the side menu on desktop).

| ID      | Screen                                                         | Sprint |
| ------- | -------------------------------------------------------------- | ------ |
| H0a     | Menu, option A: Weight and Profile are own items (recommended) | S3     |
| H0b     | Menu, option B: Weight under Profile                           | S3     |
| H1      | Athlete profile (view, section-by-section edit)                | S3     |
| H2      | Profile edit with validation error                             | S3     |
| H3      | Profile empty state                                            | S3     |
| W1a     | Weight page: log form, history with edit and delete, Undo card | S3     |
| W1b     | Weight page empty state                                        | S3     |
| W2      | Weight trend: 7-day average line and entries, range switch     | S3     |
| W3      | Weight reminder card (bottom status card, side menu on desktop) | S3    |
| W4      | Settings: reminder day and off switch                          | S3     |
| W5      | Weight error states (validation, failed save, list not loaded) | S3     |

### Navigation change

Side menu (P7): Rides, Import, **Weight**, **Profile**, Settings. Option B puts Weight on a tab inside
Profile. **Recommendation: option A**, because weight is logged often and the reminder card links to it,
while Profile is opened rarely and only needs its own item because the training plan and the baseline read
from it.

### Open questions (also in the file)

- H0-PO1: option A or B for the menu.
- H0-PO2: where Baseline and Zones sit once they exist.
- H-PO1 to H-PO3: display name elsewhere in the app, available days with hours, goal with a date.
- W-PO1 to W-PO4: default reminder day and what Not now does, 7-day average rule, numbers on the Log tab,
  reminder before What's new.

<!-- END athlete-and-weight -->

<!-- BEGIN baseline (Z screens) -->

## Baseline, guided test week and zones (`baseline.html`)

Open `baseline.html` in any browser. It is a single self-contained file (no network needed), built the same
way as V1: stable screen IDs, numbered pins (`1`) for the phone drawing and `D1` pins for the desktop
drawing, a sprint tag (`S3`), a feedback box under every screen, open questions per section, and "Send your
feedback" (email or copy). Notes are kept in the browser under `cycling-hub-wireframes-v2-baseline-feedback`.

- Scope: Sprint 3 (v0.4.0), part A. Every screen has a phone and a desktop layout. Navigation is the top bar
  with side menu (P7); status messages are cards at the bottom (P12, P31). Numbers are illustrative.
- New side-menu item **Baseline** with three tabs: Baseline, Zones, History (Z-PO1).
- Inputs are empty with a visible label above and helper text below; no eyebrow text; no glows.
- Zone colours are drawn as grays; the real tokens (`--zone-1` to `--zone-7`, heart rate zones reuse 1 to 5)
  come in the design step. A zone is never shown by colour alone: number and name are always text.

### Screen inventory

| ID  | Screen                                              | Sprint | Status |
| --- | --------------------------------------------------- | ------ | ------ |
| Z1  | Baseline overview                                   | S3     | Draft  |
| Z1b | Update baseline, choose a way                       | S3     | Draft  |
| Z2  | FTP suggestion from your rides (estimate, P41)      | S3     | Draft  |
| Z3  | Manual entry of FTP and heart rate values (P42)     | S3     | Draft  |
| Z4a | Guided test week, option A: stepper                 | S3     | Option |
| Z4b | Guided test week, option B: checklist page          | S3     | Option |
| Z5  | Test session detail                                 | S3     | Draft  |
| Z6  | Test result to baseline (20-minute and ramp rule)   | S3     | Draft  |
| Z7  | Zones: 7 power zones and 5 heart rate zones (P40)   | S3     | Draft  |
| Z8  | Baseline and zone history, FTP over time            | S3     | Draft  |
| Z9  | Empty state: no power data (P5)                     | S3     | Draft  |
| Z10 | Loading and error while reading streams             | S3     | Draft  |

### Option pair and recommendation

Z4a (stepper) against Z4b (checklist page). **Recommended: Z4b**, because the PO picks the dates (P43), there
are only two or three sessions, all dates are visible at once, and it needs less custom behaviour for keyboard
and screen reader support.

### Open questions for the PO

Z-PO1 to Z-PO12 in the file (menu item, search window for the suggestion, best effort or top three, effective
date, stepper or checklist, reminders, ramp rule and LTHR rule, targets without a baseline, heart rate zone
percentages, zone colour tokens, history row per save, partial stream failures).

<!-- END baseline (Z screens) -->

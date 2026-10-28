# Cycling Hub wireframes v2 (low-fidelity)

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

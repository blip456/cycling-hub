# Cycling Hub wireframes v1 (low-fidelity)

Open `index.html` in any browser. It is a single self-contained file (no network needed).

- Scope: **Sprint 1 · Foundation & ingestion**: sign in, ride import via JSON file, ride list, settings with
  version, "What's new" banner + page, "What's next" page. Charts, zones, FTP, plan, ride details, nutrition
  and body composition are out of scope and not drawn.
- Every screen has a stable **ID** (`A1`, `B1a`, …), numbered pins that match the notes under the screen,
  and a **sprint tag** (`S1`).
- Two alternatives are drawn side by side for the navigation (`N1a` / `N1b`) and the ride list row
  (`B1a` / `B1b`), and for the What's new banner position (`B1c` top / `B1d` bottom).
- Feedback: a box under every screen, open questions per section (for product owners / for possible end
  users), and a "Send your feedback" section that opens a pre-filled email to yoran.broodcooren@inthepocket.com (or copies
  the text). Notes are kept in the browser under `cycling-hub-wireframes-v1-feedback`.
- Inputs are drawn empty with a visible label and helper text; sample content is neutral. Numbers are
  illustrative only. Average power and average heart rate show "—" because the export file does not contain
  them yet.

## What changed since the previous version

Not applicable (first version).

## Screen inventory

### N · Navigation & app shell

| ID  | Screen                                       | Sprint | Status   |
| --- | -------------------------------------------- | ------ | -------- |
| N1a | App shell, option A: bottom tab bar          | S1     | Option   |
| N1b | App shell, option B: top bar + side menu     | S1     | Option   |

### A · Sign in & password reset

| ID  | Screen                                | Sprint | Status |
| --- | ------------------------------------- | ------ | ------ |
| A1  | Sign in                               | S1     | Draft  |
| A2  | Sign in, error                        | S1     | Draft  |
| A3  | Forgot password                       | S1     | Draft  |
| A4  | Reset link sent                       | S1     | Draft  |
| A5  | Set new password (from the email link) | S1     | Draft  |

### B · Rides (home)

| ID  | Screen                                  | Sprint | Status  |
| --- | --------------------------------------- | ------ | ------- |
| B1a | Rides, option A: card per ride          | S1     | Option  |
| B1b | Rides, option B: dense table rows       | S1     | Option  |
| B1c | Rides with What's new banner (top)      | S1     | Variant |
| B1d | Rides with What's new banner (bottom)   | S1     | Variant |
| B2  | Rides, empty (first use)                | S1     | Draft   |
| B3a | Rides, loading                          | S1     | Draft   |
| B3b | Rides, error / offline                  | S1     | Draft   |

### C · Import rides

| ID  | Screen                          | Sprint | Status |
| --- | ------------------------------- | ------ | ------ |
| C1  | Import, choose file (idle)      | S1     | Draft  |
| C2  | Import, validating and saving   | S1     | Draft  |
| C3  | Import, summary                 | S1     | Draft  |
| C4  | Import, malformed file          | S1     | Draft  |

### G · Settings & about

| ID  | Screen                     | Sprint | Status |
| --- | -------------------------- | ------ | ------ |
| G1  | Settings & about           | S1     | Draft  |
| G2  | What's new (changelog)     | S1     | Draft  |
| G3  | What's next (roadmap)      | S1     | Draft  |

### X · Desktop

| ID  | Screen                               | Sprint | Status |
| --- | ------------------------------------ | ------ | ------ |
| X1  | Rides on desktop (table)             | S1     | Draft  |
| X2  | Import on desktop (drag-over state)  | S1     | Draft  |

## Open questions

Listed per section in `index.html`:

- Navigation: `N-PO1`–`N-PO3`, `N-U1`–`N-U3`
- Sign in: `A-PO1`–`A-PO3`, `A-U1`–`A-U3`
- Rides: `B-PO1`–`B-PO5`, `B-U1`–`B-U3`
- Import: `C-PO1`–`C-PO5`, `C-U1`–`C-U3`
- Settings: `G-PO1`–`G-PO4`, `G-U1`–`G-U3`
- Desktop: `X-PO1`–`X-PO3`, `X-U1`–`X-U3`

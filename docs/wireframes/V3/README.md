# Cycling Hub wireframes v3 (low-fidelity, Sprint 4)

Wireframes for v0.5.0 "Training plan", part A. Each file is a single self-contained HTML page (no network
needed), with the same machinery as [V2](../V2/README.md): stable screen IDs, numbered pins with notes, a
sprint tag, a feedback box per screen, open questions per section and a "Send your feedback" section.

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

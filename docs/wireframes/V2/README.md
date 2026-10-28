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

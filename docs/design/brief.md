# Design brief (vibe)

The PO's answers from the design question round on 16 Oct 2026 (decision P20 in
[`../decisions.md`](../decisions.md)). Design agents start from this brief; the PO picks a direction
from the options they produce.

| Topic             | PO's choice                                                                                              |
| ----------------- | -------------------------------------------------------------------------------------------------------- |
| Overall feel      | **Calm & analytical**: a quiet instrument panel, whitespace, muted surfaces, the numbers do the talking. |
| Colour base       | **Deep & dark-first**: rich dark surfaces with a bright accent. **Near-neutral charcoal/ink, not navy**: at most a faint cool hint (P22).                    |
| Accent families   | **Blue / teal** and **green / lime** (orange avoided: it reads as Strava).                               |
| Typography        | **One clean sans-serif everywhere**, tabular numbers for metrics.                                        |
| Density (phone)   | **Balanced**: like the B1a cards, about six metrics per ride in two rows.                                |
| Shapes            | **Soft & rounded**: 12–20 px radius, pill buttons, soft shadows or glows.                                |
| Personality       | **Subtle touches**: route-shape thumbnails from the polyline, friendly empty states. **No glows or halos** (P21). No illustrations or motivational copy. |
| References        | **Apple Fitness / Health** and **Whoop / Oura**.                                                         |
| Light mode        | **Equal quality** to dark mode (used on a laptop and outdoors), not a derived inversion.                 |
| Metric colours    | **Fixed colour per metric everywhere** (e.g. power, heart rate, speed, distance), like Apple Fitness rings; reused later for charts and zones. |
| Motion            | **Subtle**: short fades and slides, numbers counting up once on the import summary; respects "reduce motion". |
| Brand             | **Keep "Cycling Hub"**, wordmark in the app font only; a minimal home-screen icon.                        |

Constraints from earlier decisions: WCAG 2.2 AA contrast in both themes, 44 px touch targets, labels
above inputs and never example values in inputs, side menu navigation (P7), phone and desktop (P8),
System / Light / Dark switch (P9), status messages as bottom cards (P12), Feature / Fix / Technical pills
(P18).

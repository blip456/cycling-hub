# Cycling Hub design V1 (high fidelity)

Open `index.html` in any browser. It is one self-contained file: no network, no fonts or images to load. The only script is the feedback box.

- Direction **C, Deep Ocean** (P29), turned into the design system in [`../DESIGN.md`](../DESIGN.md). The page inlines [`src/styles/tokens.css`](../../../src/styles/tokens.css) verbatim; every frame is built from those tokens.
- Every frame sets its own theme (`data-theme`); the page chrome follows the system theme.
- Screen IDs reuse the wireframe IDs. New: `DS1`–`DS9` (design system sheet), `B1a-month`, `C5` (import history), `B4` (ride detail), `BG1` (background comparison for Q4).
- Feedback: a box under every screen, open questions `D-PO1`–`D-PO7`, and "Send your feedback", which opens a pre-filled email to yoran.broodcooren@inthepocket.com or copies the text. Notes are kept in the browser under `cycling-hub-design-v1-feedback`.
- Inputs are drawn empty or filled with real content, never with example text inside. Numbers are illustrative.

## What changed since wireframes V1

Includes the wireframe feedback (`../../wireframes/V1/feedback-product-owner.md`) and decisions P7–P29:

- Top bar + side menu on the phone, permanent side menu on desktop (N1b, P7, P8); every screen also on desktop.
- Theme switch System / Light / Dark (P9).
- Ride cards on the phone, dense table on desktop (P10); metric order distance, moving time, avg speed, avg power, avg HR, elevation.
- Week and month views with totals, Hide commutes filter, tags as plain text (P11, P24).
- What's new and errors as bottom cards (P12, B1d, B3b).
- Import: outcome titles (P17), skipped activities listed with the reason (P14), import history (P16, C5).
- What's new with Feature / Fix / Technical labels; What's next with version, title, sprint, status, tagline (P18).
- A first ride detail (B4) with delete and confirm (P15).

## Screen inventory

| ID | Screen | Sprint | Frames |
| --- | --- | --- | --- |
| DS1–DS9 | Colour, metric colours, type, spacing / radius / elevation, buttons, inputs and controls, cards and status cards, top bar and menu, empty / loading / error | — | dark + light |
| N1b | Side menu open | S0 | phone dark, light |
| A1 | Sign in | S0 | phone dark, light; desktop dark |
| A2 | Sign in, error | S0 | phone dark, light |
| A3 | Forgot password | S0 | phone dark, light |
| A4 | Reset link sent | S0 | phone dark |
| A5 | Choose a new password (+ expired link) | S0 | phone dark, light |
| C1 | Import, choose file | S1 | phone dark, light |
| X2 | Import on desktop, drag-over | S1 | desktop dark |
| C2 | Checking and saving | S1 | phone dark |
| C3 | Import summary | S1 | phone dark (backfill); desktop light |
| C4 | File can't be imported | S1 | phone dark, light |
| C5 | Import history | S1 | phone light; desktop dark |
| G1 | Settings | S1 | phone dark, light; desktop dark |
| G2 | What's new | S1 | phone dark, light; desktop light |
| G3 | What's next | S1 | phone dark, light |
| B1a | Rides, week view (+ What's new card, B1d) | S2 | phone dark, light |
| B1a-month | Rides, month view, commutes hidden | S2 | phone light, dark |
| X1 | Rides on desktop | S2 | desktop dark (hover), light (focus) |
| B2 | Rides, empty | S2 | phone dark; desktop light |
| B3a | Rides, loading | S2 | phone dark, light |
| B3b | Rides, error | S2 | phone light, dark |
| B4 | Ride detail, first version | S2 | phone dark (top, scrolled), light (confirm delete); desktop dark |
| BG1 | Background: splash, flow lines, flat (Q4) | — | phone dark + light, desktop dark |

## Checks

- Rendered in headless Chromium at 1280 px and 390 px: no horizontal page overflow at 390 px (desktop frames scroll inside their own container on purpose).
- WCAG text contrast: every text element measured against its real background, alpha-composited; text on the splash and flow lines measured pixel by pixel (worst 5 % of background pixels). Input borders, checkbox edges and focus rings checked at 3 : 1. Result: **0 failures** in dark and light system themes at both widths.

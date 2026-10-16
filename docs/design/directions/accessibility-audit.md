# Accessibility audit — design directions V1

Checked on 16 Oct 2026 against **WCAG 2.2 level AA**, for all three directions (A Midnight Teal,
B Graphite & Lime, C Deep Ocean), dark and light. Decision P23 in [`../../decisions.md`](../../decisions.md).

## How it was checked

- **Automated, in headless Chromium:** every visible text element in the three directions is measured
  against its real (composited) background with the WCAG contrast formula. Font size and weight decide
  the threshold: normal text 4.5:1, large text (≥ 24 px, or ≥ 18.66 px bold) 3:1.
- **Non-text checks (also automated):** input boundaries, focus indicators and the selected state of
  segmented controls against their background (3:1), and the size of tappable controls (≥ 24 × 24 px).
- **Manual review:** colour is never the only cue, text is real text (not images), and motion.

## Findings and fixes

| # | WCAG criterion | Where | Problem | Fix |
| - | -------------- | ----- | ------- | --- |
| 1 | 1.4.11 Non-text contrast | All directions, input fields | Field borders were only 1.3–1.5:1 against the card, so an empty field was hard to see. | New `--input-border` token per theme, 3.4–4.7:1 (dark ≈ #6B6F77, light ≈ #858689). |
| 2 | 1.4.11 Non-text contrast | All directions, segmented controls (Week / Month, System / Light / Dark) | The selected segment differed from the track by only 1.1–1.2:1. | Selected segment gets a 1 px outline in `--input-border` (≥ 3:1). B light keeps its extra dot. |
| 3 | 1.4.11 / 2.4.7 Focus visible | B light | The focus ring used the bright lime (1.2:1 on white). | Light-mode focus uses the darker lime text colour #4D6B00 (5.6:1). |
| 4 | 2.4.7 Focus visible | C | Focus ring was 1 px. | Solid 2 px ring in all directions (no blur, P21). Contrast 5.5–15:1. |
| 5 | 1.4.3 Contrast (minimum) | C light, metric colours | Speed (4.3:1), heart rate (4.2:1) and elevation (4.2:1) were below 4.5:1 for small text. | Darkened to #257395, #B64366, #93610A (all 5.3:1 on white). |
| 6 | 1.4.3 Contrast (minimum) | C light, "positive" green (AA badges, Fix pill) | 4.4:1 on the background gradient. | Darkened to #3A7A21 (5.3:1). |

| 7 | 1.4.3 Contrast (minimum) | C light, smaller "Fix" label after the P24 cleanup | 4.1:1 at 11 px. | Text darkened to #2F6419. |

After the fixes the automated text check reports **0 failures** across all three directions (re-run after the P24 cleanup).

## Gradient splash backgrounds (P25)

Text that sits directly on the new gradient backgrounds was measured pixel by pixel (text hidden, worst
5 % of background pixels, `pixel-contrast-check.cjs`): 72 elements, **0 failures**, lowest ratio 5.5:1.

## Restraint pass (P28)

New metric colours, contrast on their surface (dark / light):

| Direction | Metric | Dark | Light |
| --------- | ------ | ---- | ----- |
| A | Avg power (gold) | #FACC15 · 11.4:1 | #806200 · 5.7:1 |
| A | Elevation (earth) | #D6A97A · 8.1:1 | #6B4A2B · 8.0:1 |
| B | Elevation (earth) | #E0B98C · 9.7:1 | #6B4A2B · 8.0:1 |
| C | Avg power (gold) | #E9CD4C · 10.8:1 | #806200 · 5.7:1 |
| C | Moving time (grey) | #C8CBD0 · 10.5:1 | #5A5F66 · 6.4:1 |
| C | Elevation (earth) | #D6A97A · 8.0:1 | #6B4A2B · 8.0:1 |

With card outlines removed, card edges are a tone step only. That is allowed (cards are not controls, 1.4.11 does not apply); input borders, focus rings and the selected segment keep their 3:1 boundaries from fixes 1–4.

Pixel check of text on the splash and smoke after this pass: 87 elements, **0 failures**, lowest ratio 5.7:1.

## Passed without changes

- **Text and muted text:** at least 5.4:1 in both themes of every direction; the main text colour 15–17:1.
- **Accent as text:** A and C pass in both themes; B lime passes in dark, and light mode uses the
  separate darker lime for text (lime itself is only a fill there, with dark text on it, 14.3:1).
- **Metric colours** in A and B: ≥ 4.5:1 on their surface in both themes.
- **Target size (2.5.8):** all buttons ≥ 44 px tall; icon buttons 44 × 44 px.
- **Use of colour (1.4.1):** every metric value always has its label and unit; pills (Feature / Fix /
  Technical, MTB, Commute) carry text; outcome cards are titled.
- **Motion (2.3.3, by design):** subtle only, and it switches off with the system "reduce motion" setting.

## To check again in the real build

- Screen-reader labels and focus order (the mockups have no real interaction yet).
- Text resize to 200 % and reflow at 320 px wide (1.4.4, 1.4.10).
- The last ride sits partly behind the bottom status card: in the app the list must stay scrollable
  (bottom padding the height of the card) so no ride is permanently hidden (2.4.11 Focus not obscured).

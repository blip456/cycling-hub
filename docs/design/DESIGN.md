# Cycling Hub design system

Direction C, **Deep Ocean** (P29). Version 1, 16 Oct 2026. Visual reference: [`V1/index.html`](V1/index.html).

| Source of truth | What it holds |
| --- | --- |
| [`src/styles/tokens.css`](../../src/styles/tokens.css) | CSS custom properties the app uses. |
| [`tokens.json`](tokens.json) | The same tokens, machine-readable (W3C design-tokens style). |
| This file | How to use them. |

Change a token in all three places, or not at all.

## 1. Principles

1. **Calm and analytical.** A quiet instrument panel: charcoal surfaces, one cobalt accent, the numbers are the loudest thing on screen.
2. **Numbers first.** Values are large, tabular and coloured per metric; labels and units are small and muted.
3. **Restraint** (P21, P22, P24, P28):
   - No glows, halos or tinted shadows. Emphasis comes from fill only; focus is a solid 2 px outline.
   - Dark surfaces are near-neutral charcoal, never navy.
   - No eyebrow text (small labels above headings). No uppercase letter-spaced labels.
   - Pills only for the Feature / Fix / Technical labels. Buttons and segmented controls are rounded rectangles; ride tags are plain text.
   - Cards have no outline and no resting shadow; they separate from the background by a tone step. Lines only in tables, lists and form fields.
   - Only the text that is needed. One sentence beats two.
4. **Equal-quality light mode**, designed as its own palette, not an inversion.
5. **Accessible by default** (P23): WCAG 2.2 AA in both themes, 44 px targets, colour is never the only cue.

## 2. Colour

Themes are set with `data-theme="dark" | "light"` on `<html>`; without it the system setting decides (System is the default, P9). The attribute also works on any nested element.

### Surfaces and text

| Token | Dark | Light | Use |
| --- | --- | --- | --- |
| `--bg` | `#111318` | `#F2F5F9` | Screen background, under the splash |
| `--surface` | `#191C22` | `#FFFFFF` | Cards, groups, table |
| `--surface-hover` | `#1E2128` | `#F7F9FC` | Hover on cards, rows |
| `--raised` | `#23262C` | `#FFFFFF` | Floating: status card, drawer, dialog; segmented thumb |
| `--fill` | `#23262C` | `#E6EAF0` | Tone step: secondary button, tiles, week rows, skeleton |
| `--fill-hover` | `#2A2E35` | `#DCE1E8` | Hover on fills |
| `--track` | `#0F1116` | `#E6EAF0` | Inset track: segmented control, progress bar |
| `--border` | `#30343B` | `#DDDFE2` | Dividers in tables and lists only |
| `--input-border` | `#6E7279` | `#74777C` | Input, checkbox and selected-segment edges |
| `--text` | `#E6EDF7` | `#171A1F` | All running text |
| `--muted` | `#A1A5AB` | `#5C6067` | Meta, units, labels of values, helper text |
| `--accent` | `#5B9BFF` | `#2457D6` | Primary action, links, active nav icon, route line |
| `--accent-hover` / `--accent-pressed` | `#7AAEFF` / `#4A88EA` | `#1D49B8` / `#193F9F` | Button states |
| `--on-accent` | `#0D1015` | `#FFFFFF` | Text on accent |
| `--accent-soft` | accent 14 % | accent 9 % | Active nav item, Feature label, drag-over |
| `--positive` / `--positive-soft` | `#8FD07A` / 12 % | `#2F6A1C` / 10 % | Success icon, Fix label |
| `--danger` / `--danger-soft` | `#FF8A80` / 12 % | `#B3261E` / 8 % | Errors, destructive text |
| `--on-danger` | `#0D1015` | `#FFFFFF` | Text on the solid confirm button |
| `--focus` | = accent | = accent | Focus ring |
| `--overlay` | `rgba(5,6,8,.6)` | `rgba(23,26,31,.36)` | Scrim behind the phone drawer and dialogs |

### Contrast (measured)

| Pair | Dark | Light | Needs |
| --- | --- | --- | --- |
| text on surface / bg | 14.5 / 15.8 | 17.4 / 16.0 | 4.5 |
| muted on surface / fill | 6.9 / 6.1 | 6.3 / 5.2 | 4.5 |
| accent on surface / fill | 6.2 / 5.5 | 6.2 / 5.1 | 4.5 |
| on-accent on accent | 6.9 | 6.2 | 4.5 |
| danger on surface | 7.5 | 6.5 | 4.5 |
| positive on surface / fill | 9.3 / 8.3 | 6.6 / 5.4 | 4.5 |
| input-border on surface / bg | 3.5 / 3.9 | 4.5 / 4.1 | 3 |
| focus on surface / bg | 6.2 / 6.7 | 6.2 / 5.6 | 3 |

On the splash, the pixel check (worst 5 % of background pixels) keeps all text ≥ 4.5 : 1 and input borders ≥ 3 : 1.

Changes from the direction file: light `--input-border` `#86888B` → `#74777C` (it fell to 2.8 : 1 on the light splash), light `--positive` `#3A7A21` → `#2F6A1C`; new `--danger`, `--fill`, `--track`, hover and pressed tokens.

### Metric colours

Fixed per metric, everywhere, in this order (P10). Never use the accent for a metric. All pass 4.5 : 1 on `--bg`, `--surface`, `--raised` and `--fill`.

| Token | Metric | Unit | Dark | Light |
| --- | --- | --- | --- | --- |
| `--m-dist` | Distance | km | `#56D2AC` | `#0D7050` |
| `--m-time` | Moving time | h | `#C8CBD0` | `#5A5F66` |
| `--m-speed` | Avg speed | km/h | `#9DD9F0` | `#1F6585` |
| `--m-power` | Avg power | W | `#E9CD4C` | `#806200` |
| `--m-hr` | Avg heart rate | bpm | `#E8728F` | `#A63A5B` |
| `--m-elev` | Elevation | m | `#D6A97A` | `#6B4A2B` |

Changed from the direction for contrast on tiles: dark heart rate `#D85A80` → `#E8728F`, light speed `#257395` → `#1F6585`, light heart rate `#B64366` → `#A63A5B`.

Rules: colour goes on the **value**, never on the label or unit. A missing value is a muted "—" with its unit. Later charts and zones reuse these colours.

## 3. Typography

**Inter** everywhere, one family (P20). Bundle it with the app (variable woff2, self-hosted; see open question D-PO7); fall back to the system UI font. Every number uses `font-variant-numeric: tabular-nums`. Nothing below 13 px.

| Token | Size / line | Weight | Tracking | Use |
| --- | --- | --- | --- | --- |
| `--fs-display` | 44 / 46 | 600 | −0.025em | The one hero number of a screen (ride distance) |
| `--fs-stat` | 32 / 36 | 600 | −0.025em | Import outcome numbers |
| `--fs-heading` | 24 / 30 | 600 | −0.015em | Desktop page title, phone screen headline, stat tiles |
| `--fs-title` | 20 / 26 | 600 | −0.01em | Top bar title, card titles |
| `--fs-body-lg` | 17 / 24 | 600 | −0.01em | Metric values on ride cards, ride name |
| `--fs-body` | 15 / 22 | 400 (buttons 600) | 0 | Text, rows, inputs, buttons, table cells |
| `--fs-caption` | 13 / 18 | 400–600 | 0 | Meta, units, helper text, labels, table header |

- Sentence case everywhere. No uppercase, no letter-spaced labels, no monospace.
- Left-aligned. Centre only the sign-in card on desktop and button labels.
- Headlines fit in two lines; cut words before shrinking type.
- Dates: `Sun 11 Oct · 08:30`, 24 h, Europe/Brussels. Thousands with a comma (`1,020`), decimals with a point, one decimal for km and km/h.

## 4. Spacing, radius, sizes

- **Spacing:** 4 px base. `--space-1 … --space-16` = 4, 8, 12, 16, 20, 24, 32, 40, 48, 64. Inside a card 12–16; between cards 10–12; between groups 20–24; page sections 32+.
- **Radius:** `--radius-sm` 8 (icon chips, skeleton bars), `--radius-md` 12 (buttons, inputs, segmented control, nav items), `--radius-lg` 16 (cards, groups, table, status card), `--radius-xl` 20 (drawer, dialogs), `--radius-full` only for change-type labels.
- **Sizes:** `--target-min` / `--control-h` 44, `--row-h` 52, `--table-row-h` 44, `--topbar-h` 56, `--sidebar-w` 232, `--drawer-w` 300 (max 85 %), `--content-max` 1120, `--form-max` 400.

## 5. Elevation

Three tone steps: `--bg` → `--surface` → `--raised` / `--fill`. That is the hierarchy.

- `--shadow` is `none`: nothing at rest has a shadow (P28).
- `--shadow-raised` (= `--shadow-float`) only on what floats above the page: bottom status card, phone drawer, dialogs, menus. Neutral black, never tinted.

## 6. Background

- **Default: gradient splash** (P25). `--page` (= `--splash`) layers three large radial fields (accent, distance colour, accent; 18/13/8 % dark, 16/12/7 % light) over `--bg`. Put it on the screen root only, never on a single element, and keep cards opaque.
- **Flat:** `data-background="flat"` on `<html>` sets `--page` to `--bg`.
- **Flow lines** (P26, P27): soft haze plus a few thin gradient-stroke lines, as an SVG background asset. Shown in V1 (BG1); not a token yet.
- **The choice is open (Q4).** Build with `--page`, so switching later is one line.
- The top bar is transparent over the splash; once the page scrolls it gets `--bg` (solid, never blurred glass).

## 7. Iconography

- Line icons, 24 px grid, drawn at 20 px, 1.75 px stroke, round caps and joins, `currentColor`. One set (Lucide fits; the V1 icons follow its geometry).
- Icons support a label; an icon-only button needs an `aria-label` and a 44 px target.
- Default colour `--muted` in navigation, `--accent` for the active item, `--text` in the top bar.
- **Route thumbnails** (P20): the ride's polyline as a 2 px accent line on a 44 px `--fill` tile, radius 12. No map tiles in V1.
- Wordmark: "Cycling Hub" in Inter 600, `--text`, no colour split.

## 8. Motion

Subtle and short; everything works without it.

| Token | Value | Use |
| --- | --- | --- |
| `--dur-fast` | 120 ms | Hover, press, colour changes |
| `--dur-base` | 200 ms | Fades, segmented thumb, status card sliding up 16 px |
| `--dur-slow` | 320 ms | Drawer slide |
| `--dur-count` | 800 ms | Import outcome numbers count up once |
| `--ease-out` / `--ease-in-out` | `cubic-bezier(.2,.8,.2,1)` / `(.4,0,.2,1)` | |

- Animate transform and opacity only.
- Skeletons pulse slowly (1.6 s); no shimmer sweep.
- `prefers-reduced-motion: reduce` sets every duration to 0: content appears immediately, numbers show their final value, skeletons stay still.

## 9. Components

States for every interactive part: default, hover, pressed, focus-visible, disabled (and loading where it applies). Focus is always `outline: var(--focus-ring); outline-offset: var(--focus-offset)`.

### Buttons

| Variant | Fill / text | Use |
| --- | --- | --- |
| Primary | `--accent` / `--on-accent`; hover `--accent-hover`, pressed `--accent-pressed` | One per screen |
| Secondary | `--fill` / `--text`; hover `--fill-hover` | Cancel, Import another file, Copy |
| Destructive | `--fill` / `--danger`, with a trash icon | Delete ride in the page |
| Destructive confirm | `--danger` / `--on-danger` | Only inside the confirm dialog |
| Text | transparent / `--accent`; hover `--accent-soft` | Forgot password?, How do I get the file? |
| Icon | transparent / `--text`, 44 × 44; hover `--fill` | Menu, back, close, import shortcut |

Height 44, radius 12, padding 0 20, 15 px / 600. Full width on phone forms. Disabled: `--fill` with `--muted` text, `aria-disabled`. Loading: spinner icon + verb ("Saving"), button keeps its width.

### Input

- Label above (13 px / 600, `--text`), field, then helper text (13 px, `--muted`) below.
- Field: 44 high, radius 12, `--surface`, 1 px `--input-border`, 15 px text, 14 px padding.
- Hover: border `--muted`. Focus: border `--focus` + 1 px ring = 2 px solid, no blur. Error: border `--danger` + 1 px ring; the error text replaces the helper text and starts with an alert icon. Disabled: `--fill`, `--border`, `--muted` text.
- **Never an example value inside the field** (no placeholders). Password fields have a Show / Hide text button inside the field instead of a confirm field.
- Use the right `type`, `autocomplete` and `inputmode` so password managers work.

### Segmented control

`--track` container (radius 12, 3 px padding, 44 high); segments 15 px / 500 `--muted`; selected segment `--raised`, `--text` 600, with a 1 px inset `--input-border` edge (3 : 1). Used for Week / Month and System / Light / Dark. Arrow keys move the selection (radio-group semantics).

### Checkbox

20 px box, radius 6, 2 px `--input-border`; checked: `--accent` fill with an `--on-accent` check. Whole row with label is the 44 px target. Used for "Hide commutes".

### Card and group

- Card: `--surface`, radius 16, padding 16, no outline, no shadow.
- Group (settings, details): card with rows of 52 px; a 1 px `--border` divider inset 16 px between rows; a group title above it (15 px / 600). Link rows end with a muted chevron; hover `--surface-hover`.

### Ride card (phone)

Route thumbnail + name (17 px / 600, one line, ellipsis) + meta line `Sun 11 Oct · 08:30 · Road` (13 px muted; tags as plain text). Below: 3 × 2 grid of metrics in the fixed order, value 17 px / 600 in the metric colour, unit 13 px muted, label 13 px muted. Whole card is one link to the ride. Week or month header above the cards: title left (15 px / 600), totals right (13 px muted).

### Stat tile and outcome card

- Stat tile: `--surface`, label 13 px muted, value 24 px / 600 in the metric colour, unit 15 px muted.
- Import outcome card: titled by the outcome (P17: New rides, Updated, Unchanged, Not a ride, Skipped (errors), Deleted earlier), number 32 px. Only "New rides" is tinted (accent 12 % over surface).

### Table row (desktop)

- Container: `--surface`, radius 16. Header 13 px / 600 muted, unit on a second line; metric headers in their metric colour.
- Rows 44 px, 15 px tabular, 1 px `--border` between rows; numbers right-aligned, date muted, name 600.
- Week / month rows: 36 px, `--fill`, 13 px / 600, totals on the right.
- Hover `--surface-hover`; keyboard focus: 2 px focus outline inset; the row opens the ride.

### Side menu and top bar

- **Phone (< 960 px):** top bar 56 px: menu button, page title (20 px / 600), one page action on the right (Import on Rides). The menu is a drawer from the left (`--raised`, radius 0 20 20 0, float shadow, `--overlay` scrim); closes on scrim tap, swipe left, Escape or choosing an item; focus is trapped inside; the page behind is `inert`.
- **Desktop (≥ 960 px):** permanent side menu 232 px on the page background: wordmark, items, version at the bottom.
- Nav item: 44 px, radius 12, icon + label 15 px. Hover `--fill`. Active: `--accent-soft` fill, label 600, icon `--accent`, `aria-current="page"`.

### Bottom status card (P12)

- `--raised`, radius 16, float shadow, min height 56, 12 px from the sides and 16 px from the bottom on the phone; bottom-right, 420 px wide on desktop.
- Info (What's new): accent dot, one line of text, an action ("What's new"), close button. `role="status"`.
- Error (load failed, no connection): danger alert icon, message, "Try again". `role="alert"`. No offline mode.
- The page keeps bottom padding equal to the card height so nothing stays hidden behind it (2.4.11).

### Change-type labels (P18)

Pills, 24 px high, radius full, 13 px / 500: **Feature** `--accent-soft` / `--accent`, **Fix** `--positive-soft` / `--positive`, **Technical** `--fill` / `--muted`. In What's new each change is one row: label column (84 px) + text.

### Empty, loading, error

- **Empty:** 56 px `--fill` icon tile with an accent line icon, a title (24 px), one sentence, one primary action and an optional text button. No illustrations, no motivational copy.
- **Loading:** skeleton cards shaped like the real content in `--fill`; screen-reader text "Loading rides"; never a spinner-only screen.
- **Form error:** a `--danger-soft` notice with an alert icon above the form, announced with `role="alert"`; field errors under the field.
- **Page error:** the bottom status card (error variant).
- **Import file error (C4):** danger icon + headline, "Nothing was changed.", a card with the reason, then Choose another file and Copy error details.

## 10. Layout

| | Phone (< 960 px) | Desktop (≥ 960 px) |
| --- | --- | --- |
| Navigation | Top bar + drawer | Permanent side menu, 232 px |
| Margins | 16 px | 32 px around the content |
| Content | One column, full width | Up to 1120 px; forms and settings 400–560 px; ride detail two columns (route + details left, metrics right) |
| Rides | Cards (B1a) | Dense table (X1) |
| Import | Tap the file card | Drop anywhere on the page, or choose |
| Primary action | Top bar icon or full-width button | In the page header, right-aligned |
| Status card | Bottom, full width minus 12 px | Bottom right, 420 px |

- Tablets between 600 and 959 px use the phone layout with content up to 640 px wide, centred.
- Safe areas: respect `env(safe-area-inset-*)` for the top bar, drawer and status card in the installed PWA.
- Reflow at 320 px wide and 200 % text without horizontal scrolling (the desktop table is not shown below 960 px).

## 11. Accessibility rules

- Contrast as in section 2; check every new colour pair, including text on the splash.
- Targets ≥ 44 × 44 px; at least 8 px between adjacent targets.
- Visible focus on everything interactive: 2 px solid `--focus`, 2 px offset. Never remove outlines without this replacement.
- Colour is never the only cue: metric values always have a label and unit; errors have an icon and text; the selected segment has an edge and weight change; outcome cards are titled.
- Semantic HTML: real `button`, `a`, `label for`, `table` with `th scope`, headings in order, landmarks (`nav`, `main`).
- Live regions: form errors `role="alert"`; import progress `role="progressbar"` with values; status cards `role="status"` / `role="alert"`.
- Motion respects `prefers-reduced-motion`.
- The drawer and dialogs trap focus, close on Escape and return focus to the trigger.

## 12. Do and don't

| Do | Don't |
| --- | --- |
| Separate surfaces with a tone step | Put 1 px outlines or resting shadows on cards |
| Use the accent for the one primary action and links | Use the accent as a metric colour or a decoration |
| Colour the value in its metric colour | Colour labels, units or whole cards per metric |
| Put information in the heading or first sentence | Add eyebrow labels, uppercase tags or "New ·" chips |
| Show ride tags as plain text in the meta line | Turn tags, statuses or filters into pills |
| Use a solid 2 px focus outline | Use glows, halos, blurred or tinted focus shadows |
| Keep status messages in the bottom card | Show banners at the top or toasts that cover content |
| Label above, helper below, empty field | Put example values or hints inside inputs |
| Show "—" with the unit when a value is missing | Hide the column or show 0 |
| Write one short sentence | Explain what the UI already shows |
| Keep the splash on the screen background | Attach a gradient to a button, card or icon |

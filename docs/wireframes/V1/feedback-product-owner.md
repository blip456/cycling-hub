# Product Owner feedback: Yoran

|                |                                                              |
| -------------- | ------------------------------------------------------------ |
| **Role**       | Product Owner (also the only end user)                       |
| **Reviewer**   | Yoran                                                        |
| **Wireframes** | V1 (`docs/wireframes/V1/index.html`)                         |
| **Received**   | 16 Oct 2026, via the feedback email from the wireframes page |
| **Status**     | Recorded. Processing notes below; decisions pending PO confirmation of the points in note 4. |

The feedback below is recorded **verbatim** (typos included; never edit the reviewer's words). Screen IDs
(e.g. `N1b`) and question IDs (e.g. `N-PO1`) refer to the wireframes page. Processing notes are kept
separately at the bottom of this file.

```text
Subject: Cycling Hub wireframes v1 - feedback

Feedback on the Cycling Hub wireframes (v1):

SCREENS
- B1a: This option looks better
- B1b: Do not like this, go for option B1a
- B1d: Good implement like this. Make banner a bit like a card
- B2: OK, import rides should bring you to the 'import page'
- B3a: OK
- B3b: move the error/offline to the bottom like a card. Just how you do it for the "there is an update"
- C1: OK
- C2: OK
- C3: 233
  added to your rides
  => in your example, what is in this card actually? if it is new rides, the title should reflect this.
- C4: OK
- G1: Perfect
- G2: Perfect
- G3: Perfect

OPEN QUESTIONS
- N-PO1 Bottom tab bar (N1a) or top bar + side menu (N1b)? Keep in mind that charts, zones, plan, nutrition and body composition come later.
  > Go for side menu N1B - there will be indeed more menu items in the future.
  > Also keep in mind that desktop support is a MUST
- N-PO2 Should Import be its own destination, or only an action button on the Rides page?
  > Own destination
- N-PO3 Dark mode: follow the phone setting only, or also a manual Light / Dark switch in Settings (G1)?
  > Both dark, light and also system as modes
- N-U1 Which of N1a and N1b feels more natural when you open the app right after a ride?
  > N1B
- N-U2 Do you mostly use your phone one-handed when you check your rides?
  > Phone one handed
- N-U3 Will you install the app on your home screen, or open it in the browser?
  > App on homescreen, but i will also use the app on a desktop
- A-PO1 How long should you stay signed in on a device: until you sign out, or sign in again after e.g. 30 days?
  > 30 days
- A-PO2 After a password reset, sign in automatically (A5 → B1) or go back to the sign-in screen?
  > Whatever is the default of supabase
- A-PO3 Do you want a passkey / Face ID sign-in later, or is email + password with the password manager enough?
  > Password + email is enough
- A-U1 Do you use a password manager on your phone and laptop?
  > Yes
- A-U2 On which devices will you use the app: phone, laptop, both?
  > Both
- A-U3 Would a magic link by email (no password) be easier for you than a password?
  > Password email is fine
- B-PO1 Which order of metrics do you want in a ride? Proposed: distance, moving time, average speed, elevation, average power, average heart rate.
  > distance - moving time - average speed - average power - average heart rate - elevation
  > Optional: check also if weather info can be added (temperature, wind speed and wind direction)
- B-PO2 Should rides be grouped by week with weekly totals (km, moving time) in the list, as the dashed week headers in B1a?
  > Week is good - but allow for month view too
- B-PO3 Average power and heart rate are not in the file yet: show the columns with “—” now (as drawn) or hide them until the extension exports them?
  > Show as - indeed
- B-PO4 Show tags for MTB, commute and indoor (trainer) rides? Hide commutes from the list?
  > Yes, strava tags should also appear here. commutes can be a filter (show or not)
- B-PO5 Should the app work offline with the rides from the last visit (B3b)?
  > No
- B-U1 Card per ride (B1a) or dense table rows (B1b): which one do you read faster?
  > B1b
- B-U2 Which number do you look at first after a ride?
  > average speed + power + total distance
- B-U3 Do you think in weeks (weekly km) or in months when you look back at your rides?
  > weeks and months
- C-PO1 Non-ride activities (Hike, Walk, Run, InlineSkate…): ignore them (as drawn) or store them too, hidden from the ride list, for later use?
  > Store them too in DB but dont show it
- C-PO2 For the first backfill: import everything in the file, or pick a date range (e.g. only the last 12 months)?
  > Import everything you can find from strava (the activities.json)
- C-PO3 When only a few activities in a file are broken: reject the whole file (as drawn) or import the valid ones and list the skipped ones?
  > import valid ones but give proper info what and why skipped
- C-PO4 If an activity was deleted in Strava, it simply stops appearing in new exports. Should the app ever remove it, or keep it?
  > give the option to the end user if it occurs
- C-PO5 Do you want a history of past imports (date, file, counts), or is “Last import” enough?
  > history of imports
- C-U1 Will you import from your phone, from your laptop, or both?
  > both
- C-U2 How often do you expect to import: after every ride, weekly, whenever you think of it?
  > maybe every 2 weeks or so
- C-U3 Where does the exported file end up for you (Downloads, iCloud/Drive, mailed to yourself)?
  > Just download from browser
- G-PO1 Should the What’s new banner sit at the top of the page (B1c) or at the bottom above the navigation (B1d)?
  > Bottom of the page - card style
- G-PO2 What’s new: only user-facing features and fixes, or also technical changes?
  > Both - use a different pill to indicate functional vs technical changes
- G-PO3 What’s next: show the sprint only (as drawn) or also an expected month?
  > sprint + version number is enough
- G-PO4 Is anything else needed in Settings for Sprint 1 (e.g. delete all rides, export data)?
  > Sprint 0 should be the technical and design setup:
  > - create a good design system using the same approach as the wireframes. Turn them into actual designs and publish as a new HTML so i can review the design. ask me questions so we can together find a design, colors, that we both like. Only once design is ready, the technical setup can be created with a minimum of login and bootstrapped project
  > Sprint 1 should be the entire imports + settings section of this wireframe
  > Sprint 2 should be indeed ride import, delete, export, seeing rides and ride detail. basically the entire "rides"  section from this wireframe
- G-U1 Would you read the What’s new page after an update, or only glance at the banner?
  > yes would read it
- G-U2 Do you use dark mode on your phone? At what time of day do you usually open a training app?
  > follow device system settings
- G-U3 Is a roadmap (What’s next) motivating for you, or noise?
  > Yes it it motivating to see the (moving) roadmap
```

---

## Processing notes (not part of the feedback)

Written by the assistant, clearly separated from the verbatim feedback above.

### 1. Themes

- **Desktop is a must, not a sketch** (N-PO1, N-U3, A-U2, C-U1). Every screen needs a phone and a desktop
  layout; desktop gets a permanent side menu, phone the top bar + side menu (N1b).
- **Bottom cards for status messages** (B1d, B3b, G-PO1): the What's new banner and the error/offline
  message share one card style at the bottom of the page.
- **Week and month views** of rides with totals (B-PO2, B-U3).
- **Store everything, show only rides** (C-PO1, C-PO2): every activity from the file is stored, non-rides
  are hidden.
- **Forgiving import with clear reporting** (C-PO3, C-PO5): import the valid activities, say what was
  skipped and why, keep a history of imports.
- **The roadmap matters** (G-PO2, G-PO3, G-U1, G-U3): What's new shows functional and technical changes
  with different pills; What's next shows sprint + version.
- **New sprint order** (G-PO4): Sprint 0 = design system + technical setup (login, bootstrapped project);
  Sprint 1 = import + settings sections; Sprint 2 = rides section (list, detail, delete, export).

### 2. Conflicts and inconsistencies

| Topic                           | Where                     | What was said                                                                                                         |
| ------------------------------- | ------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Ride row: card or dense rows    | B1a, B1b vs B-U1          | Screens: "B1a looks better … go for option B1a". Question B-U1 ("which one do you read faster?"): "B1b".             |
| Malformed file changes nothing  | Kickoff brief vs C-PO3    | Brief acceptance criterion: "A malformed file shows a clear error and changes nothing". C-PO3: import the valid ones. |
| Non-ride activities             | Decision P4 vs C-PO1      | P4 (15 Oct): ignore other sports. C-PO1: store them in the database, don't show them.                                 |
| Backfill depth                  | Decision P3 vs C-PO2      | P3: about 2 years. C-PO2: everything in the file (the sample goes back to 2014).                                      |
| Theme setting                   | N-PO3 vs G-U2             | N-PO3: System / Light / Dark modes. G-U2: follow device settings. Compatible: System is the default, manual override possible. |
| Sprint content                  | Kickoff brief vs G-PO4    | Brief: Sprint 1 = foundation + import + ride list + release pages. G-PO4: Sprint 0 = design + setup, Sprint 1 = import + settings, Sprint 2 = rides. |

### 3. Questions left open

- **X-PO1–X-PO3, X-U1–X-U3** (desktop) not answered; partly covered by "desktop support is a MUST".
- **C3**: the PO asks what the "233 added to your rides" card is. Answer: it counts *new* rides; the card
  title becomes "New rides" in V2.
- **Weather** (B-PO1, optional): needs discovery. The export has no weather; it could come from a free
  historical weather API using the ride's start time and location. Parked for later until confirmed.
- **Strava tags** (B-PO4): the current export only has `commute` and `trainer`; other tags (race, long
  run, workout type, gravel) need export format v2 (open question Q1 in `decisions.md`).
- **Deleted activities** (C-PO4): with small "last 5" files the app can't tell a deleted ride from one
  that is simply older than the file. Detection only works when a file says it is a complete export (or
  covers an explicit date range).

### 4. Suggested decisions (to confirm with the PO before they land in `decisions.md`)

1. Ride row: B1a (cards) on phone, a dense table (X1) on desktop. Resolves the B1a/B-U1 conflict.
2. Partial import (C-PO3) supersedes the brief's "changes nothing": valid activities are saved; broken ones
   are listed with the reason. A file that isn't a valid export at all (not JSON, wrong structure) still
   changes nothing.
3. C-PO1 supersedes P4: every activity is stored; only cycling types are shown.
4. C-PO2 refines P3: the backfill imports the whole file.
5. Deleted activities are detected only on files marked as complete exports; the app then asks per
   activity whether to keep or remove it.
6. What's new pills: "Feature" / "Fix" for functional changes, "Technical" for the rest
   (chore, ci, refactor, build, docs, test, perf).
7. Session length: sign in again after 30 days (A-PO1). Supabase's own session time-box is a paid-plan
   feature, so on the free plan the app enforces it itself (sign out when the last sign-in is older than
   30 days). Password reset follows the Supabase default (A-PO2): the reset link signs you in and you set a
   new password.
8. Sprint plan per G-PO4: Sprint 0 design system + technical setup (v0.1.0), Sprint 1 import + settings,
   Sprint 2 rides. The rides list moves out of the first build sprint.

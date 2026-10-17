# Product Owner feedback: Yoran

|                |                                                         |
| -------------- | ------------------------------------------------------- |
| **Role**       | Product Owner (also the only end user)                  |
| **Reviewer**   | Yoran                                                   |
| **Design**     | V1, Deep Ocean (`docs/design/V1/index.html`)            |
| **Received**   | 17 Oct 2026, in the Claude session                      |
| **Status**     | Processed: decisions P30–P36 in `docs/decisions.md`.    |

The feedback below is recorded **verbatim**. Question IDs refer to the design page (D-PO1…D-PO7).

```text
Design review: your feedback on the screens, plus the 7 questions on the page:
	•	Q4: which background (gradient splash, flow lines or flat)? => splash
	•	Where the What's new card sits on desktop. => same banner style at the bottom but inside the side banner. So the width the the left banner and inside of it.
	•	Whether the adjusted colours still feel right. => yes
	•	Whether failed imports should appear in the import history. => yes
	•	Whether the ride detail needs a map or just the route shape. => no map. I’m not rebuilding Strava. Shape is enough. App purpose and focus is on getting tailored training plan and analyzing via LLM or AI past training sessions
	•	Whether the desktop table should be sortable. => yes sortable and filter
	•	Whether to ship the Inter font with the app (about 100 kB) or use the system font. => ship font
```

---

## Processing notes (not part of the feedback)

| Question | Decision | Where it lands |
| -------- | -------- | -------------- |
| D-PO1 Background | Gradient splash; flow lines and flat dropped as options (P30, closes Q4) | Design V1, tokens (`--page`), app |
| D-PO2 Desktop What's new card | Bottom card inside the permanent side menu, menu width (P31) | Design V1, Sprint 1 build |
| D-PO3 Adjusted metric colours | Approved (P32) | tokens.css as is |
| D-PO4 Failed imports in history | Yes, shown as "Not imported" (P33) | Sprint 1 |
| D-PO5 Ride detail map | No map, route shape only (P34); product focus on plans and AI analysis | Sprint 2, roadmap |
| D-PO6 Desktop table | Sortable and filterable (P35) | Sprint 2 |
| D-PO7 Font | Ship Inter, self-hosted (P36) | App (Sprint 0) |

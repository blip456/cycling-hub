import { describe, expect, it } from "vitest";
import {
  ALL_OFF,
  ALL_ON,
  AUTO_MATCH,
  context,
  GOALS,
  MADE_AT_MONTH,
  MONTH_INPUT,
  MONTH_WEIGHT,
  ride,
  SAT_RIDE,
  SAT_SESSION,
  session,
  SESSION_INPUT,
  THRESHOLD_STEPS,
  WEEK_INPUT,
} from "./fixtures";
import monthBare from "./golden/month-bare.txt?raw";
import monthFull from "./golden/month-full.txt?raw";
import sessionBare from "./golden/session-bare.txt?raw";
import sessionFull from "./golden/session-full.txt?raw";
import weekBare from "./golden/week-bare.txt?raw";
import weekFull from "./golden/week-full.txt?raw";
import { DEFAULT_PROMPT_LINES, summarizeMonth, summarizeSession, summarizeWeek } from "./index";
import type { SessionSummaryInput, SummaryOptions, WeekSummaryInput } from "./types";

const monthContext = () => context({ madeAt: MADE_AT_MONTH, weight: MONTH_WEIGHT });
const withPrompt = (kind: keyof typeof DEFAULT_PROMPT_LINES): SummaryOptions => ({
  ...ALL_ON,
  promptLine: DEFAULT_PROMPT_LINES[kind],
});

function blocks(text: string): string[] {
  return text
    .split("\n")
    .filter((l) => l.startsWith("## "))
    .map((l) => l.slice(3));
}

describe("golden summaries (wireframe R11, markdown headings, plain lists)", () => {
  it("session, everything on", () => {
    expect(`${summarizeSession(SESSION_INPUT, context(), withPrompt("session"))}\n`).toBe(
      sessionFull,
    );
  });
  it("session, everything off", () => {
    expect(`${summarizeSession(SESSION_INPUT, context(), ALL_OFF)}\n`).toBe(sessionBare);
  });
  it("week, everything on", () => {
    expect(`${summarizeWeek(WEEK_INPUT, context(), withPrompt("week"))}\n`).toBe(weekFull);
  });
  it("week, everything off", () => {
    expect(`${summarizeWeek(WEEK_INPUT, context(), ALL_OFF)}\n`).toBe(weekBare);
  });
  it("month, everything on", () => {
    expect(`${summarizeMonth(MONTH_INPUT, monthContext(), withPrompt("month"))}\n`).toBe(monthFull);
  });
  it("month, everything off", () => {
    expect(`${summarizeMonth(MONTH_INPUT, monthContext(), ALL_OFF)}\n`).toBe(monthBare);
  });
  it("is plain text: no emoji, no table syntax", () => {
    for (const text of [sessionFull, weekFull, monthFull]) {
      expect(text).not.toMatch(/\p{Extended_Pictographic}/u);
      expect(text).not.toContain("|");
      expect(text).not.toContain("\r");
    }
  });
});

describe("switches", () => {
  it("weight off removes only the Weight block", () => {
    const full = summarizeWeek(WEEK_INPUT, context(), ALL_ON);
    const off = summarizeWeek(WEEK_INPUT, context(), { ...ALL_ON, includeWeight: false });
    expect(blocks(full)).toContain("Weight");
    expect(blocks(off)).toEqual(blocks(full).filter((b) => b !== "Weight"));
    expect(off).not.toContain("Target path");
  });
  it("goals off removes only the Goals block", () => {
    const full = summarizeMonth(MONTH_INPUT, monthContext(), ALL_ON);
    const off = summarizeMonth(MONTH_INPUT, monthContext(), { ...ALL_ON, includeGoals: false });
    expect(blocks(off)).toEqual(blocks(full).filter((b) => b !== "Goals"));
    expect(off).not.toContain("Winter sportive");
  });
  it("the prompt line goes first, then a blank line, then the title", () => {
    const text = summarizeSession(SESSION_INPUT, context(), ALL_ON);
    expect(text.startsWith("Analyse this, please.\n\n# Session: Long ride")).toBe(true);
  });
  it("a blank or null prompt line is left out; line breaks are normalised", () => {
    const bare = summarizeSession(SESSION_INPUT, context(), ALL_OFF);
    expect(summarizeSession(SESSION_INPUT, context(), { ...ALL_OFF, promptLine: "  \n " })).toBe(
      bare,
    );
    const text = summarizeSession(SESSION_INPUT, context(), {
      ...ALL_OFF,
      promptLine: "Line one\r\nLine two\r\n",
    });
    expect(text.startsWith("Line one\nLine two\n\n# Session")).toBe(true);
  });
  it("the default instruction lines differ per kind", () => {
    expect(new Set(Object.values(DEFAULT_PROMPT_LINES)).size).toBe(3);
  });
});

describe("session summary, missing data", () => {
  const base = (patch: Partial<SessionSummaryInput>): SessionSummaryInput => ({
    ...SESSION_INPUT,
    ...patch,
  });
  it("says there is no power or heart rate data for a ride without them", () => {
    const text = summarizeSession(
      base({ ride: ride({ id: "r", date: "2026-10-24", movingMinutes: 100 }), match: null }),
      context(),
      ALL_OFF,
    );
    expect(text).toContain("## Power (FTP 250 W)\n- No power data for this ride.");
    expect(text).toContain("## Heart rate\n- No heart rate data for this ride.");
    expect(text).toContain("## Done\n- 100 min.");
    expect(text).not.toContain("Matched to this session");
  });
  it("a missed session has no ride blocks", () => {
    const text = summarizeSession(
      base({ session: { ...SAT_SESSION, status: "missed" }, ride: null, match: null }),
      context(),
      ALL_OFF,
    );
    expect(text).toContain("## Done\n- Missed, no ride.");
    expect(blocks(text)).toEqual(["Plan", "Done"]);
  });
  it("a session still to do and a skipped one", () => {
    const todo = summarizeSession(
      base({ session: { ...SAT_SESSION, status: "planned" }, ride: null, match: null }),
      context(),
      ALL_OFF,
    );
    expect(todo).toContain("- Not done yet.");
    const skipped = summarizeSession(
      base({ session: { ...SAT_SESSION, status: "skipped" }, ride: null, match: null }),
      context(),
      ALL_OFF,
    );
    expect(skipped).toContain("- Skipped.");
  });
  it("a ride that is not in the plan", () => {
    const text = summarizeSession(
      { session: null, ride: SAT_RIDE, match: null, week: null },
      context(),
      ALL_OFF,
    );
    expect(text.startsWith("# Ride: Sat 24 Oct 2026\n")).toBe(true);
    expect(text).toContain("## Plan\n- Not part of the plan (an extra ride).");
  });
  it("nothing at all gives a short text", () => {
    const text = summarizeSession(
      { session: null, ride: null, match: null, week: null },
      context(),
      ALL_ON,
    );
    expect(text).toContain("# Ride: date unknown");
    expect(text).toContain("- No ride data.");
  });
  it("lists the steps of a structured session and the match flags", () => {
    const threshold = session({
      id: "t",
      date: "2026-10-20",
      title: "Threshold 3 x 10 min",
      minutes: 75,
      status: "done",
      description: "threshold intervals",
      target: { zone: 4, watts: { min: 238, max: 263 }, bpm: null },
      steps: THRESHOLD_STEPS,
    });
    const text = summarizeSession(
      base({
        session: threshold,
        ride: ride({ id: "r", date: "2026-10-21", movingMinutes: 60 }),
        match: { by: "manual", flags: ["short", "easier"], shortByMinutes: 15 },
      }),
      context(),
      ALL_OFF,
    );
    expect(text).toContain("- Planned: 75 min threshold intervals in zone 4, 238 to 263 W.");
    expect(text).toContain(
      [
        "- Steps:",
        "  - 15 min Warm-up, 50 to 70 % FTP, 125 to 175 W, zone 1 to 2",
        "  - 3 x 10 min Threshold, 95 to 105 % FTP, 238 to 263 W, zone 4, 156 to 168 bpm",
        "  - 2 x 5 min Rest, 50 % FTP, 125 W, zone 1",
        "  - 10 min Cool-down, 50 % FTP, 125 W, zone 1",
      ].join("\n"),
    );
    expect(text).toContain(
      "- Matched to this session by hand: 1 day later, 80 % of the planned time. Flagged: short by 15 min, easier than planned.",
    );
  });
  it("leaves out zone lines without an FTP or heart rate reference", () => {
    const text = summarizeSession(
      SESSION_INPUT,
      context({ ftp: null, lthr: null, maxHr: null }),
      ALL_OFF,
    );
    expect(text).toContain("## Power\n");
    expect(text).not.toContain("Power zones");
    expect(text).not.toContain("Heart rate zones");
  });
});

describe("weight and goals text", () => {
  it("says so when there are no weigh-ins", () => {
    const text = summarizeWeek(WEEK_INPUT, context({ weight: [] }), ALL_ON);
    expect(text).toContain("## Weight\n- No weight entries yet.");
  });
  it("does not present an old weigh-in as the current trend", () => {
    const text = summarizeWeek(
      WEEK_INPUT,
      context({ weight: [{ date: "2026-08-01", kg: 77 }] }),
      ALL_ON,
    );
    expect(text).toContain(
      "- No weigh-in in the last 14 days. Last 7-day average 77.0 kg on 1 Aug.",
    );
    expect(text).not.toContain("Target path");
  });
  it("says when there are too few weigh-ins for a trend", () => {
    const text = summarizeWeek(
      WEEK_INPUT,
      context({ weight: [{ date: "2026-10-24", kg: 75.2 }] }),
      ALL_ON,
    );
    expect(text).toContain("- 7-day average 75.2 kg. Not enough weigh-ins for a 4-week trend.");
  });
  it("describes a rising and a steady trend, and a gain target without a cap", () => {
    const rising = summarizeWeek(
      WEEK_INPUT,
      context({
        weight: [
          { date: "2026-09-26", kg: 70 },
          { date: "2026-10-24", kg: 71.12 },
        ],
        goals: { ...GOALS, targetWeightKg: 74 },
      }),
      ALL_ON,
    );
    expect(rising).toContain("Up 0.28 kg a week over the last 4 weeks.");
    expect(rising).toContain("- Target path needs a gain of 0.41 kg a week.");
    expect(rising).not.toContain("cap");
    const steady = summarizeWeek(
      WEEK_INPUT,
      context({
        weight: [
          { date: "2026-09-26", kg: 75 },
          { date: "2026-10-24", kg: 75 },
        ],
      }),
      ALL_ON,
    );
    expect(steady).toContain("Steady over the last 4 weeks.");
  });
  it("no goals in the profile", () => {
    const text = summarizeMonth(MONTH_INPUT, { ...monthContext(), goals: null }, ALL_ON);
    expect(text).toContain("## Goals\n- No goals set in the profile.");
  });
  it("goals without a target or event, with the PO's own words on one line", () => {
    const text = summarizeWeek(
      WEEK_INPUT,
      context({
        goals: {
          ...GOALS,
          purposes: [],
          level: null,
          targetWeightKg: null,
          targetWeightDate: null,
          eventName: null,
          eventDate: null,
          hoursPerWeek: 5.5,
          environment: "outdoors",
          availableDays: [],
          goalText: "Ride the sportive\n  without stopping.",
        },
      }),
      ALL_ON,
    );
    expect(text).toContain(
      [
        "## Goals",
        "- Purposes: not set.",
        "- About 5.5 h a week. Rides outdoors.",
        "- In my own words: Ride the sportive without stopping.",
      ].join("\n"),
    );
  });
});

describe("week summary, empty and odd cases", () => {
  const empty: WeekSummaryInput = {
    start: "2026-10-19",
    week: null,
    records: [],
    rides: [],
    next: null,
    changes: [],
  };
  it("a week without plan and rides", () => {
    expect(summarizeWeek(empty, context({ weight: [], goals: null }), ALL_ON)).toBe(
      [
        "Analyse this, please.",
        "",
        "# Training week: Mon 19 Oct to Sun 25 Oct 2026",
        "Made on Mon 26 Oct 2026, 07:40 (Europe/Brussels).",
        "",
        "## Planned vs done",
        "- No planned sessions and no rides this week.",
        "",
        "## Power (FTP 250 W)",
        "- No rides this week.",
        "",
        "## Heart rate",
        "- No rides this week.",
        "",
        "## Time in zones",
        "- No rides this week.",
        "",
        "## Weight",
        "- No weight entries yet.",
        "",
        "## Goals",
        "- No goals set in the profile.",
      ].join("\n"),
    );
  });
  it("rides without a plan are listed as extra rides", () => {
    const text = summarizeWeek(
      {
        ...empty,
        rides: [ride({ id: "x", date: "2026-10-21", movingMinutes: 45, distanceKm: 20.1 })],
      },
      context(),
      ALL_OFF,
    );
    expect(text).toContain("- No planned sessions this week.");
    expect(text).toContain("- Wed 21 Oct: extra ride, not in the plan, 45 min, 20.1 km.");
    expect(text).toContain("- Wed: no power data.");
    expect(text).toContain("- Wed: no heart rate data.");
    expect(text).toContain("- Power: no power zone data this week.");
  });
  it("a week still in progress lists what is still to do and measures only what is due", () => {
    const text = summarizeWeek(
      {
        ...WEEK_INPUT,
        records: [
          ...WEEK_INPUT.records.slice(0, 1),
          { session: { ...SAT_SESSION, status: "planned" as const }, ride: null, match: null },
        ],
      },
      context(),
      ALL_OFF,
    );
    expect(text).toContain("- Sat 24 Oct: planned Long ride, 150 min. Still to do.");
    expect(text).toContain(
      "- Total: planned 225 min in 2 sessions, done 74 min in 1 session (99 %). Still to do: 1 session.",
    );
  });
  it("skipped sessions do not count as planned", () => {
    const text = summarizeWeek(
      {
        ...empty,
        records: [{ session: { ...SAT_SESSION, status: "skipped" }, ride: null, match: null }],
      },
      context(),
      ALL_OFF,
    );
    expect(text).toContain("Skipped.");
    expect(text).toContain("- Total: planned 0 min in 0 sessions, done 0 min in 0 sessions.");
  });
  it("writes both years when the week crosses New Year, and lists plan changes", () => {
    const text = summarizeWeek(
      {
        ...empty,
        start: "2026-12-28",
        changes: ["Week 8 repeated after a missed week.\nHours held."],
      },
      context({ madeAt: new Date(Date.UTC(2027, 0, 4, 8, 0)) }),
      ALL_OFF,
    );
    expect(text).toContain("# Training week: Mon 28 Dec 2026 to Sun 3 Jan 2027");
    expect(text).toContain("Made on Mon 4 Jan 2027, 09:00 (Europe/Brussels).");
    expect(text).toContain(
      "## Plan changes this week\n- Week 8 repeated after a missed week. Hours held.",
    );
  });
  it("shows a recovery week", () => {
    const text = summarizeWeek(
      { ...empty, week: { number: 4, of: null, phase: null, recovery: true } },
      context(),
      ALL_OFF,
    );
    expect(text).toContain("# Training week 4: ");
    expect(text).toContain("(Europe/Brussels). Recovery week.");
  });
  it("coming week without sessions", () => {
    const text = summarizeWeek(
      {
        ...WEEK_INPUT,
        next: { ...(WEEK_INPUT.next as NonNullable<WeekSummaryInput["next"]>), sessions: [] },
      },
      context(),
      ALL_OFF,
    );
    expect(text).toContain(
      "## Coming week (week 6, Mon 26 Oct to Sun 1 Nov)\n- No sessions planned.",
    );
  });
  it("a ride with a flagged match", () => {
    const flagged = WEEK_INPUT.records.map((r, i) =>
      i === 0 ? { ...r, match: { ...AUTO_MATCH, flags: ["harder"] as const } } : r,
    );
    const text = summarizeWeek({ ...WEEK_INPUT, records: flagged }, context(), ALL_OFF);
    expect(text).toContain("Done, 74 min. Flagged: harder than planned.");
  });
});

describe("month summary, empty and odd cases", () => {
  const empty = { year: 2026, month: 10, weeks: [], rides: [], changes: [] };
  it("a month without plan and rides", () => {
    expect(summarizeMonth(empty, monthContext(), ALL_OFF)).toBe(
      [
        "# Training month: October 2026 (1 to 28 Oct)",
        "Made on Wed 28 Oct 2026, 10:05 (Europe/Brussels). No plan weeks in this month.",
        "",
        "## Planned vs done",
        "- No planned sessions in this period.",
        "",
        "## Rides",
        "- No rides in this period.",
        "",
        "## Power (FTP 250 W)",
        "- No rides, so no power data.",
        "",
        "## Heart rate",
        "- No rides, so no heart rate data.",
      ].join("\n"),
    );
  });
  it("rides without a plan", () => {
    const text = summarizeMonth(
      {
        ...empty,
        rides: [ride({ id: "a", date: "2026-10-03", movingMinutes: 90, distanceKm: 30 })],
      },
      monthContext(),
      ALL_OFF,
    );
    expect(text).toContain("- No plan weeks in this period, 1 extra ride.");
    expect(text).toContain("- 1 ride, 30.0 km, 1 h 30 moving time.");
    expect(text).toContain("- Longest ride: Sat 3 Oct, 30.0 km, 90 min.");
    expect(text).toContain("- No ride has power data.");
    expect(text).toContain("- No ride has heart rate data.");
  });
  it("a month that has not started yet", () => {
    const text = summarizeMonth({ ...empty, month: 12 }, monthContext(), ALL_ON);
    expect(text).toContain("# Training month: December 2026 (not started yet)");
    expect(text).toContain("## Weight\n- No weight data yet.");
  });
  it("a finished month runs to its last day, and a month crossing nothing else", () => {
    const text = summarizeMonth({ ...empty, month: 9 }, monthContext(), ALL_OFF);
    expect(text).toContain("# Training month: September 2026 (1 to 30 Sep)");
  });
  it("counts only what falls in the month", () => {
    const text = summarizeMonth(MONTH_INPUT, monthContext(), ALL_OFF);
    expect(text).not.toContain("28 Sep");
    expect(text).toContain("Plan weeks 2 to 6 of 12.");
  });
  it("weight: one entry, no change, and stale", () => {
    const one = summarizeMonth(
      { ...empty },
      context({ madeAt: MADE_AT_MONTH, weight: [{ date: "2026-10-20", kg: 75 }] }),
      ALL_ON,
    );
    expect(one).toContain("- 7-day average: 75.0 kg on 20 Oct. 1 entry.");
    const same = summarizeMonth(
      { ...empty },
      context({
        madeAt: MADE_AT_MONTH,
        weight: [
          { date: "2026-10-01", kg: 75 },
          { date: "2026-10-20", kg: 75 },
        ],
      }),
      ALL_ON,
    );
    expect(same).toContain("(no change). 2 entries.");
    const none = summarizeMonth(
      { ...empty },
      context({ madeAt: MADE_AT_MONTH, weight: [] }),
      ALL_ON,
    );
    expect(none).toContain("## Weight\n- No weigh-ins in this period.");
  });
});

describe("robustness", () => {
  it("never throws on invalid dates, NaN and an invalid madeAt", () => {
    const bad = context({ madeAt: new Date(Number.NaN), ftp: Number.NaN, lthr: -1, maxHr: 0 });
    const badSession = session({ id: "x", date: "not a date", title: "Odd", minutes: Number.NaN });
    expect(() =>
      summarizeSession(
        {
          session: badSession,
          ride: ride({ id: "r", date: "2026-02-30" }),
          match: AUTO_MATCH,
          week: null,
        },
        bad,
        ALL_ON,
      ),
    ).not.toThrow();
    expect(() =>
      summarizeWeek(
        {
          ...WEEK_INPUT,
          start: "nope",
          records: [{ session: badSession, ride: null, match: null }],
        },
        bad,
        ALL_ON,
      ),
    ).not.toThrow();
    expect(() =>
      summarizeMonth({ year: 2026, month: 13, weeks: [], rides: [], changes: [] }, bad, ALL_ON),
    ).not.toThrow();
    expect(summarizeWeek(WEEK_INPUT, bad, ALL_OFF)).toContain("Made on an unknown date.");
  });
  it("is deterministic and does not change its input", () => {
    const before = JSON.stringify([SESSION_INPUT, WEEK_INPUT, MONTH_INPUT]);
    const a = summarizeWeek(WEEK_INPUT, context(), ALL_ON);
    const b = summarizeWeek(WEEK_INPUT, context(), ALL_ON);
    summarizeMonth(MONTH_INPUT, monthContext(), ALL_ON);
    summarizeSession(SESSION_INPUT, context(), ALL_ON);
    expect(a).toBe(b);
    expect(JSON.stringify([SESSION_INPUT, WEEK_INPUT, MONTH_INPUT])).toBe(before);
  });
  it("the time of day does not depend on the machine's zone: 07:40 in Brussels on both sides of the 25 Oct change", () => {
    const summer = summarizeWeek(
      WEEK_INPUT,
      context({ madeAt: new Date(Date.UTC(2026, 9, 24, 5, 40)) }),
      ALL_OFF,
    );
    const winter = summarizeWeek(
      WEEK_INPUT,
      context({ madeAt: new Date(Date.UTC(2026, 9, 26, 6, 40)) }),
      ALL_OFF,
    );
    expect(summer).toContain("Made on Sat 24 Oct 2026, 07:40");
    expect(winter).toContain("Made on Mon 26 Oct 2026, 07:40");
  });
});

import { describe, expect, it } from "vitest";
import type { Step } from "../engine";
import {
  formatDuration,
  formatLongDate,
  heartRateText,
  isHard,
  mainSetLine,
  moveOptions,
  moveWarnings,
  nextSession,
  phaseGroups,
  placeOf,
  spokenDuration,
  stepGroups,
  todayCard,
  weekDays,
  weekNumberOf,
  weekSpan,
  weekSummaries,
  wattsText,
} from "./model";
import { applyPatch, inversePatch } from "./patch";
import { currentWeight } from "./weight";
import { planFixture, TODAY } from "./test-support";

const { plan, sessions } = planFixture();
const DAYS = plan.intake?.availableDays ?? [];

describe("words", () => {
  it("writes durations", () => {
    expect(formatDuration(45)).toBe("45 min");
    expect(formatDuration(75)).toBe("1 h 15");
    expect(formatDuration(120)).toBe("2 h");
    expect(spokenDuration(75)).toBe("1 hour 15 minutes");
    expect(spokenDuration(120)).toBe("2 hours");
  });

  it("writes a long date", () => {
    expect(formatLongDate("2026-11-02")).toBe("Monday 2 Nov 2026");
  });
});

describe("weeks and phases", () => {
  const weeks = weekSummaries(plan, sessions);

  it("has one summary per week of the plan, from the Monday it starts", () => {
    expect(weeks).toHaveLength(12);
    expect(weeks[0]?.startDate).toBe("2026-09-28");
    expect(weeks[4]?.startDate).toBe("2026-10-26");
  });

  it("adds up minutes and load without the event", () => {
    const last = weeks[11];
    expect(last?.eventDate).toBe("2026-12-19");
    const own = (last?.sessions ?? []).filter((s) => s.kind !== "event");
    expect(last?.minutes).toBe(own.reduce((sum, s) => sum + s.durationMin, 0));
  });

  it("groups the weeks by phase with recovery weeks on their own", () => {
    const groups = phaseGroups(weeks);
    expect(groups.map((g) => g.phase)).toEqual([
      "base",
      "recovery",
      "build",
      "recovery",
      "peak",
      "taper",
    ]);
    expect(weekSpan(groups[0] ?? { phase: "base", weeks: [] })).toBe("weeks 1 to 3");
    expect(weekSpan(groups[1] ?? { phase: "base", weeks: [] })).toBe("week 4");
  });

  it("finds the week of a date, before the start and after the end", () => {
    expect(weekNumberOf(plan, TODAY)).toBe(5);
    expect(weekNumberOf(plan, "2026-09-27")).toBe(0);
    expect(weekNumberOf(plan, "2027-03-01")).toBe(13);
  });
});

describe("the days of a week", () => {
  it("lists Monday to Sunday with today marked and the training days from the plan", () => {
    const week = weekSummaries(plan, sessions)[4];
    const days = weekDays(week?.startDate ?? "", week?.sessions ?? [], DAYS, TODAY);
    expect(days.map((d) => d.weekday)).toEqual(["mon", "tue", "wed", "thu", "fri", "sat", "sun"]);
    expect(days.find((d) => d.isToday)?.date).toBe(TODAY);
    expect(days[0]?.trainingDay).toBe(false);
    expect(days[1]?.trainingDay).toBe(true);
  });
});

describe("today's card", () => {
  it("shows the open session of today", () => {
    const card = todayCard(plan, sessions, TODAY);
    expect(card.kind).toBe("session");
    if (card.kind === "session") expect(card.session.date).toBe(TODAY);
  });

  it("shows the done session once it is marked", () => {
    const done = sessions.map((s) => (s.date === TODAY ? { ...s, status: "done" as const } : s));
    expect(todayCard(plan, done, TODAY).kind).toBe("done");
  });

  it("shows a rest day with the next session", () => {
    const card = todayCard(plan, sessions, "2026-10-29");
    expect(card.kind).toBe("rest");
    if (card.kind === "rest") expect(card.next?.date).toBe("2026-10-30");
  });

  it("knows before the start and after the end", () => {
    expect(todayCard(plan, sessions, "2026-09-20")).toEqual({
      kind: "before",
      startDate: "2026-09-28",
    });
    expect(todayCard(plan, sessions, "2027-02-01").kind).toBe("after");
  });

  it("finds the next planned session", () => {
    expect(nextSession(sessions, "2026-10-29")?.date).toBe("2026-10-30");
    expect(nextSession([], "2026-10-29")).toBeNull();
  });
});

describe("moving a session", () => {
  const wednesday = sessions.find((s) => s.date === TODAY);
  if (!wednesday) throw new Error("fixture has no session today");

  it("offers the days from today to the end of the week, without its own day", () => {
    const options = moveOptions(wednesday, sessions, DAYS, TODAY);
    expect(options.map((o) => o.date)).toEqual([
      "2026-10-29",
      "2026-10-30",
      "2026-10-31",
      "2026-11-01",
    ]);
  });

  it("calls a free day that is not a training day by its name", () => {
    const thursday = moveOptions(wednesday, sessions, DAYS, TODAY)[0];
    expect(thursday?.swapWith).toBeNull();
    expect(thursday?.trainingDay).toBe(false);
    expect(thursday?.note).toBe("Free. Not one of your training days");
  });

  it("swaps with a session that is on the day", () => {
    const friday = moveOptions(wednesday, sessions, DAYS, TODAY)[1];
    expect(friday?.swapWith?.date).toBe("2026-10-30");
    expect(friday?.note).toMatch(/is planned\. The two sessions swap$/);
  });

  it("does not offer a day with a done session", () => {
    const done = sessions.map((s) =>
      s.date === "2026-10-30" ? { ...s, status: "done" as const } : s,
    );
    expect(moveOptions(wednesday, done, DAYS, TODAY).map((o) => o.date)).not.toContain(
      "2026-10-30",
    );
  });

  it("warns about a day that is not a training day", () => {
    const thursday = moveOptions(wednesday, sessions, DAYS, TODAY)[0];
    if (!thursday) throw new Error("no option");
    expect(moveWarnings(wednesday, thursday, sessions)).toContain(
      "Thursday is not one of your training days. The session is moved anyway.",
    );
  });

  const hardTemplate = sessions.find((s) => s.week === 5 && isHard(s));
  const easyTemplate = sessions.find((s) => s.week === 5 && s.kind === "endurance");
  if (!hardTemplate || !easyTemplate) throw new Error("fixture needs a hard and an easy session");
  const week = [
    { ...hardTemplate, id: "a", date: "2026-10-27" },
    { ...easyTemplate, id: "c", date: "2026-10-28" },
    { ...hardTemplate, id: "b", date: "2026-10-30" },
  ];
  const [hardA] = week;
  if (!hardA) throw new Error("no session");

  it("warns when two hard sessions would end up on back-to-back days", () => {
    const thursday = { date: "2026-10-29", swapWith: null, trainingDay: true, note: "Free" };
    expect(moveWarnings(hardA, thursday, week).join(" ")).toMatch(/back-to-back/);
  });

  it("does not warn about hard days that stay apart", () => {
    const wednesday = {
      date: "2026-10-28",
      swapWith: week[1] ?? null,
      trainingDay: true,
      note: "swap",
    };
    expect(moveWarnings(hardA, wednesday, week).join(" ")).not.toMatch(/back-to-back/);
  });
});

describe("patches", () => {
  const session = sessions[0];
  if (!session) throw new Error("no session");

  it("applies a patch and builds the patch that puts it back", () => {
    const patch = { status: "skipped" as const, date: "2026-10-30", movedFrom: session.date };
    const changed = applyPatch(session, patch);
    expect(changed).toMatchObject(patch);
    expect(applyPatch(changed, inversePatch(session, patch))).toEqual(session);
  });
});

describe("steps in words and numbers", () => {
  const work = (over: Partial<Step["target"]>, exact = false): Step => ({
    kind: "work",
    label: "Work",
    durationSec: 720,
    durationMin: 12,
    target: {
      percentFtp: 95,
      minPercent: 91,
      maxPercent: 105,
      watts: { target: 238, min: 228, max: 262 },
      powerZone: 4,
      exact,
      ...over,
    },
    heartRate: { zoneFrom: 4, zoneTo: 4, min: 151, max: 169, reference: "lthr" },
    powerLeads: false,
    cadence: null,
  });

  it("writes a watt band for outdoor and one number for indoor", () => {
    expect(wattsText(work({}))).toBe("228–262 W");
    expect(wattsText(work({}, true))).toBe("238 W");
    expect(wattsText(work({ watts: { target: 125, min: 0, max: 137 } }))).toBe("up to 137 W");
    expect(wattsText(work({ watts: { target: 300, min: 301, max: null } }))).toBe("301 W and up");
  });

  it("writes the heart rate range", () => {
    expect(heartRateText(work({}))).toBe("151–169 bpm");
    expect(heartRateText({ ...work({}), heartRate: null })).toBeNull();
  });

  it("splits a session in warm-up, main set and cool-down with repeats counted", () => {
    const warm: Step = { ...work({ powerZone: 2 }), kind: "warm-up", label: "Warm-up" };
    const rest: Step = {
      ...work({ powerZone: 1, percentFtp: 50 }),
      kind: "rest",
      durationSec: 360,
      durationMin: 6,
    };
    const cool: Step = { ...warm, kind: "cool-down", label: "Cool-down" };
    const groups = stepGroups([warm, work({}), rest, work({}), rest, work({}), cool]);
    expect(groups.map((g) => g.title)).toEqual(["Warm-up", "Main set", "Cool-down"]);
    const main = groups[1];
    expect(main?.summary).toBe("3 × 12 min");
    expect(main?.lines.map((l) => [l.step.kind, l.repeats])).toEqual([
      ["work", 3],
      ["rest", 2],
    ]);
  });

  it("writes the main set for the today card with watts and the zone as number and name", () => {
    const threshold = sessions.find((s) => s.kind === "sweet-spot" || s.kind === "threshold");
    if (!threshold) throw new Error("no quality session");
    expect(mainSetLine(threshold)).toMatch(/^Main set: \d × \d+ min at .*W \(Z\d · [A-Za-z ]+\)$/);
  });
});

describe("where a session is ridden", () => {
  const session = sessions[0];
  if (!session) throw new Error("no session");
  it("follows the plan unless the session has its own choice", () => {
    expect(placeOf({ ...session, indoor: null }, "indoor")).toBe("indoor");
    expect(placeOf({ ...session, indoor: null }, "outdoor")).toBe("outdoor");
    expect(placeOf({ ...session, indoor: null }, "both")).toBeNull();
    expect(placeOf({ ...session, indoor: true }, "outdoor")).toBe("indoor");
  });
});

describe("the weight trend", () => {
  it("gives the 7-day average and the pace per week", () => {
    const result = currentWeight(
      [
        { date: "2026-10-01", kg: 80 },
        { date: "2026-10-08", kg: 79.4 },
        { date: "2026-10-15", kg: 78.8 },
        { date: "2026-10-22", kg: 78.2 },
        { date: "2026-10-28", kg: 77.8 },
      ],
      "2026-10-28",
    );
    expect(result?.kg).toBe(78);
    expect(result?.perWeek).toBe(-0.5);
  });

  it("has no pace with less than a week of data and nothing without weigh-ins", () => {
    expect(currentWeight([{ date: "2026-10-28", kg: 78 }], "2026-10-28")?.perWeek).toBeNull();
    expect(currentWeight([], "2026-10-28")).toBeNull();
  });
});

import { describe, expect, it } from "vitest";
import type { PlanSession } from "../data";
import { candidates, manualMatch, matchFacts, matchReason } from "./matching";
import { purposesSentence, taperReason, weekReason, type WeightFacts } from "./reasons";
import type { WeightState } from "../adapt";

function session(id: string, date: string, over: Partial<PlanSession> = {}): PlanSession {
  return {
    id,
    planId: "p",
    date,
    week: 1,
    phase: "base",
    kind: "endurance",
    title: "Endurance ride",
    durationMin: 60,
    load: 40,
    qualityMin: 0,
    steps: [],
    reason: "",
    strengthNote: null,
    status: "planned",
    indoor: null,
    activityId: null,
    matchSource: null,
    movedFrom: null,
    dayOrder: 0,
    ...over,
  };
}

const ride = { id: "r1", date: "2026-10-24", movingMinutes: 142, commute: false };

describe("fixing a match", () => {
  const long = session("long", "2026-10-24", {
    kind: "long",
    title: "Long ride",
    durationMin: 150,
    activityId: "r1",
    status: "done",
    matchSource: "auto",
  });
  const recovery = session("rec", "2026-10-25", { durationMin: 45, status: "missed" });
  const taken = session("taken", "2026-10-22", { activityId: "other", status: "done" });
  const far = session("far", "2026-10-30");
  const all = [long, recovery, taken, far];

  it("offers sessions within two days, with notes", () => {
    const list = candidates(ride, all);
    expect(list.map((c) => c.session.id)).toEqual(["long", "rec", "taken"]);
    expect(list[0]?.note).toBe("2 h 30, best fit");
    expect(list[1]?.note).toBe("45 min, missed");
    expect(list[2]?.note).toBe("1 h, already has a ride");
  });

  it("locks a manual link and unlinks the old session, which is missed when its day is over", () => {
    expect(manualMatch(ride, recovery, all, "2026-10-28")).toEqual([
      { id: "long", patch: { activityId: null, matchSource: "manual", status: "missed" } },
      { id: "rec", patch: { activityId: "r1", matchSource: "manual", status: "done" } },
    ]);
  });

  it("stores a locked unlink for 'no session', planned when the day is not over", () => {
    expect(manualMatch(ride, null, all, "2026-10-24")).toEqual([
      { id: "long", patch: { activityId: null, matchSource: "manual", status: "planned" } },
    ]);
  });

  it("only locks the link when the same session is chosen", () => {
    expect(manualMatch(ride, long, all, "2026-10-28")).toEqual([
      { id: "long", patch: { activityId: "r1", matchSource: "manual", status: "done" } },
    ]);
  });

  it("words the facts and the reason", () => {
    expect(matchFacts(ride, long)).toBe("Planned 2 h 30, done 2 h 22 (95 %).");
    expect(matchReason(ride, long)).toBe(
      "Matched automatically: same day, close to the planned time.",
    );
    expect(matchReason(ride, { ...long, matchSource: "manual" })).toBe("You chose this match.");
  });
});

describe("reason lines", () => {
  const state = (over: Partial<WeightState>): WeightState => ({
    state: "faster-than-cap",
    capKgPerWeek: 0.4,
    rateKgPerWeek: 0.8,
    checks: [],
    holdWeeks: [5],
    extraEasyRideWeeks: [],
    notice: "The plan holds your training hours this week.",
    ...over,
  });
  const facts = (s: WeightState): WeightFacts => ({
    state: s,
    goal: { targetKg: 76, targetDate: "2026-12-19" },
    currentKg: 80,
    today: "2026-10-28",
  });
  const week = (n: number, minutes: number, phase: "build" | "taper" = "build") =>
    ({ number: n, minutes, phase }) as never;

  it("uses the engine's notice for the current week without repeating the trend", () => {
    const r = weekReason({
      week: week(5, 400),
      weeks: [week(5, 400)],
      isCurrent: true,
      weight: facts(state({})),
      purposes: ["weight-loss", "endurance"],
    });
    expect(r?.lines).toEqual([
      "The plan holds your training hours this week.",
      "Weight loss is your first purpose, endurance your second.",
    ]);
  });

  it("names the trend and the needed pace for another held week", () => {
    const r = weekReason({
      week: week(6, 400),
      weeks: [],
      isCurrent: false,
      weight: facts(state({ holdWeeks: [6] })),
      purposes: ["weight-loss"],
    });
    expect(r?.lines[0]).toMatch(
      /^Your weight trend is 0\.8 kg a week; your target needs 0\.\d+ kg\.$/,
    );
  });

  it("says nothing when the weight did not change the week", () => {
    expect(
      weekReason({
        week: week(2, 400),
        weeks: [],
        isCurrent: false,
        weight: facts(state({})),
        purposes: [],
      }),
    ).toBeNull();
  });

  it("explains a taper week against the heaviest week before it", () => {
    expect(taperReason(week(12, 120, "taper"), [week(10, 360)])).toBe(
      "Taper: 2 h of riding instead of 6 h. Freshness matters more than fitness this close to the event.",
    );
    expect(purposesSentence([])).toBeNull();
  });
});

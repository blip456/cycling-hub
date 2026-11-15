/**
 * The training settings and the ride history through the runner: the evaluation is built from the profile's
 * settings and from the weekly hours of the last 24 weeks, and the future sessions follow them.
 */
import { describe, expect, it } from "vitest";
import { EXAMPLE_B } from "../engine/fixtures";
import { addHistory, fakeApi, fakeDb, fakeRide } from "./fake-api";
import { buildEvaluateInput } from "./inputs";
import { createRunner } from "./runner";

const TODAY = "2026-12-03"; // Thursday of week 6

describe("buildEvaluateInput: settings and history", () => {
  it("hands the settings and the 24-week median to the plan, and the average when asked", async () => {
    const db = fakeDb(EXAMPLE_B);
    // Weekly hours of the weeks before the running week: 6, 6, 6, 2 and 20 (median 6, average 8).
    for (const [monday, hours] of [
      ["2026-11-23", 6],
      ["2026-11-16", 6],
      ["2026-11-09", 6],
      ["2026-11-02", 2],
      ["2026-10-26", 20],
    ] as const) {
      db.rides.push(fakeRide(monday, hours * 60));
    }
    db.profile = {
      ...db.profile,
      training: {
        zone2TargetPercent: 70,
        maxLongRideMin: null,
        maxWeeklyHours: 12,
        historyStat: "median",
      },
    };
    const inputs = await fakeApi(db).load();
    if (!inputs) throw new Error("no inputs");

    const median = buildEvaluateInput(inputs, TODAY);
    expect(median?.profileInput.settings).toEqual({ zone2TargetPercent: 70, maxHoursPerWeek: 12 });
    expect(median?.profileInput.adjustments?.recentAverageHours).toBe(6);

    const average = buildEvaluateInput(
      {
        ...inputs,
        profile: {
          ...inputs.profile,
          training: { ...inputs.profile.training, historyStat: "average" },
        },
      },
      TODAY,
    );
    expect(average?.profileInput.adjustments?.recentAverageHours).toBe(8);
  });

  it("leaves the history out when there are too few rides to say anything", async () => {
    const inputs = await fakeApi(fakeDb(EXAMPLE_B)).load();
    if (!inputs) throw new Error("no inputs");
    const built = buildEvaluateInput(inputs, TODAY);
    expect(built?.profileInput.adjustments).toBeUndefined();
    expect(built?.profileInput.settings).toEqual({});
  });
});

describe("the runner with a Zone 2 target", () => {
  it("rebuilds the future long rides at the chosen target and keeps the band", async () => {
    const db = fakeDb(EXAMPLE_B);
    addHistory(db, TODAY);
    db.profile = {
      ...db.profile,
      training: { ...db.profile.training, zone2TargetPercent: 72 },
    };
    const api = fakeApi(db);
    const result = await createRunner(api).run(TODAY);
    expect(result.status === "done" && result.outcome).toBe("recalculated");

    const future = api.db.sessions.filter((s) => s.date >= TODAY && s.kind === "long");
    expect(future.length).toBeGreaterThan(0);
    for (const session of future) {
      const target = session.steps[0]?.target;
      expect(target?.percentFtp).toBe(72);
      expect(target?.minPercent).toBe(56);
      expect(target?.maxPercent).toBe(75);
    }
    // Sessions that were ridden keep what they were planned with.
    const past = api.db.sessions.filter((s) => s.date < TODAY && s.kind === "long");
    expect(past.every((s) => s.steps[0]?.target.percentFtp === 65)).toBe(true);
  });
});

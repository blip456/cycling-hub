import { describe, expect, it } from "vitest";
import { buildPlan } from "./build";
import { BALANCE_CAP_FACTOR, LEVEL_SETTINGS } from "./constants";
import { inputFingerprint } from "./fingerprint";
import { EXAMPLE_A, EXAMPLE_B, EXAMPLE_C, EXAMPLE_D } from "./fixtures";
import { parseSprintSet, sessionSteps, sessionTitle, stepContext } from "./library";
import { hardMix, purposePair } from "./mix";
import { checkPlan } from "./plan-checks";
import { levelSettingsFor, normalizeSettings, settingsNotice } from "./settings";
import { INTENSITY_BALANCES, type IntensityBalance, type PlanInput } from "./types";

/** Committed, 8 h, endurance, no event: the plan where the balance has the most to change. */
const { event: _event, ...COMMITTED_INTAKE } = EXAMPLE_B.intake;
const COMMITTED_ENDURANCE: PlanInput = {
  ...EXAMPLE_B,
  intake: { ...COMMITTED_INTAKE, purposes: ["endurance"] },
};

const withBalance = (input: PlanInput, intensityBalance: IntensityBalance): PlanInput => ({
  ...input,
  settings: { intensityBalance },
});

const sprintRides = (plan: ReturnType<typeof buildPlan>) =>
  plan.sessions.filter((s) => s.kind === "endurance" && s.mainSet !== null);

describe("intensity balance: the mix (rules section 3b)", () => {
  const endurance = purposePair(["endurance"]);

  it("changes nothing for base-focused", () => {
    for (const phase of ["base", "build", "peak"] as const) {
      expect(
        hardMix({ level: "committed", purposes: endurance, phase, week: 5, balance: "base" }),
      ).toEqual(hardMix({ level: "committed", purposes: endurance, phase, week: 5 }));
    }
  });

  it("balanced adds one VO2 max session from Build, as Q2, and leaves Base alone", () => {
    const at = (phase: "base" | "build" | "peak") =>
      hardMix({ level: "committed", purposes: endurance, phase, week: 5, balance: "balanced" });
    expect(at("base").q2?.kind).toBe("sweet-spot");
    expect(at("build")).toMatchObject({ q1: { kind: "sweet-spot" }, q2: { kind: "vo2" } });
    expect(at("peak")).toMatchObject({ q1: { kind: "threshold" }, q2: { kind: "vo2" } });
  });

  it("balanced gives an amateur with one hard slot a VO2 max session every other week", () => {
    const kinds = [5, 6, 7, 9, 10, 11].map(
      (week) =>
        hardMix({
          level: "amateur",
          purposes: endurance,
          phase: week < 9 ? "build" : "peak",
          week,
          balance: "balanced",
        }).q1.kind,
    );
    expect(kinds).toEqual(["vo2", "sweet-spot", "vo2", "vo2", "threshold", "vo2"]);
  });

  it("does not stack: a speed plan that already has VO2 max keeps its mix", () => {
    const speed = purposePair(["speed"]);
    expect(
      hardMix({
        level: "committed",
        purposes: speed,
        phase: "build",
        week: 5,
        balance: "balanced",
      }),
    ).toEqual(hardMix({ level: "committed", purposes: speed, phase: "build", week: 5 }));
  });

  it("high makes Q1 VO2 max from the first week, and Q2 from Build; a sprint Q2 stays", () => {
    const at = (phase: "base" | "build" | "peak", purposes = endurance) =>
      hardMix({ level: "committed", purposes, phase, week: 1, balance: "high" });
    expect(at("base")).toMatchObject({ q1: { kind: "vo2" }, q2: { kind: "sweet-spot" } });
    expect(at("build")).toMatchObject({ q1: { kind: "vo2" }, q2: { kind: "vo2" } });
    expect(at("peak", purposePair(["speed"])).q2?.kind).toBe("sprint");
  });

  it("never overrules weight loss or muscle building where it matters most", () => {
    const weight = hardMix({
      level: "committed",
      purposes: purposePair(["weight-loss"]),
      phase: "build",
      week: 5,
      balance: "high",
    });
    expect(weight.q1.kind).toBe("sweet-spot");
    const muscle = hardMix({
      level: "committed",
      purposes: purposePair(["muscle-building"]),
      phase: "base",
      week: 1,
      balance: "high",
    });
    expect(muscle.q1.kind).toBe("torque");
  });
});

describe("intensity balance: limits and fingerprint", () => {
  it("raises the limits on hard work by the factor of the step, and nothing else", () => {
    for (const balance of INTENSITY_BALANCES) {
      const base = LEVEL_SETTINGS.committed;
      const own = levelSettingsFor("committed", { intensityBalance: balance });
      expect(own.qualityCap).toBeCloseTo(base.qualityCap * BALANCE_CAP_FACTOR[balance]);
      expect(own.aboveThresholdCap).toBeCloseTo(
        base.aboveThresholdCap * BALANCE_CAP_FACTOR[balance],
      );
      expect(own.structuredBudget).toBe(base.structuredBudget);
      expect(own.rides).toEqual(base.rides);
    }
  });

  it("is part of the fingerprint only when it is not base-focused", () => {
    const plain = inputFingerprint(EXAMPLE_B);
    expect(inputFingerprint(withBalance(EXAMPLE_B, "base"))).toBe(plain);
    const prints = [
      plain,
      ...(["balanced", "high"] as const).map((b) => inputFingerprint(withBalance(EXAMPLE_B, b))),
    ];
    expect(new Set(prints).size).toBe(3);
    expect(normalizeSettings({ intensityBalance: "base" })).toEqual({});
  });

  it("is named in the notice", () => {
    expect(settingsNotice("committed", { intensityBalance: "balanced" })?.message).toContain(
      "the intensity is balanced",
    );
    expect(settingsNotice("committed", { intensityBalance: "high" })?.message).toContain(
      "the intensity is high",
    );
  });
});

describe("intensity balance: the plan", () => {
  it("base-focused gives the same plan as no setting, with no sprint rides", () => {
    const plain = buildPlan(COMMITTED_ENDURANCE);
    const base = buildPlan(withBalance(COMMITTED_ENDURANCE, "base"));
    expect(base.sessions).toEqual(plain.sessions);
    expect(sprintRides(plain)).toHaveLength(0);
  });

  it("balanced has one sprint ride in every loading week, high has two, never on consecutive days", () => {
    for (const [balance, count] of [
      ["balanced", 1],
      ["high", 2],
    ] as const) {
      const plan = buildPlan(withBalance(COMMITTED_ENDURANCE, balance));
      for (const week of plan.weeks) {
        const rides = week.sessions.filter((s) => s.kind === "endurance" && s.mainSet !== null);
        if (week.type !== "loading") {
          expect(rides).toHaveLength(0);
          continue;
        }
        expect(rides).toHaveLength(count);
        const days = rides.map((r) => new Date(r.date).getTime() / 86_400_000);
        if (days.length === 2) expect(Math.abs((days[0] ?? 0) - (days[1] ?? 0))).toBeGreaterThan(1);
      }
    }
  });

  it("keeps a sprint ride an easy ride: not a hard day, and the sprints are a small part of its load", () => {
    const plan = buildPlan(withBalance(COMMITTED_ENDURANCE, "high"));
    for (const ride of sprintRides(plan)) {
      expect(ride.slot).toBe("easy");
      expect(ride.ladderStep).toBeNull();
      const plain = ride.steps.reduce(
        (sum, s) => sum + (s.durationSec / 3600) * 0.65 ** 2 * 100,
        0,
      );
      expect(ride.load).toBeLessThan(plain * 1.1);
    }
    for (const week of plan.weeks) expect(week.structuredCount).toBeLessThanOrEqual(2);
  });

  it("puts the sprints on the day after a hard day last", () => {
    const plan = buildPlan(withBalance(COMMITTED_ENDURANCE, "balanced"));
    const hard = new Set(
      plan.sessions.filter((s) => s.slot === "q1" || s.slot === "q2").map((s) => s.date),
    );
    const dayBefore = (date: string) =>
      new Date(new Date(date).getTime() - 86_400_000).toISOString().slice(0, 10);
    for (const week of plan.weeks.filter((w) => w.type === "loading")) {
      const easy = week.sessions.filter((s) => s.slot === "easy" && s.kind === "endurance");
      const fresh = easy.filter((s) => !hard.has(dayBefore(s.date)));
      const chosen = easy.filter((s) => s.mainSet !== null);
      if (fresh.length > 0) expect(chosen.every((s) => !hard.has(dayBefore(s.date)))).toBe(true);
    }
  });

  it("raises the VO2 max time without breaking a single plan check, for every example", () => {
    const share = (plan: ReturnType<typeof buildPlan>) => {
      const loading = plan.weeks.filter((w) => w.type === "loading");
      return (
        loading.reduce((s, w) => s + w.aboveThresholdMinutes, 0) /
        loading.reduce((s, w) => s + w.plannedMinutes, 0)
      );
    };
    for (const input of [COMMITTED_ENDURANCE, EXAMPLE_A, EXAMPLE_C, EXAMPLE_D]) {
      const shares = INTENSITY_BALANCES.map((balance) => {
        const withSetting = withBalance(input, balance);
        const plan = buildPlan(withSetting);
        expect(checkPlan(plan, withSetting)).toEqual([]);
        return share(plan);
      });
      if (input !== EXAMPLE_D) {
        expect(shares[1]).toBeGreaterThan(shares[0] ?? 0);
        expect(shares[2]).toBeGreaterThan(shares[1] ?? 0);
      }
    }
  });

  it("changes no weekly minutes: the balance changes what is ridden, not how long", () => {
    const base = buildPlan(COMMITTED_ENDURANCE);
    for (const balance of ["balanced", "high"] as const) {
      const plan = buildPlan(withBalance(COMMITTED_ENDURANCE, balance));
      expect(plan.weeks.map((w) => w.plannedMinutes)).toEqual(
        base.weeks.map((w) => w.plannedMinutes),
      );
    }
  });
});

describe("a sprint ride (rules section 7.5)", () => {
  const ctx = stepContext({ ftp: 250, indoor: false });
  const ride = (durationMin: number, set: [number, number] = [6, 8]) =>
    sessionSteps({
      kind: "endurance",
      level: "committed",
      durationMin,
      sprintRide: set,
      context: ctx,
    });

  it("is Zone 2 first, then a sprint every 4 minutes, then Zone 2 to the end", () => {
    const result = ride(75);
    expect(result.mainSet).toBe("6x8s");
    expect(result.steps.reduce((sum, s) => sum + s.durationSec, 0)).toBe(75 * 60);
    expect(result.steps[0]).toMatchObject({ kind: "easy", durationMin: 20 });
    const sprints = result.steps.filter((s) => s.kind === "work");
    expect(sprints).toHaveLength(6);
    expect(sprints.every((s) => s.durationSec === 8 && s.target.percentFtp === 150)).toBe(true);
    const rests = result.steps.filter((s) => s.kind === "rest");
    expect(rests.every((s) => s.durationSec === 4 * 60 - 8)).toBe(true);
    expect(result.steps.at(-1)).toMatchObject({ kind: "easy", durationMin: 31 });
    expect(
      result.steps.filter((s) => s.kind === "easy").every((s) => s.target.percentFtp === 65),
    ).toBe(true);
  });

  it("uses fewer sprints when the ride is short, and none when it cannot hold two", () => {
    expect(ride(45).mainSet).toBe("5x8s");
    expect(ride(35).mainSet).toBeNull();
    expect(ride(35).steps.some((s) => s.kind === "work")).toBe(false);
  });

  it("follows the Zone 2 target of the settings", () => {
    const high = sessionSteps({
      kind: "endurance",
      level: "committed",
      durationMin: 75,
      sprintRide: [6, 8],
      context: stepContext({ ftp: 250, indoor: false, zone2Percent: 72 }),
    });
    expect(
      high.steps.filter((s) => s.kind === "easy").every((s) => s.target.percentFtp === 72),
    ).toBe(true);
  });

  it("has a plain title and reads back from its main set", () => {
    expect(sessionTitle({ kind: "endurance", mainSet: "6x8s" })).toBe(
      "Endurance ride with sprints 6 x 8 s",
    );
    expect(sessionTitle({ kind: "endurance", mainSet: null })).toBe("Endurance ride");
    expect(parseSprintSet("6x8s")).toEqual([6, 8]);
    expect(parseSprintSet("3x15")).toBeNull();
    expect(parseSprintSet(null)).toBeNull();
  });
});

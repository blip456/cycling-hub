import { describe, expect, it } from "vitest";
import { canonicalInput, inputFingerprint } from "./fingerprint";
import { EXAMPLE_B, EXAMPLE_D } from "./fixtures";
import { ENGINE_VERSION, type PlanInput } from "./types";

function withIntake(input: PlanInput, patch: Partial<PlanInput["intake"]>): PlanInput {
  return { ...input, intake: { ...input.intake, ...patch } };
}

describe("inputFingerprint", () => {
  const base = EXAMPLE_B;
  const fingerprint = inputFingerprint(base);

  it("starts with the engine version and is stable", () => {
    expect(fingerprint.startsWith(`${ENGINE_VERSION}-`)).toBe(true);
    expect(inputFingerprint(structuredClone(base))).toBe(fingerprint);
    expect(canonicalInput(base)).toBe(canonicalInput(structuredClone(base)));
  });

  it("does not change with things that do not change the plan", () => {
    // Day order, a different today with the same start Monday, ranks 3 and 4, and answers inside a level.
    expect(
      inputFingerprint(withIntake(base, { availableDays: ["sun", "sat", "fri", "wed", "tue"] })),
    ).toBe(fingerprint);
    expect(inputFingerprint({ ...base, today: "2026-10-20" })).toBe(
      inputFingerprint({ ...base, today: "2026-10-26" }),
    );
    expect(
      inputFingerprint(withIntake(base, { purposes: ["speed", "endurance", "weight-loss"] })),
    ).toBe(inputFingerprint(withIntake(base, { purposes: ["speed", "endurance"] })));
    expect(
      inputFingerprint(
        withIntake(base, {
          levelAnswers: { ...base.intake.levelAnswers, experience: 3 },
        }),
      ),
    ).toBe(fingerprint);
  });

  it("changes with each input that matters", () => {
    const changed: PlanInput[] = [
      withIntake(base, { hoursPerWeek: 9 }),
      withIntake(base, { availableDays: ["tue", "wed", "fri", "sat"] }),
      withIntake(base, { purposes: ["endurance"] }),
      withIntake(base, { purposes: ["speed", "muscle-building"] }),
      withIntake(base, { environment: "outdoor" }),
      withIntake(base, { levelOverride: "amateur" }),
      withIntake(base, { event: { name: "Other", date: "2027-01-17", duration: "3-to-6h" } }),
      withIntake(base, { event: { name: "100 km ride", date: "2027-01-10", duration: "3-to-6h" } }),
      withIntake(base, {
        event: { name: "100 km ride", date: "2027-01-17", duration: "under-3h" },
      }),
      withIntake(base, { recoveryEvery: 3 }),
      withIntake(base, { ftpTest: "ramp" }),
      { ...base, ftp: 251 },
      { ...base, lthr: 166 },
      { ...base, maxHr: 190 },
      { ...base, adjustments: { holdWeeks: [6] } },
      { ...base, adjustments: { missedStructured: [{ week: 6, kind: "vo2" }] } },
      { ...base, adjustments: { recentAverageHours: 4 } },
    ];
    const seen = new Set([fingerprint]);
    for (const input of changed) seen.add(inputFingerprint(input));
    expect(seen.size).toBe(changed.length + 1);
  });

  it("includes the weight goal and the rounded start weight, not tiny differences", () => {
    const a = inputFingerprint(EXAMPLE_D);
    expect(inputFingerprint(withIntake(EXAMPLE_D, { weightKg: 86.04 }))).toBe(a);
    expect(inputFingerprint(withIntake(EXAMPLE_D, { weightKg: 85 }))).not.toBe(a);
    expect(
      inputFingerprint(
        withIntake(EXAMPLE_D, { weightGoal: { targetKg: 81, targetDate: "2027-01-17" } }),
      ),
    ).not.toBe(a);
  });

  it("matches the plan's own fingerprint", async () => {
    const { buildPlan } = await import("./build");
    expect(buildPlan(base).fingerprint).toBe(fingerprint);
  });
});

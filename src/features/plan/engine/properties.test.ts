/** Property-style tests: many generated intakes (a seeded generator, so every run is the same). */
import { describe, expect, it } from "vitest";
import { addDays, WEEKDAYS } from "@/features/athlete";
import { buildPlan } from "./build";
import { inputFingerprint } from "./fingerprint";
import { checkPlan } from "./plan-checks";
import { generateInput as generate } from "./generate-input";

const SEEDS = Array.from({ length: 400 }, (_, i) => i + 1);

describe("generated intakes", () => {
  it("pass every self-check", () => {
    const failures: string[] = [];
    for (const seed of SEEDS) {
      const input = generate(seed);
      const plan = buildPlan(input);
      const issues = checkPlan(plan, input);
      if (issues.length > 0) failures.push(`seed ${seed}: ${issues.slice(0, 3).join("; ")}`);
    }
    expect(failures).toEqual([]);
  });

  it("are deterministic: the same input gives the same plan and fingerprint", () => {
    for (const seed of SEEDS.slice(0, 120)) {
      const input = generate(seed);
      const a = buildPlan(input);
      const b = buildPlan(structuredClone(input));
      expect(b).toEqual(a);
      expect(inputFingerprint(input)).toBe(a.fingerprint);
    }
  });

  it("never plan a session on an unavailable day (openers and the event excepted)", () => {
    for (const seed of SEEDS) {
      const input = generate(seed);
      const plan = buildPlan(input);
      const allowed = new Set<string>(input.intake.availableDays);
      for (const s of plan.sessions) {
        if (s.kind === "event" || s.kind === "openers") continue;
        const day = WEEKDAYS[(new Date(s.date).getUTCDay() + 6) % 7];
        expect(allowed.has(day ?? "")).toBe(true);
      }
    }
  });

  it("have a taper and the event in the last week whenever there is a usable event", () => {
    let withEvent = 0;
    for (const seed of SEEDS) {
      const input = generate(seed);
      const plan = buildPlan(input);
      if (plan.event === null) continue;
      withEvent += 1;
      const last = plan.weeks[plan.weeks.length - 1];
      expect(last?.type).toBe("taper");
      expect(plan.sessions.at(-1)?.kind).toBe("event");
      expect(plan.sessions.at(-1)?.date).toBe(plan.event.date);
    }
    expect(withEvent).toBeGreaterThan(50);
  });

  it("use the zone code: watts follow FTP and heart rate follows the references", () => {
    for (const seed of SEEDS.slice(0, 100)) {
      const input = generate(seed);
      const plan = buildPlan(input);
      expect(plan.ftp).toBe(input.ftp);
      expect(checkPlan(plan, input).filter((m) => /watts|zone|heart/.test(m))).toEqual([]);
      const withHr = input.lthr !== undefined || input.maxHr !== undefined;
      const anyHr = plan.sessions.some((s) => s.steps.some((st) => st.heartRate !== null));
      if (!withHr) expect(anyHr).toBe(false);
    }
  });

  it("keep the plan start on a Monday and the weeks 7 days apart", () => {
    for (const seed of SEEDS.slice(0, 100)) {
      const plan = buildPlan(generate(seed));
      expect(new Date(plan.startDate).getUTCDay()).toBe(1);
      plan.weeks.forEach((w, i) => {
        expect(w.startDate).toBe(addDays(plan.startDate, 7 * i));
      });
    }
  });
});

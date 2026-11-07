/** Seeded scenarios for the property tests: the same seed always gives the same scenario. */
import { addDays, type IsoDate, type WeightEntry } from "@/features/athlete";
import { buildPlan, type Plan, type PlanInput } from "../engine";
import { generateInput } from "../engine/generate-input";
import type { EvaluateInput } from "./evaluate";
import { storeSessions } from "./test-helpers";
import type { AdaptRide, StoredSession } from "./types";

function generator(seed: number): () => number {
  let state = (seed * 2654435761) >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type Scenario = {
  plan: Plan;
  input: PlanInput;
  args: EvaluateInput;
};

export function scenario(seed: number): Scenario | null {
  const rnd = generator(seed);
  const int = (min: number, max: number): number => min + Math.floor(rnd() * (max - min + 1));
  const base = generateInput(seed);
  const plan = buildPlan(base);
  if (plan.status !== "ok" || plan.weeks.length === 0) return null;
  const today = addDays(plan.startDate, int(0, plan.weeks.length * 7 - 1)) as IsoDate;
  const stored = storeSessions(plan);
  const rides: AdaptRide[] = [];
  const sessions: StoredSession[] = stored.map((s) => {
    if (s.kind === "event" || s.date >= today) return s;
    const roll = rnd();
    const old = s.date < (addDays(today, -3) as IsoDate);
    if (roll < 0.78) {
      const ride: AdaptRide = {
        id: `r-${s.date}`,
        date: s.date,
        movingMinutes: Math.max(20, Math.round(s.durationMin * (0.75 + rnd() * 0.5))),
        avgPowerW: rnd() < 0.15 ? null : Math.round((base.ftp ?? 200) * (0.5 + rnd() * 0.5)),
      };
      rides.push(ride);
      return old ? { ...s, status: "done", activityId: ride.id, matchSource: "auto" } : s;
    }
    if (roll < 0.95) return old ? { ...s, status: "missed" } : s;
    return { ...s, status: "skipped" };
  });
  for (let i = int(0, 3); i > 0; i -= 1) {
    rides.push({
      id: `extra-${i}`,
      date: addDays(today, -int(0, 6)) as IsoDate,
      movingMinutes: int(20, 200),
      avgPowerW: rnd() < 0.2 ? null : int(90, 300),
    });
  }
  const futureIdx = sessions.findIndex((s) => s.date > today && s.kind !== "event");
  const lockIdx = rnd() < 0.3 ? futureIdx : -1;
  const locked = sessions.map((s, i) =>
    i === lockIdx ? { ...s, matchSource: "manual" as const } : s,
  );
  const weightEntries: WeightEntry[] = [];
  if (base.intake.weightKg !== undefined) {
    const slope = (rnd() * 1.3 - 0.4) / 7;
    for (let i = 0; i <= 28 + int(0, 90); i += 1) {
      const date = addDays(plan.startDate, i - 28) as IsoDate;
      if (date > today) break;
      weightEntries.push({ date, kg: base.intake.weightKg - slope * i });
    }
  }
  const input: PlanInput = rnd() < 0.3 ? { ...base, ftp: (base.ftp ?? 200) + int(-20, 30) } : base;
  return {
    plan,
    input,
    args: {
      plan: { startDate: plan.startDate },
      sessions: locked,
      rides,
      weightEntries,
      profileInput: input,
      today,
      lastFingerprint: null,
      undoneFingerprint: null,
    },
  };
}

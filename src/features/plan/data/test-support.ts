import { vi } from "vitest";
import * as baselineApi from "@/features/baseline/api";
import { HISTORY, VIEW } from "@/features/baseline/fixtures";
import * as weightApi from "@/features/weight/api";
import type { WeightEntry } from "@/features/athlete";
import { buildPlan, type Plan, type PlanInput } from "../engine";
import * as api from "./api";
import { planFromRow, sessionFromRow, sessionInserts, toJson } from "./mapping";
import type { PlanSession, StoredPlan } from "./types";

/** Today in the tests: Wednesday 28 October 2026, week 5 of the example plan (as in the wireframes). */
export const NOW = new Date("2026-10-28T10:00:00Z");
export const TODAY = "2026-10-28";
export const USER_ID = "00000000-0000-0000-0000-000000000001";

/** Committed, 8 h, endurance and speed, Tue Wed Fri Sat Sun, both indoor and outdoor; starts Mon 28 Sep, event Sat 19 Dec. */
export const PLAN_INPUT: PlanInput = {
  today: "2026-09-28",
  ftp: 250,
  lthr: 165,
  maxHr: 188,
  intake: {
    purposes: ["endurance", "speed"],
    levelAnswers: { experience: 2, weeklyHours: 2, intervals: 2, longestRide: 1, hardSessions: 1 },
    hoursPerWeek: 8,
    availableDays: ["tue", "wed", "fri", "sat", "sun"],
    environment: "both",
    startDate: "2026-09-28",
    event: { name: "Autumn sportive", date: "2026-12-19", duration: "3-to-6h" },
  },
};

export type PlanFixture = { engine: Plan; plan: StoredPlan; sessions: PlanSession[] };

/** The example plan as the data layer returns it: built by the engine, written as rows and read back. */
export function planFixture(input: PlanInput = PLAN_INPUT): PlanFixture {
  const engine = buildPlan(input);
  const base = {
    id: "plan-1",
    user_id: USER_ID,
    status: "active",
    undone_fingerprint: null,
    created_at: "2026-09-28T08:00:00Z",
    updated_at: "2026-09-28T08:00:00Z",
  };
  const plan = planFromRow({
    ...base,
    start_date: engine.startDate,
    weeks: engine.weeks.length,
    intake: toJson(input.intake),
    ftp_w: input.ftp ?? 250,
    weight_kg: null,
    engine_version: engine.engineVersion,
    input_fingerprint: engine.fingerprint,
  });
  const sessions = sessionInserts(engine).flatMap((row, i) => {
    const session = sessionFromRow({
      id: `s-${String(i)}`,
      plan_id: "plan-1",
      user_id: USER_ID,
      activity_id: null,
      match_source: null,
      moved_from: null,
      created_at: base.created_at,
      updated_at: base.updated_at,
      indoor: null,
      reason: "",
      status: "planned",
      steps: [],
      planned_load: 0,
      quality_min: 0,
      day_order: 0,
      ...row,
    });
    return session ? [session] : [];
  });
  return { engine, plan, sessions };
}

export const WEIGHTS: WeightEntry[] = [
  { date: "2026-10-14", kg: 79, note: null },
  { date: "2026-10-21", kg: 78.7, note: null },
  { date: "2026-10-28", kg: 78.4, note: null },
];

/** Makes the plan, baseline and weight API mocks answer like a healthy server. Call it after the `vi.mock` calls. */
export function mockPlanApi(fixture: PlanFixture | null = planFixture()) {
  vi.mocked(api.fetchActivePlan).mockResolvedValue(fixture?.plan ?? null);
  vi.mocked(api.fetchPlanSessions).mockResolvedValue(fixture?.sessions ?? []);
  vi.mocked(api.updateSessions).mockResolvedValue(undefined);
  vi.mocked(api.fetchPlanProfile).mockResolvedValue({
    ridingEnvironment: "both",
    weeklyHours: null,
    trainingPurposes: [],
    levelAnswers: null,
    eventName: null,
    eventDate: null,
    availableDays: ["tue", "wed", "fri", "sat", "sun"],
  });
  vi.mocked(api.savePlanProfile).mockResolvedValue(undefined);
  vi.mocked(api.fetchActiveWeightGoal).mockResolvedValue(null);
  vi.mocked(api.saveWeightGoal).mockResolvedValue(undefined);
  vi.mocked(baselineApi.fetchCurrentBaseline).mockResolvedValue({
    ...VIEW,
    lthr: 165,
    lthr_effective_date: "2026-10-11",
  });
  vi.mocked(baselineApi.fetchBaselineEntries).mockResolvedValue(HISTORY);
  vi.mocked(weightApi.fetchWeightEntries).mockResolvedValue(WEIGHTS);
}

/** The factory for `vi.mock("../data/api")`: real code, with every function that talks to Supabase replaced. */
export async function mockedApi(importOriginal: () => Promise<typeof api>) {
  const actual = await importOriginal();
  return {
    ...actual,
    fetchActivePlan: vi.fn(),
    fetchPlanSessions: vi.fn(),
    updateSessions: vi.fn(),
    createPlan: vi.fn(),
    fetchPlanProfile: vi.fn(),
    savePlanProfile: vi.fn(),
    fetchActiveWeightGoal: vi.fn(),
    saveWeightGoal: vi.fn(),
  };
}

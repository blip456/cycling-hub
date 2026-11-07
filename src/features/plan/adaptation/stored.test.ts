import { describe, expect, it } from "vitest";
import { buildPlan, type PlanInput } from "../engine";
import { EXAMPLE_A, EXAMPLE_B, EXAMPLE_C, EXAMPLE_D } from "../engine/fixtures";
import { sessionFromRow, sessionInserts } from "../data/mapping";
import type { PlanSession } from "../data";
import { toStoredSessions } from "./stored";

/** The plan as the database holds it: written as rows, read back. */
function roundTrip(input: PlanInput) {
  const plan = buildPlan(input);
  const sessions = sessionInserts(plan).flatMap((row, i): PlanSession[] => {
    const session = sessionFromRow({
      id: `s-${String(i)}`,
      plan_id: "p",
      user_id: "u",
      activity_id: null,
      match_source: null,
      moved_from: null,
      created_at: "",
      updated_at: "",
      ...row,
      indoor: row.indoor ?? null,
      reason: row.reason ?? "",
      status: row.status ?? "planned",
      steps: row.steps ?? [],
      planned_load: row.planned_load ?? 0,
      quality_min: row.quality_min ?? 0,
      day_order: row.day_order ?? 0,
    });
    return session ? [session] : [];
  });
  return { plan, stored: toStoredSessions(sessions, input.intake) };
}

describe.each([
  ["A", EXAMPLE_A],
  ["B", EXAMPLE_B],
  ["C", EXAMPLE_C],
  ["D", EXAMPLE_D],
])("example plan %s read back from rows", (_name, input) => {
  const { plan, stored } = roundTrip(input);

  it("keeps every session", () => {
    expect(stored.map((s) => s.date)).toEqual(plan.sessions.map((s) => s.date));
  });

  it("gives back the engine's session including slot, main set, ladder step and load", () => {
    const strip = (s: (typeof stored)[number]) => {
      const { id: _id, activityId: _a, matchSource: _m, movedFrom: _f, ...session } = s;
      return session;
    };
    const engine = plan.sessions.map((s) => (s.kind === "event" ? { ...s, indoor: false } : s));
    expect(stored.map(strip)).toEqual(engine);
  });
});

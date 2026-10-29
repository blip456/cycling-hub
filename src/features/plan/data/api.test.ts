import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createPlan,
  saveWeightGoal,
  savePlanProfile,
  updateSessions,
  fetchActivePlan,
} from "./api";
import { PLAN_INPUT, planFixture } from "./test-support";

type Call = { table: string; ops: { op: string; args: unknown[] }[] };
type Result = { data: unknown; error: { message: string } | null };

const calls: Call[] = [];
let respond: (call: Call) => Result;

/** A stand-in for the Supabase query builder: records the chain and answers from `respond`. */
function builder(table: string) {
  const call: Call = { table, ops: [] };
  calls.push(call);
  const chain: Record<string, unknown> = {};
  for (const op of [
    "select",
    "insert",
    "update",
    "upsert",
    "delete",
    "eq",
    "in",
    "order",
    "single",
    "maybeSingle",
    "overrideTypes",
  ]) {
    chain[op] = (...args: unknown[]) => {
      call.ops.push({ op, args });
      return chain;
    };
  }
  chain.then = (resolve: (value: Result) => unknown) => resolve(respond(call));
  return chain;
}

vi.mock("@/lib/supabase/client", () => ({ getSupabase: () => ({ from: builder }) }));

const OK: Result = { data: null, error: null };
const names = (call: Call) => call.ops.map((o) => o.op).join(".");

beforeEach(() => {
  calls.length = 0;
  respond = () => OK;
});

const fixture = planFixture();
const newPlan = { plan: fixture.engine, intake: PLAN_INPUT.intake, ftp: 250, weightKg: 78.4 };

describe("createPlan", () => {
  function healthy(oldIds: string[]) {
    respond = (call) => {
      const first = call.ops[0]?.op;
      if (
        call.table === "training_plans" &&
        first === "select" &&
        call.ops.some((o) => o.op === "eq")
      )
        return { data: oldIds.map((id) => ({ id })), error: null };
      if (call.table === "training_plans" && first === "insert")
        return {
          data: {
            id: "new-plan",
            start_date: fixture.engine.startDate,
            weeks: 12,
            status: "active",
            intake: PLAN_INPUT.intake,
            ftp_w: 250,
            weight_kg: 78.4,
            engine_version: fixture.engine.engineVersion,
            input_fingerprint: fixture.engine.fingerprint,
            undone_fingerprint: null,
            created_at: "2026-10-29T08:00:00Z",
            updated_at: "2026-10-29T08:00:00Z",
            user_id: "u",
          },
          error: null,
        };
      return OK;
    };
  }

  it("replaces the old active plan first, then writes the plan and every session", async () => {
    healthy(["old-plan"]);
    const saved = await createPlan(newPlan);
    expect(saved).toMatchObject({ id: "new-plan", status: "active", weeks: 12 });

    const order = calls.map((c) => `${c.table}:${names(c)}`);
    expect(order[0]).toBe("training_plans:select.eq");
    expect(order[1]).toBe("training_plans:update.in");
    expect(order[2]).toBe("training_plans:insert.select.single");
    expect(order.slice(3).every((o) => o === "planned_sessions:insert")).toBe(true);

    expect(calls[1]?.ops[0]?.args[0]).toEqual({ status: "replaced" });
    expect(calls[1]?.ops[1]?.args).toEqual(["id", ["old-plan"]]);

    const rows = calls
      .filter((c) => c.table === "planned_sessions")
      .flatMap((c) => c.ops[0]?.args[0] as { plan_id: string; kind: string }[]);
    expect(rows).toHaveLength(fixture.engine.sessions.length);
    expect(rows.every((r) => r.plan_id === "new-plan")).toBe(true);
    expect(rows.map((r) => r.kind)).toContain("long_ride");
  });

  it("does not touch other plans when there is no old one", async () => {
    healthy([]);
    await createPlan(newPlan);
    expect(calls.some((c) => names(c) === "update.in")).toBe(false);
  });

  it("puts the old plan back when the plan row cannot be written", async () => {
    healthy(["old-plan"]);
    const ok = respond;
    respond = (call) =>
      call.table === "training_plans" && call.ops[0]?.op === "insert"
        ? { data: null, error: { message: "nope" } }
        : ok(call);
    await expect(createPlan(newPlan)).rejects.toThrow("nope");
    const last = calls.at(-1);
    expect(last?.ops[0]?.args[0]).toEqual({ status: "active" });
  });

  it("removes the new plan and restores the old one when the sessions cannot be written", async () => {
    healthy(["old-plan"]);
    const ok = respond;
    respond = (call) =>
      call.table === "planned_sessions" ? { data: null, error: { message: "rls" } } : ok(call);
    await expect(createPlan(newPlan)).rejects.toThrow("rls");
    const tail = calls
      .slice(-2)
      .map((c) => `${c.table}:${names(c)}:${JSON.stringify(c.ops[0]?.args[0] ?? null)}`);
    expect(tail[0]).toBe("training_plans:delete.eq:null");
    expect(tail[1]).toBe('training_plans:update.in:{"status":"active"}');
  });

  it("stops before writing when the old plan cannot be replaced", async () => {
    respond = (call) =>
      call.ops[0]?.op === "update"
        ? { data: null, error: { message: "denied" } }
        : { data: [{ id: "old" }], error: null };
    await expect(createPlan(newPlan)).rejects.toThrow("denied");
    expect(calls.some((c) => c.ops[0]?.op === "insert")).toBe(false);
  });
});

describe("the weight goal", () => {
  it("cancels the active goal and adds the new one", async () => {
    await saveWeightGoal({ targetKg: 76, targetDate: "2027-01-23", startKg: 78.4 });
    expect(calls.map((c) => `${c.table}:${names(c)}`)).toEqual([
      "weight_goals:update.eq",
      "weight_goals:insert",
    ]);
    expect(calls[0]?.ops[0]?.args[0]).toEqual({ status: "cancelled" });
    expect(calls[1]?.ops[0]?.args[0]).toEqual({
      target_weight_kg: 76,
      target_date: "2027-01-23",
      start_weight_kg: 78.4,
    });
  });

  it("only cancels with null", async () => {
    await saveWeightGoal(null);
    expect(calls).toHaveLength(1);
  });
});

describe("the other writes", () => {
  it("updates sessions one by one with database column names", async () => {
    await updateSessions([
      { id: "a", patch: { status: "done" } },
      { id: "b", patch: { date: "2026-10-30", movedFrom: "2026-10-28", indoor: true } },
    ]);
    expect(calls).toHaveLength(2);
    expect(calls[0]?.ops[0]?.args[0]).toEqual({ status: "done" });
    expect(calls[1]?.ops[0]?.args[0]).toEqual({
      session_date: "2026-10-30",
      moved_from: "2026-10-28",
      indoor: true,
    });
  });

  it("throws the database message when an update fails", async () => {
    respond = () => ({ data: null, error: { message: "locked" } });
    await expect(updateSessions([{ id: "a", patch: { status: "skipped" } }])).rejects.toThrow(
      "locked",
    );
    expect(calls).toHaveLength(1);
  });

  it("saves only the profile fields it is given", async () => {
    await savePlanProfile("u", {
      trainingPurposes: ["endurance", "weight_loss"],
      levelAnswers: [1, 2, 3, 0, 1],
      weeklyHours: 7.5,
    });
    expect(calls[0]?.table).toBe("profiles");
    expect(calls[0]?.ops[0]?.args[0]).toEqual({
      id: "u",
      training_purposes: ["endurance", "weight_loss"],
      level_answers: {
        experience: 1,
        weeklyHours: 2,
        intervals: 3,
        longestRide: 0,
        hardSessions: 1,
      },
      weekly_hours: 7.5,
    });
  });

  it("reads no active plan as null", async () => {
    respond = () => OK;
    await expect(fetchActivePlan()).resolves.toBeNull();
  });
});

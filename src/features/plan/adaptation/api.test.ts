import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSupabaseRunnerApi, fetchPlanChanges } from "./api";
import { payloadFromJson, type ChangePayload } from "./changes";

type Op = { op: string; args: unknown[] };
const ops: Op[] = [];
let answer: { data: unknown; error: { message: string } | null } = { data: null, error: null };

function builder() {
  const chain: Record<string, unknown> = {};
  for (const op of ["select", "insert", "update", "eq", "order", "limit", "single"]) {
    chain[op] = (...args: unknown[]) => {
      ops.push({ op, args });
      return chain;
    };
  }
  chain.then = (resolve: (value: typeof answer) => unknown) => resolve(answer);
  return chain;
}

vi.mock("@/lib/supabase/client", () => ({ getSupabase: () => ({ from: builder }) }));

const payload: ChangePayload = {
  version: 1,
  message: "1 session changed.",
  reasons: ["settings-changed"],
  changes: [],
  fingerprint: "fp",
  undo: null,
  before: { ftp: 250, intake: null },
  inputs: { settings: { zone2TargetPercent: 70 }, recentAverageHours: 6.4 },
};

beforeEach(() => {
  ops.length = 0;
  answer = { data: { id: "c-1" }, error: null };
});

describe("the update log in the database", () => {
  it("writes the payload as a JSON array: the changes column is checked to be one", async () => {
    // plan_changes.changes has `check (jsonb_typeof(changes) = 'array')`; an object makes every insert fail.
    const id = await createSupabaseRunnerApi("u").insertChange({
      planId: "p",
      reason: "1 session changed.",
      payload,
    });
    expect(id).toBe("c-1");
    const insert = ops.find((o) => o.op === "insert")?.args[0] as { changes: unknown };
    expect(Array.isArray(insert.changes)).toBe(true);
    expect(insert.changes).toHaveLength(1);
  });

  it("reads the stored array back to the same payload, and still reads a bare object", async () => {
    await createSupabaseRunnerApi("u").insertChange({ planId: "p", reason: "x", payload });
    const stored = (ops.find((o) => o.op === "insert")?.args[0] as { changes: unknown }).changes;
    expect(payloadFromJson(stored)).toEqual(payload);
    expect(payloadFromJson(payload)).toEqual(payload);
    expect(payloadFromJson([])).toBeNull();

    answer = {
      data: [
        {
          id: "c-1",
          plan_id: "p",
          created_at: "2026-11-15T20:00:00Z",
          undone_at: null,
          reason: "1 session changed.",
          changes: stored,
        },
      ],
      error: null,
    };
    const list = await fetchPlanChanges("p", 5);
    expect(list).toHaveLength(1);
    expect(list[0]?.payload.inputs?.settings.zone2TargetPercent).toBe(70);
  });
});

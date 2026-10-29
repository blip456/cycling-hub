/**
 * The runner against an in-memory database: the missed Wednesday of docs/plan/example-plans.md (plan B, week
 * 6) from a stored plan to Undo, plus the stability rules (no write when unchanged, order, concurrency,
 * failures).
 */
import { beforeEach, describe, expect, it } from "vitest";
import { EXAMPLE_B } from "../engine/fixtures";
import type { PlanSession } from "../data/types";
import { addHistory, fakeApi, fakeDb, fakeRide, type FakeApi } from "./fake-api";
import { createRunner, type RunResult, type Runner } from "./runner";

const TODAY = "2026-12-03"; // Thursday of week 6
const WEDNESDAY = "2026-12-02";
const NEXT_WEDNESDAY = "2026-12-09";

function session(api: FakeApi, date: string): PlanSession {
  const found = api.db.sessions.find((s) => s.date === date);
  if (!found) throw new Error(`no session on ${date}`);
  return found;
}

/** The main set as the title writes it ("VO2 5 x 4 min"). */
function workSets(s: PlanSession): string {
  return s.title.replace(/^.*?(\d+) x (\d+).*$/, "$1x$2");
}

function done(result: RunResult) {
  if (result.status !== "done") throw new Error(`run ended with ${result.status}`);
  return result;
}

let api: FakeApi;
let runner: Runner;
let original: PlanSession[];

beforeEach(() => {
  const db = fakeDb(EXAMPLE_B);
  original = db.sessions.map((s) => ({ ...s }));
  addHistory(db, TODAY, [WEDNESDAY]);
  api = fakeApi(db);
  runner = createRunner(api);
});

describe("a missed Wednesday through the runner", () => {
  it("marks the day missed, repeats the VO2 step next week and records the update", async () => {
    const result = done(await runner.run(TODAY));
    expect(result.outcome).toBe("recalculated");
    expect(result.changeId).toBe("c-1");

    expect(session(api, WEDNESDAY).status).toBe("missed");
    expect(session(api, WEDNESDAY).activityId).toBeNull();
    // Rides before today count as done sessions, linked automatically.
    expect(session(api, "2026-12-01").status).toBe("done");
    expect(session(api, "2026-12-01").matchSource).toBe("auto");

    expect(workSets(session(api, NEXT_WEDNESDAY))).toBe("5x4");
    expect(workSets(original.find((s) => s.date === NEXT_WEDNESDAY) as PlanSession)).toBe("6x4");

    const change = api.db.changes[0];
    expect(change?.undoneAt).toBeNull();
    expect(change?.message).toMatch(/^\d+ sessions? changed because Wed 2 Dec was not ridden\.$/);
    expect(change?.payload.changes.find((c) => c.date === NEXT_WEDNESDAY)).toMatchObject({
      date: NEXT_WEDNESDAY,
      change: "main-set",
      reasonCode: "missed-session",
    });
    expect(change?.payload.fingerprint).toBe(api.db.plan.fingerprint);
  });

  it("writes in the order that survives a failure: statuses, diff, record, fingerprint last", async () => {
    await runner.run(TODAY);
    expect(api.writes).toEqual(["statuses", "diff", "change", "plan"]);
  });

  it("writes nothing when it runs again on the same inputs", async () => {
    await runner.run(TODAY);
    const before = structuredClone(api.db);
    api.writes.length = 0;
    const second = done(await runner.run(TODAY));
    expect(second.outcome).toBe("unchanged");
    expect(second.changeId).toBeNull();
    expect(api.writes).toEqual([]);
    expect(api.db).toEqual(before);
  });

  it("Undo puts week 7 back, keeps Wednesday missed and pins the fingerprint", async () => {
    await runner.run(TODAY);
    const change = api.db.changes[0];
    if (!change) throw new Error("no change");
    api.writes.length = 0;

    expect(await runner.undo(change, new Date("2026-12-03T10:00:00Z"))).toEqual({
      status: "done",
    });
    expect(api.writes).toEqual(["pin", "diff", "plan", "undone"]);
    expect(workSets(session(api, NEXT_WEDNESDAY))).toBe("6x4");
    expect(session(api, WEDNESDAY).status).toBe("missed");
    expect(api.db.changes[0]?.undoneAt).toBe("2026-12-03T10:00:00.000Z");
    expect(api.db.plan.undoneFingerprint).toBe(change.payload.undo?.undoneFingerprint);
    // The week-7 session is back as it was stored at the start.
    expect(session(api, NEXT_WEDNESDAY)).toEqual(original.find((s) => s.date === NEXT_WEDNESDAY));

    // The same state is not recalculated: pinned, and nothing is written.
    api.writes.length = 0;
    const next = done(await runner.run(TODAY));
    expect(next.outcome).toBe("pinned");
    expect(api.writes).toEqual([]);
    expect(workSets(session(api, NEXT_WEDNESDAY))).toBe("6x4");
  });

  it("recalculates again once an input changes after an Undo (a new FTP)", async () => {
    await runner.run(TODAY);
    const change = api.db.changes[0];
    if (!change) throw new Error("no change");
    await runner.undo(change);
    api.db.baseline = { ...api.db.baseline, ftp: 262 };
    const result = done(await runner.run(TODAY));
    expect(result.outcome).toBe("recalculated");
    expect(api.db.plan.undoneFingerprint).toBeNull();
    expect(api.db.plan.ftp).toBe(262);
    expect(api.db.changes[0]?.payload.reasons).toContain("new-ftp");
  });

  it("refuses an Undo that is out of date", async () => {
    await runner.run(TODAY);
    const change = api.db.changes[0];
    if (!change) throw new Error("no change");
    expect(await runner.undo({ ...change, undoneAt: "2026-12-03T10:00:00Z" })).toEqual({
      status: "stale",
    });
    api.db.plan = { ...api.db.plan, fingerprint: "someone-else" };
    expect(await runner.undo(change)).toEqual({ status: "stale" });
  });
});

describe("stability", () => {
  it("shares one run between requests made while it waits, and runs once more for a late one", async () => {
    const first = runner.run(TODAY);
    const second = runner.run(TODAY);
    expect(second).toBe(first);
    await first;
    expect(api.load).toHaveBeenCalledTimes(1);

    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const load = api.load;
    api.load = () => gate.then(() => load());
    const running = runner.run(TODAY);
    await Promise.resolve();
    const late = runner.run(TODAY);
    const later = runner.run(TODAY);
    expect(late).not.toBe(running);
    expect(later).toBe(late);
    release();
    await Promise.all([running, late]);
  });

  it("never runs two evaluations at once", async () => {
    let active = 0;
    let peak = 0;
    const load = api.load;
    api.load = async () => {
      active += 1;
      peak = Math.max(peak, active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      const inputs = await load();
      active -= 1;
      return inputs;
    };
    await Promise.all([runner.run(TODAY), runner.run(TODAY), runner.undo(fakeChange())]);
    expect(peak).toBe(1);
  });

  it("returns no-plan without a plan and never throws", async () => {
    api.load = () => Promise.resolve(null);
    expect(await runner.run(TODAY)).toEqual({ status: "no-plan" });
  });

  it("leaves the old plan intact when the load fails", async () => {
    api.failOn("load");
    const result = await runner.run(TODAY);
    expect(result.status).toBe("failed");
    expect(api.writes).toEqual([]);
  });

  it("a failed diff keeps the old sessions and fingerprint; the next run finishes the job", async () => {
    const fingerprint = api.db.plan.fingerprint;
    api.failOn("diff");
    const failed = await runner.run(TODAY);
    expect(failed.status).toBe("failed");
    expect(api.db.plan.fingerprint).toBe(fingerprint);
    expect(api.db.changes).toEqual([]);
    expect(workSets(session(api, NEXT_WEDNESDAY))).toBe("6x4");

    api.failOn(null);
    const retried = done(await runner.run(TODAY));
    expect(retried.outcome).toBe("recalculated");
    expect(workSets(session(api, NEXT_WEDNESDAY))).toBe("5x4");
    expect(api.db.changes).toHaveLength(1);
    expect(api.db.plan.fingerprint).not.toBe(fingerprint);
  });

  it("a failed record write leaves the fingerprint old, so no half-update counts as done", async () => {
    const fingerprint = api.db.plan.fingerprint;
    api.failOn("change");
    expect((await runner.run(TODAY)).status).toBe("failed");
    expect(api.db.plan.fingerprint).toBe(fingerprint);
  });

  it("a failed Undo before the pin changes nothing and can be tried again", async () => {
    await runner.run(TODAY);
    const change = api.db.changes[0];
    if (!change) throw new Error("no change");
    api.failOn("pin");
    expect((await runner.undo(change)).status).toBe("failed");
    expect(workSets(session(api, NEXT_WEDNESDAY))).toBe("5x4");
    api.failOn(null);
    expect(await runner.undo(change)).toEqual({ status: "done" });
    expect(workSets(session(api, NEXT_WEDNESDAY))).toBe("6x4");
  });
});

describe("statuses in every outcome", () => {
  it("writes a done session from a late import even when nothing else changes", async () => {
    await runner.run(TODAY);
    // The ride of the missed Wednesday arrives late (within the matching window).
    api.db.rides = [...api.db.rides, fakeRide(WEDNESDAY, 70)];
    api.writes.length = 0;
    const result = done(await runner.run(TODAY));
    expect(result.outcome).toBe("recalculated");
    expect(api.writes[0]).toBe("statuses");
    expect(session(api, WEDNESDAY).status).toBe("done");
  });
});

function fakeChange() {
  return {
    id: "x",
    planId: "plan-1",
    createdAt: "",
    undoneAt: null,
    message: "",
    payload: {
      version: 1 as const,
      message: "",
      reasons: [],
      changes: [],
      fingerprint: "nope",
      undo: null,
      before: { ftp: 250, intake: null },
    },
  };
}

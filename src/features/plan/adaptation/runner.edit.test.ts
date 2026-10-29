/**
 * Editing the plan's answers through the runner: the edited intake is evaluated instead of the stored one,
 * only sessions that have not happened yet change, the answers are stored even when nothing changes, the
 * plan length follows an event, and Undo puts everything back. A runner without a plan does nothing.
 */
import { beforeEach, describe, expect, it } from "vitest";
import type { Intake } from "../engine";
import { EXAMPLE_A } from "../engine/fixtures";
import { addHistory, fakeApi, fakeDb, type FakeApi } from "./fake-api";
import { createRunner, type RunResult, type Runner } from "./runner";

const TODAY = "2026-12-04"; // Friday of week 6

function done(result: RunResult) {
  if (result.status !== "done") throw new Error(`run ended with ${result.status}`);
  return result;
}

function edited(change: Partial<Intake>): Intake {
  return { ...EXAMPLE_A.intake, ...change };
}

let api: FakeApi;
let runner: Runner;

beforeEach(async () => {
  const db = fakeDb(EXAMPLE_A);
  addHistory(db, TODAY);
  api = fakeApi(db);
  runner = createRunner(api);
  // A first run settles the plan after the history (rides before today are matched).
  await runner.run(TODAY);
  api.writes.length = 0;
});

describe("an edit through the runner", () => {
  it("recalculates the future, keeps the past and records an update that says it was edited", async () => {
    const pastBefore = api.db.sessions.filter((s) => s.date < TODAY).map((s) => ({ ...s }));
    const futureBefore = api.db.sessions.filter((s) => s.date >= TODAY).map((s) => ({ ...s }));
    const result = done(await runner.run(TODAY, { edit: edited({ hoursPerWeek: 5 }) }));

    expect(result.outcome).toBe("recalculated");
    expect(result.change?.message).toMatch(
      /^\d+ sessions? changed because you edited your plan\.$/,
    );
    expect(result.changeId).toBe(result.change?.id);
    expect(api.db.sessions.filter((s) => s.date < TODAY)).toEqual(pastBefore);
    expect(api.db.sessions.filter((s) => s.date >= TODAY)).not.toEqual(futureBefore);
    expect(api.db.plan.intake?.hoursPerWeek).toBe(5);
    expect(api.db.plan.startDate).toBe("2026-10-26");
    expect(api.writes).toEqual(["diff", "change", "plan"]);
  });

  it("does not use the profile for an edit: the confirmed intake wins", async () => {
    // The profile still says 4 hours; the edit says 5.
    expect(api.db.profile.weeklyHours).toBe(4);
    await runner.run(TODAY, { edit: edited({ hoursPerWeek: 5 }) });
    expect(api.db.plan.intake?.hoursPerWeek).toBe(5);
  });

  it("changes nothing and writes nothing when the answers are the same", async () => {
    const before = structuredClone(api.db);
    const result = done(await runner.run(TODAY, { edit: edited({}) }));
    expect(result.outcome).toBe("unchanged");
    expect(result.change).toBeNull();
    expect(api.writes).toEqual([]);
    expect(api.db).toEqual(before);
  });

  it("stores the answers when no session changes (a changed event name)", async () => {
    // Same event day and length, other name: the sessions are as they were; the stored answers follow.
    await runner.run(TODAY, {
      edit: edited({ event: { name: "Club ride", date: "2027-01-10", duration: "under-3h" } }),
    });
    api.writes.length = 0;
    const result = done(
      await runner.run(TODAY, {
        edit: edited({ event: { name: "Club ride 2", date: "2027-01-10", duration: "under-3h" } }),
      }),
    );
    expect(result.change).toBeNull();
    expect(api.db.plan.intake?.event?.name).toBe("Club ride 2");
  });

  it("follows an added event: a shorter plan with the event on its day", async () => {
    expect(api.db.plan.weeks).toBe(12);
    const result = done(
      await runner.run(TODAY, {
        edit: edited({ event: { name: "Club ride", date: "2027-01-10", duration: "under-3h" } }),
      }),
    );
    expect(result.change?.payload.reasons[0]).toBe("plan-edited");
    expect(api.db.plan.weeks).toBe(11);
    expect(api.db.sessions.find((s) => s.date === "2027-01-10")?.kind).toBe("event");
    expect(api.db.sessions.every((s) => s.date <= "2027-01-10")).toBe(true);
  });

  it("Undo of an edit puts the sessions, the answers and the plan length back", async () => {
    const sessionsBefore = api.db.sessions.map((s) => ({ ...s }));
    const intakeBefore = api.db.plan.intake;
    const result = done(
      await runner.run(TODAY, {
        edit: edited({ event: { name: "Club ride", date: "2027-01-10", duration: "under-3h" } }),
      }),
    );
    if (!result.change) throw new Error("no change");
    expect(await runner.undo(result.change)).toEqual({ status: "done" });
    expect(api.db.plan.weeks).toBe(12);
    expect(api.db.plan.intake).toEqual(intakeBefore);
    expect(api.db.sessions).toEqual(sessionsBefore);
  });

  it("never merges an edit with a request that is waiting", async () => {
    const plain = runner.run(TODAY);
    const edit = runner.run(TODAY, { edit: edited({ hoursPerWeek: 5 }) });
    const [a, b] = await Promise.all([plain, edit]);
    expect(a).not.toBe(b);
    expect(done(b).outcome).toBe("recalculated");
    expect(api.db.plan.intake?.hoursPerWeek).toBe(5);
  });

  it("a plan whose stored answers cannot be read can still be edited", async () => {
    api.db.plan = { ...api.db.plan, intake: null };
    const result = done(await runner.run(TODAY, { edit: edited({ hoursPerWeek: 5 }) }));
    expect(result.outcome).toBe("recalculated");
    expect(api.db.plan.intake?.hoursPerWeek).toBe(5);
  });
});

describe("a preview of an edit", () => {
  it("says how many sessions would change and writes nothing", async () => {
    const before = structuredClone(api.db);
    const preview = await runner.preview(TODAY, edited({ hoursPerWeek: 5 }));
    expect(preview.status).toBe("done");
    if (preview.status !== "done") return;
    expect(preview.outcome).toBe("recalculated");
    expect(preview.changed).toBeGreaterThan(0);
    expect(api.writes).toEqual([]);
    expect(api.db).toEqual(before);
  });

  it("says nothing changes for the same answers", async () => {
    const preview = await runner.preview(TODAY, edited({}));
    expect(preview).toMatchObject({ status: "done", outcome: "unchanged", changed: 0 });
  });

  it("gives the engine's warning for an event further away than the plan reaches", async () => {
    const preview = await runner.preview(
      TODAY,
      edited({
        event: { name: "Far away", date: "2027-04-04", duration: "under-3h" },
      }),
    );
    if (preview.status !== "done") throw new Error(preview.status);
    expect(preview.warnings.map((w) => w.code)).toContain("event-far");
  });

  it("fails without throwing when the plan cannot be read", async () => {
    api.failOn("load");
    expect((await runner.preview(TODAY, edited({}))).status).toBe("failed");
    expect((await runner.run(TODAY, { edit: edited({}) })).status).toBe("failed");
  });
});

describe("without a plan", () => {
  it("does nothing: no evaluation, no writes, nothing recreated", async () => {
    const empty = fakeApi(fakeDb(EXAMPLE_A));
    empty.load = () => Promise.resolve(null);
    const bare = createRunner(empty);
    expect(await bare.run(TODAY)).toEqual({ status: "no-plan" });
    expect(await bare.run(TODAY, { edit: edited({ hoursPerWeek: 5 }) })).toEqual({
      status: "no-plan",
    });
    expect(await bare.preview(TODAY, edited({}))).toEqual({ status: "no-plan" });
    expect(empty.writes).toEqual([]);
  });
});

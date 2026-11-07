/**
 * An edit of the plan's answers (the intake questions again) through `evaluatePlan`: only sessions that have
 * not happened yet are recalculated, the notice says the plan was edited, and the same answers change nothing.
 */
import { describe, expect, it } from "vitest";
import type { IsoDate } from "@/features/athlete";
import { buildPlan, type PlanInput } from "../engine";
import { EXAMPLE_A } from "../engine/fixtures";
import { evaluateOnce, initialState, withHistory, type Stored } from "./test-helpers";
import type { StoredSession } from "./types";

const TODAY: IsoDate = "2026-12-04"; // Friday of week 6

function withIntake(change: Partial<PlanInput["intake"]>): PlanInput {
  return { ...EXAMPLE_A, intake: { ...EXAMPLE_A.intake, ...change } };
}

/** The plan after weeks 1 to 5 were ridden, evaluated once so its fingerprint is stored. */
function settled() {
  const { plan, stored } = initialState(EXAMPLE_A);
  const history = withHistory(stored, TODAY);
  const rest = { rides: history.rides, weightEntries: [], today: TODAY };
  const first = evaluateOnce(plan, EXAMPLE_A, history.stored, rest);
  return { plan, rest, state: first.next };
}

function before(sessions: readonly StoredSession[], day: IsoDate) {
  return sessions.filter((s) => s.date < day);
}

describe("editing the answers", () => {
  const { plan, rest, state } = settled();

  it("changes nothing when the answers are the same", () => {
    const again = evaluateOnce(plan, EXAMPLE_A, state, { ...rest, edited: true });
    expect(again.result.outcome).toBe("unchanged");
    expect(again.result.update).toBeNull();
    expect(again.result.diff).toEqual({ insert: [], update: [], delete: [] });
  });

  it("recalculates only the sessions that have not happened yet and says the plan was edited", () => {
    const edited = withIntake({ hoursPerWeek: 5 });
    const run = evaluateOnce(plan, edited, state, {
      ...rest,
      edited: true,
      previous: { ftp: 250, intake: EXAMPLE_A.intake },
    });
    expect(run.result.outcome).toBe("recalculated");
    expect(run.result.update?.reasons).toContain("plan-edited");
    expect(run.result.update?.message).toMatch(
      /^\d+ sessions? changed because you edited your plan\.$/,
    );
    for (const change of run.result.update?.changes ?? []) {
      expect(change.date >= TODAY).toBe(true);
      expect(change.reasonCode).toBe("plan-edited");
      expect(change.reason).toBe("You edited your plan, so this session was recalculated.");
    }
    // Everything before today (done sessions with their rides) is exactly as it was.
    expect(before(run.next.sessions, TODAY)).toEqual(before(state.sessions, TODAY));
    // The plan has more hours to come.
    const minutes = (sessions: readonly StoredSession[]) =>
      sessions.filter((s) => s.date >= TODAY).reduce((sum, s) => sum + s.durationMin, 0);
    expect(minutes(run.next.sessions)).toBeGreaterThan(minutes(state.sessions));
    // The start date stays.
    expect(buildPlan(edited).startDate).toBe(plan.startDate);
  });

  it("names the edit instead of guessing from the event or the days", () => {
    const edited = withIntake({
      availableDays: ["tue", "thu", "sat", "sun"],
      event: { name: "Club ride", date: "2027-01-10", duration: "under-3h" },
    });
    const run = evaluateOnce(plan, edited, state, {
      ...rest,
      edited: true,
      previous: { ftp: 250, intake: EXAMPLE_A.intake },
    });
    expect(run.result.update?.reasons[0]).toBe("plan-edited");
    expect(new Set(run.result.update?.changes.map((c) => c.reasonCode))).toEqual(
      new Set(["plan-edited"]),
    );
    expect(before(run.next.sessions, TODAY)).toEqual(before(state.sessions, TODAY));
    // The event is on its day now.
    expect(run.next.sessions.find((s) => s.date === "2027-01-10")?.kind).toBe("event");
  });

  it("without the edit flag the same change is a settings change", () => {
    const run = evaluateOnce(plan, withIntake({ hoursPerWeek: 5 }), state, rest);
    expect(run.result.update?.reasons).toContain("settings-changed");
    expect(run.result.update?.reasons).not.toContain("plan-edited");
  });

  it("leaves a session with a manual match alone", () => {
    const locked: Stored = {
      ...state,
      sessions: state.sessions.map((s) =>
        s.date === "2026-12-06" ? { ...s, matchSource: "manual" as const } : s,
      ),
    };
    const run = evaluateOnce(plan, withIntake({ hoursPerWeek: 5 }), locked, {
      ...rest,
      edited: true,
    });
    expect(run.next.sessions.find((s) => s.date === "2026-12-06")).toEqual(
      locked.sessions.find((s) => s.date === "2026-12-06"),
    );
  });

  it("can be undone: the inverse diff and the old fingerprint are stored", () => {
    const run = evaluateOnce(plan, withIntake({ hoursPerWeek: 5 }), state, {
      ...rest,
      edited: true,
    });
    expect(run.result.undo).not.toBeNull();
    expect(run.result.undo?.restoreFingerprint).toBe(state.fingerprint);
  });
});

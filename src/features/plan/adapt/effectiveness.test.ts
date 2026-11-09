/** Ride feedback: verdicts per session, signals per type and week, and the ladder hold after a cut-short session. */
import { describe, expect, it } from "vitest";
import { STRUCTURED_KINDS } from "../engine";
import { EXAMPLE_B } from "../engine/fixtures";
import { effectiveness, struggledStructured, type EffectivenessInput } from "./effectiveness";
import { evaluatePlan } from "./evaluate";
import { evaluateOnce, initialState, ride, withHistory } from "./test-helpers";
import type { AdaptRide, StoredSession } from "./types";

const FTP = EXAMPLE_B.ftp ?? 250;
const TODAY = "2026-12-20";

/** The structured sessions of the plan before TODAY, each ridden with `minutesShare` of its time. */
function ridden(share: number, powerShare: number | null = null) {
  const { plan, stored } = initialState(EXAMPLE_B);
  const rides: AdaptRide[] = [];
  const sessions = stored.sessions.map((s): StoredSession => {
    if (s.date >= TODAY || s.kind === "event") return s;
    if (!STRUCTURED_KINDS.includes(s.kind)) {
      // Everything else is ridden as planned, so the weeks look normal.
      const easy = ride(s.date, s.durationMin, { avgPowerW: 120 });
      rides.push(easy);
      return { ...s, status: "done", activityId: easy.id, matchSource: "auto" };
    }
    const watts =
      powerShare === null
        ? 150
        : (s.steps.reduce((a, st) => a + st.durationSec * st.target.percentFtp, 0) /
            s.steps.reduce((a, st) => a + st.durationSec, 0) /
            100) *
          FTP *
          powerShare;
    const r = ride(s.date, Math.round(s.durationMin * share), { avgPowerW: watts });
    rides.push(r);
    return { ...s, status: "done", activityId: r.id, matchSource: "auto" };
  });
  return { plan, sessions, rides };
}

const input = (state: ReturnType<typeof ridden>): EffectivenessInput => ({
  plan: state.plan,
  sessions: state.sessions,
  rides: state.rides,
  ftp: FTP,
  today: TODAY,
});

describe("effectiveness", () => {
  it("says there is not enough data before any hard session", () => {
    const { plan, stored } = initialState(EXAMPLE_B);
    const report = effectiveness({
      plan,
      sessions: stored.sessions,
      rides: [],
      ftp: FTP,
      today: TODAY,
    });
    expect(report.signals.map((s) => s.code)).toEqual(["not-enough-data"]);
  });

  it("gives positive signals when sessions are ridden as planned", () => {
    const report = effectiveness(input(ridden(1, 1)));
    expect(report.signals.some((s) => s.code === "kind-on-target" && s.tone === "good")).toBe(true);
    expect(report.signals.some((s) => s.tone === "watch")).toBe(false);
  });

  it("flags sessions that are cut short and holds the ladder step for them", () => {
    const state = ridden(0.6);
    const report = effectiveness(input(state));
    expect(report.signals.some((s) => s.code === "kind-too-long")).toBe(true);
    const held = struggledStructured(input(state));
    expect(held.length).toBeGreaterThan(0);
    // One entry per week and kind.
    expect(new Set(held.map((h) => `${String(h.week)}:${h.kind}`)).size).toBe(held.length);
  });

  it("flags sessions ridden well above the target power", () => {
    const state = ridden(1, 1.2);
    const report = effectiveness(input(state));
    expect(report.signals.some((s) => s.code === "kind-too-light")).toBe(true);
    expect(struggledStructured(input(state))).toEqual([]);
  });

  it("does not judge low outdoor power, which includes freewheeling", () => {
    const state = ridden(1, 0.6);
    const outdoor = {
      ...state,
      sessions: state.sessions.map((s) => ({ ...s, indoor: false })),
    };
    const report = effectiveness(input(outdoor));
    expect(report.signals.some((s) => s.code === "kind-too-hard")).toBe(false);
  });
});

describe("a cut-short session changes the plan", () => {
  const evaluate = (share: number, state = ridden(share)) => {
    return evaluatePlan({
      plan: { startDate: state.plan.startDate },
      sessions: state.sessions,
      rides: state.rides,
      weightEntries: [],
      profileInput: EXAMPLE_B,
      today: TODAY,
      lastFingerprint: null,
      undoneFingerprint: null,
    });
  };

  it("repeats the ladder step: the inputs differ from the same rides at full length", () => {
    expect(evaluate(0.6).fingerprint).not.toBe(evaluate(1).fingerprint);
  });

  it("is stable: the same rides give the same result twice", () => {
    const state = ridden(0.6);
    expect(evaluate(0.6, state).fingerprint).toBe(evaluate(0.6, state).fingerprint);
  });
});

describe("re-plan now", () => {
  const today = "2026-12-03";
  const { plan, stored } = initialState(EXAMPLE_B);
  const history = withHistory(stored, today);
  const rest = { rides: history.rides, weightEntries: [], today };
  const first = evaluateOnce(plan, EXAMPLE_B, history.stored, rest);

  it("is skipped by the fingerprint without force, and runs with it", () => {
    const quiet = evaluateOnce(plan, EXAMPLE_B, first.next, rest);
    expect(quiet.result.outcome).toBe("unchanged");
    const forced = evaluateOnce(plan, EXAMPLE_B, first.next, { ...rest, force: true });
    expect(forced.result.outcome).toBe("recalculated");
    // Same engine, same inputs: nothing differs, so there is nothing to announce.
    expect(forced.result.update).toBeNull();
  });

  it("names the reason when the engine gives different sessions", () => {
    // A stored session that differs from what the engine builds now (as after an engine tweak).
    const target = first.next.sessions.find((s) => s.date > today && s.kind === "endurance");
    expect(target).toBeDefined();
    const tweaked = {
      ...first.next,
      sessions: first.next.sessions.map((s) =>
        s.id === target?.id ? { ...s, durationMin: s.durationMin + 10 } : s,
      ),
    };
    // Without force the fingerprint hides the difference; with it the session is rebuilt.
    expect(evaluateOnce(plan, EXAMPLE_B, tweaked, rest).result.update).toBeNull();
    const forced = evaluateOnce(plan, EXAMPLE_B, tweaked, { ...rest, force: true });
    expect(forced.result.update?.reasons).toEqual(["replanned"]);
    expect(forced.result.update?.message).toMatch(/current engine/);
    expect(forced.result.undo).not.toBeNull();
    // And the result is settled: forcing again changes nothing.
    const again = evaluateOnce(plan, EXAMPLE_B, forced.next, { ...rest, force: true });
    expect(again.result.update).toBeNull();
  });
});

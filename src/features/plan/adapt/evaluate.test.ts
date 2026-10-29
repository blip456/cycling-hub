/**
 * Re-evaluation: the two worked examples of docs/plan/example-plans.md (a missed Wednesday, an extra unplanned
 * 150-minute Thursday ride) as fixtures with before and after weeks, then the rules around them.
 */
import { describe, expect, it } from "vitest";
import { addDays, type IsoDate, type WeightEntry } from "@/features/athlete";
import { buildPlan, type PlanInput } from "../engine";
import { EXAMPLE_A, EXAMPLE_B, EXAMPLE_D } from "../engine/fixtures";
import { evaluatePlan } from "./evaluate";
import { applyDiff } from "./merge";
import { applyStatuses } from "./status";
import {
  applyResult,
  evaluateOnce,
  initialState,
  ride,
  withHistory,
  type Stored,
} from "./test-helpers";
import type { StoredSession } from "./types";
import { STALLED_NO_ROOM_NOTICE } from "./weight-state";

const NO_WEIGHT: WeightEntry[] = [];

/** "Tue End 65 | Wed VO2 5x4 (95) | ..." for the sessions of the week starting on `monday`. */
function week(sessions: readonly StoredSession[], monday: IsoDate): string[] {
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i) as IsoDate);
  return sessions
    .filter((s) => days.includes(s.date) && s.status !== "missed")
    .map((s) => `${s.date.slice(8)} ${s.kind}${s.mainSet ? ` ${s.mainSet}` : ""} ${s.durationMin}`);
}

function minutes(sessions: readonly StoredSession[], monday: IsoDate): number {
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i) as IsoDate);
  return sessions
    .filter((s) => days.includes(s.date) && s.status !== "missed" && s.kind !== "event")
    .reduce((sum, s) => sum + s.durationMin, 0);
}

function future(sessions: readonly StoredSession[], from: IsoDate): StoredSession[] {
  return sessions.filter((s) => s.date >= from);
}

describe("example 1: a missed Wednesday (plan B, week 6)", () => {
  const { plan, stored } = initialState(EXAMPLE_B);
  const today = "2026-12-03"; // Thursday
  const history = withHistory(stored, today, ["2026-12-02"]);
  const rest = { rides: history.rides, weightEntries: NO_WEIGHT, today };
  const first = evaluateOnce(plan, EXAMPLE_B, history.stored, rest);

  it("marks Wednesday missed and keeps the rest of week 6 as it was", () => {
    expect(first.result.statusUpdates).toEqual([
      { id: "s-2026-12-02", status: "missed", activityId: null, matchSource: null },
    ]);
    // The VO2 session cannot move (Thursday is not an available day, Friday holds the threshold session).
    const dates = [
      ...first.result.diff.insert.map((i) => i.session.date),
      ...first.result.diff.update.map((u) => u.date),
      ...first.result.diff.delete.map((d) => d.date),
    ];
    expect(dates.filter((d) => d >= "2026-11-30" && d <= "2026-12-06")).toEqual([]);
    expect(week(first.next.sessions, "2026-11-30")).toEqual([
      "01 endurance 65",
      "04 threshold 3x10 80",
      "05 endurance 65",
      "06 long 175",
    ]);
  });

  it("repeats the VO2 step next week: 5x4 instead of 6x4, same hours", () => {
    expect(week(history.stored.sessions, "2026-12-07")).toContain("09 vo2 6x4 95");
    expect(week(first.next.sessions, "2026-12-07")).toEqual([
      "08 endurance 65",
      "09 vo2 5x4 95",
      "11 threshold 2x20 80",
      "12 endurance 65",
      "13 long 175",
    ]);
    expect(minutes(first.next.sessions, "2026-12-07")).toBe(
      minutes(history.stored.sessions, "2026-12-07"),
    );
  });

  it("announces it with the reason, the trigger and an Undo", () => {
    const update = first.result.update;
    expect(first.result.outcome).toBe("recalculated");
    expect(update?.reasons).toEqual(["missed-session"]);
    expect(update?.message).toMatch(/^\d+ sessions? changed because Wed 2 Dec was not ridden\.$/);
    const vo2 = update?.changes.find((c) => c.date === "2026-12-09");
    expect(vo2).toMatchObject({
      change: "main-set",
      before: { kind: "vo2", durationMin: 95, mainSet: "6x4" },
      after: { kind: "vo2", durationMin: 95, mainSet: "5x4" },
      reasonCode: "missed-session",
    });
    expect(vo2?.reason).toMatch(/not made up/);
    expect(update?.previousFingerprint).toBe("");
    expect(first.result.undo?.description).toBe(
      "Restores the plan as it was before Thu 3 Dec. The missed session stays missed.",
    );
  });

  it("changes nothing that has happened", () => {
    expect(first.next.sessions.filter((s) => s.date < today && s.id !== "s-2026-12-02")).toEqual(
      history.stored.sessions.filter((s) => s.date < today && s.id !== "s-2026-12-02"),
    );
    for (const change of first.result.update?.changes ?? [])
      expect(change.date >= today).toBe(true);
  });

  it("is quiet when evaluated again: no update, no write", () => {
    const again = evaluateOnce(plan, EXAMPLE_B, first.next, rest);
    expect(again.result.outcome).toBe("unchanged");
    expect(again.result.update).toBeNull();
    expect(again.result.statusUpdates).toEqual([]);
    expect(isEmpty(again.result.diff)).toBe(true);
    expect(again.next).toEqual(first.next);
  });

  it("Undo restores week 7 as before and pins the fingerprint", () => {
    const undo = first.result.undo;
    if (!undo) throw new Error("no undo");
    const restored: Stored = {
      sessions: applyDiff(first.next.sessions, undo.diff),
      fingerprint: undo.restoreFingerprint,
      undone: undo.undoneFingerprint,
    };
    expect(future(restored.sessions, today)).toEqual(future(history.stored.sessions, today));
    // Wednesday stays missed.
    expect(restored.sessions.find((s) => s.id === "s-2026-12-02")?.status).toBe("missed");

    const pinned = evaluateOnce(plan, EXAMPLE_B, restored, rest);
    expect(pinned.result.outcome).toBe("pinned");
    expect(pinned.result.update).toBeNull();
    expect(isEmpty(pinned.result.diff)).toBe(true);
    expect(pinned.result.undoneFingerprint).toBe(undo.undoneFingerprint);
    expect(pinned.next.sessions).toEqual(restored.sessions);
  });

  it("any new input change clears the pin and recalculates", () => {
    const undo = first.result.undo;
    if (!undo) throw new Error("no undo");
    const restored: Stored = {
      sessions: applyDiff(first.next.sessions, undo.diff),
      fingerprint: undo.restoreFingerprint,
      undone: undo.undoneFingerprint,
    };
    const newFtp: PlanInput = { ...EXAMPLE_B, ftp: 260 };
    const next = evaluateOnce(plan, newFtp, restored, { ...rest, previous: { ftp: 250 } });
    expect(next.result.outcome).toBe("recalculated");
    expect(next.result.undoneFingerprint).toBeNull();
    expect(next.next.undone).toBeNull();
  });

  it("recalculating without a stored fingerprint finds nothing new to write", () => {
    const forced = evaluateOnce(plan, EXAMPLE_B, { ...first.next, fingerprint: null }, rest);
    expect(forced.result.outcome).toBe("recalculated");
    expect(isEmpty(forced.result.diff)).toBe(true);
    expect(forced.result.update).toBeNull();
  });
});

describe("example 1, variant: an amateur with Thursday available", () => {
  const input: PlanInput = {
    ...EXAMPLE_A,
    intake: { ...EXAMPLE_A.intake, availableDays: ["tue", "wed", "thu", "sat", "sun"] },
  };
  const { plan, stored } = initialState(input);
  const today = "2026-12-03";
  const history = withHistory(stored, today, ["2026-12-02"]);
  const rest = { rides: history.rides, weightEntries: NO_WEIGHT, today };

  it("moves the missed sweet spot to Thursday once: same hours, no doubling", () => {
    const first = evaluateOnce(plan, input, history.stored, rest);
    const moved = first.next.sessions.find((s) => s.date === "2026-12-03");
    expect(moved).toMatchObject({ kind: "sweet-spot", movedFrom: "2026-12-02", status: "planned" });
    expect(minutes(first.next.sessions, "2026-11-30")).toBe(
      minutes(history.stored.sessions, "2026-11-30"),
    );
    expect(first.result.update?.changes).toMatchObject([
      { date: "2026-12-03", change: "added", reasonCode: "missed-session" },
    ]);
    expect(first.result.update?.message).toBe(
      "1 session changed because Wed 2 Dec was not ridden.",
    );
    // Wednesday stays in the plan as missed.
    expect(first.next.sessions.find((s) => s.date === "2026-12-02")?.status).toBe("missed");
  });

  it("is not moved a second time when the moved session is missed too", () => {
    const first = evaluateOnce(plan, input, history.stored, rest);
    const friday = "2026-12-04";
    const second = evaluateOnce(plan, input, first.next, { ...rest, today: friday });
    expect(second.result.diff.insert.filter((i) => i.session.movedFrom !== null)).toEqual([]);
    expect(
      second.next.sessions.filter((s) => s.movedFrom !== null && s.status === "planned"),
    ).toEqual([]);
    expect(second.next.sessions.find((s) => s.date === "2026-12-03")?.status).toBe("missed");
  });

  it("is dropped when the next day is next to a hard session", () => {
    const hardFriday: StoredSession = {
      ...(history.stored.sessions.find((s) => s.date === "2026-12-02") as StoredSession),
      id: "friday-hard",
      date: "2026-12-04",
      kind: "threshold",
      mainSet: "2x10",
      matchSource: "manual",
      status: "planned",
    };
    const state: Stored = { ...history.stored, sessions: [...history.stored.sessions, hardFriday] };
    const result = evaluateOnce(plan, input, state, rest);
    expect(result.result.diff.insert.filter((i) => i.session.movedFrom !== null)).toEqual([]);
    expect(result.next.sessions.find((s) => s.date === "2026-12-03")).toBeUndefined();
  });
});

describe("example 2: an extra unplanned 150-minute Thursday ride (plan A, week 6)", () => {
  const { plan, stored } = initialState(EXAMPLE_A);
  const today = "2026-12-04"; // Friday, after the import
  const history = withHistory(stored, today);
  const thursday = ride("2026-12-03", 150, { id: "thursday", avgPowerW: 130 });
  const rest = { rides: [...history.rides, thursday], weightEntries: NO_WEIGHT, today };
  const first = evaluateOnce(plan, EXAMPLE_A, history.stored, rest);
  const before = history.stored.sessions;

  it("counts the ride as the long ride (done early) and Sunday as done", () => {
    const match = first.result.matches.find((m) => m.rideId === "thursday");
    expect(match).toMatchObject({ sessionId: "s-2026-12-06", doneEarly: true, by: "automatic" });
    expect(first.result.statusUpdates).toContainEqual({
      id: "s-2026-12-06",
      status: "done",
      activityId: "thursday",
      matchSource: "auto",
    });
    expect(first.result.extraRides).toEqual([]);
  });

  it("shortens Saturday to the 34 minutes left, rounded down to 5 and the easy minimum: 30", () => {
    expect(week(before, "2026-11-30")).toEqual([
      "02 sweet-spot 2x12 80",
      "05 endurance 60",
      "06 long 100",
    ]);
    expect(
      first.result.diff.update.map((u) => [u.date, u.before.durationMin, u.after.durationMin]),
    ).toEqual([["2026-12-05", 60, 30]]);
    expect(first.result.diff.insert).toEqual([]);
    expect(first.result.diff.delete).toEqual([]);
  });

  it("keeps the week at 4.33 h (80 + 150 ridden, 30 to come) and the next weeks as they were", () => {
    const ridden = 80 + 150;
    expect(
      ridden + (first.next.sessions.find((s) => s.date === "2026-12-05")?.durationMin ?? 0),
    ).toBe(260);
    expect(Math.round((260 / 60) * 100) / 100).toBe(4.33);
    expect(future(first.next.sessions, "2026-12-07")).toEqual(future(before, "2026-12-07"));
  });

  it("announces it and Undo restores Saturday", () => {
    const update = first.result.update;
    expect(update?.reasons).toEqual(["extra-ride"]);
    expect(update?.message).toBe(
      "1 session changed because your 150-minute ride on Thu 3 Dec counts as this week's long ride.",
    );
    expect(update?.changes[0]).toMatchObject({
      date: "2026-12-05",
      change: "minutes",
      before: { kind: "endurance", durationMin: 60, mainSet: null },
      after: { kind: "endurance", durationMin: 30, mainSet: null },
      reasonCode: "extra-ride",
    });
    const undo = first.result.undo;
    if (!undo) throw new Error("no undo");
    const restored = applyDiff(first.next.sessions, undo.diff);
    expect(restored.find((s) => s.date === "2026-12-05")?.durationMin).toBe(60);
    expect(future(restored, "2026-12-05").map((s) => s.durationMin)).toEqual(
      future(before, "2026-12-05").map((s) => s.durationMin),
    );
  });

  it("is quiet when evaluated again", () => {
    const again = evaluateOnce(plan, EXAMPLE_A, first.next, rest);
    expect(again.result.outcome).toBe("unchanged");
    expect(again.result.update).toBeNull();
  });

  it("does not turn next week into an overload week at +8 %", () => {
    expect(first.result.update?.changes.every((c) => c.date <= "2026-12-06")).toBe(true);
  });
});

describe("a new FTP changes the targets of future sessions only", () => {
  const { plan, stored } = initialState(EXAMPLE_B);
  const today = "2026-12-04"; // Friday: the threshold session is today
  const history = withHistory(stored, today);
  const rest = { rides: history.rides, weightEntries: NO_WEIGHT, today };
  const first = evaluateOnce(plan, EXAMPLE_B, history.stored, rest);
  const newFtp: PlanInput = { ...EXAMPLE_B, ftp: 275 };

  it("updates watts, keeps structure and minutes, and says so", () => {
    const next = evaluateOnce(plan, newFtp, first.next, { ...rest, previous: { ftp: 250 } });
    expect(next.result.outcome).toBe("recalculated");
    expect(next.result.update?.reasons).toEqual(["new-ftp"]);
    expect(next.result.update?.message).toBe("Targets updated for your new FTP.");
    expect(
      next.result.update?.changes.every(
        (c) => c.change === "targets" && c.reasonCode === "new-ftp",
      ),
    ).toBe(true);
    const sat = next.next.sessions.find((s) => s.date === "2026-12-05");
    const old = first.next.sessions.find((s) => s.date === "2026-12-05");
    expect(sat?.steps[0]?.target.watts.target).toBe(Math.round(275 * 0.65));
    expect(sat?.durationMin).toBe(old?.durationMin);
    expect(sat?.title).toBe(old?.title);
    // Nothing before today or from a past week changes, and every row keeps its id.
    expect(next.next.sessions.filter((s) => s.date < today)).toEqual(
      first.next.sessions.filter((s) => s.date < today),
    );
    expect(next.next.sessions.map((s) => s.id)).toEqual(first.next.sessions.map((s) => s.id));
  });

  it("keeps today's session when a ride for today already exists", () => {
    const started = { ...rest, rides: [...rest.rides, ride("2026-12-04", 30, { avgPowerW: 150 })] };
    const next = evaluateOnce(plan, newFtp, first.next, { ...started, previous: { ftp: 250 } });
    expect(next.next.sessions.find((s) => s.date === "2026-12-04")).toEqual(
      first.next.sessions.find((s) => s.date === "2026-12-04"),
    );
    expect(
      next.next.sessions.find((s) => s.date === "2026-12-05")?.steps[0]?.target.watts.target,
    ).toBe(Math.round(275 * 0.65));
  });

  it("names new heart rate zones", () => {
    const next = evaluateOnce(plan, { ...EXAMPLE_B, lthr: 172 }, first.next, {
      ...rest,
      previous: { ftp: 250, lthr: 165 },
    });
    expect(next.result.update?.reasons).toEqual(["new-heart-rate-zones"]);
    expect(next.result.update?.message).toBe("Targets updated for your new heart rate zones.");
  });
});

describe("locked matches and settings", () => {
  const { plan, stored } = initialState(EXAMPLE_B);
  const today = "2026-12-03";
  const history = withHistory(stored, today);
  const rest = { rides: history.rides, weightEntries: NO_WEIGHT, today };

  it("never replaces a session with a manual match", () => {
    const locked = history.stored.sessions.map((s) =>
      s.date === "2026-12-12" ? { ...s, matchSource: "manual" as const } : s,
    );
    const lighter: PlanInput = { ...EXAMPLE_B, intake: { ...EXAMPLE_B.intake, hoursPerWeek: 7 } };
    const result = evaluateOnce(plan, lighter, { ...history.stored, sessions: locked }, rest);
    expect(result.result.diff.update.length).toBeGreaterThan(0);
    expect(result.next.sessions.find((s) => s.date === "2026-12-12")).toEqual(
      locked.find((s) => s.date === "2026-12-12"),
    );
    expect(result.result.update?.reasons).toContain("settings-changed");
  });

  it("names changed riding days", () => {
    const fewer: PlanInput = {
      ...EXAMPLE_B,
      intake: { ...EXAMPLE_B.intake, availableDays: ["tue", "thu", "sat", "sun"] },
    };
    const result = evaluateOnce(plan, fewer, history.stored, {
      ...rest,
      previous: { ftp: 250, intake: EXAMPLE_B.intake },
    });
    expect(result.result.update?.reasons[0]).toBe("days-changed");
    expect(result.result.update?.message).toMatch(/because your riding days changed\.$/);
  });

  it("does nothing for a plan that cannot be built", () => {
    const result = evaluateOnce(plan, { ...EXAMPLE_B, ftp: null }, history.stored, rest);
    expect(result.result.outcome).toBe("blocked");
    expect(isEmpty(result.result.diff)).toBe(true);
    expect(result.result.update).toBeNull();
  });
});

describe("hard rides and back-to-back hard days", () => {
  it("makes tomorrow's hard session easy after a hard unplanned ride today", () => {
    const { plan, stored } = initialState(EXAMPLE_B);
    const today = "2026-12-03"; // Thursday; Friday is the threshold session
    const history = withHistory(stored, today);
    const hard = ride("2026-12-03", 45, { id: "hard", avgPowerW: 215 });
    const result = evaluateOnce(plan, EXAMPLE_B, history.stored, {
      rides: [...history.rides, hard],
      weightEntries: NO_WEIGHT,
      today,
    });
    expect(result.result.extraRides.map((r) => r.id)).toEqual(["hard"]);
    expect(result.next.sessions.find((s) => s.date === "2026-12-04")?.kind).toBe("endurance");
    expect(result.result.update?.changes[0]).toMatchObject({
      date: "2026-12-04",
      change: "kind",
      reasonCode: "extra-ride",
    });
  });
});

describe("ramp back and no riding", () => {
  const { plan, stored } = initialState(EXAMPLE_A);

  it("eases back in at 80 % of the last ridden week after a week without rides", () => {
    // Weeks 1 to 4 ridden, weeks 5 and 6 not at all; today is Monday of week 7.
    const today = "2026-12-07";
    const history = withHistory(stored, "2026-11-23");
    const rides = history.rides;
    const result = evaluateOnce(plan, EXAMPLE_A, history.stored, {
      rides,
      weightEntries: NO_WEIGHT,
      today,
    });
    const lastWeek = rides
      .filter((r) => r.date >= "2026-11-16" && r.date <= "2026-11-22")
      .reduce((s, r) => s + r.movingMinutes, 0);
    expect(minutes(result.next.sessions, "2026-12-07")).toBeLessThanOrEqual(
      Math.floor(lastWeek * 0.8),
    );
    const ramp = result.result.update?.changes.filter((c) => c.reasonCode === "ramp-back") ?? [];
    expect(ramp.length).toBeGreaterThan(0);
    expect(result.result.update?.reasons).toContain("ramp-back");
    // The second week back is 8 % higher, still under the plan.
    const second = minutes(result.next.sessions, "2026-12-14");
    expect(second).toBeLessThanOrEqual(Math.floor(lastWeek * 0.8 * 1.08));
  });

  it("changes nothing after 21 days without a ride, and offers a new plan", () => {
    const today = "2026-12-14";
    const history = withHistory(stored, "2026-11-23");
    const result = evaluateOnce(plan, EXAMPLE_A, history.stored, {
      rides: history.rides,
      weightEntries: NO_WEIGHT,
      today,
    });
    expect(result.result.inactivity?.days).toBeGreaterThanOrEqual(21);
    expect(result.result.inactivity?.message).toMatch(/not changed/);
    expect(isEmpty(result.result.diff)).toBe(true);
    expect(result.result.update).toBeNull();
  });
});

describe("the weight loop in a plan", () => {
  /** A weigh-in a day from 4 weeks before the plan start up to `to`, falling `rate` kg a week. */
  function weights(to: IsoDate, rate: number): WeightEntry[] {
    const out: WeightEntry[] = [];
    for (let i = 0; i <= 28 + 100; i += 1) {
      const date = addDays("2026-09-28", i) as IsoDate;
      if (date > to) break;
      out.push({ date, kg: 90 - (rate / 7) * i });
    }
    return out;
  }

  it("holds the hours when the trend falls faster than the cap twice in a row", () => {
    const { plan, stored } = initialState(EXAMPLE_D);
    const today = "2026-11-09"; // Monday of week 3: checks of weeks 1 to 3, all fast
    const history = withHistory(stored, today);
    const result = evaluateOnce(plan, EXAMPLE_D, history.stored, {
      rides: history.rides,
      weightEntries: weights(today, 0.8),
      today,
    });
    expect(result.result.weight?.state).toBe("faster-than-cap");
    expect(result.result.weight?.holdWeeks).toEqual([2, 3, 4]);
    expect(result.result.update?.reasons).toContain("weight-faster-than-cap");
    expect(result.result.update?.message).toMatch(
      /^Your weight trend fell 0\.8 kg a week in the last 2 weeks\./,
    );
    // Week 3 does not grow: it holds the hours of the weeks before it.
    expect(minutes(result.next.sessions, "2026-11-09")).toBeLessThan(
      minutes(history.stored.sessions, "2026-11-09"),
    );
    expect(minutes(result.next.sessions, "2026-11-09")).toBeLessThanOrEqual(
      minutes(history.stored.sessions, "2026-11-02"),
    );
    for (const change of result.result.update?.changes ?? [])
      expect(change.date >= today).toBe(true);
  });

  it("adds one easy ride when the trend is flat three weeks and a day is free", () => {
    const input: PlanInput = {
      ...EXAMPLE_D,
      intake: { ...EXAMPLE_D.intake, availableDays: ["tue", "wed", "thu", "sat", "sun"] },
    };
    const { plan, stored } = initialState(input);
    const today = "2026-11-09";
    const history = withHistory(stored, today);
    const result = evaluateOnce(plan, input, history.stored, {
      rides: history.rides,
      weightEntries: weights(today, 0),
      today,
    });
    expect(result.result.weight?.extraEasyRideWeeks).toEqual([3]);
    const added = result.result.diff.insert.map((i) => i.session);
    expect(added).toHaveLength(1);
    expect(added[0]).toMatchObject({ kind: "endurance", week: 3 });
    expect((added[0]?.durationMin ?? 0) <= 45).toBe(true);
    expect(result.result.update?.reasons).toEqual(["weight-stalled"]);
    expect(result.result.update?.message).toContain("flat for 3 weeks");
  });

  it("only says so when every available day already has a ride", () => {
    const { plan, stored } = initialState(EXAMPLE_D);
    const today = "2026-11-09";
    const history = withHistory(stored, today);
    const result = evaluateOnce(plan, EXAMPLE_D, history.stored, {
      rides: history.rides,
      weightEntries: weights(today, 0),
      today,
    });
    expect(isEmpty(result.result.diff)).toBe(true);
    expect(result.result.weight?.notice).toBe(STALLED_NO_ROOM_NOTICE);
  });

  it("does not run the weight rules when weight loss is not a purpose", () => {
    const { plan, stored } = initialState(EXAMPLE_A);
    const today = "2026-11-09";
    const history = withHistory(stored, today);
    const result = evaluateOnce(plan, EXAMPLE_A, history.stored, {
      rides: history.rides,
      weightEntries: weights(today, 0.8),
      today,
    });
    expect(result.result.weight).toBeNull();
  });
});

describe("the result is a function of its arguments", () => {
  it("gives the same result for the same arguments and the shuffled lists", () => {
    const { plan, stored } = initialState(EXAMPLE_B);
    const today = "2026-12-03";
    const history = withHistory(stored, today, ["2026-12-02"]);
    const args = (sessions: StoredSession[], rides = history.rides) => ({
      plan: { startDate: plan.startDate },
      sessions,
      rides,
      weightEntries: NO_WEIGHT,
      profileInput: EXAMPLE_B,
      today,
      lastFingerprint: null,
      undoneFingerprint: null,
    });
    const a = evaluatePlan(args(history.stored.sessions));
    const b = evaluatePlan(
      args([...history.stored.sessions].reverse(), [...history.rides].reverse()),
    );
    expect(b).toEqual(a);
    expect(evaluatePlan(args(history.stored.sessions))).toEqual(a);
    const input = structuredClone(history.stored.sessions);
    evaluatePlan(args(input));
    expect(input).toEqual(history.stored.sessions);
  });

  it("applyStatuses and applyResult agree on the new state", () => {
    const { plan, stored } = initialState(EXAMPLE_B);
    const today = "2026-12-03";
    const history = withHistory(stored, today, ["2026-12-02"]);
    const { result } = evaluateOnce(plan, EXAMPLE_B, history.stored, {
      rides: history.rides,
      weightEntries: NO_WEIGHT,
      today,
    });
    const applied = applyResult(history.stored, result);
    expect(applied.fingerprint).toBe(result.fingerprint);
    expect(
      applyStatuses(history.stored.sessions, result.statusUpdates).find(
        (s) => s.id === "s-2026-12-02",
      )?.status,
    ).toBe("missed");
    expect(buildPlan(EXAMPLE_B).status).toBe("ok");
  });
});

function isEmpty(diff: { insert: unknown[]; update: unknown[]; delete: unknown[] }): boolean {
  return diff.insert.length === 0 && diff.update.length === 0 && diff.delete.length === 0;
}

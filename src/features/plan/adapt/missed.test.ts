/** Missed-session handling and overload (docs/plan/engine-rules.md section 13). */
import { describe, expect, it } from "vitest";
import type { IsoDate } from "@/features/athlete";
import type { PlanInput } from "../engine";
import { EXAMPLE_A, EXAMPLE_B } from "../engine/fixtures";
import { evaluateOnce, initialState, ride, withHistory, type Stored } from "./test-helpers";
import type { StoredSession } from "./types";

const NO_WEIGHT: never[] = [];

function find(sessions: readonly StoredSession[], date: IsoDate): StoredSession | undefined {
  return sessions.find((s) => s.date === date);
}

describe("a missed long ride", () => {
  const input: PlanInput = {
    ...EXAMPLE_A,
    intake: { ...EXAMPLE_A.intake, availableDays: ["tue", "wed", "thu", "sat", "sun"] },
  };
  const { plan, stored } = initialState(input);

  /** Wednesday 2 Dec becomes a long ride that was not ridden. */
  function withMissedLong(today: IsoDate): {
    state: Stored;
    rides: ReturnType<typeof withHistory>["rides"];
  } {
    const history = withHistory(stored, today, ["2026-12-02"]);
    const sunday = find(history.stored.sessions, "2026-12-06") as StoredSession;
    const sessions = history.stored.sessions.map((s) =>
      s.date === "2026-12-02"
        ? { ...sunday, id: s.id, date: s.date, slot: "long" as const, durationMin: s.durationMin }
        : s,
    );
    return { state: { ...history.stored, sessions }, rides: history.rides };
  }

  it("moves to the next free available day when the day before is not a hard day", () => {
    const { state, rides } = withMissedLong("2026-12-03");
    const result = evaluateOnce(plan, input, state, {
      rides,
      weightEntries: NO_WEIGHT,
      today: "2026-12-03",
    });
    expect(find(result.next.sessions, "2026-12-03")).toMatchObject({
      kind: "long",
      movedFrom: "2026-12-02",
      status: "planned",
    });
    expect(find(result.next.sessions, "2026-12-02")?.status).toBe("missed");
  });

  it("is dropped when no free available day is left this week", () => {
    const { state, rides } = withMissedLong("2026-12-05");
    const result = evaluateOnce(plan, input, state, {
      rides,
      weightEntries: NO_WEIGHT,
      today: "2026-12-05",
    });
    expect(result.next.sessions.filter((s) => s.movedFrom !== null)).toEqual([]);
  });
});

describe("missed structured sessions in plan B", () => {
  const { plan, stored } = initialState(EXAMPLE_B);

  it("skipped is a PO action: never moved, but the ladder step repeats like a missed one", () => {
    const today = "2026-12-03";
    const history = withHistory(stored, today, ["2026-12-02"]);
    const skipped: Stored = {
      ...history.stored,
      sessions: history.stored.sessions.map((s) =>
        s.date === "2026-12-02"
          ? { ...s, status: "skipped" as const, matchSource: "manual" as const }
          : s,
      ),
    };
    const result = evaluateOnce(plan, EXAMPLE_B, skipped, {
      rides: history.rides,
      weightEntries: NO_WEIGHT,
      today,
    });
    expect(find(result.next.sessions, "2026-12-02")?.status).toBe("skipped");
    expect(result.next.sessions.filter((s) => s.movedFrom !== null)).toEqual([]);
    expect(find(result.next.sessions, "2026-12-09")?.mainSet).toBe("5x4");
  });

  it("two structured sessions missed within 7 days: next week has one hard session fewer", () => {
    const today = "2026-12-05"; // Saturday; Wednesday's VO2 and Friday's threshold were not ridden
    const history = withHistory(stored, today, ["2026-12-02", "2026-12-04"]);
    const result = evaluateOnce(plan, EXAMPLE_B, history.stored, {
      rides: history.rides,
      weightEntries: NO_WEIGHT,
      today,
    });
    expect(find(result.next.sessions, "2026-12-02")?.status).toBe("missed");
    expect(find(result.next.sessions, "2026-12-04")?.status).toBe("missed");
    // Next week: the VO2 stays, the later hard session becomes an easy ride (budget minus 1, at least 1).
    expect(find(result.next.sessions, "2026-12-09")?.kind).toBe("vo2");
    expect(find(result.next.sessions, "2026-12-11")?.kind).toBe("endurance");
    expect(find(history.stored.sessions, "2026-12-11")?.kind).toBe("threshold");
    expect(result.result.update?.reasons).toContain("missed-session");
  });

  it("one missed structured session does not lower the next week's budget", () => {
    const today = "2026-12-03";
    const history = withHistory(stored, today, ["2026-12-02"]);
    const result = evaluateOnce(plan, EXAMPLE_B, history.stored, {
      rides: history.rides,
      weightEntries: NO_WEIGHT,
      today,
    });
    expect(find(result.next.sessions, "2026-12-11")?.kind).toBe("threshold");
  });

  it("never makes up a missed session: the week's other days and hours stay", () => {
    const today = "2026-12-03";
    const history = withHistory(stored, today, ["2026-12-02"]);
    const result = evaluateOnce(plan, EXAMPLE_B, history.stored, {
      rides: history.rides,
      weightEntries: NO_WEIGHT,
      today,
    });
    const before = history.stored.sessions.filter(
      (s) => s.date >= "2026-12-03" && s.date <= "2026-12-06",
    );
    const after = result.next.sessions.filter(
      (s) => s.date >= "2026-12-03" && s.date <= "2026-12-06",
    );
    expect(after).toEqual(before);
  });
});

describe("overload", () => {
  it("a loading week more than 25 % above plan holds the next week and turns its Q2 into endurance", () => {
    const { plan, stored } = initialState(EXAMPLE_B);
    const today = "2026-12-07"; // Monday: week 6 (480 planned minutes) is over
    const history = withHistory(stored, today);
    const extras = [
      ride("2026-11-30", 100, { avgPowerW: 120 }),
      ride("2026-12-03", 100, { avgPowerW: 120 }),
    ];
    const result = evaluateOnce(plan, EXAMPLE_B, history.stored, {
      rides: [...history.rides, ...extras],
      weightEntries: NO_WEIGHT,
      today,
    });
    // 480 planned + 200 extra = 680, above 600 (125 %).
    expect(find(result.next.sessions, "2026-12-11")).toMatchObject({ kind: "endurance" });
    expect(find(history.stored.sessions, "2026-12-11")?.kind).toBe("threshold");
    expect(
      result.result.update?.changes.some(
        (c) => c.date === "2026-12-11" && c.reasonCode === "extra-ride",
      ),
    ).toBe(true);
  });

  it("a week at +10 % is not an overload", () => {
    const { plan, stored } = initialState(EXAMPLE_B);
    const today = "2026-12-07";
    const history = withHistory(stored, today);
    const result = evaluateOnce(plan, EXAMPLE_B, history.stored, {
      rides: [...history.rides, ride("2026-12-03", 45, { avgPowerW: 120 })],
      weightEntries: NO_WEIGHT,
      today,
    });
    expect(find(result.next.sessions, "2026-12-11")?.kind).toBe("threshold");
  });
});

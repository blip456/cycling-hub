import { describe, expect, it } from "vitest";
import { summarizeMonth, summarizeSession, summarizeWeek } from "../export";
import {
  changeLines,
  contextFrom,
  goalsFrom,
  kindFromDb,
  matchInfo,
  mondayOf,
  monthInput,
  planWeekAt,
  rideFromRow,
  sessionFromRow,
  sessionInput,
  stepsFromJson,
  weekInput,
} from "./adapt";
import type { PlanData, PlanSessionRow } from "./types";

import { PLAN, PLAN_DATA, PROFILE, ROWS, rideRow } from "./test-support";

describe("session kinds", () => {
  it("maps the database spelling to the engine's", () => {
    expect(kindFromDb("long_ride")).toBe("long");
    expect(kindFromDb("sweet_spot")).toBe("sweet-spot");
    expect(kindFromDb("vo2max")).toBe("vo2");
    expect(kindFromDb("threshold")).toBe("threshold");
    expect(kindFromDb("something-new")).toBe("endurance");
  });
});

describe("steps", () => {
  it("reads the stored engine steps and keeps the total length", () => {
    const row = ROWS.find((r) => r.kind === "threshold");
    expect(row).toBeDefined();
    const steps = stepsFromJson(row?.steps, 250);
    const minutes = steps.reduce((sum, s) => sum + s.minutes * (s.repeats ?? 1), 0);
    expect(minutes).toBeCloseTo(row?.duration_min ?? 0, 1);
    expect(steps.some((s) => s.watts !== null)).toBe(true);
  });

  it("shows repeated work and rest steps as blocks", () => {
    const threshold = ROWS.find((r) => r.kind === "threshold");
    const blocks = stepsFromJson(threshold?.steps, 250);
    expect(blocks.find((s) => s.label === "Threshold")?.repeats).toBe(2);
    expect(blocks.find((s) => s.label === "Rest")?.repeats).toBe(1);
    const vo2 = ROWS.find((r) => r.kind === "vo2max");
    const intervals = stepsFromJson(vo2?.steps, 250);
    expect(intervals.find((s) => s.label === "VO2 max")?.repeats).toBe(5);
    expect(intervals.find((s) => s.label === "Rest")?.repeats).toBe(4);
  });

  it("leaves out steps that cannot be read and gives nothing for a non-array", () => {
    expect(stepsFromJson("nope", 250)).toEqual([]);
    expect(stepsFromJson([{ label: 5 }, null, 3], 250)).toEqual([]);
  });

  it("fills in watts from the FTP when the stored step has none", () => {
    const steps = stepsFromJson(
      [
        {
          kind: "work",
          label: "Endurance",
          durationSec: 3600,
          target: { percentFtp: 65, minPercent: 56, maxPercent: 75 },
          heartRate: null,
        },
      ],
      200,
    );
    expect(steps[0]?.watts).toEqual({ min: 112, max: 150 });
    expect(
      stepsFromJson(
        [
          {
            label: "X",
            durationSec: 60,
            target: { percentFtp: 65, minPercent: 56, maxPercent: 75 },
          },
        ],
        null,
      )[0]?.watts,
    ).toBeNull();
  });
});

describe("sessions", () => {
  it("adapts a stored session with its target, hard flag and reason", () => {
    const row = ROWS.find((r) => r.kind === "long_ride") as PlanSessionRow;
    const session = sessionFromRow(row, 250);
    expect(session).toMatchObject({
      id: row.id,
      date: row.session_date,
      title: row.title,
      minutes: row.duration_min,
      status: "planned",
      description: "long steady endurance",
    });
    expect(session?.reason).toBe(row.reason);
    expect(session?.target?.watts).not.toBeNull();
    expect(session?.steps.length).toBeGreaterThan(0);
  });

  it("leaves dropped sessions out and blank reasons null", () => {
    const row = ROWS[0] as PlanSessionRow;
    expect(sessionFromRow({ ...row, status: "dropped" }, 250)).toBeNull();
    expect(sessionFromRow({ ...row, reason: "  " }, 250)?.reason).toBeNull();
  });

  it("marks a session with quality minutes as hard", () => {
    const row = ROWS[0] as PlanSessionRow;
    expect(sessionFromRow({ ...row, quality_min: 20 }, 250)?.hard).toBe(true);
    expect(sessionFromRow({ ...row, quality_min: 0 }, 250)?.hard).toBe(false);
  });
});

describe("rides", () => {
  it("adapts a ride row, leaving the name out", () => {
    const ride = rideFromRow(rideRow(), {
      normalizedPowerW: 181,
      powerZoneMinutes: [10, 100, 10, 0, 0, 0, 0],
      hrZoneMinutes: null,
    });
    expect(ride).toMatchObject({
      id: "ride-1",
      date: "2026-10-28",
      movingMinutes: 120,
      distanceKm: 60,
      climbingM: 400,
      avgPowerW: 170,
      normalizedPowerW: 181,
      avgHr: 140,
      maxHr: 160,
      hrZoneMinutes: null,
      intervalWatts: null,
    });
    expect(ride.avgSpeedKmh).toBeCloseTo(30, 5);
    expect("name" in ride).toBe(false);
  });

  it("gives null for a ride without power, heart rate or a stream", () => {
    const ride = rideFromRow(
      rideRow({
        average_watts: null,
        average_heartrate: null,
        max_heartrate: null,
        elevation_m: 0,
      }),
      null,
    );
    expect(ride).toMatchObject({
      avgPowerW: null,
      avgHr: null,
      maxHr: null,
      climbingM: null,
      normalizedPowerW: null,
      powerZoneMinutes: null,
      hrZoneMinutes: null,
    });
  });

  it("flags a short, easier or harder ride (engine rules section 11)", () => {
    const row = ROWS.find((r) => r.kind === "endurance") as PlanSessionRow;
    const session = sessionFromRow(row, 250);
    if (!session) throw new Error("no session");
    const planned = row.duration_min;
    const short = rideFromRow(rideRow({ moving_time_s: Math.round(planned * 0.6 * 60) }), null);
    expect(matchInfo(row, session, short, 250)).toMatchObject({
      by: "automatic",
      flags: ["short"],
      shortByMinutes: Math.round(planned * 0.4),
    });
    const easy = rideFromRow(rideRow({ moving_time_s: planned * 60, average_watts: 80 }), null);
    expect(matchInfo({ match_source: "manual" }, session, easy, 250)).toMatchObject({
      by: "manual",
      flags: ["easier"],
    });
    const hard = rideFromRow(rideRow({ moving_time_s: planned * 60, average_watts: 240 }), null);
    expect(matchInfo(row, session, hard, 250).flags).toEqual(["harder"]);
    const unknown = rideFromRow(
      rideRow({ moving_time_s: planned * 60, average_watts: null }),
      null,
    );
    expect(matchInfo(row, session, unknown, 250).flags).toEqual([]);
    expect(matchInfo(row, session, hard, null).flags).toEqual([]);
  });
});

describe("profile and weight", () => {
  it("turns the profile and the weight goal into summary goals", () => {
    expect(goalsFrom(PROFILE, { targetKg: 73, targetDate: "2026-12-13" })).toEqual({
      purposes: ["weight loss", "endurance"],
      level: "committed",
      targetWeightKg: 73,
      targetWeightDate: "2026-12-13",
      eventName: "100 km ride",
      eventDate: "2027-01-17",
      hoursPerWeek: 8,
      environment: "both",
      availableDays: ["tue", "thu", "sat", "sun"],
      goalText: null,
    });
  });

  it("handles an empty profile and no weight goal", () => {
    const goals = goalsFrom(
      {
        trainingPurposes: [],
        level: null,
        weeklyHours: null,
        ridingEnvironment: "indoor",
        availableDays: [],
        eventName: null,
        eventDate: null,
        goal: "Ride more",
      },
      null,
    );
    expect(goals).toMatchObject({
      purposes: [],
      level: null,
      targetWeightKg: null,
      environment: "indoors",
      goalText: "Ride more",
    });
  });

  it("takes the cap from the newest weigh-in and has none without weigh-ins", () => {
    const base = { madeAt: new Date(0), ftp: 250, lthr: null, maxHr: null, goals: null };
    expect(contextFrom({ ...base, weight: [] }).weightRateCapKgPerWeek).toBeNull();
    const context = contextFrom({
      ...base,
      weight: [
        { date: "2026-10-01", kg: 80 },
        { date: "2026-10-28", kg: 75.1 },
      ],
    });
    expect(context.weightRateCapKgPerWeek).toBe(0.38);
  });
});

describe("plan changes", () => {
  it("lists the reasons in a range and leaves undone changes out", () => {
    const lines = changeLines(
      [
        {
          created_at: "2026-10-27T10:00:00Z",
          reason: "A missed session moved the plan.",
          undone_at: null,
        },
        {
          created_at: "2026-10-27T11:00:00Z",
          reason: "Undone one.",
          undone_at: "2026-10-27T11:05:00Z",
        },
        { created_at: "2026-11-05T10:00:00Z", reason: "Later.", undone_at: null },
      ],
      "2026-10-26",
      "2026-11-01",
    );
    expect(lines).toEqual(["A missed session moved the plan."]);
  });

  it("counts a change at 00:30 Brussels time on the Brussels day", () => {
    const lines = changeLines(
      [{ created_at: "2026-10-26T23:30:00Z", reason: "Late.", undone_at: null }],
      "2026-10-27",
      "2026-10-27",
    );
    expect(lines).toEqual(["Late."]);
  });
});

describe("summary inputs from a plan", () => {
  const rides = new Map([
    [
      "ride-1",
      rideFromRow(
        rideRow({ id: "ride-1", start_local: `${ROWS[0]?.session_date}T08:00:00` }),
        null,
      ),
    ],
  ]);
  const lookups = { plan: PLAN_DATA, ftp: 250, rides, changes: [] };
  const week1 = ROWS.filter((r) => r.week_number === 1);

  it("finds the Monday and the plan week of a date", () => {
    expect(mondayOf("2026-10-28")).toBe("2026-10-26");
    expect(mondayOf("2026-11-01")).toBe("2026-10-26");
    expect(planWeekAt(PLAN_DATA, "2026-10-26")).toBe(1);
    expect(planWeekAt(PLAN_DATA, "2026-11-02")).toBe(2);
    expect(planWeekAt(PLAN_DATA, "2026-10-19")).toBeNull();
    expect(planWeekAt({ plan: null, sessions: [] }, "2026-10-26")).toBeNull();
  });

  it("builds the week input with the records, the matched ride and the coming week", () => {
    const first = ROWS[0] as PlanSessionRow;
    const data: PlanData = {
      ...PLAN_DATA,
      sessions: ROWS.map((r) =>
        r.id === first.id
          ? { ...r, status: "done", activity_id: "ride-1", match_source: "auto" }
          : r,
      ),
    };
    const input = weekInput("2026-10-28", { ...lookups, plan: data });
    expect(input.start).toBe("2026-10-26");
    expect(input.week).toEqual({
      number: 1,
      of: PLAN.weeks.length,
      phase: "base",
      recovery: false,
    });
    expect(input.records).toHaveLength(week1.length);
    expect(input.records.find((r) => r.session.id === first.id)?.ride?.id).toBe("ride-1");
    expect(input.next?.week.number).toBe(2);
    expect(input.next?.sessions.length).toBeGreaterThan(0);
    expect(input.rides.map((r) => r.id)).toEqual(["ride-1"]);
  });

  it("builds a week outside the plan from the rides only", () => {
    const input = weekInput("2026-10-14", lookups);
    expect(input.week).toBeNull();
    expect(input.records).toEqual([]);
    expect(input.next).toBeNull();
  });

  it("builds a session input with its week", () => {
    const input = sessionInput(ROWS[0] as PlanSessionRow, lookups);
    expect(input?.week?.number).toBe(1);
    expect(input?.ride).toBeNull();
    expect(input?.session?.id).toBe(ROWS[0]?.id);
  });

  it("builds the month input with the plan weeks that touch the month", () => {
    const input = monthInput(2026, 11, lookups);
    expect(input.weeks.map((w) => w.week.number)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(input.weeks[0]?.start).toBe("2026-10-26");
    const december = monthInput(2026, 12, lookups);
    expect(december.weeks[0]?.week.number).toBe(6);
    expect(monthInput(2025, 1, lookups).weeks).toEqual([]);
  });

  it("produces readable summaries through the real summary functions", () => {
    const context = contextFrom({
      madeAt: new Date("2026-10-29T10:00:00Z"),
      ftp: 250,
      lthr: 165,
      maxHr: null,
      goals: goalsFrom(PROFILE, { targetKg: 73, targetDate: "2026-12-13" }),
      weight: [{ date: "2026-10-28", kg: 75.1 }],
    });
    const options = { includeWeight: true, includeGoals: true, promptLine: null };
    const week = summarizeWeek(weekInput("2026-10-28", lookups), context, options);
    expect(week).toContain("# Training week 1 of 12: Mon 26 Oct to Sun 1 Nov 2026");
    expect(week).toContain("## Planned vs done");
    expect(week).toContain("## Goals");
    const month = summarizeMonth(monthInput(2026, 10, lookups), context, options);
    expect(month).toContain("# Training month: October 2026");
    const session = summarizeSession(
      sessionInput(ROWS[0] as PlanSessionRow, lookups) ?? {
        session: null,
        ride: null,
        match: null,
        week: null,
      },
      context,
      { ...options, includeWeight: false },
    );
    expect(session).toContain("# Session:");
    expect(session).not.toContain("## Weight");
  });

  it("says plainly when there is no power data or weight", () => {
    const context = contextFrom({
      madeAt: new Date("2026-10-29T10:00:00Z"),
      ftp: null,
      lthr: null,
      maxHr: null,
      goals: null,
      weight: [],
    });
    const noPower = new Map([
      [
        "ride-1",
        rideFromRow(
          rideRow({ average_watts: null, start_local: `${ROWS[0]?.session_date}T08:00:00` }),
          null,
        ),
      ],
    ]);
    const text = summarizeWeek(
      weekInput("2026-10-28", { ...lookups, ftp: null, rides: noPower }),
      context,
      { includeWeight: true, includeGoals: false, promptLine: null },
    );
    expect(text).toContain("## Weight");
    expect(text.toLowerCase()).toMatch(/no weight|n\/a|not enough/);
  });
});

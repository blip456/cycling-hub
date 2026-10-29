import { describe, expect, it } from "vitest";
import { WEEKDAYS, weekdayIndex } from "@/features/athlete";
import { buildPlan, rideCount } from "./build";
import { EXAMPLE_A, EXAMPLE_B, EXAMPLE_C, EXAMPLE_D, EXAMPLE_TODAY } from "./fixtures";
import { checkPlan } from "./plan-checks";
import type { Intake, PlanInput, PlannedSession } from "./types";

function make(
  patch: Partial<Intake>,
  base: PlanInput = EXAMPLE_A,
  rest: Partial<PlanInput> = {},
): PlanInput {
  return { ...base, ...rest, intake: { ...base.intake, ...patch } };
}

const weekday = (s: PlannedSession) => WEEKDAYS[weekdayIndex(s.date) ?? 0];
const kinds = (plan: ReturnType<typeof buildPlan>, week: number) =>
  plan.weeks[week - 1]?.sessions.map((s) => s.kind);

describe("a plan that cannot be built", () => {
  it("is blocked without an FTP", () => {
    for (const ftp of [null, 0, Number.NaN]) {
      const plan = buildPlan({ ...EXAMPLE_A, ftp });
      expect(plan.status).toBe("blocked");
      expect(plan.weeks).toEqual([]);
      expect(plan.sessions).toEqual([]);
      expect(plan.warnings.map((w) => w.code)).toContain("no-ftp");
      expect(plan.ftp).toBeNull();
    }
  });

  it("is blocked with fewer than 2 available days", () => {
    const plan = buildPlan(make({ availableDays: ["sat"] }));
    expect(plan.status).toBe("blocked");
    expect(plan.warnings.map((w) => w.code)).toEqual(["too-few-days"]);
    expect(buildPlan(make({ availableDays: [] })).status).toBe("blocked");
    expect(buildPlan(make({ availableDays: ["sat", "sun"] })).status).toBe("ok");
  });

  it("is blocked for an invalid today", () => {
    expect(buildPlan({ ...EXAMPLE_A, today: "nonsense" }).warnings.map((w) => w.code)).toContain(
      "invalid-input",
    );
  });
});

describe("level and hours", () => {
  it("gates the level by hours and clamps the hours, and says so", () => {
    const plan = buildPlan(make({ hoursPerWeek: 9 }, EXAMPLE_C));
    expect(plan.level).toBe("committed");
    expect(plan.hoursPerWeek).toBe(9);
    expect(plan.notices.map((n) => n.code)).toContain("level-gated");
    const clamped = buildPlan(make({ hoursPerWeek: 11 }));
    expect(clamped.level).toBe("amateur");
    expect(clamped.hoursPerWeek).toBe(6);
    expect(clamped.notices.map((n) => n.code)).toContain("hours-clamped");
  });

  it("uses the level override", () => {
    const plan = buildPlan(make({ levelOverride: "committed", hoursPerWeek: 7 }));
    expect(plan.level).toBe("committed");
    expect(plan.notices.map((n) => n.code)).toContain("level-overridden");
  });

  it("starts week 1 from the recent riding hours with history", () => {
    const normal = buildPlan(make({ hoursPerWeek: 8 }, EXAMPLE_B));
    const history = buildPlan({
      ...make({ hoursPerWeek: 8 }, EXAMPLE_B),
      adjustments: { recentAverageHours: 2 },
    });
    expect(normal.weeks[0]?.targetMinutes).toBe(360);
    expect(history.weeks[0]?.targetMinutes).toBe(285);
    expect(history.notices.map((n) => n.code)).toContain("history-start");
    expect(checkPlan(history, make({ hoursPerWeek: 8 }, EXAMPLE_B))).toEqual([]);
  });

  it("gives round(H / 1.6) rides within the level range and the days", () => {
    const base = { level: "committed", hoursPerWeek: 8, availableDays: 7, main: "speed" } as const;
    expect(rideCount(base)).toBe(5);
    expect(rideCount({ ...base, hoursPerWeek: 6 })).toBe(4);
    expect(rideCount({ ...base, availableDays: 4 })).toBe(4);
    expect(rideCount({ ...base, main: "weight-loss" })).toBe(5);
    expect(rideCount({ ...base, level: "amateur", hoursPerWeek: 3, availableDays: 2 })).toBe(2);
  });
});

describe("purposes", () => {
  it("uses the top two ranked purposes and defaults to endurance", () => {
    const plan = buildPlan(
      make({ purposes: ["speed", "endurance", "weight-loss", "muscle-building"] }),
    );
    expect(plan.purposes).toEqual({ main: "speed", secondary: "endurance" });
    expect(buildPlan(make({ purposes: [] })).purposes).toEqual({
      main: "endurance",
      secondary: null,
    });
  });

  it("gives an amateur speed plan VO2 in build and no sprints at all", () => {
    const plan = buildPlan(make({ purposes: ["speed"] }));
    const all = plan.sessions.map((s) => s.kind);
    expect(all).not.toContain("sprint");
    expect(plan.weeks[4]?.sessions.find((s) => s.slot === "q1")?.kind).toBe("vo2");
    expect(checkPlan(plan, make({ purposes: ["speed"] }))).toEqual([]);
  });

  it("follows the main purpose for the long ride and the second purpose for Q2", () => {
    const input = make({ purposes: ["endurance", "speed"] }, EXAMPLE_B, {});
    const plan = buildPlan({ ...input, intake: { ...input.intake, event: undefined as never } });
    const week6 = plan.weeks[5]?.sessions.map((s) => s.kind);
    // Endurance Q1 in build is sweet spot, speed's Q1 in build is VO2 and becomes Q2.
    expect(week6).toContain("sweet-spot");
    expect(week6).toContain("vo2");
    expect(plan.weeks[5]?.sessions.find((s) => s.kind === "long")?.mainSet).toBeNull();
  });

  it("lets an amateur follow the secondary purpose in weeks 3, 7 and 11", () => {
    const input = make({ purposes: ["endurance", "speed"] });
    const plan = buildPlan(input);
    const q1 = plan.weeks.map((w) => w.sessions.find((s) => s.slot === "q1")?.kind);
    expect(q1[2]).toBe("sweet-spot"); // speed base Q1
    expect(q1[6]).toBe("vo2"); // speed build Q1
    expect(q1[10]).toBe("vo2"); // speed peak Q1 (a loading week)
    expect(q1[0]).toBe("tempo");
    expect(q1[4]).toBe("sweet-spot");
    expect(q1[8]).toBe("threshold");
  });

  it("keeps weight loss as main purpose to one hard session for a committed rider and two for semi-pro", () => {
    const committed = buildPlan(
      make({ purposes: ["weight-loss"], hoursPerWeek: 8 }, EXAMPLE_B, {}),
    );
    for (const w of committed.weeks.filter((w) => w.type === "loading")) {
      expect(w.structuredCount).toBeLessThanOrEqual(1);
    }
    const semi = buildPlan(make({ purposes: ["weight-loss"] }, EXAMPLE_C));
    const loading = semi.weeks.filter((w) => w.type === "loading");
    expect(loading.every((w) => w.structuredCount === 2)).toBe(true);
    expect(semi.weeks[5]?.sessions.filter((s) => s.mainSet !== null)).toHaveLength(2);
    expect(semi.weeks[5]?.sessions.find((s) => s.kind === "long")?.mainSet).toBeNull();
  });

  it("gives weight loss a ride on every available day up to the level maximum", () => {
    const plan = buildPlan(EXAMPLE_D);
    expect(plan.weeks[0]?.sessions).toHaveLength(4);
    const semi = buildPlan(make({ purposes: ["weight-loss"] }, EXAMPLE_C));
    expect(semi.weeks[0]?.sessions).toHaveLength(6);
  });

  it("keeps Q2 as endurance when weight loss is the secondary purpose", () => {
    const input = make({ purposes: ["speed", "weight-loss"], hoursPerWeek: 8 }, EXAMPLE_B, {});
    const plan = buildPlan(input);
    expect(plan.weeks[5]?.structuredCount).toBe(1);
  });

  it("never lets weight loss as secondary raise the hard budget", () => {
    const input = make({ purposes: ["muscle-building", "weight-loss"] }, EXAMPLE_C, {});
    const plan = buildPlan(input);
    expect(checkPlan(plan, input)).toEqual([]);
  });
});

describe("strength notes (muscle building)", () => {
  it("gives 2 notes a week for main muscle building and 1 for an amateur", () => {
    const committed = buildPlan(
      make({ purposes: ["muscle-building"], hoursPerWeek: 8 }, EXAMPLE_B, {}),
    );
    const week6 = committed.weeks[5]?.sessions.filter((s) => s.strengthNote !== null);
    expect(week6).toHaveLength(2);
    const amateur = buildPlan(make({ purposes: ["muscle-building"] }));
    expect(amateur.weeks[5]?.sessions.filter((s) => s.strengthNote !== null)).toHaveLength(1);
  });

  it("puts notes on hard-session days, not on easy days, and not in the taper", () => {
    const input = make({ purposes: ["muscle-building"], hoursPerWeek: 8 }, EXAMPLE_B, {});
    const plan = buildPlan(input);
    for (const s of plan.sessions) {
      if (s.strengthNote !== null) {
        expect(["q1", "q2"]).toContain(s.slot);
        expect(s.kind).not.toBe("test");
      }
    }
    for (const w of plan.weeks.filter((w) => w.type === "taper")) {
      expect(w.sessions.every((s) => s.strengthNote === null)).toBe(true);
    }
  });

  it("never puts a note on the day before a test or the event", () => {
    const plan = buildPlan(EXAMPLE_C);
    const dates = new Map(plan.sessions.map((s) => [s.date, s]));
    for (const s of plan.sessions) {
      if (s.strengthNote === null) continue;
      const next = new Date(Date.parse(s.date) + 86_400_000).toISOString().slice(0, 10);
      expect(["test", "event"]).not.toContain(dates.get(next)?.kind);
    }
  });

  it("has no notes without muscle building", () => {
    expect(buildPlan(EXAMPLE_A).sessions.every((s) => s.strengthNote === null)).toBe(true);
  });

  it("is a note only: it does not change hours or load", () => {
    const plan = buildPlan(EXAMPLE_C);
    const minutes = plan.weeks[5]?.sessions.reduce((sum, s) => sum + s.durationMin, 0);
    expect(minutes).toBe(plan.weeks[5]?.plannedMinutes);
  });
});

describe("indoor and outdoor (section 10)", () => {
  it("uses exact watts for every session indoors and bands outdoors", () => {
    const indoor = buildPlan(make({ environment: "indoor" }));
    expect(indoor.sessions.every((s) => s.indoor)).toBe(true);
    const targets = indoor.sessions
      .flatMap((s) => s.steps.map((st) => st.target))
      .filter((t) => t.watts.target !== null);
    expect(targets.every((t) => t.exact)).toBe(true);
    const outdoor = buildPlan(make({ environment: "outdoor" }));
    expect(outdoor.sessions.every((s) => !s.indoor)).toBe(true);
    expect(outdoor.sessions.flatMap((s) => s.steps).some((st) => st.target.exact)).toBe(false);
  });

  it("puts structured weekday sessions indoors and the weekend outdoors when both", () => {
    const plan = buildPlan(
      make({ environment: "both", purposes: ["speed"], hoursPerWeek: 8 }, EXAMPLE_B, {}),
    );
    for (const s of plan.sessions) {
      const structured = [
        "tempo",
        "sweet-spot",
        "threshold",
        "vo2",
        "sprint",
        "torque",
        "test",
      ].includes(s.kind);
      const day = weekday(s);
      expect(s.indoor).toBe(structured && day !== "sat" && day !== "sun");
    }
  });

  it("limits indoor sessions and easy rides and says the week holds fewer hours", () => {
    const input = make({ environment: "indoor" }, EXAMPLE_C, {});
    const plan = buildPlan(input);
    for (const s of plan.sessions) {
      if (s.kind === "endurance") expect(s.durationMin).toBeLessThanOrEqual(90);
      if (["tempo", "sweet-spot", "threshold", "torque", "vo2"].includes(s.kind)) {
        expect(s.durationMin).toBeLessThanOrEqual(120);
      }
    }
    expect(plan.notices.map((n) => n.code)).toContain("indoor-limit");
    expect(checkPlan(plan, input)).toEqual([]);
  });

  it("makes the warm-up 5 minutes longer indoors", () => {
    const indoor = buildPlan(make({ environment: "indoor" }));
    const outdoor = buildPlan(make({ environment: "outdoor" }));
    const warm = (p: ReturnType<typeof buildPlan>) =>
      p.weeks[0]?.sessions.find((s) => s.slot === "q1")?.steps[0]?.durationMin;
    expect((warm(indoor) ?? 0) - (warm(outdoor) ?? 0)).toBe(5);
  });
});

describe("events", () => {
  it("puts openers the day before the event even when that day is not an available day", () => {
    const input = make(
      {
        event: { name: "Race", date: "2027-01-17", duration: "3-to-6h" },
        availableDays: ["tue", "wed", "sun"],
        purposes: ["speed"],
        hoursPerWeek: 8,
      },
      EXAMPLE_B,
      {},
    );
    const plan = buildPlan(input);
    const opener = plan.sessions.find((s) => s.kind === "openers");
    expect(opener?.date).toBe("2027-01-16");
    expect(weekday(opener as PlannedSession)).toBe("sat");
    expect(checkPlan(plan, input)).toEqual([]);
  });

  it("moves the openers into the week before when the event is on a Monday", () => {
    const input = make(
      {
        event: { name: "Race", date: "2027-01-11", duration: "3-to-6h" },
        purposes: ["speed"],
        hoursPerWeek: 8,
        availableDays: ["tue", "wed", "fri", "sat", "sun", "mon"],
      },
      EXAMPLE_B,
      {},
    );
    const plan = buildPlan(input);
    expect(plan.weeks).toHaveLength(12);
    const opener = plan.sessions.find((s) => s.kind === "openers");
    expect(opener?.date).toBe("2027-01-10");
    expect(opener?.week).toBe(11);
    expect(plan.sessions.find((s) => s.kind === "long" && s.date === "2027-01-10")).toBeUndefined();
    expect(plan.weeks[11]?.sessions.map((s) => s.kind)).toEqual(["event"]);
    expect(checkPlan(plan, input)).toEqual([]);
  });

  it("tapers one week for an event under 3 hours", () => {
    const input = make(
      {
        event: { name: "Race", date: "2027-01-17", duration: "under-3h" },
        purposes: ["speed"],
        hoursPerWeek: 8,
      },
      EXAMPLE_B,
      {},
    );
    const plan = buildPlan(input);
    expect(plan.event?.taperWeeks).toBe(1);
    expect(plan.weeks[10]?.type).toBe("loading");
    expect(plan.weeks[11]?.type).toBe("taper");
    expect(plan.weeks[11]?.targetMinutes).toBe(240);
    expect(checkPlan(plan, input)).toEqual([]);
  });

  it("starts 12 weeks before the event week when the event is far away, and says so", () => {
    const input = make(
      {
        event: { name: "Race", date: "2027-06-06", duration: "3-to-6h" },
        purposes: ["speed"],
        hoursPerWeek: 8,
      },
      EXAMPLE_B,
      {},
    );
    const plan = buildPlan(input);
    expect(plan.startDate).toBe("2027-03-15");
    expect(plan.weeks).toHaveLength(12);
    expect(plan.warnings.map((w) => w.code)).toContain("event-far");
    expect(plan.endDate).toBe("2027-06-06");
    expect(checkPlan(plan, input)).toEqual([]);
  });

  it("builds a shorter plan for an event 8 weeks away with a taper and a recovery week", () => {
    const input = make(
      {
        event: { name: "Race", date: "2026-12-20", duration: "3-to-6h" },
        purposes: ["speed"],
        hoursPerWeek: 8,
      },
      EXAMPLE_B,
      {},
    );
    const plan = buildPlan(input);
    expect(plan.weeks).toHaveLength(8);
    expect(plan.weeks.map((w) => w.type)).toEqual([
      "loading",
      "loading",
      "loading",
      "recovery",
      "loading",
      "loading",
      "taper",
      "taper",
    ]);
    // Six training weeks: thirds of two weeks each.
    expect(plan.weeks.map((w) => w.phase)).toEqual([
      "base",
      "base",
      "build",
      "build",
      "peak",
      "peak",
      "taper",
      "taper",
    ]);
    expect(checkPlan(plan, input)).toEqual([]);
  });

  it("builds only a taper for an event less than 4 weeks away and warns", () => {
    const input = make(
      {
        event: { name: "Race", date: "2026-11-15", duration: "3-to-6h" },
        purposes: ["speed"],
        hoursPerWeek: 8,
      },
      EXAMPLE_B,
      {},
    );
    const plan = buildPlan(input);
    expect(plan.warnings.map((w) => w.code)).toContain("event-too-soon");
    expect(plan.weeks.length).toBeLessThan(4);
    expect(plan.sessions.at(-1)?.kind).toBe("event");
    expect(checkPlan(plan, input)).toEqual([]);
  });

  it("ignores an event in the past and builds the plain 12 weeks", () => {
    const input = make(
      { event: { name: "Race", date: "2026-09-20", duration: "3-to-6h" } },
      EXAMPLE_A,
      {},
    );
    const plan = buildPlan(input);
    expect(plan.event).toBeNull();
    expect(plan.weeks).toHaveLength(12);
    expect(plan.warnings.map((w) => w.code)).toContain("event-past");
  });

  it("keeps a short intensity set in the taper and drops the second hard session and the blocks", () => {
    const input = make(
      { event: { name: "Race", date: "2027-01-17", duration: "3-to-6h" } },
      EXAMPLE_C,
      {},
    );
    const plan = buildPlan(input);
    for (const w of plan.weeks.filter((w) => w.type === "taper")) {
      expect(w.sessions.filter((s) => s.mainSet !== null && s.kind !== "openers")).toHaveLength(1);
      expect(w.sessions.find((s) => s.kind === "long")?.mainSet ?? null).toBeNull();
    }
    expect(plan.weeks[10]?.sessions.find((s) => s.slot === "q1")?.ladderStep).toBe(2);
    expect(plan.weeks[11]?.sessions.find((s) => s.slot === "q1")?.ladderStep).toBe(0);
  });

  it("does not count the event in the hours or the caps", () => {
    const plan = buildPlan(EXAMPLE_B);
    const event = plan.sessions.find((s) => s.kind === "event");
    expect(event?.load).toBe(0);
    expect(event?.steps).toEqual([]);
    expect(event?.title).toBe("Event: 100 km ride");
    expect(plan.weeks[11]?.plannedMinutes).toBe(215);
  });
});

describe("adjustments from the adaptation part", () => {
  const input = make({ hoursPerWeek: 5, purposes: ["weight-loss"] }, EXAMPLE_D, {});

  it("holds the hours and sets a step down in a held week (weight falling faster than the cap)", () => {
    const normal = buildPlan(input);
    const held = buildPlan({ ...input, adjustments: { holdWeeks: [6] } });
    expect(held.weeks[5]?.plannedMinutes).toBe(normal.weeks[4]?.plannedMinutes);
    expect(held.weeks[5]?.plannedHours).toBe(4.67);
    expect(held.weeks[5]?.sessions.find((s) => s.slot === "q1")?.mainSet).toBe("2x10");
    expect(normal.weeks[5]?.sessions.find((s) => s.slot === "q1")?.mainSet).toBe("2x12");
    expect(held.weeks[5]?.sessions.find((s) => s.slot === "q1")?.reason).toContain("weekly cap");
    expect(checkPlan(held, input)).toEqual([]);
  });

  it("adds one easy ride of up to 45 minutes in a stalled week when a day is free and hours are below H", () => {
    const free = buildPlan(
      make(
        {
          hoursPerWeek: 5,
          purposes: ["endurance"],
          availableDays: ["tue", "wed", "fri", "sat", "sun"],
        },
        EXAMPLE_A,
        {
          adjustments: { extraEasyRideWeeks: [3] },
        },
      ),
    );
    const base = buildPlan(
      make(
        {
          hoursPerWeek: 5,
          purposes: ["endurance"],
          availableDays: ["tue", "wed", "fri", "sat", "sun"],
        },
        EXAMPLE_A,
        {},
      ),
    );
    expect(free.weeks[2]?.sessions.length).toBe((base.weeks[2]?.sessions.length ?? 0) + 1);
    expect(free.weeks[2]?.plannedMinutes).toBeLessThanOrEqual(300);
    // No free day (every available day has a ride) and no change.
    const full = buildPlan({ ...input, adjustments: { extraEasyRideWeeks: [3] } });
    expect(full.weeks[2]?.sessions.length).toBe(4);
  });

  it("repeats the ladder step after a missed structured session", () => {
    const base = buildPlan(EXAMPLE_B);
    const missed = buildPlan({
      ...EXAMPLE_B,
      adjustments: { missedStructured: [{ week: 6, kind: "vo2" }] },
    });
    const step = (p: ReturnType<typeof buildPlan>, week: number) =>
      p.weeks[week - 1]?.sessions.find((s) => s.kind === "vo2")?.mainSet;
    expect(step(base, 6)).toBe("5x4");
    expect(step(base, 7)).toBe("6x4");
    expect(step(missed, 6)).toBe("5x4");
    expect(step(missed, 7)).toBe("5x4");
  });

  it("holds the hours and drops Q2 in the week after an overload", () => {
    const normal = buildPlan(EXAMPLE_B);
    const overload = buildPlan({ ...EXAMPLE_B, adjustments: { noSecondHardWeeks: [6] } });
    expect(overload.weeks[5]?.plannedMinutes).toBe(normal.weeks[4]?.plannedMinutes);
    expect(overload.weeks[5]?.structuredCount).toBe(1);
  });
});

describe("heart rate and reasons", () => {
  it("shows watts only and says so without a heart rate reference", () => {
    const plan = buildPlan({ ...EXAMPLE_A, lthr: null });
    expect(plan.sessions.every((s) => s.steps.every((st) => st.heartRate === null))).toBe(true);
    expect(plan.notices.map((n) => n.code)).toContain("no-heart-rate");
  });

  it("gives every session a reason and a title", () => {
    for (const input of [EXAMPLE_A, EXAMPLE_B, EXAMPLE_C, EXAMPLE_D]) {
      for (const s of buildPlan(input).sessions) {
        expect(s.reason.length).toBeGreaterThan(20);
        expect(s.title.length).toBeGreaterThan(3);
        expect(s.status).toBe("planned");
      }
    }
  });

  it("names the week type in the reason of a recovery week session", () => {
    const plan = buildPlan(EXAMPLE_A);
    expect(plan.weeks[3]?.sessions.find((s) => s.slot === "q1")?.reason).toContain("Recovery week");
    expect(kinds(plan, 12)).toContain("test");
  });
});

describe("determinism and ordering", () => {
  it("gives the same plan twice and orders sessions by date", () => {
    for (const input of [EXAMPLE_A, EXAMPLE_B, EXAMPLE_C, EXAMPLE_D]) {
      const a = buildPlan(input);
      expect(buildPlan(structuredClone(input))).toEqual(a);
      const dates = a.sessions.map((s) => s.date);
      expect(dates).toEqual([...dates].sort());
      expect(new Set(dates).size).toBe(dates.length);
    }
  });

  it("does not read the clock: only today decides the start", () => {
    const a = buildPlan({ ...EXAMPLE_A, today: EXAMPLE_TODAY });
    const b = buildPlan({ ...EXAMPLE_A, today: "2026-10-27" });
    expect(a.startDate).toBe("2026-10-26");
    expect(b.startDate).toBe("2026-11-02");
  });
});

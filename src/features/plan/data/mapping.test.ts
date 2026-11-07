import { describe, expect, it } from "vitest";
import { SESSION_KINDS } from "../engine";
import {
  intakeFromJson,
  joinReason,
  kindFromDb,
  kindToDb,
  planInsert,
  sessionFromRow,
  sessionInserts,
  splitReason,
  stepsFromJson,
  toJson,
} from "./mapping";
import { PLAN_INPUT, planFixture } from "./test-support";

/** The kinds the planned_sessions check constraint allows (migration 20261029100300). */
const DB_KINDS = [
  "recovery",
  "endurance",
  "long_ride",
  "tempo",
  "sweet_spot",
  "threshold",
  "vo2max",
  "sprint",
  "torque",
  "openers",
  "test",
  "event",
];

describe("kinds", () => {
  it("maps every engine kind to a database kind and back", () => {
    for (const kind of SESSION_KINDS) {
      expect(DB_KINDS).toContain(kindToDb(kind));
      expect(kindFromDb(kindToDb(kind))).toBe(kind);
    }
  });

  it("writes snake_case for the kinds that differ", () => {
    expect(kindToDb("long")).toBe("long_ride");
    expect(kindToDb("sweet-spot")).toBe("sweet_spot");
    expect(kindToDb("vo2")).toBe("vo2max");
    expect(kindFromDb("long_ride")).toBe("long");
    expect(kindFromDb("unknown")).toBeNull();
  });
});

describe("the rows of an engine plan", () => {
  const { engine } = planFixture();
  const rows = sessionInserts(engine);

  it("writes one row per session with a database kind and a day order", () => {
    expect(rows).toHaveLength(engine.sessions.length);
    for (const row of rows) {
      expect(DB_KINDS).toContain(row.kind);
      expect(row.duration_min).toBeGreaterThan(0);
      expect(row.day_order).toBe(0);
    }
  });

  it("puts recovery and taper weeks in the phase column", () => {
    const phases = new Map(rows.map((r) => [r.week_number, r.phase]));
    for (const week of engine.weeks) {
      const expected = week.type === "recovery" ? "recovery" : week.phase;
      expect(phases.get(week.number)).toBe(expected);
    }
    expect([...phases.values()]).toContain("recovery");
    expect([...phases.values()]).toContain("taper");
  });

  it("writes the plan row from the engine plan", () => {
    const row = planInsert({ plan: engine, intake: PLAN_INPUT.intake, ftp: 250.4, weightKg: 78.4 });
    expect(row).toMatchObject({
      start_date: "2026-09-28",
      weeks: 12,
      status: "active",
      ftp_w: 250,
      weight_kg: 78.4,
      engine_version: engine.engineVersion,
      input_fingerprint: engine.fingerprint,
    });
  });

  it("reads the rows back as the same sessions", () => {
    const { sessions } = planFixture();
    expect(sessions).toHaveLength(engine.sessions.length);
    engine.sessions.forEach((original, i) => {
      const read = sessions[i];
      expect(read).toMatchObject({
        date: original.date,
        week: original.week,
        kind: original.kind,
        title: original.title,
        durationMin: Math.round(original.durationMin),
        status: "planned",
        strengthNote: original.strengthNote,
      });
      expect(read?.steps).toEqual(original.steps);
      expect(read?.reason).toBe(original.reason);
    });
  });

  it("keeps the intake it was built from", () => {
    expect(planFixture().plan.intake).toEqual(PLAN_INPUT.intake);
  });
});

describe("the strength note", () => {
  it("is stored after the reason and split off again", () => {
    const text = joinReason("Why.", "Lift something.");
    expect(splitReason(text)).toEqual({ reason: "Why.", strengthNote: "Lift something." });
    expect(splitReason("Why.")).toEqual({ reason: "Why.", strengthNote: null });
    expect(joinReason("Why.", null)).toBe("Why.");
  });
});

describe("what the database may hold", () => {
  it("reads no steps from something that is not a list of steps", () => {
    expect(stepsFromJson({})).toEqual([]);
    expect(stepsFromJson([{ kind: "work" }])).toEqual([]);
  });

  it("reads no intake from an unreadable object", () => {
    expect(intakeFromJson({ purposes: ["x"] })).toBeNull();
    expect(intakeFromJson(toJson(PLAN_INPUT.intake))).toEqual(PLAN_INPUT.intake);
  });

  it("does not show a dropped session", () => {
    const row = {
      id: "s",
      plan_id: "p",
      user_id: "u",
      activity_id: null,
      match_source: null,
      moved_from: null,
      created_at: "",
      updated_at: "",
      indoor: null,
      reason: "",
      steps: [],
      planned_load: 0,
      quality_min: 0,
      day_order: 0,
      week_number: 1,
      phase: "base",
      session_date: "2026-10-01",
      kind: "endurance",
      title: "Endurance ride",
      duration_min: 60,
      status: "dropped",
    };
    expect(sessionFromRow(row)).toBeNull();
    expect(sessionFromRow({ ...row, status: "planned" })).not.toBeNull();
    expect(sessionFromRow({ ...row, status: "planned", kind: "nope" })).toBeNull();
  });
});

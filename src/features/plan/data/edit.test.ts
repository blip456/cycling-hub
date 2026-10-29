import { describe, expect, it } from "vitest";
import type { Intake } from "../engine";
import { EMPTY_PLAN_PROFILE, type PlanProfile } from "./api";
import { describeEdit, editSave, type EditCurrent } from "./edit";
import { draftFromIntake, engineInput, validateStep, type EngineContext } from "./intake";
import { PLAN_INPUT } from "./test-support";

const TODAY = "2026-10-28";
const START = "2026-09-28"; // the plan started on Monday 28 September

const INTAKE: Intake = { ...PLAN_INPUT.intake, startDate: START };

const CTX: EngineContext = {
  today: TODAY,
  weightKg: 78.4,
  availableDays: ["tue", "wed", "fri", "sat", "sun"],
  profileEnvironment: "both",
  ftp: 250,
  lthr: 165,
  maxHr: 188,
  fixedStart: START,
};

const PROFILE: PlanProfile = {
  ...EMPTY_PLAN_PROFILE,
  ridingEnvironment: "both",
  weeklyHours: 8,
  trainingPurposes: ["endurance", "speed"],
  levelAnswers: [2, 2, 2, 1, 1],
  eventName: "Autumn sportive",
  eventDate: "2026-12-19",
  availableDays: ["tue", "wed", "fri", "sat", "sun"],
};

const CURRENT: EditCurrent = { intake: INTAKE, profile: PROFILE, goal: null };

describe("the draft of an existing plan", () => {
  it("holds the answers of the intake and asks nothing about the start", () => {
    const draft = draftFromIntake(INTAKE, TODAY);
    expect(draft).toMatchObject({
      purposes: ["endurance", "speed"],
      answers: [2, 2, 2, 1, 1],
      hours: "8",
      environment: "both",
      hasEvent: true,
      eventName: "Autumn sportive",
      eventDate: "2026-12-19",
      eventDuration: "3-to-6h",
      levelOverride: null,
      targetKg: "",
      targetDate: "",
    });
    expect(Object.keys(validateStep(1, draft, CTX))).toEqual([]);
    expect(validateStep(2, draft, CTX)).toEqual({});
    expect(validateStep(3, draft, CTX)).toEqual({});
    expect(validateStep(4, draft, CTX)).toEqual({});
  });

  it("carries the level choice, the weight target and the event length", () => {
    const draft = draftFromIntake(
      {
        ...INTAKE,
        purposes: ["weight-loss", "endurance"],
        levelOverride: "amateur",
        weightGoal: { targetKg: 76, targetDate: "2027-01-23" },
        event: { name: "Ride", date: "2026-12-19", duration: "over-6h" },
      },
      TODAY,
    );
    expect(draft).toMatchObject({
      purposes: ["weight-loss", "endurance"],
      levelOverride: "amateur",
      targetKg: "76",
      targetDate: "2027-01-23",
      eventDuration: "over-6h",
    });
  });

  it("leaves a passed event and a passed target date out", () => {
    const draft = draftFromIntake(
      {
        ...INTAKE,
        event: { name: "Ride", date: "2026-10-20", duration: "under-3h" },
        weightGoal: { targetKg: 76, targetDate: "2026-10-01" },
      },
      TODAY,
    );
    expect(draft.hasEvent).toBe(false);
    expect(draft.eventDate).toBe("");
    expect(draft.targetDate).toBe("");
  });
});

describe("the event of an edited plan (the start is fixed)", () => {
  const base = { ...draftFromIntake(INTAKE, TODAY), hasEvent: true };

  it("does not ask for a start date, whatever the draft says", () => {
    const draft = { ...base, startChoice: "other" as const, startDate: "2020-01-01" };
    expect(validateStep(4, draft, CTX)).toEqual({});
  });

  // Early in the plan: three days after the start.
  const early = { ...CTX, today: "2026-10-01" };

  it("wants the event after the start of the plan", () => {
    // A plan that starts next week, and an event before it.
    const ahead = { ...CTX, fixedStart: "2026-11-02" };
    expect(validateStep(4, { ...base, eventDate: "2026-10-30" }, ahead).eventDate).toMatch(
      /before the start of your plan/,
    );
  });

  it("wants at least four weeks from the start to the event", () => {
    expect(validateStep(4, { ...base, eventDate: "2026-10-18" }, early).eventDate).toMatch(
      /too close to the start of your plan.*choose Monday 19 Oct 2026 or later/,
    );
    expect(validateStep(4, { ...base, eventDate: "2026-10-19" }, early)).toEqual({});
  });

  it("wants the event inside the twelve weeks, and points to a new plan", () => {
    expect(validateStep(4, { ...base, eventDate: "2026-12-20" }, CTX)).toEqual({});
    const error = validateStep(4, { ...base, eventDate: "2026-12-21" }, CTX).eventDate;
    expect(error).toMatch(/after the last week of your plan \(it ends on Sunday 20 Dec 2026\)/);
    expect(error).toMatch(/remove this plan and build a new one/);
  });

  it("still wants a date from tomorrow", () => {
    expect(validateStep(4, { ...base, eventDate: TODAY }, CTX).eventDate).toMatch(/in the past/);
  });

  it("gives the engine the plan's start date", () => {
    const input = engineInput(draftFromIntake(INTAKE, TODAY), CTX);
    expect(input?.intake.startDate).toBe(START);
  });
});

describe("what saving writes", () => {
  const draft = draftFromIntake(INTAKE, TODAY);

  it("writes every answer to the profile like the intake does", () => {
    const save = editSave(
      { ...draft, hours: "10", purposes: ["speed", "endurance"] },
      CTX,
      CURRENT,
    );
    expect(save?.profilePatch).toEqual({
      trainingPurposes: ["speed", "endurance"],
      levelAnswers: [2, 2, 2, 1, 1],
      weeklyHours: 10,
      eventName: "Autumn sportive",
      eventDate: "2026-12-19",
    });
    expect(save?.input.intake).toMatchObject({
      hoursPerWeek: 10,
      purposes: ["speed", "endurance"],
      startDate: START,
    });
  });

  it("removes the event from the profile and the intake", () => {
    const save = editSave({ ...draft, hasEvent: false }, CTX, CURRENT);
    expect(save?.profilePatch).toMatchObject({ eventName: null, eventDate: null });
    expect(save?.input.intake.event).toBeUndefined();
  });

  it("keeps the level choice in the intake", () => {
    const save = editSave({ ...draft, levelOverride: "amateur" }, CTX, CURRENT);
    expect(save?.input.intake.levelOverride).toBe("amateur");
  });

  it("saves the environment only when the profile has none", () => {
    expect(editSave(draft, CTX, CURRENT)?.profilePatch).not.toHaveProperty("ridingEnvironment");
    const save = editSave(
      { ...draft, environment: "indoor" },
      { ...CTX, profileEnvironment: null },
      { ...CURRENT, profile: { ...PROFILE, ridingEnvironment: null } },
    );
    expect(save?.profilePatch.ridingEnvironment).toBe("indoor");
    expect(save?.restore.profilePatch.ridingEnvironment).toBeNull();
  });

  it("is nothing for an incomplete draft", () => {
    expect(editSave({ ...draft, hours: "" }, CTX, CURRENT)).toBeNull();
  });

  it("remembers what puts the profile back", () => {
    const save = editSave({ ...draft, hours: "10" }, CTX, CURRENT);
    expect(save?.restore.profilePatch).toEqual({
      trainingPurposes: ["endurance", "speed"],
      levelAnswers: [2, 2, 2, 1, 1],
      weeklyHours: 8,
      eventName: "Autumn sportive",
      eventDate: "2026-12-19",
    });
  });

  describe("the weight goal", () => {
    const withGoal: Intake = {
      ...INTAKE,
      purposes: ["weight-loss", "endurance"],
      weightKg: 80,
      weightGoal: { targetKg: 76, targetDate: "2027-01-23" },
    };
    const goalRecord = {
      targetKg: 76,
      targetDate: "2027-01-23",
      startKg: 80,
      startDate: "2026-09-28",
    };
    const current: EditCurrent = { intake: withGoal, profile: PROFILE, goal: goalRecord };
    const goalDraft = draftFromIntake(withGoal, TODAY);

    it("leaves the goal and the start weight alone while the target stays", () => {
      const save = editSave(goalDraft, CTX, current);
      expect(save?.goal).toBeUndefined();
      expect(save?.restore.goal).toBeUndefined();
      expect(save?.input.intake.weightKg).toBe(80);
      expect(save?.input.intake.weightGoal).toEqual({ targetKg: 76, targetDate: "2027-01-23" });
    });

    it("starts a changed target from the current weight and remembers the old one", () => {
      const save = editSave({ ...goalDraft, targetKg: "75" }, CTX, current);
      expect(save?.goal).toEqual({ targetKg: 75, targetDate: "2027-01-23", startKg: 78.4 });
      expect(save?.input.intake.weightKg).toBe(78.4);
      expect(save?.restore.goal).toEqual({ targetKg: 76, targetDate: "2027-01-23", startKg: 80 });
    });

    it("cancels the goal when the target is cleared", () => {
      const save = editSave({ ...goalDraft, targetKg: "", targetDate: "" }, CTX, current);
      expect(save?.goal).toBeNull();
      expect(save?.input.intake.weightGoal).toBeUndefined();
      // Weight loss stays a purpose, so the weekly cap counts from today's weight.
      expect(save?.input.intake.weightKg).toBe(78.4);
    });

    it("adds a goal when weight loss is new, and leaves goals alone without weight loss", () => {
      const added = editSave(
        { ...draft, purposes: ["weight-loss"], targetKg: "76", targetDate: "2027-01-23" },
        CTX,
        CURRENT,
      );
      expect(added?.goal).toEqual({ targetKg: 76, targetDate: "2027-01-23", startKg: 78.4 });
      expect(added?.restore.goal).toBeNull();
      expect(editSave(draft, CTX, current)?.goal).toBeUndefined();
    });
  });
});

describe("what changes, in plain words", () => {
  const after = (change: Partial<Intake>): Intake => ({ ...INTAKE, ...change });

  it("says nothing differs", () => {
    expect(describeEdit(INTAKE, after({}))).toEqual([]);
  });

  it("names purposes, hours, days and place", () => {
    expect(
      describeEdit(
        INTAKE,
        after({
          purposes: ["speed", "endurance"],
          hoursPerWeek: 10,
          availableDays: ["mon", "tue", "sat"],
          environment: "indoor",
        }),
      ),
    ).toEqual([
      "Purposes change from 1 Endurance, 2 Speed to 1 Speed, 2 Endurance.",
      "Hours per week change from 8 to 10.",
      "Training days change from Tue, Wed, Fri, Sat, Sun to Mon, Tue, Sat.",
      "Indoor or outdoor changes from both indoor and outdoor to indoor.",
    ]);
  });

  it("names a changed level and a chosen one", () => {
    expect(
      describeEdit(
        INTAKE,
        after({
          levelAnswers: {
            experience: 0,
            weeklyHours: 0,
            intervals: 0,
            longestRide: 0,
            hardSessions: 0,
          },
        }),
      ),
    ).toEqual(["Level changes from Committed to Amateur."]);
    expect(describeEdit(INTAKE, after({ levelOverride: "semi-pro" }))).toEqual([
      "Level changes from Committed to Semi-pro.",
    ]);
  });

  it("names an event that is added, changed or removed", () => {
    const none = after({});
    delete (none as { event?: unknown }).event;
    expect(describeEdit(none, INTAKE)).toEqual([
      "An event is added: Autumn sportive, Saturday 19 Dec 2026.",
    ]);
    expect(describeEdit(INTAKE, none)).toEqual([
      "The event is removed: Autumn sportive, Saturday 19 Dec 2026.",
    ]);
    expect(
      describeEdit(
        INTAKE,
        after({ event: { name: "Autumn sportive", date: "2026-12-12", duration: "over-6h" } }),
      ),
    ).toEqual([
      "The event changes from Autumn sportive, Saturday 19 Dec 2026 to Autumn sportive, Saturday 12 Dec 2026.",
      "The expected event duration changes to over 6 hours.",
    ]);
  });

  it("names a weight target", () => {
    const goal = { targetKg: 76, targetDate: "2027-01-23" };
    expect(describeEdit(INTAKE, after({ weightGoal: goal }))).toEqual([
      "A weight target is added: 76.0 kg by Saturday 23 Jan 2027.",
    ]);
    expect(describeEdit(after({ weightGoal: goal }), INTAKE)).toEqual([
      "The weight target is removed.",
    ]);
  });
});

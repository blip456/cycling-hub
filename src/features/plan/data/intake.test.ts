import { describe, expect, it } from "vitest";
import { buildPlan } from "../engine";
import { assumptionLines } from "./assumptions";
import {
  draftFromProfile,
  EMPTY_DRAFT,
  engineInput,
  firstInvalidStep,
  goalOf,
  profilePatchFor,
  validateStep,
  type EngineContext,
  type IntakeDraft,
} from "./intake";
import { EMPTY_PLAN_PROFILE } from "./api";

const TODAY = "2026-10-28";

const CTX: EngineContext = {
  today: TODAY,
  weightKg: 78.4,
  availableDays: ["tue", "wed", "fri", "sat", "sun"],
  profileEnvironment: "both",
  ftp: 250,
  lthr: 165,
  maxHr: 188,
};

const COMPLETE: IntakeDraft = {
  ...EMPTY_DRAFT,
  purposes: ["endurance", "speed"],
  answers: [2, 2, 2, 1, 1],
  hours: "8",
};

describe("step 1: purposes and the weight goal", () => {
  it("needs at least one purpose", () => {
    expect(validateStep(1, EMPTY_DRAFT, CTX).purposes).toBe("Choose at least one purpose.");
    expect(validateStep(1, COMPLETE, CTX)).toEqual({});
  });

  it("leaves the weight goal alone when it is not a purpose", () => {
    const draft = { ...COMPLETE, targetKg: "10" };
    expect(validateStep(1, draft, CTX)).toEqual({});
    expect(goalOf(draft)).toBeNull();
  });

  it("accepts no target at all with weight loss (only the cap)", () => {
    expect(validateStep(1, { ...COMPLETE, purposes: ["weight-loss"] }, CTX)).toEqual({});
  });

  it("asks for the missing half of the target", () => {
    const base = { ...COMPLETE, purposes: ["weight-loss" as const] };
    expect(validateStep(1, { ...base, targetKg: "76" }, CTX).targetDate).toBeDefined();
    expect(validateStep(1, { ...base, targetDate: "2027-01-23" }, CTX).targetKg).toBeDefined();
  });

  it("checks the target through the weight goal schema", () => {
    const base = { ...COMPLETE, purposes: ["weight-loss" as const], targetDate: "2027-01-23" };
    expect(validateStep(1, { ...base, targetKg: "20" }, CTX).targetKg).toMatch(/at least 30 kg/);
    expect(validateStep(1, { ...base, targetKg: "abc" }, CTX).targetKg).toBeDefined();
    expect(
      validateStep(1, { ...base, targetKg: "76", targetDate: "2026-10-01" }, CTX).targetDate,
    ).toMatch(/in the past/);
  });

  it("wants a target below the current weight, and a logged weight", () => {
    const base = {
      ...COMPLETE,
      purposes: ["weight-loss" as const],
      targetKg: "80",
      targetDate: "2027-01-23",
    };
    expect(validateStep(1, base, CTX).targetKg).toMatch(/below your current weight \(78\.4 kg\)/);
    expect(
      validateStep(1, { ...base, targetKg: "76,5" }, { ...CTX, weightKg: null }).targetKg,
    ).toMatch(/Log your weight first/);
    expect(validateStep(1, { ...base, targetKg: "76,5" }, CTX)).toEqual({});
  });
});

describe("step 2: the level questions", () => {
  it("needs every answer", () => {
    const errors = validateStep(2, { ...EMPTY_DRAFT, answers: [1, null, 2, null, 0] }, CTX);
    expect(Object.keys(errors)).toEqual(["answer1", "answer3"]);
    expect(errors.answer1).toBe("Choose an answer.");
    expect(validateStep(2, COMPLETE, CTX)).toEqual({});
  });
});

describe("step 3: hours, days and place", () => {
  it("needs hours in half hours between 1 and 25", () => {
    expect(validateStep(3, { ...COMPLETE, hours: "" }, CTX).hours).toBe(
      "Enter your hours per week.",
    );
    expect(validateStep(3, { ...COMPLETE, hours: "0.5" }, CTX).hours).toMatch(/at least 1/);
    expect(validateStep(3, { ...COMPLETE, hours: "30" }, CTX).hours).toMatch(/at most 25/);
    expect(validateStep(3, { ...COMPLETE, hours: "7.3" }, CTX).hours).toMatch(/half hours/);
    expect(validateStep(3, { ...COMPLETE, hours: "x" }, CTX).hours).toBeDefined();
    expect(validateStep(3, { ...COMPLETE, hours: "7,5" }, CTX)).toEqual({});
  });

  it("needs at least two training days from the profile", () => {
    expect(validateStep(3, COMPLETE, { ...CTX, availableDays: ["mon"] }).days).toMatch(
      /at least 2 training days/,
    );
  });

  it("asks for indoor or outdoor only when the profile has none", () => {
    const ctx = { ...CTX, profileEnvironment: null };
    expect(validateStep(3, COMPLETE, ctx).environment).toBe("Choose indoor, outdoor or both.");
    expect(validateStep(3, { ...COMPLETE, environment: "indoor" }, ctx)).toEqual({});
  });
});

describe("step 4: start and event", () => {
  it("does not allow a start in the past", () => {
    const draft = { ...COMPLETE, startChoice: "other" as const, startDate: "2026-10-01" };
    expect(validateStep(4, draft, CTX).startDate).toMatch(/in the past/);
    expect(validateStep(4, { ...draft, startDate: "" }, CTX).startDate).toBeDefined();
    expect(validateStep(4, { ...draft, startDate: "2026-11-04" }, CTX)).toEqual({});
  });

  it("needs a valid event date from tomorrow, and an event after the start", () => {
    const base = { ...COMPLETE, hasEvent: true };
    expect(validateStep(4, base, CTX).eventDate).toBe("Enter the event date.");
    expect(validateStep(4, { ...base, eventDate: TODAY }, CTX).eventDate).toMatch(/in the past/);
    expect(validateStep(4, { ...base, eventDate: "2026-10-30" }, CTX).eventDate).toMatch(
      /before the plan starts/,
    );
    expect(validateStep(4, { ...base, eventDate: "2026-12-19" }, CTX)).toEqual({});
  });

  it("limits the event name to 60 characters, and the name is optional", () => {
    const base = { ...COMPLETE, hasEvent: true, eventDate: "2026-12-19" };
    expect(validateStep(4, { ...base, eventName: "x".repeat(61) }, CTX).eventName).toMatch(/60/);
    expect(validateStep(4, { ...base, eventName: "" }, CTX)).toEqual({});
  });

  it("does not look at the event when there is none", () => {
    expect(validateStep(4, { ...COMPLETE, eventDate: "junk" }, CTX)).toEqual({});
  });
});

describe("the first step with a problem", () => {
  it("is null for a complete draft and the earliest step otherwise", () => {
    expect(firstInvalidStep(COMPLETE, CTX)).toBeNull();
    expect(firstInvalidStep({ ...COMPLETE, answers: [1, 1, null, 1, 1] }, CTX)).toBe(2);
    expect(firstInvalidStep({ ...COMPLETE, hours: "" }, CTX)).toBe(3);
    expect(firstInvalidStep({ ...COMPLETE, purposes: [], hours: "" }, CTX)).toBe(1);
  });
});

describe("the draft from the profile", () => {
  it("restores answers and drops an event that has passed", () => {
    const draft = draftFromProfile(
      {
        ...EMPTY_PLAN_PROFILE,
        trainingPurposes: ["muscle_building", "weight_loss"],
        levelAnswers: [1, 2, 3, 0, 1],
        weeklyHours: 7.5,
        ridingEnvironment: "indoor",
        eventName: "Old race",
        eventDate: "2026-09-01",
      },
      { targetKg: 76, targetDate: "2027-01-23", startKg: 78, startDate: "2026-10-01" },
      TODAY,
    );
    expect(draft).toMatchObject({
      purposes: ["muscle-building", "weight-loss"],
      answers: [1, 2, 3, 0, 1],
      hours: "7.5",
      environment: "indoor",
      targetKg: "76",
      targetDate: "2027-01-23",
      hasEvent: false,
      eventName: "",
    });
  });
});

describe("the engine input", () => {
  it("is null for an incomplete draft", () => {
    expect(engineInput(EMPTY_DRAFT, CTX)).toBeNull();
  });

  it("carries the answers, the profile and the baseline", () => {
    const input = engineInput(
      {
        ...COMPLETE,
        hasEvent: true,
        eventName: " Spring ride ",
        eventDate: "2026-12-19",
        eventDuration: "over-6h",
        startChoice: "other",
        startDate: "2026-11-04",
      },
      CTX,
    );
    expect(input).toMatchObject({
      today: TODAY,
      ftp: 250,
      lthr: 165,
      maxHr: 188,
      intake: {
        purposes: ["endurance", "speed"],
        levelAnswers: {
          experience: 2,
          weeklyHours: 2,
          intervals: 2,
          longestRide: 1,
          hardSessions: 1,
        },
        hoursPerWeek: 8,
        availableDays: ["tue", "wed", "fri", "sat", "sun"],
        environment: "both",
        event: { name: "Spring ride", date: "2026-12-19", duration: "over-6h" },
        startDate: "2026-11-04",
      },
    });
    expect(input?.intake.weightKg).toBeUndefined();
  });

  it("adds the weight and the goal only with weight loss, and the level override when asked", () => {
    const draft: IntakeDraft = {
      ...COMPLETE,
      purposes: ["weight-loss", "endurance"],
      targetKg: "76",
      targetDate: "2027-01-23",
      levelOverride: "amateur",
    };
    const input = engineInput(draft, CTX);
    expect(input?.intake).toMatchObject({
      weightKg: 78.4,
      weightGoal: { targetKg: 76, targetDate: "2027-01-23" },
      levelOverride: "amateur",
    });
    expect(engineInput(draft, CTX, null)?.intake.levelOverride).toBeUndefined();
  });

  it("uses the environment of the draft when the profile has none", () => {
    const input = engineInput(
      { ...COMPLETE, environment: "outdoor" },
      { ...CTX, profileEnvironment: null },
    );
    expect(input?.intake.environment).toBe("outdoor");
  });

  it("gives a plan the engine accepts", () => {
    const input = engineInput(COMPLETE, CTX);
    if (!input) throw new Error("no input");
    const plan = buildPlan(input);
    expect(plan.status).toBe("ok");
    expect(plan.weeks).toHaveLength(12);
    expect(plan.startDate).toBe("2026-11-02");
  });
});

describe("what the plan will assume", () => {
  it("lists the rules in plain words, ending with the recalculation line", () => {
    const input = engineInput(COMPLETE, CTX);
    if (!input) throw new Error("no input");
    const lines = assumptionLines(buildPlan(input), input);
    expect(lines[0]).toBe("Sessions only on Tue, Wed, Fri, Sat and Sun. Mon and Thu stay free.");
    expect(lines.join("\n")).toMatch(/About 8 h in a normal week\. Weeks 4, 8 and 12 are lighter/);
    expect(lines.join("\n")).toMatch(
      /Watts from your FTP of 250 W and heart rate from your lactate threshold/,
    );
    expect(lines.join("\n")).toMatch(/Endurance comes first/);
    expect(lines.join("\n")).toMatch(/Speed, your second purpose/);
    expect(lines.at(-1)).toMatch(/recalculated when rides come in/);
  });

  it("mentions the taper, the event warnings and the weight cap", () => {
    const input = engineInput(
      {
        ...COMPLETE,
        purposes: ["weight-loss"],
        targetKg: "76",
        targetDate: "2027-01-23",
        hasEvent: true,
        eventDate: "2026-11-14",
      },
      CTX,
    );
    if (!input) throw new Error("no input");
    const plan = buildPlan(input);
    const text = assumptionLines(plan, input).join("\n");
    expect(text).toMatch(/taper before your event/);
    expect(text).toMatch(/less than 4 weeks away/);
    expect(text).toMatch(/kg/);
  });

  it("says what is blocked when there is no FTP", () => {
    const input = engineInput(COMPLETE, { ...CTX, ftp: null });
    if (!input) throw new Error("no input");
    const plan = buildPlan(input);
    expect(plan.status).toBe("blocked");
    expect(plan.warnings.map((w) => w.code)).toContain("no-ftp");
  });
});

describe("what a step saves to the profile", () => {
  it("saves the purposes in database words, the answers, the hours and the event", () => {
    expect(
      profilePatchFor(1, { ...COMPLETE, purposes: ["muscle-building", "weight-loss"] }, CTX),
    ).toEqual({
      trainingPurposes: ["muscle_building", "weight_loss"],
    });
    expect(profilePatchFor(2, COMPLETE, CTX)).toEqual({ levelAnswers: [2, 2, 2, 1, 1] });
    expect(profilePatchFor(3, COMPLETE, CTX)).toEqual({ weeklyHours: 8 });
    expect(
      profilePatchFor(
        3,
        { ...COMPLETE, environment: "indoor" },
        { ...CTX, profileEnvironment: null },
      ),
    ).toEqual({ weeklyHours: 8, ridingEnvironment: "indoor" });
    expect(
      profilePatchFor(
        4,
        { ...COMPLETE, hasEvent: true, eventName: "Ride", eventDate: "2026-12-19" },
        CTX,
      ),
    ).toEqual({
      eventName: "Ride",
      eventDate: "2026-12-19",
    });
    expect(profilePatchFor(4, COMPLETE, CTX)).toEqual({ eventName: null, eventDate: null });
  });
});

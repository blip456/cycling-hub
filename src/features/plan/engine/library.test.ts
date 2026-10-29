import { describe, expect, it } from "vitest";
import {
  aboveThresholdMinutes,
  formatMainSet,
  minimumMinutes,
  qualityMinutes,
  sessionLoad,
  sessionReason,
  sessionSteps,
  sessionTitle,
  stepContext,
  stepsMinutes,
} from "./library";
import type { SessionKind } from "./types";

const outdoor = stepContext({ ftp: 250, lthr: 165, indoor: false });
const indoor = stepContext({ ftp: 250, lthr: 165, indoor: true });

function build(
  kind: SessionKind,
  durationMin: number,
  step = 0,
  level: "amateur" | "committed" | "semi-pro" = "committed",
) {
  return sessionSteps({ kind, level, durationMin, ladderStep: step, context: outdoor });
}

describe("targets at 250 W (section 7.1)", () => {
  const work = (kind: SessionKind, minutes: number) =>
    build(kind, minutes).steps.find((s) => s.kind === "work");

  it.each([
    ["tempo", 208, 190, 225, 3],
    ["sweet-spot", 228, 220, 235, 4],
    ["threshold", 250, 238, 263, 4],
    ["vo2", 280, 265, 300, 5],
    ["torque", 195, 190, 205, 3],
  ] as const)("%s is %i W (%i to %i), power zone %i", (kind, target, min, max, zone) => {
    const step = work(kind, 120);
    expect(step?.target.watts).toEqual({ target, min, max });
    expect(step?.target.powerZone).toBe(zone);
  });

  it("gives endurance 163 W (139 to 188) and recovery 125 W (100 to 138)", () => {
    expect(build("endurance", 60).steps[0]?.target.watts).toEqual({
      target: 163,
      min: 140,
      max: 188,
    });
    expect(build("recovery", 45).steps[0]?.target.watts).toEqual({
      target: 125,
      min: 100,
      max: 138,
    });
  });

  it("uses heart rate zones from the LTHR, with Z3 to Z4 for sweet spot", () => {
    const hr = build("endurance", 60).steps[0]?.heartRate;
    expect(hr).toMatchObject({ zoneFrom: 2, zoneTo: 2, min: 113, max: 137, reference: "lthr" });
    const ss = build("sweet-spot", 90).steps.find((s) => s.kind === "work")?.heartRate;
    expect(ss).toMatchObject({ zoneFrom: 3, zoneTo: 4, min: 138, max: 173 });
  });

  it("falls back to max HR zones, and to watts only without a reference", () => {
    const maxHr = sessionSteps({
      kind: "endurance",
      level: "committed",
      durationMin: 60,
      context: stepContext({ ftp: 250, maxHr: 190, indoor: false }),
    });
    expect(maxHr.steps[0]?.heartRate?.reference).toBe("max-hr");
    const none = sessionSteps({
      kind: "endurance",
      level: "committed",
      durationMin: 60,
      context: stepContext({ ftp: 250, indoor: false }),
    });
    expect(none.steps[0]?.heartRate).toBeNull();
  });

  it("makes indoor targets exact and the warm-up 5 minutes longer", () => {
    const result = sessionSteps({
      kind: "threshold",
      level: "committed",
      durationMin: 90,
      ladderStep: 0,
      context: indoor,
    });
    const step = result.steps.find((s) => s.kind === "work");
    expect(step?.target).toMatchObject({ exact: true, watts: { target: 250, min: 250, max: 250 } });
    expect(result.steps[0]?.durationMin).toBe(20);
    const out = build("threshold", 90);
    expect(out.steps[0]?.durationMin).toBe(15);
    expect(out.steps.find((s) => s.kind === "work")?.target.exact).toBe(false);
  });

  it("marks sprints all-out without watts or heart rate, and VO2 as power-led", () => {
    const sprint = build("sprint", 80).steps.find((s) => s.kind === "work");
    expect(sprint?.target.watts.target).toBeNull();
    expect(sprint?.heartRate).toBeNull();
    expect(sprint?.durationSec).toBe(8);
    expect(build("vo2", 90).steps.find((s) => s.kind === "work")?.powerLeads).toBe(true);
  });
});

describe("structure of a session (section 7.2)", () => {
  it("is warm-up, repeats with rests, easy fill, cool-down, and adds up to the length", () => {
    const result = build("tempo", 60, 0);
    expect(result.mainSet).toBe("2x15");
    expect(result.steps.map((s) => s.kind)).toEqual([
      "warm-up",
      "work",
      "rest",
      "work",
      "cool-down",
    ]);
    expect(stepsMinutes(result.steps)).toBe(60);
    const long = build("tempo", 90, 0);
    expect(long.steps.map((s) => s.label)).toContain("Easy endurance");
    expect(stepsMinutes(long.steps)).toBe(90);
  });

  it("uses rests as long as the work for VO2 (at least 2 minutes)", () => {
    const result = build("vo2", 90, 1);
    const rest = result.steps.find((s) => s.kind === "rest");
    expect(result.mainSet).toBe("5x4");
    expect(rest?.durationMin).toBe(4);
  });

  it("goes down the ladder until the set fits, then to endurance", () => {
    const fits = build("vo2", 60, 3);
    expect(fits.ladderStep).toBeLessThan(3);
    expect(stepsMinutes(fits.steps)).toBe(60);
    const tiny = build("tempo", 30, 3);
    expect(tiny.kind).toBe("endurance");
    expect(tiny.mainSet).toBeNull();
    expect(tiny.ladderStep).toBeNull();
  });

  it("builds openers (40 minutes), the 20-minute test (70) and the ramp test (45)", () => {
    expect(stepsMinutes(build("openers", 40).steps)).toBe(40);
    const test = sessionSteps({
      kind: "test",
      level: "committed",
      durationMin: 70,
      context: outdoor,
    });
    expect(stepsMinutes(test.steps)).toBe(70);
    const ramp = sessionSteps({
      kind: "test",
      level: "committed",
      durationMin: 45,
      ftpTest: "ramp",
      context: outdoor,
    });
    expect(stepsMinutes(ramp.steps)).toBe(45);
  });

  it("builds a semi-pro long ride with tempo blocks that adds up", () => {
    const result = sessionSteps({
      kind: "long",
      level: "semi-pro",
      durationMin: 255,
      longBlocks: 1,
      context: outdoor,
    });
    expect(result.mainSet).toBe("3x20");
    expect(stepsMinutes(result.steps)).toBe(255);
    const plain = sessionSteps({
      kind: "long",
      level: "semi-pro",
      durationMin: 255,
      context: outdoor,
    });
    expect(plain.mainSet).toBeNull();
  });

  it("gives the shortest length that holds the first set", () => {
    expect(minimumMinutes({ kind: "tempo", level: "committed", indoor: false })).toBe(60);
    expect(minimumMinutes({ kind: "tempo", level: "committed", indoor: true })).toBe(65);
    expect(minimumMinutes({ kind: "endurance", level: "committed", indoor: false })).toBeNull();
    expect(minimumMinutes({ kind: "sprint", level: "amateur", indoor: false })).toBeNull();
  });
});

describe("load and intensity minutes (section 2)", () => {
  it("gives an easy hour at 65 % FTP a load of 42", () => {
    expect(Math.round(sessionLoad(build("endurance", 60).steps))).toBe(42);
  });

  it("counts only work at 88 % FTP and up as quality, and above 105 % as above threshold", () => {
    const tempo = build("tempo", 90).steps;
    expect(qualityMinutes(tempo)).toBe(0);
    const ss = build("sweet-spot", 90, 0).steps;
    expect(qualityMinutes(ss)).toBe(30);
    expect(aboveThresholdMinutes(ss)).toBe(0);
    const vo2 = build("vo2", 90, 0).steps;
    expect(aboveThresholdMinutes(vo2)).toBe(15);
    expect(aboveThresholdMinutes(build("threshold", 90).steps)).toBe(0);
  });
});

describe("titles and reasons", () => {
  it("writes titles with the main set", () => {
    expect(sessionTitle({ kind: "sweet-spot", mainSet: "3x15" })).toBe("Sweet spot 3 x 15 min");
    expect(sessionTitle({ kind: "sprint", mainSet: "6x8s" })).toBe("Sprints 6 x 8 s");
    expect(sessionTitle({ kind: "endurance", mainSet: null })).toBe("Endurance ride");
    expect(sessionTitle({ kind: "event", mainSet: null, eventName: "Gran Fondo" })).toBe(
      "Event: Gran Fondo",
    );
    expect(sessionTitle({ kind: "test", mainSet: null, ftpTest: "ramp" })).toBe("FTP ramp test");
    expect(formatMainSet("sprint", [6, 8])).toBe("6x8s");
  });

  it("starts with the reason of the type and adds the week context", () => {
    expect(sessionReason({ kind: "threshold", weekType: "loading", purpose: "speed" })).toBe(
      "Work at FTP. Raises the power you can hold for an hour. It fits your goal: speed.",
    );
    expect(sessionReason({ kind: "tempo", weekType: "recovery" })).toContain("Recovery week");
    expect(sessionReason({ kind: "vo2", weekType: "taper" })).toContain("Taper");
    expect(sessionReason({ kind: "tempo", weekType: "loading", held: true })).toContain(
      "weekly cap",
    );
  });
});

import { describe, expect, it } from "vitest";
import { checklistFor, dateWarnings, PROTOCOLS, stepsFor } from "./protocols";

describe("protocols", () => {
  it("has three sessions for the 20-minute test and two for the ramp test, in order from position 1", () => {
    expect(PROTOCOLS["20min"].sessions.map((s) => [s.position, s.kind])).toEqual([
      [1, "opener"],
      [2, "test"],
      [3, "recovery"],
    ]);
    expect(PROTOCOLS.ramp.sessions.map((s) => [s.position, s.kind])).toEqual([
      [1, "opener"],
      [2, "test"],
    ]);
  });
});

describe("stepsFor", () => {
  it("takes power targets from the FTP (Coggan zones)", () => {
    const steps = stepsFor("20min", "test", 250);
    expect(steps.map((s) => s.title)).toEqual([
      "Warm-up",
      "Fast pedalling",
      "Easy spin",
      "Hard effort",
      "Recovery",
      "The test",
      "Cool-down",
    ]);
    expect(steps[0]?.target).toBe("Zone 2: 139 to 188 W");
    expect(steps[2]?.target).toBe("Zone 1: up to 138 W");
  });

  it("uses effort wording only when there is no FTP", () => {
    const steps = stepsFor("20min", "test", null);
    expect(steps.every((s) => !/\d+ W/.test(s.target))).toBe(true);
    expect(steps[0]?.target).toBe("Easy, you can still talk");
  });

  it("gives the ramp test its own steps", () => {
    const steps = stepsFor("ramp", "test", 250);
    expect(steps.map((s) => s.title)).toEqual(["Warm-up", "The ramp", "Cool-down"]);
    expect(steps[1]?.target).toContain("100 W");
  });

  it("has steps for the opener and the recovery ride", () => {
    expect(stepsFor("20min", "opener", 200).length).toBeGreaterThan(2);
    expect(stepsFor("20min", "recovery", 200)).toHaveLength(1);
  });
});

describe("checklistFor", () => {
  it("lists the test preparation", () => {
    expect(checklistFor("test")).toContain("Power meter zeroed");
  });
});

describe("dateWarnings", () => {
  const sessions = PROTOCOLS["20min"].sessions;
  const today = "2026-10-28";

  it("has no warnings for sensible dates", () => {
    expect(dateWarnings(sessions, ["2026-10-30", "2026-10-31", "2026-11-01"], today)).toEqual([
      [],
      [],
      [],
    ]);
  });

  it("has no warnings while no date is chosen", () => {
    expect(dateWarnings(sessions, [null, null, null], today)).toEqual([[], [], []]);
  });

  it("warns about a date in the past", () => {
    expect(dateWarnings(sessions, ["2026-10-20", null, null], today)[0]).toEqual([
      "This date is in the past.",
    ]);
  });

  it("warns when the test is on the same day as the opener", () => {
    const warnings = dateWarnings(sessions, ["2026-10-30", "2026-10-30", null], today);
    expect(warnings[1]?.join(" ")).toContain("same day as the opener");
  });

  it("warns when the sessions are out of order", () => {
    const warnings = dateWarnings(sessions, ["2026-11-02", "2026-10-31", null], today);
    expect(warnings[1]?.join(" ")).toContain("before session 1");
  });
});

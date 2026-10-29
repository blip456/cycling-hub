import { describe, expect, it } from "vitest";
import { mondayOnOrAfter, mondayOnOrBefore, phaseOf, planStructure } from "./calendar";

describe("start date", () => {
  it("finds Mondays", () => {
    expect(mondayOnOrAfter("2026-10-26")).toBe("2026-10-26");
    expect(mondayOnOrAfter("2026-10-28")).toBe("2026-11-02");
    expect(mondayOnOrBefore("2026-11-01")).toBe("2026-10-26");
  });

  it("starts on the next Monday by default, today when it is a Monday", () => {
    expect(planStructure({ today: "2026-10-26" }).startDate).toBe("2026-10-26");
    expect(planStructure({ today: "2026-10-29" }).startDate).toBe("2026-11-02");
  });

  it("rolls a chosen start date forward to a Monday and says so", () => {
    const structure = planStructure({ today: "2026-10-26", startDate: "2026-10-28" });
    expect(structure.startDate).toBe("2026-11-02");
    expect(structure.notices.map((n) => n.code)).toEqual(["start-moved"]);
  });
});

describe("12 weeks without an event", () => {
  const structure = planStructure({ today: "2026-10-26" });

  it("has base, build and peak blocks of 4 weeks", () => {
    expect(structure.weeks.map((w) => w.phase)).toEqual([
      ...Array<string>(4).fill("base"),
      ...Array<string>(4).fill("build"),
      ...Array<string>(4).fill("peak"),
    ]);
    expect(structure.endDate).toBe("2027-01-17");
  });

  it("has a recovery week every 4th week and the FTP test in week 12", () => {
    expect(structure.weeks.filter((w) => w.type === "recovery").map((w) => w.number)).toEqual([
      4, 8, 12,
    ]);
    expect(structure.weeks.filter((w) => w.hasTest).map((w) => w.number)).toEqual([12]);
  });

  it("can use a recovery week every 3rd week", () => {
    const three = planStructure({ today: "2026-10-26", recoveryEvery: 3 });
    expect(three.weeks.filter((w) => w.type === "recovery").map((w) => w.number)).toEqual([
      3, 6, 9, 12,
    ]);
  });
});

describe("with an event (built backwards)", () => {
  it("tapers 1 week for an event under 3 hours and 2 weeks otherwise", () => {
    const short = planStructure({
      today: "2026-10-26",
      event: { name: "A", date: "2027-01-17", duration: "under-3h" },
    });
    expect(short.taperWeeks).toBe(1);
    expect(short.weeks.filter((w) => w.type === "taper").map((w) => w.number)).toEqual([12]);
    for (const duration of ["3-to-6h", "over-6h"] as const) {
      const long = planStructure({
        today: "2026-10-26",
        event: { name: "A", date: "2027-01-17", duration },
      });
      expect(long.weeks.filter((w) => w.type === "taper").map((w) => w.number)).toEqual([11, 12]);
    }
  });

  it("defaults to a two week taper and ends the plan on the event date", () => {
    const structure = planStructure({
      today: "2026-10-26",
      event: { name: "A", date: "2027-01-14" },
    });
    expect(structure.taperWeeks).toBe(2);
    expect(structure.endDate).toBe("2027-01-14");
    expect(structure.weeks).toHaveLength(12);
  });

  it("never makes the last week before the taper a recovery week", () => {
    // 8 weeks: weeks 1 to 6 train, 7 and 8 taper; week 4 is recovery, week 6 is not.
    const structure = planStructure({
      today: "2026-10-26",
      event: { name: "A", date: "2026-12-20", duration: "3-to-6h" },
    });
    expect(structure.weeks).toHaveLength(8);
    expect(structure.weeks.filter((w) => w.type === "recovery").map((w) => w.number)).toEqual([4]);
    // 12 weeks: week 8 is recovery, week 10 is the last training week.
    const twelve = planStructure({
      today: "2026-10-26",
      event: { name: "A", date: "2027-01-17", duration: "3-to-6h" },
    });
    expect(twelve.weeks.filter((w) => w.type === "recovery").map((w) => w.number)).toEqual([4, 8]);
    // Week 8 would be recovery, but it is the last training week before the taper: it stays loading.
    const edge = planStructure({
      today: "2026-10-26",
      event: { name: "A", date: "2027-01-03", duration: "3-to-6h" },
    });
    expect(edge.weeks).toHaveLength(10);
    expect(edge.weeks.find((w) => w.number === 8)?.type).toBe("loading");
  });

  it("starts 12 weeks before the event week when the event is further away", () => {
    const structure = planStructure({
      today: "2026-10-26",
      event: { name: "A", date: "2027-03-14", duration: "3-to-6h" },
    });
    expect(structure.startDate).toBe("2026-12-21");
    expect(structure.weeks).toHaveLength(12);
    expect(structure.endDate).toBe("2027-03-14");
    expect(structure.warnings.map((w) => w.code)).toEqual(["event-far"]);
    expect(structure.warnings[0]?.message).toContain("2026-12-21");
  });

  it("builds a short plan for an event less than 4 weeks away and warns", () => {
    const structure = planStructure({
      today: "2026-10-26",
      event: { name: "A", date: "2026-11-14", duration: "3-to-6h" },
    });
    expect(structure.weeks).toHaveLength(3);
    expect(structure.weeks.map((w) => w.type)).toEqual(["loading", "taper", "taper"]);
    expect(structure.warnings.map((w) => w.code)).toEqual(["event-too-soon"]);
  });

  it("limits the taper to the plan length and has no recovery week under 5 weeks", () => {
    const structure = planStructure({
      today: "2026-10-26",
      event: { name: "A", date: "2026-11-08", duration: "over-6h" },
    });
    expect(structure.weeks.map((w) => w.type)).toEqual(["taper", "taper"]);
    const four = planStructure({
      today: "2026-10-26",
      event: { name: "A", date: "2026-11-22", duration: "under-3h" },
    });
    expect(four.weeks.map((w) => w.type)).toEqual(["loading", "loading", "loading", "taper"]);
  });

  it("ignores an event before the start and warns", () => {
    const structure = planStructure({
      today: "2026-10-26",
      event: { name: "A", date: "2026-10-01", duration: "3-to-6h" },
    });
    expect(structure.event).toBeNull();
    expect(structure.weeks).toHaveLength(12);
    expect(structure.warnings.map((w) => w.code)).toEqual(["event-past"]);
  });
});

describe("phases of a shorter plan", () => {
  it("takes thirds of the training weeks", () => {
    const phases = [1, 2, 3, 4, 5, 6, 7, 8].map((week) => phaseOf(week, 8, 10));
    expect(phases).toEqual(["base", "base", "base", "build", "build", "build", "peak", "peak"]);
  });
});

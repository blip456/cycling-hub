import { describe, expect, it } from "vitest";
import { clampHours, gateLevel, levelBand, levelScore, scoreLevel } from "./level";
import type { LevelAnswers } from "./types";

const answers = (a: number, b: number, c: number, d: number, e: number): LevelAnswers => ({
  experience: a as LevelAnswers["experience"],
  weeklyHours: b as LevelAnswers["weeklyHours"],
  intervals: c as LevelAnswers["intervals"],
  longestRide: d as LevelAnswers["longestRide"],
  hardSessions: e as LevelAnswers["hardSessions"],
});

describe("level scoring", () => {
  it("sums the five answers", () => {
    expect(levelScore(answers(1, 1, 1, 1, 0))).toBe(4);
    expect(levelScore(answers(3, 3, 3, 3, 3))).toBe(15);
    expect(levelScore(answers(0, 0, 0, 0, 0))).toBe(0);
  });

  it("uses the bands 0-5, 6-10 and 11-15", () => {
    expect([0, 5].map(levelBand)).toEqual(["amateur", "amateur"]);
    expect([6, 10].map(levelBand)).toEqual(["committed", "committed"]);
    expect([11, 15].map(levelBand)).toEqual(["semi-pro", "semi-pro"]);
  });

  it("drops a level when the hours do not fit (the hours gate)", () => {
    expect(gateLevel("semi-pro", 9.5)).toBe("committed");
    expect(gateLevel("semi-pro", 10)).toBe("semi-pro");
    expect(gateLevel("semi-pro", 4)).toBe("amateur");
    expect(gateLevel("committed", 5.9)).toBe("amateur");
    expect(gateLevel("committed", 6)).toBe("committed");
    expect(gateLevel("amateur", 1)).toBe("amateur");
  });

  it("reports score, band, gated level and the final level", () => {
    expect(scoreLevel(answers(3, 3, 2, 2, 2), 13)).toEqual({
      score: 12,
      band: "semi-pro",
      gated: "semi-pro",
      level: "semi-pro",
    });
    expect(scoreLevel(answers(3, 3, 2, 2, 2), 4)).toMatchObject({
      band: "semi-pro",
      gated: "amateur",
    });
  });

  it("lets the override win over the gated level", () => {
    expect(scoreLevel(answers(1, 1, 1, 1, 0), 4, "committed").level).toBe("committed");
  });

  it("clamps the hours to the level range", () => {
    expect(clampHours("amateur", 8)).toBe(6);
    expect(clampHours("amateur", 1)).toBe(3);
    expect(clampHours("committed", 8)).toBe(8);
    expect(clampHours("semi-pro", 20)).toBe(16);
    expect(clampHours("semi-pro", Number.NaN)).toBe(10);
  });
});

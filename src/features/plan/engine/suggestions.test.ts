import { describe, expect, it } from "vitest";
import type { HistoryRide } from "./history";
import {
  levelSuggestions,
  suggestMaxLongRide,
  suggestMaxWeeklyHours,
  suggestTargetHours,
  suggestionText,
} from "./suggestions";

/** Monday 2026-11-16: the complete weeks before it end on Sunday 2026-11-15. */
const TODAY = "2026-11-18";

/** A ride on the Wednesday of the week that starts `weeksAgo` weeks before the running week's Monday. */
function ride(weeksAgo: number, hours: number, extra: Partial<HistoryRide> = {}): HistoryRide {
  const monday = new Date(Date.UTC(2026, 10, 16) - weeksAgo * 7 * 86_400_000);
  const day = new Date(monday.getTime() + 2 * 86_400_000);
  return { date: day.toISOString().slice(0, 10), movingMinutes: hours * 60, ...extra };
}

const weeks = (count: number, hours: number, extra: Partial<HistoryRide> = {}) =>
  Array.from({ length: count }, (_, i) => ride(i + 1, hours, extra));

describe("number suggestions", () => {
  it("suggests the weekly hours in half hours", () => {
    expect(suggestTargetHours(weeks(24, 6.3), TODAY, "median")?.value).toBe(6.5);
  });

  it("keeps the target hours in the 1 to 25 range", () => {
    expect(suggestTargetHours(weeks(24, 30), TODAY, "median")?.value).toBe(25);
    expect(suggestTargetHours(weeks(24, 0.2), TODAY, "median")?.value).toBe(1);
  });

  it("takes the busy weeks for the most hours in a week", () => {
    const rides = [...weeks(20, 6), ...[21, 22, 23, 24].map((n) => ride(n, 11))];
    expect(suggestMaxWeeklyHours(rides, TODAY)?.value).toBe(11);
    expect(suggestMaxWeeklyHours(weeks(24, 1), TODAY)?.value).toBe(3);
  });

  it("takes the longest ride of the last 24 weeks in steps of 5 minutes", () => {
    const rides = [ride(2, 2), ride(10, 4.51), ride(30, 8)];
    expect(suggestMaxLongRide(rides, TODAY)?.value).toBe(270);
  });

  it("gives nothing without rides", () => {
    expect(suggestTargetHours([], TODAY, "median")).toBeUndefined();
    expect(suggestMaxWeeklyHours([], TODAY)).toBeUndefined();
    expect(suggestMaxLongRide([], TODAY)).toBeUndefined();
  });
});

describe("level suggestions", () => {
  const FTP = 200;

  it("L1 only answers when the history reaches back a year", () => {
    expect(levelSuggestions(weeks(20, 5), TODAY, "median", FTP)[0]).toBeUndefined();
    const old = [ride(60, 5), ...weeks(10, 5)];
    expect(levelSuggestions(old, TODAY, "median", FTP)[0]?.answer).toBe(1);
    const older = [ride(170, 5), ...weeks(10, 5)];
    expect(levelSuggestions(older, TODAY, "median", FTP)[0]?.answer).toBe(2);
    const oldest = [ride(300, 5), ...weeks(10, 5)];
    expect(levelSuggestions(oldest, TODAY, "median", FTP)[0]?.answer).toBe(3);
  });

  it("L4 takes the longest ride of the last 3 months", () => {
    const answer = (hours: number) =>
      levelSuggestions([...weeks(10, 1), ride(3, hours)], TODAY, "median", FTP)[3]?.answer;
    expect(answer(1.9)).toBe(0);
    expect(answer(2)).toBe(1);
    expect(answer(3.5)).toBe(2);
    expect(answer(5.1)).toBe(3);
    expect(levelSuggestions([...weeks(10, 1), ride(20, 7)], TODAY, "median", FTP)[3]?.answer).toBe(
      0,
    );
  });

  it("L3 and L5 count rides with average power above 75 % of FTP", () => {
    const hard = { avgPowerW: 160 };
    const easy = { avgPowerW: 120 };
    const everyWeek = [...weeks(13, 1.5, hard), ...weeks(13, 2, easy)];
    const result = levelSuggestions(everyWeek, TODAY, "median", FTP);
    expect(result[2]?.answer).toBe(3);
    expect(result[4]?.answer).toBe(1);

    const twoHard = [...everyWeek, ...weeks(13, 1, hard)];
    expect(levelSuggestions(twoHard, TODAY, "median", FTP)[4]?.answer).toBe(2);

    const never = [...weeks(13, 1.5, easy)];
    const none = levelSuggestions(never, TODAY, "median", FTP);
    expect(none[2]?.answer).toBe(0);
    expect(none[4]?.answer).toBe(0);
  });

  it("L3 and L5 need an FTP and enough rides with power", () => {
    const rides = weeks(13, 1.5, { avgPowerW: 160 });
    expect(levelSuggestions(rides, TODAY, "median", null)[2]).toBeUndefined();
    expect(levelSuggestions(weeks(13, 1.5), TODAY, "median", FTP)[4]).toBeUndefined();
    expect(
      levelSuggestions(weeks(4, 1.5, { avgPowerW: 160 }), TODAY, "median", FTP)[2],
    ).toBeUndefined();
  });

  it("leaves commutes out", () => {
    const rides = weeks(13, 3, { commute: true });
    expect(levelSuggestions(rides, TODAY, "median", FTP)[1]).toBeUndefined();
  });

  it("words the suggestion as filled in or as a plain fact", () => {
    expect(suggestionText("about 6 h", true)).toBe(
      "Filled in from your rides: about 6 h. Change it if that is not right.",
    );
    expect(suggestionText("about 6 h", false)).toBe("From your rides: about 6 h.");
  });
});

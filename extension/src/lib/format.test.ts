import { describe, expect, it } from "vitest";
import { progressText, timeLeft } from "./format";

describe("progressText", () => {
  it("shows the list progress", () => {
    expect(progressText({ phase: "list", read: 120, total: 311 })).toBe(
      "Reading activities: 120 of 311",
    );
    expect(progressText({ phase: "list", read: 20, total: null })).toBe("Reading activities: 20");
  });

  it("shows the details progress with the time left", () => {
    expect(progressText({ phase: "details", done: 12, total: 208, secondsLeft: 420 })).toBe(
      "Downloading ride details: 12 of 208, about 7 minutes left",
    );
    expect(progressText({ phase: "details", done: 208, total: 208, secondsLeft: 0 })).toBe(
      "Downloading ride details: 208 of 208",
    );
  });
});

describe("timeLeft", () => {
  it.each([
    [30, "less than a minute left"],
    [60, "about 1 minute left"],
    [3600, "about 1 hour left"],
    [3900, "about 1 hour 5 minutes left"],
    [7260, "about 2 hours 1 minute left"],
  ])("%i s → %s", (seconds, text) => {
    expect(timeLeft(seconds)).toBe(text);
  });
});

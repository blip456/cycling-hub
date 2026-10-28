import { describe, expect, it } from "vitest";
import { brusselsDate, type Weekday } from "./dates";
import { shouldShowWeightReminder } from "./reminder";

// 28 Oct 2026 is a Wednesday.
const base = { entries: [], today: "2026-10-28", reminderDay: "wed" as Weekday, enabled: true };

describe("shouldShowWeightReminder", () => {
  it("shows on the reminder day with nothing logged", () => {
    expect(shouldShowWeightReminder(base)).toBe(true);
  });
  it("is due from the most recent reminder day, so the day setting matters", () => {
    // Today is Wednesday. A Thursday reminder was last due 6 days ago (Thursday 22 Oct).
    const logged = { entries: [{ date: "2026-10-21" }] };
    expect(shouldShowWeightReminder({ ...base, ...logged, reminderDay: "thu" })).toBe(true);
    expect(shouldShowWeightReminder({ ...base, ...logged, reminderDay: "wed" })).toBe(true);
    // Logged on Tuesday: Tuesday reminders are satisfied, Wednesday ones are not.
    const tuesday = { entries: [{ date: "2026-10-27" }] };
    expect(shouldShowWeightReminder({ ...base, ...tuesday, reminderDay: "tue" })).toBe(false);
    expect(shouldShowWeightReminder({ ...base, ...tuesday, reminderDay: "wed" })).toBe(true);
  });
  it("keeps showing into the next week until a weight is logged", () => {
    expect(shouldShowWeightReminder({ ...base, today: "2026-10-29" })).toBe(true);
    expect(shouldShowWeightReminder({ ...base, today: "2026-11-02" })).toBe(true); // next Monday
    expect(shouldShowWeightReminder({ ...base, today: "2026-11-04" })).toBe(true); // next Wednesday
  });
  it("hides once a weight is logged on or after the reminder day", () => {
    const logged = { entries: [{ date: "2026-10-28" }] };
    expect(shouldShowWeightReminder({ ...base, ...logged })).toBe(false);
    expect(shouldShowWeightReminder({ ...base, ...logged, today: "2026-11-03" })).toBe(false);
    expect(shouldShowWeightReminder({ ...base, ...logged, today: "2026-11-04" })).toBe(true);
  });
  it("is not cleared by a weight logged before the reminder day", () => {
    expect(
      shouldShowWeightReminder({ ...base, reminderDay: "wed", entries: [{ date: "2026-10-27" }] }),
    ).toBe(true);
  });
  it("works for every reminder day", () => {
    for (const day of ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const) {
      expect(shouldShowWeightReminder({ ...base, reminderDay: day })).toBe(true);
    }
  });
  it("is off when disabled", () => {
    expect(shouldShowWeightReminder({ ...base, enabled: false })).toBe(false);
  });
  it("ignores future and invalid entry dates", () => {
    expect(shouldShowWeightReminder({ ...base, entries: [{ date: "2026-10-29" }] })).toBe(true);
    expect(shouldShowWeightReminder({ ...base, entries: [{ date: "nope" }] })).toBe(true);
  });
  it("counts days across the 29 Mar and 25 Oct clock changes", () => {
    const spring = { ...base, today: "2026-03-30", reminderDay: "sun" as Weekday };
    expect(shouldShowWeightReminder({ ...spring, entries: [{ date: "2026-03-29" }] })).toBe(false);
    expect(shouldShowWeightReminder({ ...spring, entries: [{ date: "2026-03-28" }] })).toBe(true);
    const autumn = { ...base, today: "2026-10-26", reminderDay: "sun" as Weekday };
    expect(shouldShowWeightReminder({ ...autumn, entries: [{ date: "2026-10-25" }] })).toBe(false);
    expect(shouldShowWeightReminder({ ...autumn, entries: [{ date: "2026-10-24" }] })).toBe(true);
  });
  it("works with a Brussels date taken just after local midnight", () => {
    // 22:30 UTC on Saturday 24 Oct is already Sunday 25 Oct in Brussels.
    const today = brusselsDate(new Date("2026-10-24T22:30:00Z")) as string;
    expect(today).toBe("2026-10-25");
    expect(shouldShowWeightReminder({ ...base, today, reminderDay: "sun" })).toBe(true);
    expect(
      shouldShowWeightReminder({ ...base, today, reminderDay: "sun", entries: [{ date: today }] }),
    ).toBe(false);
    expect(
      shouldShowWeightReminder({ ...base, today, reminderDay: "sun", dismissedOn: "2026-10-24" }),
    ).toBe(true);
  });
  it("handles leap days", () => {
    const input = { ...base, today: "2028-03-01", reminderDay: "sun" as Weekday }; // Wednesday
    expect(shouldShowWeightReminder({ ...input, entries: [{ date: "2028-02-27" }] })).toBe(false);
    expect(shouldShowWeightReminder({ ...input, entries: [{ date: "2028-02-26" }] })).toBe(true);
  });
  it("stays hidden for the rest of the day it was dismissed (Not now), back tomorrow", () => {
    expect(shouldShowWeightReminder({ ...base, dismissedOn: "2026-10-28" })).toBe(false);
    expect(shouldShowWeightReminder({ ...base, dismissedOn: "2026-10-27" })).toBe(true);
    expect(shouldShowWeightReminder({ ...base, dismissedOn: null })).toBe(true);
  });
  it("returns false, not an error, for invalid input", () => {
    expect(shouldShowWeightReminder({ ...base, today: "bad" })).toBe(false);
    expect(shouldShowWeightReminder({ ...base, today: "2026-02-30" })).toBe(false);
    expect(shouldShowWeightReminder({ ...base, reminderDay: "xyz" as Weekday })).toBe(false);
  });
});

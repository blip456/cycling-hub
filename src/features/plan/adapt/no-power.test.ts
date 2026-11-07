import { describe, expect, it } from "vitest";
import { addDays, type IsoDate } from "@/features/athlete";
import { noPowerWarning } from "./no-power";
import { ride, session } from "./test-helpers";

const TODAY = "2026-12-02";
const ago = (days: number): IsoDate => addDays(TODAY, -days) as IsoDate;

/** `n` done sessions, one a day going back from `from` days ago, each with a ride with or without power. */
function done(offsets: number[], power: number | null) {
  const sessions = offsets.map((offset) =>
    session(ago(offset), "endurance", 60, {
      id: `s${offset}`,
      status: "done",
      activityId: `r${offset}`,
      matchSource: "auto",
    }),
  );
  const rides = offsets.map((offset) =>
    ride(ago(offset), 60, { id: `r${offset}`, avgPowerW: power }),
  );
  return { sessions, rides };
}

describe("noPowerWarning", () => {
  it("is quiet at 3 done sessions without power", () => {
    const { sessions, rides } = done([1, 3, 5], null);
    expect(noPowerWarning(sessions, rides, TODAY)).toBeNull();
  });

  it("warns at 4, with the count, the dates and the card text", () => {
    const { sessions, rides } = done([8, 5, 3, 1], null);
    const warning = noPowerWarning(sessions, rides, TODAY);
    expect(warning?.count).toBe(4);
    expect(warning?.dates).toEqual([ago(8), ago(5), ago(3), ago(1)]);
    expect(warning?.title).toBe("No power data on 4 sessions");
    expect(warning?.message).toBe(
      "The plan stays the same. Power targets cannot be checked on these sessions.",
    );
    expect(warning?.sessions.map((s) => s.id)).toEqual(["s8", "s5", "s3", "s1"]);
  });

  it("counts the last 28 days: 27 days ago is in, 28 days ago is out", () => {
    const edgeIn = done([27, 20, 10, 1], null);
    expect(noPowerWarning(edgeIn.sessions, edgeIn.rides, TODAY)?.count).toBe(4);
    const edgeOut = done([28, 20, 10, 1], null);
    expect(noPowerWarning(edgeOut.sessions, edgeOut.rides, TODAY)).toBeNull();
  });

  it("goes away when the count drops below 4 as the days pass", () => {
    const { sessions, rides } = done([27, 20, 10, 1], null);
    expect(noPowerWarning(sessions, rides, TODAY)).not.toBeNull();
    expect(noPowerWarning(sessions, rides, addDays(TODAY, 1) as IsoDate)).toBeNull();
  });

  it("only counts done sessions whose ride has no power", () => {
    const withPower = done([1, 2, 3, 4], 150);
    expect(noPowerWarning(withPower.sessions, withPower.rides, TODAY)).toBeNull();
    const zero = done([1, 2, 3, 4], 0);
    expect(noPowerWarning(zero.sessions, zero.rides, TODAY)?.count).toBe(4);
    const mixed = done([1, 2, 3, 4], null);
    const missed = mixed.sessions.map((s, i) =>
      i === 0 ? { ...s, status: "missed" as const } : s,
    );
    expect(noPowerWarning(missed, mixed.rides, TODAY)).toBeNull();
  });

  it("does not count a session done without a ride, or a ride that is not in the list", () => {
    const { sessions, rides } = done([1, 2, 3, 4], null);
    const byHand = sessions.map((s, i) => (i === 0 ? { ...s, activityId: null } : s));
    expect(noPowerWarning(byHand, rides, TODAY)).toBeNull();
    expect(noPowerWarning(sessions, rides.slice(1), TODAY)).toBeNull();
  });
});

import { describe, expect, it } from "vitest";
import { buildPlan } from "../engine";
import { EXAMPLE_B } from "../engine/fixtures";
import { updateEffect } from "./effect";
import { describeChange, sessionData } from "./merge";
import { effectSentence } from "../adaptation/format";

const base = buildPlan(EXAMPLE_B);
const high = buildPlan({ ...EXAMPLE_B, settings: { intensityBalance: "high" } });
const zone2 = buildPlan({ ...EXAMPLE_B, settings: { zone2TargetPercent: 72 } });

describe("the effect of an update on the weeks it changed", () => {
  it("is null when no date changed", () => {
    expect(updateEffect(base.sessions, base.sessions, new Set())).toBeNull();
  });

  it("covers only the weeks with a changed date, in plan order, with a total", () => {
    const changed = new Set(
      base.sessions.filter((s) => s.week === 6 || s.week === 5).map((s) => s.date),
    );
    const effect = updateEffect(base.sessions, high.sessions, changed);
    expect(effect?.weeks.map((w) => w.week)).toEqual([5, 6]);
    const sum = (pick: (w: NonNullable<typeof effect>["weeks"][number]) => number) =>
      effect?.weeks.reduce((s, w) => s + pick(w), 0);
    expect(effect?.total.before.minutes).toBeCloseTo(sum((w) => w.before.minutes) ?? 0);
    expect(effect?.total.after.load).toBeCloseTo(sum((w) => w.after.load) ?? 0);
  });

  it("shows more VO2 max time and the same hours for a higher intensity balance", () => {
    const dates = new Set(high.sessions.map((s) => s.date));
    const effect = updateEffect(base.sessions, high.sessions, dates);
    expect(effect).not.toBeNull();
    expect(effect?.total.after.aboveMinutes).toBeGreaterThan(
      effect?.total.before.aboveMinutes ?? 0,
    );
    expect(effect?.total.after.minutes).toBeCloseTo(effect?.total.before.minutes ?? 0);
    expect(effectSentence(effect ?? undefined)).toMatch(/min above 105 % of FTP/);
  });

  it("does not depend on the order of the sessions", () => {
    const dates = new Set(base.sessions.map((s) => s.date));
    const forward = updateEffect(base.sessions, high.sessions, dates);
    const reversed = updateEffect(
      [...base.sessions].reverse(),
      [...high.sessions].reverse(),
      dates,
    );
    expect(reversed).toEqual(forward);
  });
});

describe("what a targets change says", () => {
  const pairs = base.sessions.flatMap((before, i) => {
    const after = zone2.sessions[i];
    return after && before.date === after.date ? [[before, after] as const] : [];
  });

  it("names the step, the percent of FTP and the watts", () => {
    const [before, after] = pairs.find(([b]) => b.kind === "long") ?? [];
    expect(before && after).toBeTruthy();
    if (!before || !after) return;
    const change = describeChange(
      sessionData({ ...before, movedFrom: null }),
      sessionData({ ...after, movedFrom: null }),
    );
    expect(change?.change).toBe("targets");
    expect(change?.detail).toBe("Steady endurance: 65 % to 72 % of FTP (163 W to 180 W)");
  });

  it("has no detail for the other kinds of change", () => {
    const [before] = base.sessions;
    const other = base.sessions.find((s) => s.kind !== before?.kind);
    if (!before || !other) throw new Error("no sessions");
    const change = describeChange(
      sessionData({ ...before, movedFrom: null }),
      sessionData({ ...other, date: before.date, movedFrom: null }),
    );
    expect(change?.detail).toBeUndefined();
  });
});

describe("effectSentence", () => {
  const metrics = { minutes: 400, load: 300, hard: 2, aboveMinutes: 0 };
  const week = { week: 2, before: metrics, after: metrics };

  it("says only the targets moved when the totals stay the same", () => {
    expect(effectSentence({ weeks: [week], total: { before: metrics, after: metrics } })).toBe(
      "In the 1 week that changed, hours, load and hard sessions stay the same; only the targets and the layout moved.",
    );
  });

  it("names more riding time, load and fewer hard sessions", () => {
    const after = { minutes: 470, load: 270, hard: 1, aboveMinutes: 0 };
    expect(effectSentence({ weeks: [week, week], total: { before: metrics, after } })).toBe(
      "In the 2 weeks that changed: +1 h 10 min riding, load -10 %, -1 hard session.",
    );
  });

  it("is null without an effect (older updates)", () => {
    expect(effectSentence(undefined)).toBeNull();
  });
});

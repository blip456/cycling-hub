import { describe, expect, it } from "vitest";
import { buildPlan } from "../engine";
import { EXAMPLE_A } from "../engine/fixtures";
import {
  applyDiff,
  describeChange,
  invertDiff,
  isEmptyDiff,
  isFrozen,
  mergePlan,
  sessionData,
} from "./merge";
import { session, storeSessions } from "./test-helpers";

const plan = buildPlan(EXAMPLE_A);
const stored = storeSessions(plan);
const TODAY = "2026-12-03";

function rebuilt() {
  return plan.sessions.map((s) => sessionData({ ...s, movedFrom: null }));
}

describe("isFrozen", () => {
  it("freezes past sessions, other statuses, manual links and today's started session", () => {
    const s = session("2026-12-03", "endurance", 60);
    expect(isFrozen(s, TODAY, false)).toBe(false);
    expect(isFrozen(s, TODAY, true)).toBe(true);
    expect(isFrozen(session("2026-12-04", "endurance", 60), TODAY, true)).toBe(false);
    expect(isFrozen(session("2026-12-02", "endurance", 60), TODAY, false)).toBe(true);
    expect(
      isFrozen(session("2026-12-04", "endurance", 60, { status: "skipped" }), TODAY, false),
    ).toBe(true);
    expect(isFrozen(session("2026-12-04", "endurance", 60, { status: "done" }), TODAY, false)).toBe(
      true,
    );
    expect(
      isFrozen(session("2026-12-04", "endurance", 60, { matchSource: "manual" }), TODAY, false),
    ).toBe(true);
  });
});

describe("mergePlan", () => {
  it("gives an empty diff for the same plan", () => {
    expect(isEmptyDiff(mergePlan(stored, rebuilt(), { today: TODAY }))).toBe(true);
  });

  it("inserts a new date, updates a changed one, deletes a removed one, all by date", () => {
    const next = rebuilt().filter((s) => s.date !== "2026-12-05");
    const sunday = next.find((s) => s.date === "2026-12-06");
    if (!sunday) throw new Error("fixture");
    const edited = next.map((s) => (s.date === "2026-12-06" ? { ...s, durationMin: 90 } : s));
    edited.push({ ...sunday, date: "2026-12-04", slot: "easy", kind: "endurance" });
    const diff = mergePlan(stored, edited, { today: TODAY });
    expect(diff.delete.map((d) => [d.id, d.date])).toEqual([["s-2026-12-05", "2026-12-05"]]);
    expect(diff.update.map((u) => [u.id, u.date, u.after.durationMin])).toEqual([
      ["s-2026-12-06", "2026-12-06", 90],
    ]);
    expect(diff.insert.map((i) => i.session.date)).toEqual(["2026-12-04"]);
  });

  it("never touches frozen sessions or dates before today", () => {
    const edited = rebuilt().map((s) => ({ ...s, durationMin: s.durationMin + 5 }));
    const locked = stored.map((s) =>
      s.date === "2026-12-05" ? { ...s, matchSource: "manual" as const } : s,
    );
    const diff = mergePlan(locked, edited, { today: TODAY });
    const touched = [
      ...diff.insert.map((i) => i.session.date),
      ...diff.update.map((u) => u.date),
      ...diff.delete.map((d) => d.date),
    ];
    expect(touched.every((date) => date >= TODAY)).toBe(true);
    expect(touched).not.toContain("2026-12-05");
  });

  it("keeps today's session when a ride for today exists", () => {
    const todays = stored.find((s) => s.date === "2026-12-05");
    if (!todays) throw new Error("fixture");
    const edited = rebuilt().map((s) => (s.date === "2026-12-05" ? { ...s, durationMin: 30 } : s));
    expect(mergePlan(stored, edited, { today: "2026-12-05", startedToday: true }).update).toEqual(
      [],
    );
    expect(
      mergePlan(stored, edited, { today: "2026-12-05", startedToday: false }).update,
    ).toHaveLength(1);
  });

  it("does not offer a frozen date to the rebuilt plan", () => {
    const done = stored.map((s) =>
      s.date === "2026-12-06" ? { ...s, status: "done" as const } : s,
    );
    const next = rebuilt().filter((s) => s.date !== "2026-12-06");
    expect(mergePlan(done, next, { today: TODAY }).delete.map((d) => d.date)).not.toContain(
      "2026-12-06",
    );
  });

  it("compares by content, not by key order of the stored rows", () => {
    const reordered = stored.map((s) => ({
      ...s,
      steps: JSON.parse(JSON.stringify(s.steps).replace(/^\[/, "[")) as typeof s.steps,
    }));
    expect(isEmptyDiff(mergePlan(reordered, rebuilt(), { today: TODAY }))).toBe(true);
  });
});

describe("invertDiff and applyDiff", () => {
  const next = rebuilt()
    .filter((s) => s.date !== "2026-12-05")
    .map((s) => (s.date === "2026-12-06" ? { ...s, durationMin: 90 } : s));
  const sunday = next.find((s) => s.date === "2026-12-06");
  if (!sunday) throw new Error("fixture");
  next.push({ ...sunday, date: "2026-12-04", slot: "easy", kind: "endurance" });
  const diff = mergePlan(stored, next, { today: TODAY });

  it("applies the diff", () => {
    const after = applyDiff(stored, diff);
    expect(after.find((s) => s.date === "2026-12-05")).toBeUndefined();
    expect(after.find((s) => s.date === "2026-12-06")?.durationMin).toBe(90);
    expect(after.find((s) => s.date === "2026-12-06")?.id).toBe("s-2026-12-06");
    expect(after.find((s) => s.date === "2026-12-04")?.kind).toBe("endurance");
    expect(after.map((s) => s.date)).toEqual([...after.map((s) => s.date)].sort());
  });

  it("the inverse restores the sessions, deleted rows with their old id", () => {
    const restored = applyDiff(applyDiff(stored, diff), invertDiff(diff));
    expect(restored).toEqual(stored);
  });

  it("the inverse of the inverse is the diff, and an inverse insert deletes by date", () => {
    expect(invertDiff(invertDiff(diff))).toEqual(diff);
    expect(invertDiff(diff).delete).toEqual([
      { date: "2026-12-04", session: diff.insert[0]?.session },
    ]);
  });
});

describe("describeChange", () => {
  const base = sessionData({ ...plan.sessions[0]!, movedFrom: null });

  it("names the difference in the order kind, main set, minutes, targets", () => {
    expect(describeChange(base, { ...base, kind: "long" })?.change).toBe("kind");
    expect(describeChange(base, { ...base, mainSet: "9x9" })?.change).toBe("main-set");
    expect(describeChange(base, { ...base, durationMin: base.durationMin + 5 })?.change).toBe(
      "minutes",
    );
    const retargeted = {
      ...base,
      steps: base.steps.map((s) => ({
        ...s,
        target: { ...s.target, watts: { target: 1, min: 1, max: 1 } },
      })),
    };
    expect(describeChange(base, retargeted)?.change).toBe("targets");
  });

  it("is silent for wording only, and names added and removed sessions", () => {
    expect(describeChange(base, { ...base, reason: "other words" })).toBeNull();
    expect(describeChange(null, base)?.change).toBe("added");
    expect(describeChange(base, null)?.change).toBe("removed");
    expect(describeChange(null, null)).toBeNull();
  });
});

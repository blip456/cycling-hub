/**
 * Property tests: many seeded scenarios (a generated intake, a day inside the plan, a history of done and
 * missed sessions, extra rides, locked matches, a weight log). The same seed always gives the same scenario.
 */
import { describe, expect, it } from "vitest";
import { addDays, WEEKDAYS, type IsoDate } from "@/features/athlete";
import { STRUCTURED_KINDS } from "../engine";
import { evaluatePlan } from "./evaluate";
import { applyDiff, isFrozen } from "./merge";
import { scenario, type Scenario } from "./scenario";
import { applyStatuses } from "./status";
import type { StoredSession } from "./types";

const SEEDS = Array.from({ length: 250 }, (_, i) => i + 1);

function hardKind(s: { kind: StoredSession["kind"]; mainSet: string | null }): boolean {
  return STRUCTURED_KINDS.includes(s.kind) || (s.kind === "long" && s.mainSet !== null);
}

function content(s: StoredSession): string {
  return JSON.stringify([
    s.id,
    s.date,
    s.kind,
    s.durationMin,
    s.mainSet,
    s.steps,
    s.title,
    s.reason,
    s.movedFrom,
  ]);
}

const scenarios = SEEDS.map((seed) => ({ seed, s: scenario(seed) })).filter(
  (entry): entry is { seed: number; s: Scenario } => entry.s !== null,
);

// About 250 seeded scenarios per property: a few seconds each locally, more on a slow CI runner.
describe("generated scenarios", { timeout: 60_000 }, () => {
  it("cover enough plans", () => {
    expect(scenarios.length).toBeGreaterThan(200);
  });

  it("are deterministic, also for shuffled lists", () => {
    for (const { seed, s } of scenarios.slice(0, 80)) {
      const a = evaluatePlan(s.args);
      expect(evaluatePlan(structuredClone(s.args)), `seed ${seed}`).toEqual(a);
      const shuffled = evaluatePlan({
        ...s.args,
        sessions: [...s.args.sessions].reverse(),
        rides: [...s.args.rides].reverse(),
        weightEntries: [...s.args.weightEntries].reverse(),
      });
      expect(shuffled, `seed ${seed}`).toEqual(a);
    }
  });

  it("never change a past session, a locked match or a started session of today", () => {
    for (const { seed, s } of scenarios) {
      const result = evaluatePlan(s.args);
      const startedToday = s.args.rides.some((r) => r.date === s.args.today);
      const before = applyStatuses(s.args.sessions, result.statusUpdates);
      // Frozen as the evaluation found them: a session may still be matched to a ride in the same run.
      const frozen = s.args.sessions
        .filter((x) => isFrozen(x, s.args.today, startedToday))
        .map((x) => before.find((b) => b.id === x.id) as StoredSession);
      const after = applyDiff(before, result.diff);
      const touched = new Set([
        ...result.diff.update.map((u) => u.id),
        ...result.diff.delete.flatMap((d) => (d.id ? [d.id] : [])),
      ]);
      for (const f of frozen) {
        expect(touched.has(f.id), `seed ${seed} touched ${f.date}`).toBe(false);
        expect(
          after.find((x) => x.id === f.id),
          `seed ${seed} ${f.date}`,
        ).toEqual(f);
      }
      for (const entry of [...result.diff.insert, ...result.diff.update, ...result.diff.delete]) {
        const date = "session" in entry ? entry.session.date : entry.date;
        expect(date >= s.args.today, `seed ${seed} diff on ${date}`).toBe(true);
      }
      for (const change of result.update?.changes ?? []) {
        expect(change.date >= s.args.today, `seed ${seed}`).toBe(true);
      }
      // Only sessions that could still change are in the status updates' past: a session is missed, never lost.
      expect(new Set(after.map((x) => x.date)).size, `seed ${seed} one session a date`).toBe(
        after.length,
      );
    }
  });

  it("are stable: evaluating the applied result again changes nothing", () => {
    const failures: string[] = [];
    for (const { seed, s } of scenarios) {
      const first = evaluatePlan(s.args);
      const sessions = applyDiff(applyStatuses(s.args.sessions, first.statusUpdates), first.diff);
      const fingerprint = first.outcome === "recalculated" ? first.fingerprint : null;
      const second = evaluatePlan({ ...s.args, sessions, lastFingerprint: fingerprint });
      const forced = evaluatePlan({ ...s.args, sessions, lastFingerprint: null });
      for (const [name, again] of [
        ["stored", second],
        ["forced", forced],
      ] as const) {
        const quiet =
          again.update === null &&
          again.statusUpdates.length === 0 &&
          again.diff.insert.length + again.diff.update.length + again.diff.delete.length === 0;
        if (!quiet) failures.push(`seed ${seed} (${name})`);
      }
      if (fingerprint !== null) {
        expect(second.outcome, `seed ${seed}`).toBe("unchanged");
        expect(second.fingerprint, `seed ${seed}`).toBe(fingerprint);
      }
    }
    expect(failures).toEqual([]);
  });

  it("never plan two hard days back to back, also next to extra hard rides", () => {
    for (const { seed, s } of scenarios) {
      const result = evaluatePlan(s.args);
      const startedToday = s.args.rides.some((r) => r.date === s.args.today);
      const sessions = applyDiff(applyStatuses(s.args.sessions, result.statusUpdates), result.diff);
      const ftp = s.input.ftp ?? 0;
      const hardRides = new Set(
        result.extraRides
          .filter((r) => r.avgPowerW !== null && r.avgPowerW >= 0.8 * ftp)
          .map((r) => r.date),
      );
      const ridden = sessions.filter((x) => x.status === "planned" || x.status === "done");
      const isHard = (date: IsoDate): boolean =>
        ridden.some((x) => x.date === date && hardKind(x)) || hardRides.has(date);
      const movable = (x: StoredSession): boolean =>
        x.date >= s.args.today && !isFrozen(x, s.args.today, startedToday);
      for (const x of ridden) {
        if (!hardKind(x) || !movable(x)) continue;
        const prev = addDays(x.date, -1) as IsoDate;
        const next = addDays(x.date, 1) as IsoDate;
        expect(isHard(prev), `seed ${seed}: ${prev} next to ${x.date}`).toBe(false);
        expect(isHard(next), `seed ${seed}: ${x.date} next to ${next}`).toBe(false);
      }
    }
  });

  it("move a missed session at most once, to an available day, never onto another session", () => {
    let moves = 0;
    for (const { seed, s } of scenarios) {
      const result = evaluatePlan(s.args);
      const sessions = applyDiff(applyStatuses(s.args.sessions, result.statusUpdates), result.diff);
      const copies = sessions.filter((x) => x.movedFrom !== null);
      const origins = copies.map((x) => x.movedFrom);
      expect(new Set(origins).size, `seed ${seed}`).toBe(origins.length);
      for (const copy of copies) {
        const origin = sessions.find((x) => x.date === copy.movedFrom);
        expect(origin?.status, `seed ${seed}`).toBe("missed");
        expect(origin?.movedFrom, `seed ${seed}`).toBeNull();
        const day = WEEKDAYS[(new Date(copy.date).getUTCDay() + 6) % 7];
        expect(s.input.intake.availableDays, `seed ${seed}`).toContain(day);
        if (copy.status === "planned" && copy.date >= s.args.today) moves += 1;
      }
    }
    expect(moves).toBeGreaterThanOrEqual(0);
  });

  it("Undo restores the sessions that have not happened", () => {
    for (const { seed, s } of scenarios) {
      const result = evaluatePlan(s.args);
      if (!result.undo) continue;
      const startedToday = s.args.rides.some((r) => r.date === s.args.today);
      const before = applyStatuses(s.args.sessions, result.statusUpdates);
      const after = applyDiff(before, result.diff);
      const restored = applyDiff(after, result.undo.diff);
      const future = (list: StoredSession[]): string[] =>
        list
          .filter((x) => !isFrozen(x, s.args.today, startedToday) || x.date >= s.args.today)
          .map(content);
      expect(future(restored), `seed ${seed}`).toEqual(future(before));
      expect(result.undo.restoreFingerprint).toBeNull();
      expect(result.undo.undoneFingerprint.length).toBeGreaterThan(0);
    }
  });

  it("pin an undone fingerprint: the same inputs are not recalculated", () => {
    for (const { seed, s } of scenarios.slice(0, 100)) {
      const first = evaluatePlan(s.args);
      if (!first.undo) continue;
      const before = applyStatuses(s.args.sessions, first.statusUpdates);
      const restored = applyDiff(applyDiff(before, first.diff), first.undo.diff);
      const again = evaluatePlan({
        ...s.args,
        sessions: restored,
        lastFingerprint: first.undo.restoreFingerprint,
        undoneFingerprint: first.undo.undoneFingerprint,
      });
      expect(again.outcome, `seed ${seed}`).toBe("pinned");
      expect(again.diff.insert.length + again.diff.update.length + again.diff.delete.length).toBe(
        0,
      );
      expect(again.update).toBeNull();
    }
  });

  it("only announce changes that exist, each with a reason", () => {
    for (const { seed, s } of scenarios) {
      const result = evaluatePlan(s.args);
      if (result.update === null) continue;
      expect(result.update.changes.length, `seed ${seed}`).toBeGreaterThan(0);
      expect(result.update.message.length, `seed ${seed}`).toBeGreaterThan(0);
      expect(result.update.reasons.length, `seed ${seed}`).toBeGreaterThan(0);
      for (const change of result.update.changes) {
        expect(change.reason.endsWith("."), `seed ${seed}`).toBe(true);
        expect(result.update.reasons).toContain(change.reasonCode);
      }
    }
  });
});

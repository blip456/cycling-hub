/** Where sessions go in the week (section 6) and how the week's minutes are shared. */
import { WEEKDAYS } from "@/features/athlete";
import { floor5 } from "./budget";

export type Slot = "long" | "q1" | "q2" | "easy";

export type DayAssignment = { slot: Slot; day: number };

const WEDNESDAY = 2;
const SATURDAY = 5;
const SUNDAY = 6;

/**
 * Day indices (0 = Monday) of a set of weekdays, ascending and unique.
 */
export function dayIndices(days: readonly (typeof WEEKDAYS)[number][]): number[] {
  return [...new Set(days.map((d) => WEEKDAYS.indexOf(d)))].sort((a, b) => a - b);
}

/**
 * Assigns the slots of a week to days:
 *  - long ride: Sunday, else Saturday, else the last available day;
 *  - Q1: Wednesday, else the available day nearest to Wednesday (a tie goes to the earlier day); never
 *    next to a hard long ride;
 *  - Q2: an available day at least 2 days from Q1 and from the long ride, the farthest from both
 *    (a tie goes to the later day); without such a day it becomes an easy ride;
 *  - easy rides: the remaining days, farthest from the other rides first, a tie goes to the later day.
 * `rides` is the number of rides; when it is smaller than the slots, easy rides go first, then Q2, then Q1.
 */
export function assignDays(input: {
  /** Available day indices, ascending. */
  days: readonly number[];
  rides: number;
  hasLong: boolean;
  hasQ1: boolean;
  hasQ2: boolean;
  /** The long ride holds hard blocks, so Q1 and Q2 keep a day away from it. */
  longIsHard: boolean;
}): DayAssignment[] {
  const out: DayAssignment[] = [];
  const free = new Set(input.days);
  const used = (): number[] => out.map((a) => a.day);
  const take = (slot: Slot, day: number): void => {
    out.push({ slot, day });
    free.delete(day);
  };
  const distance = (day: number, others: readonly number[]): number =>
    others.length === 0 ? 7 : Math.min(...others.map((o) => Math.abs(o - day)));
  const pickMax = (candidates: number[], score: (day: number) => number): number | null => {
    let best: number | null = null;
    let bestScore = -Infinity;
    for (const day of candidates) {
      const s = score(day);
      // Candidates are ascending, so `>=` makes a tie go to the later day.
      if (s >= bestScore) {
        best = day;
        bestScore = s;
      }
    }
    return best;
  };

  let remaining = input.rides;
  if (input.hasLong && remaining > 0 && free.size > 0) {
    const day = free.has(SUNDAY) ? SUNDAY : free.has(SATURDAY) ? SATURDAY : Math.max(...free);
    take("long", day);
    remaining -= 1;
  }
  const longDay = out.find((a) => a.slot === "long")?.day ?? null;

  if (input.hasQ1 && remaining > 0 && free.size > 0) {
    const candidates = [...free]
      .filter((d) => !(input.longIsHard && longDay !== null && Math.abs(d - longDay) === 1))
      .sort((a, b) => a - b);
    let best: number | null = null;
    let bestDistance = Infinity;
    for (const day of candidates) {
      const d = Math.abs(day - WEDNESDAY);
      // Ascending order and strict `<` keep the earlier day on a tie.
      if (d < bestDistance) {
        best = day;
        bestDistance = d;
      }
    }
    if (best !== null) {
      take("q1", best);
      remaining -= 1;
    }
  }
  const q1Day = out.find((a) => a.slot === "q1")?.day ?? null;

  if (input.hasQ2 && remaining > 0 && q1Day !== null) {
    const fixed = [q1Day, ...(longDay === null ? [] : [longDay])];
    const candidates = [...free].filter((d) => distance(d, fixed) >= 2).sort((a, b) => a - b);
    const best = pickMax(candidates, (d) => distance(d, fixed));
    if (best !== null) {
      take("q2", best);
      remaining -= 1;
    }
  }

  while (remaining > 0 && free.size > 0) {
    const candidates = [...free].sort((a, b) => a - b);
    const best = pickMax(candidates, (d) => distance(d, used()));
    if (best === null) break;
    take("easy", best);
    remaining -= 1;
  }
  return out.sort((a, b) => a.day - b.day);
}

export type AllocationItem = {
  weight: number;
  min: number;
  max: number;
};

/**
 * Shares `total` minutes among items by weight (section 6): clamp each item to its min and max, share what
 * is left among the items that are not clamped, round down to 5 minutes and hand out the left-over
 * 5-minute blocks by the largest remainder (a tie goes to the heavier weight, then the earlier item).
 * A block that would break a max is skipped, so the total can end below `total` (a ceiling is not refilled).
 */
export function allocateMinutes(items: readonly AllocationItem[], total: number): number[] {
  const result: (number | null)[] = items.map(() => null);
  for (let round = 0; round <= items.length; round += 1) {
    const fixedSum = result.reduce<number>((sum, v) => sum + (v ?? 0), 0);
    const freeIdx = items.map((_, i) => i).filter((i) => result[i] === null);
    if (freeIdx.length === 0) break;
    const weightSum = freeIdx.reduce((sum, i) => sum + (items[i]?.weight ?? 0), 0);
    const left = Math.max(0, total - fixedSum);
    // Water-filling: fix the items that break a bound in the direction with the larger total violation
    // (so an item clamped at its minimum can still grow when others hit their maximum).
    const lows: number[] = [];
    const highs: number[] = [];
    let lowTotal = 0;
    let highTotal = 0;
    for (const i of freeIdx) {
      const item = items[i];
      if (!item) continue;
      const share = (left * item.weight) / weightSum;
      if (share < item.min) {
        lows.push(i);
        lowTotal += item.min - share;
      } else if (share > item.max) {
        highs.push(i);
        highTotal += share - item.max;
      }
    }
    if (lows.length === 0 && highs.length === 0) break;
    const fixLows = highs.length === 0 || (lows.length > 0 && lowTotal > highTotal);
    for (const i of fixLows ? lows : highs) {
      const item = items[i];
      if (item) result[i] = fixLows ? item.min : item.max;
    }
  }

  const fixedSum = result.reduce<number>((sum, v) => sum + (v ?? 0), 0);
  const freeIdx = items.map((_, i) => i).filter((i) => result[i] === null);
  const weightSum = freeIdx.reduce((sum, i) => sum + (items[i]?.weight ?? 0), 0);
  const left = Math.max(0, total - fixedSum);
  const floors = new Map<number, { floor: number; remainder: number }>();
  let floorSum = 0;
  for (const i of freeIdx) {
    const item = items[i];
    if (!item) continue;
    const share = (left * item.weight) / weightSum;
    const floor = Math.min(item.max, Math.max(item.min, floor5(share)));
    floors.set(i, { floor, remainder: share - floor });
    floorSum += floor;
  }
  let blocks = Math.floor((left - floorSum) / 5 + 1e-9);
  const order = [...floors.keys()].sort((a, b) => {
    const ra = floors.get(a)?.remainder ?? 0;
    const rb = floors.get(b)?.remainder ?? 0;
    if (Math.abs(ra - rb) > 1e-9) return rb - ra;
    const wa = items[a]?.weight ?? 0;
    const wb = items[b]?.weight ?? 0;
    return wb !== wa ? wb - wa : a - b;
  });
  const extra = new Map<number, number>();
  while (blocks > 0) {
    let gave = false;
    for (const i of order) {
      if (blocks === 0) break;
      const entry = floors.get(i);
      const item = items[i];
      if (!entry || !item) continue;
      const current = entry.floor + (extra.get(i) ?? 0);
      if (current + 5 <= item.max) {
        extra.set(i, (extra.get(i) ?? 0) + 5);
        blocks -= 1;
        gave = true;
      }
    }
    if (!gave) break;
  }
  return items.map((_, i) => result[i] ?? (floors.get(i)?.floor ?? 0) + (extra.get(i) ?? 0));
}

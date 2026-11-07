/** The input fingerprint (section 12): a stable string of exactly the inputs that change the plan. */
import { resolveInput } from "./resolve";
import { ENGINE_VERSION, type PlanInput } from "./types";

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * Canonical text of what matters: engine version, final level, H after clamping, available days (sorted),
 * the top two purposes, indoor / outdoor, the event, the resolved start date, FTP and heart rate
 * references, the weight goal and start weight (rounded, never the raw log) and the adjustments.
 * `today` is not part of it: it only picks the default start date, which is included once resolved.
 */
export function canonicalInput(input: PlanInput): string {
  const resolved = resolveInput(input);
  const { intake } = input;
  const adjustments = input.adjustments ?? {};
  const sorted = (values: readonly number[] | undefined): number[] =>
    [...new Set(values ?? [])].sort((a, b) => a - b);
  const canonical = {
    v: ENGINE_VERSION,
    level: resolved.levelResult.level,
    hours: resolved.hoursPerWeek,
    days: resolved.days,
    purposes: [resolved.purposes.main, resolved.purposes.secondary],
    environment: intake.environment,
    event: resolved.structure.event,
    start: resolved.structure.startDate,
    recoveryEvery: intake.recoveryEvery === 3 ? 3 : 4,
    ftpTest: intake.ftpTest ?? "twenty-minute",
    ftp: input.ftp === null ? null : Math.round(input.ftp),
    lthr: input.lthr ? Math.round(input.lthr) : null,
    maxHr: input.maxHr ? Math.round(input.maxHr) : null,
    weight:
      intake.weightKg !== undefined && intake.weightGoal !== undefined
        ? {
            kg: round1(intake.weightKg),
            goal: intake.weightGoal,
            cap: intake.weightRateCapPercent ?? null,
          }
        : null,
    adjust: {
      average:
        adjustments.recentAverageHours === undefined
          ? null
          : Math.round(adjustments.recentAverageHours * 4) / 4,
      hold: sorted(adjustments.holdWeeks),
      extra: sorted(adjustments.extraEasyRideWeeks),
      noSecond: sorted(adjustments.noSecondHardWeeks),
      missed: (adjustments.missedStructured ?? []).map((m) => `${m.week}:${m.kind}`).sort(),
    },
  };
  return JSON.stringify(canonical);
}

/** cyrb53: a small, fast, stable 53-bit string hash (not for security). */
function hash(text: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ code, 2654435761);
    h2 = Math.imul(h2 ^ code, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(14, "0");
}

/** Fingerprint of an input: equal fingerprints give the same plan. Starts with the engine version. */
export function inputFingerprint(input: PlanInput): string {
  return `${ENGINE_VERSION}-${hash(canonicalInput(input))}`;
}

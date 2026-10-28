/**
 * Training zones (P40): Coggan 7 power zones from FTP and 5 heart rate zones from LTHR, with a fallback
 * from max HR. Pure functions; missing or unusable input gives null, never an error.
 *
 * Rounding: a zone's upper limit is `round(reference * upperPercent / 100)` (half up, on the reference
 * rounded to a whole number). The next zone starts one whole unit above it, so zones never overlap and
 * leave no gap. The first zone starts at 0 and the last one has no upper limit (`max` is null).
 */

/** One zone. `index` is stable (1 = easiest) so the UI can map it to a colour token, e.g. `zone-3`. */
export type Zone = {
  /** 1-based and fixed per model: 1 to 7 for power, 1 to 5 for heart rate. */
  index: number;
  /** Short label for chips and chart axes, e.g. "Z4". */
  label: string;
  /** Plain-English name, e.g. "Threshold". */
  name: string;
  /** Lowest value in the zone (W or bpm), inclusive. */
  min: number;
  /** Highest value in the zone, inclusive; null for the top zone (no upper limit). */
  max: number | null;
};

type Spec = { name: string; upperPercent: number | null };

/** Coggan power zones, percent of FTP (P40). */
const POWER_SPEC: readonly Spec[] = [
  { name: "Active recovery", upperPercent: 55 },
  { name: "Endurance", upperPercent: 75 },
  { name: "Tempo", upperPercent: 90 },
  { name: "Threshold", upperPercent: 105 },
  { name: "VO2 max", upperPercent: 120 },
  { name: "Anaerobic capacity", upperPercent: 150 },
  { name: "Neuromuscular power", upperPercent: null },
];

/** Coggan heart rate zones, percent of LTHR. */
const LTHR_SPEC: readonly Spec[] = [
  { name: "Active recovery", upperPercent: 68 },
  { name: "Endurance", upperPercent: 83 },
  { name: "Tempo", upperPercent: 94 },
  { name: "Threshold", upperPercent: 105 },
  { name: "VO2 max", upperPercent: null },
];

/** Fallback heart rate zones, percent of max HR (50-60, 60-70, 70-80, 80-90, 90-100 style bands). */
const MAX_HR_SPEC: readonly Spec[] = [
  { name: "Active recovery", upperPercent: 60 },
  { name: "Endurance", upperPercent: 70 },
  { name: "Tempo", upperPercent: 80 },
  { name: "Threshold", upperPercent: 90 },
  { name: "VO2 max", upperPercent: null },
];

function build(reference: number, spec: readonly Spec[]): Zone[] {
  const base = Math.round(reference);
  let min = 0;
  return spec.map((s, i) => {
    const max = s.upperPercent === null ? null : Math.round((base * s.upperPercent) / 100);
    const zone: Zone = { index: i + 1, label: `Z${i + 1}`, name: s.name, min, max };
    if (max !== null) min = max + 1;
    return zone;
  });
}

function usable(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 1;
}

/**
 * The 7 Coggan power zones for an FTP in watts, or null when FTP is missing, not a finite number or
 * below 1 W. Example for 200 W: Z1 0-110, Z2 111-150, Z3 151-180, Z4 181-210, Z5 211-240, Z6 241-300,
 * Z7 301 and up.
 */
export function powerZones(ftp: number | null | undefined): Zone[] | null {
  return usable(ftp) ? build(ftp, POWER_SPEC) : null;
}

/** Which reference the heart rate zones came from. */
export type HeartRateZoneSet = { reference: "lthr" | "max-hr"; zones: Zone[] };

/**
 * The 5 heart rate zones. LTHR is used when it is usable (Coggan percentages); otherwise max HR
 * (percent-of-max bands); otherwise null. `reference` says which one was used so the UI can say so.
 */
export function heartRateZones(input: {
  lthr?: number | null | undefined;
  maxHr?: number | null | undefined;
}): HeartRateZoneSet | null {
  if (usable(input.lthr)) return { reference: "lthr", zones: build(input.lthr, LTHR_SPEC) };
  if (usable(input.maxHr)) return { reference: "max-hr", zones: build(input.maxHr, MAX_HR_SPEC) };
  return null;
}

/**
 * The zone a value falls in, or null for a missing or non-finite value, or a negative one. Fractions
 * count towards the zone below the next whole-number minimum (e.g. 110.4 W is Z1 when Z2 starts at 111).
 */
export function zoneForValue(
  zones: readonly Zone[],
  value: number | null | undefined,
): Zone | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return null;
  for (const zone of zones) {
    if (zone.max === null || value < zone.max + 1) return zone;
  }
  return null;
}

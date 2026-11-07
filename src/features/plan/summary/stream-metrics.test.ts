import { describe, expect, it } from "vitest";
import { normalizedPower, rideMetrics } from "./stream-metrics";

function stream(
  seconds: number,
  watts: (s: number) => number | null,
  heartrate?: (s: number) => number | null,
) {
  const time = Array.from({ length: seconds }, (_, i) => i);
  return {
    time,
    watts: time.map(watts),
    ...(heartrate ? { heartrate: time.map(heartrate) } : {}),
  };
}

describe("normalised power", () => {
  it("is the power itself for a constant effort", () => {
    expect(normalizedPower(new Float64Array(120).fill(200))).toBeCloseTo(200, 6);
  });

  it("is higher than the average for a varying effort", () => {
    const grid = new Float64Array(600).map((_, i) => (i % 120 < 60 ? 300 : 100));
    const average = 200;
    expect(normalizedPower(grid) ?? 0).toBeGreaterThan(average);
  });

  it("is null for a ride shorter than 30 seconds", () => {
    expect(normalizedPower(new Float64Array(29).fill(200))).toBeNull();
  });
});

describe("ride metrics", () => {
  const baseline = { ftp: 200, lthr: 165, maxHr: null };

  it("counts minutes per power zone for FTP 200", () => {
    const m = rideMetrics(
      stream(600, () => 200),
      baseline,
    );
    expect(m.normalizedPowerW).toBe(200);
    // 200 W is in Z4 (181 to 210 W): ten minutes.
    expect(m.powerZoneMinutes?.map((x) => Math.round(x * 10) / 10)).toEqual([0, 0, 0, 10, 0, 0, 0]);
  });

  it("counts a coasting second as zone 1 and a missing second as nothing", () => {
    const m = rideMetrics(
      stream(120, (s) => (s < 60 ? 0 : null)),
      baseline,
    );
    expect(m.powerZoneMinutes?.[0]).toBeCloseTo(1, 5);
    expect(m.powerZoneMinutes?.slice(1).every((x) => x === 0)).toBe(true);
  });

  it("counts heart rate zones from the LTHR and ignores dropouts", () => {
    const m = rideMetrics(
      stream(
        120,
        () => 150,
        (s) => (s < 60 ? 0 : 150),
      ),
      baseline,
    );
    expect(m.hrZoneMinutes).not.toBeNull();
    const total = m.hrZoneMinutes?.reduce((a, b) => a + b, 0) ?? 0;
    expect(total).toBeCloseTo(1, 5);
  });

  it("gives no power zones without an FTP but still the normalised power", () => {
    const m = rideMetrics(
      stream(120, () => 200),
      { ftp: null, lthr: null, maxHr: null },
    );
    expect(m.powerZoneMinutes).toBeNull();
    expect(m.normalizedPowerW).toBe(200);
    expect(m.hrZoneMinutes).toBeNull();
  });

  it("gives all null for a stream without channels or an unreadable one", () => {
    const empty = { normalizedPowerW: null, powerZoneMinutes: null, hrZoneMinutes: null };
    expect(rideMetrics({ time: [0, 1, 2] }, baseline)).toEqual(empty);
    expect(rideMetrics("nope", baseline)).toEqual(empty);
    expect(rideMetrics(null, baseline)).toEqual(empty);
    expect(rideMetrics({ time: [2, 1], watts: [1, 2] }, baseline)).toEqual(empty);
  });
});

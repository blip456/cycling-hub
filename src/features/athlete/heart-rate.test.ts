import { describe, expect, it } from "vitest";
import { findHighestHeartRate, highestPlausibleHeartRate } from "./heart-rate";
import type { NumericStream, RideStream } from "./streams";

function perSecond(values: (number | null)[]): NumericStream {
  return { time: values.map((_, i) => i), values };
}

function constant(bpm: number, seconds: number): number[] {
  return Array.from({ length: seconds }, () => bpm);
}

describe("highestPlausibleHeartRate", () => {
  it("returns the highest level held for 5 seconds", () => {
    const stream = perSecond([...constant(120, 30), ...constant(185, 8), ...constant(150, 30)]);
    expect(highestPlausibleHeartRate(stream)).toEqual({ bpm: 185, startOffsetS: 30 });
  });
  it("ignores a short spike", () => {
    const stream = perSecond([...constant(150, 30), 220, 221, ...constant(150, 30)]);
    expect(highestPlausibleHeartRate(stream)?.bpm).toBe(150);
  });
  it("takes the lowest value of the best 5-second stretch", () => {
    const stream = perSecond([150, 190, 180, 181, 182, 183, 150]);
    expect(highestPlausibleHeartRate(stream)?.bpm).toBe(180);
  });
  it("ignores values outside 40 to 230, including zero dropouts", () => {
    expect(highestPlausibleHeartRate(perSecond(constant(0, 30)))).toBeNull();
    expect(highestPlausibleHeartRate(perSecond(constant(240, 30)))).toBeNull();
    expect(
      highestPlausibleHeartRate(perSecond([...constant(140, 20), ...constant(250, 10)]))?.bpm,
    ).toBe(140);
    expect(highestPlausibleHeartRate(perSecond(constant(230, 5)))?.bpm).toBe(230);
    expect(highestPlausibleHeartRate(perSecond(constant(40, 5)))?.bpm).toBe(40);
    expect(highestPlausibleHeartRate(perSecond(constant(39, 5)))).toBeNull();
  });
  it("does not bridge nulls into a held level", () => {
    expect(
      highestPlausibleHeartRate(perSecond([190, 190, null, 190, 190, 140, 140, 140, 140, 140]))
        ?.bpm,
    ).toBe(140);
  });
  it("returns null for empty, null, short or malformed streams", () => {
    expect(highestPlausibleHeartRate(null)).toBeNull();
    expect(highestPlausibleHeartRate({ time: [], values: [] })).toBeNull();
    expect(highestPlausibleHeartRate(perSecond(constant(190, 4)))).toBeNull();
    expect(highestPlausibleHeartRate({ time: [0, 1], values: [150] })).toBeNull();
  });
  it("uses time, so a sparse stream still counts", () => {
    // Two points 5 s apart: the first holds 5 s.
    expect(highestPlausibleHeartRate({ time: [0, 5], values: [170, 100] })?.bpm).toBe(170);
  });
});

describe("findHighestHeartRate", () => {
  const ride = (id: string, bpm: number | null): RideStream => ({
    id,
    stream: bpm === null ? null : perSecond(constant(bpm, 30)),
  });
  it("picks the highest across rides and the newest on a tie", async () => {
    const result = await findHighestHeartRate([
      ride("a", 170),
      ride("b", 188),
      ride("c", 188),
      ride("d", null),
    ]);
    expect(result).toEqual({ bpm: 188, startOffsetS: 0, rideId: "b", ridesChecked: 4 });
  });
  it("stops at the cap", async () => {
    let pulled = 0;
    function* source(): Generator<RideStream> {
      for (let i = 0; i < 20; i += 1) {
        pulled += 1;
        yield ride(`r${i}`, 150);
      }
    }
    expect((await findHighestHeartRate(source(), { maxRides: 2 }))?.ridesChecked).toBe(2);
    expect(pulled).toBe(2);
  });
  it("returns null with no heart rate data", async () => {
    expect(await findHighestHeartRate([])).toBeNull();
    expect(await findHighestHeartRate([ride("a", null)])).toBeNull();
    expect(await findHighestHeartRate([ride("a", 150)], { maxRides: 0 })).toBeNull();
  });
});

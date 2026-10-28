import { describe, expect, it } from "vitest";
import { heartRateZones, powerZones, zoneForValue, type Zone } from "./zones";

function expectContiguous(zones: Zone[]) {
  expect(zones[0]?.min).toBe(0);
  for (let i = 1; i < zones.length; i += 1) {
    const previous = zones[i - 1] as Zone;
    expect((zones[i] as Zone).min).toBe((previous.max as number) + 1);
    expect(previous.max as number).toBeGreaterThanOrEqual(previous.min);
  }
  expect(zones[zones.length - 1]?.max).toBeNull();
}

describe("powerZones", () => {
  it("gives the 7 Coggan zones for 200 W", () => {
    const zones = powerZones(200) as Zone[];
    expect(zones.map((z) => [z.min, z.max])).toEqual([
      [0, 110],
      [111, 150],
      [151, 180],
      [181, 210],
      [211, 240],
      [241, 300],
      [301, null],
    ]);
  });
  it("gives stable index, label and name", () => {
    const zones = powerZones(250) as Zone[];
    expect(zones.map((z) => z.index)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(zones.map((z) => z.label)).toEqual(["Z1", "Z2", "Z3", "Z4", "Z5", "Z6", "Z7"]);
    expect(zones[3]?.name).toBe("Threshold");
  });
  it("rounds half up and leaves no gaps or overlaps for every FTP from 50 to 600", () => {
    for (let ftp = 50; ftp <= 600; ftp += 1) expectContiguous(powerZones(ftp) as Zone[]);
    // 55 % of 250 is 137.5, rounded up to 138.
    expect((powerZones(250) as Zone[])[0]?.max).toBe(138);
  });
  it("rounds a fractional FTP to whole watts first", () => {
    expect(powerZones(249.6)).toEqual(powerZones(250));
  });
  it("returns null for missing or unusable input", () => {
    for (const bad of [null, undefined, 0, -5, NaN, Infinity, 0.4])
      expect(powerZones(bad)).toBeNull();
  });
});

describe("heartRateZones", () => {
  it("uses LTHR with Coggan percentages", () => {
    const set = heartRateZones({ lthr: 170, maxHr: 190 });
    expect(set?.reference).toBe("lthr");
    expect(set?.zones.map((z) => [z.min, z.max])).toEqual([
      [0, 116],
      [117, 141],
      [142, 160],
      [161, 179],
      [180, null],
    ]);
    expect(set?.zones.map((z) => z.index)).toEqual([1, 2, 3, 4, 5]);
  });
  it("falls back to max HR when LTHR is missing", () => {
    const set = heartRateZones({ lthr: null, maxHr: 190 });
    expect(set?.reference).toBe("max-hr");
    expect(set?.zones.map((z) => [z.min, z.max])).toEqual([
      [0, 114],
      [115, 133],
      [134, 152],
      [153, 171],
      [172, null],
    ]);
  });
  it("leaves no gaps for every LTHR and max HR in range", () => {
    for (let hr = 90; hr <= 230; hr += 1) {
      expectContiguous((heartRateZones({ lthr: hr }) as { zones: Zone[] }).zones);
      expectContiguous((heartRateZones({ maxHr: hr }) as { zones: Zone[] }).zones);
    }
  });
  it("returns null with no usable reference", () => {
    expect(heartRateZones({})).toBeNull();
    expect(heartRateZones({ lthr: null, maxHr: undefined })).toBeNull();
    expect(heartRateZones({ lthr: NaN, maxHr: 0 })).toBeNull();
  });
  it("ignores an unusable LTHR and uses max HR", () => {
    expect(heartRateZones({ lthr: 0, maxHr: 190 })?.reference).toBe("max-hr");
  });
});

describe("zoneForValue", () => {
  const zones = powerZones(200) as Zone[];
  it("finds the zone on the boundaries", () => {
    expect(zoneForValue(zones, 0)?.index).toBe(1);
    expect(zoneForValue(zones, 110)?.index).toBe(1);
    expect(zoneForValue(zones, 111)?.index).toBe(2);
    expect(zoneForValue(zones, 300)?.index).toBe(6);
    expect(zoneForValue(zones, 301)?.index).toBe(7);
    expect(zoneForValue(zones, 1500)?.index).toBe(7);
  });
  it("puts a fraction below the next minimum in the lower zone", () => {
    expect(zoneForValue(zones, 110.4)?.index).toBe(1);
  });
  it("returns null for missing, negative and non-finite values", () => {
    for (const bad of [null, undefined, -1, NaN, Infinity])
      expect(zoneForValue(zones, bad)).toBeNull();
  });
});

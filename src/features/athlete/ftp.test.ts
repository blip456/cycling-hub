import { describe, expect, it } from "vitest";
import {
  best20MinPower,
  bestAveragePower,
  findBestFtpEstimate,
  ftpFrom20MinTest,
  ftpFromRampTest,
} from "./ftp";
import { readChannel, type NumericStream, type RideStream } from "./streams";

/** One point per second from 0. */
function perSecond(values: (number | null)[]): NumericStream {
  return { time: values.map((_, i) => i), values };
}

function constant(watts: number, seconds: number): (number | null)[] {
  return Array.from({ length: seconds }, () => watts);
}

describe("bestAveragePower", () => {
  it("finds the best window and its start offset", () => {
    const stream = perSecond([...constant(100, 100), ...constant(300, 60), ...constant(100, 100)]);
    expect(bestAveragePower(stream, 60)).toEqual({ watts: 300, startOffsetS: 100, durationS: 60 });
  });
  it("averages a window that is only partly the effort", () => {
    const stream = perSecond([...constant(100, 10), ...constant(200, 10)]);
    expect(bestAveragePower(stream, 10)?.watts).toBe(200);
    expect(bestAveragePower(stream, 20)).toEqual({ watts: 150, startOffsetS: 0, durationS: 20 });
  });
  it("returns the earliest window on a tie", () => {
    const stream = perSecond([...constant(250, 30), ...constant(100, 30), ...constant(250, 30)]);
    expect(bestAveragePower(stream, 30)?.startOffsetS).toBe(0);
  });
  it("returns null for empty, too short or invalid input", () => {
    expect(bestAveragePower(null, 60)).toBeNull();
    expect(bestAveragePower(undefined, 60)).toBeNull();
    expect(bestAveragePower({ time: [], values: [] }, 60)).toBeNull();
    expect(bestAveragePower(perSecond(constant(200, 59)), 60)).toBeNull();
    expect(bestAveragePower(perSecond(constant(200, 60)), 0)).toBeNull();
    expect(bestAveragePower(perSecond(constant(200, 60)), 1.5)).toBeNull();
    expect(bestAveragePower({ time: [0, 1], values: [200] }, 1)).toBeNull();
  });
  it("counts zero watts as power", () => {
    expect(bestAveragePower(perSecond([...constant(200, 30), ...constant(0, 30)]), 60)?.watts).toBe(
      100,
    );
  });
  it("counts a short dropout as 0 W so it cannot raise the average", () => {
    const values = [...constant(200, 30), null, null, null, ...constant(200, 27)];
    const effort = bestAveragePower(perSecond(values), 60);
    expect(effort?.watts).toBe(190); // 57 s of 200 W and 3 s of 0 W
  });
  it("is broken by a dropout longer than 10 s", () => {
    const values = [...constant(300, 40), ...Array<null>(11).fill(null), ...constant(200, 40)];
    expect(bestAveragePower(perSecond(values), 60)).toBeNull();
    const withTenOnly = [...constant(300, 40), ...Array<null>(10).fill(null), ...constant(200, 40)];
    expect(bestAveragePower(perSecond(withTenOnly), 60)).not.toBeNull();
  });
  it("finds a window after a break", () => {
    const values = [...constant(500, 30), ...Array<null>(20).fill(null), ...constant(200, 60)];
    expect(bestAveragePower(perSecond(values), 60)).toEqual({
      watts: 200,
      startOffsetS: 50,
      durationS: 60,
    });
  });
  it("breaks on a timestamp gap over 10 s", () => {
    // 1 Hz for 40 s, then a 20 s hole in the recording, then 1 Hz for 40 s.
    const time = [
      ...Array.from({ length: 40 }, (_, i) => i),
      ...Array.from({ length: 40 }, (_, i) => 60 + i),
    ];
    const stream = { time, values: constant(250, 80) };
    expect(bestAveragePower(stream, 60)).toBeNull();
    expect(bestAveragePower(stream, 40)?.watts).toBe(250);
  });
  it("holds a value across a gap of up to 10 s", () => {
    // Points every 5 s at 200 W: 12 points cover 60 s.
    const time = Array.from({ length: 13 }, (_, i) => i * 5);
    const stream = { time, values: constant(200, 13) };
    expect(bestAveragePower(stream, 60)?.watts).toBe(200);
  });
  it("handles irregular intervals by time, not by point count", () => {
    // 100 W for 20 s held by 2 points, then 300 W as 30 points: time-weighted mean over 50 s is 220.
    const time = [0, 10, ...Array.from({ length: 30 }, (_, i) => 20 + i)];
    const values = [100, 100, ...constant(300, 30)];
    expect(bestAveragePower({ time, values }, 50)?.watts).toBe(220);
  });
  it("keeps the later point when two share a second", () => {
    const stream = { time: [0, 0, 1], values: [999, 100, 100] };
    expect(bestAveragePower(stream, 2)?.watts).toBe(100);
  });
  it("starts offsets at the first point's time", () => {
    const stream = { time: [100, 101, 102], values: [200, 200, 200] };
    expect(bestAveragePower(stream, 3)?.startOffsetS).toBe(100);
  });
  it("ignores a null at the very start or end instead of treating it as zero", () => {
    const values = [null, null, ...constant(200, 60), null];
    expect(bestAveragePower(perSecond(values), 60)).toEqual({
      watts: 200,
      startOffsetS: 2,
      durationS: 60,
    });
  });
  it("rejects a time span that is absurdly long", () => {
    expect(bestAveragePower({ time: [0, 5_000_000], values: [1, 1] }, 1)).toBeNull();
  });
});

describe("best20MinPower", () => {
  it("returns null for a ride under 20 minutes", () => {
    expect(best20MinPower(perSecond(constant(250, 1199)))).toBeNull();
  });
  it("finds a 20-minute effort inside a longer ride", () => {
    const stream = perSecond([
      ...constant(150, 600),
      ...constant(280, 1200),
      ...constant(120, 300),
    ]);
    expect(best20MinPower(stream)).toEqual({ watts: 280, startOffsetS: 600, durationS: 1200 });
  });
  it("works on exactly 20 minutes", () => {
    expect(best20MinPower(perSecond(constant(210, 1200)))?.watts).toBe(210);
  });
  it("follows the maxGapS option", () => {
    const values = [...constant(250, 600), ...Array<null>(15).fill(null), ...constant(250, 600)];
    expect(best20MinPower(perSecond(values))).toBeNull();
    expect(best20MinPower(perSecond(values), { maxGapS: 15 })).not.toBeNull();
  });
});

describe("FTP from tests", () => {
  it("takes 95 % of the 20-minute average", () => {
    expect(ftpFrom20MinTest(300)).toBe(285);
    expect(ftpFrom20MinTest(251)).toBe(238); // 238.45
    expect(ftpFrom20MinTest(210)).toBe(200); // 199.5 rounds up
  });
  it("takes 75 % of the best 1-minute power for the ramp test", () => {
    expect(ftpFromRampTest(400)).toBe(300);
    expect(ftpFromRampTest(333)).toBe(250); // 249.75
  });
  it("returns null for missing or non-positive values", () => {
    for (const bad of [null, undefined, 0, -10, NaN, Infinity]) {
      expect(ftpFrom20MinTest(bad)).toBeNull();
      expect(ftpFromRampTest(bad)).toBeNull();
    }
  });
});

describe("findBestFtpEstimate", () => {
  const ride = (id: string, watts: number | null, seconds = 1500): RideStream => ({
    id,
    stream: watts === null ? null : perSecond(constant(watts, seconds)),
  });

  it("picks the best ride, newest first wins ties", async () => {
    const rides = [ride("new", 250), ride("best", 300), ride("tie", 300), ride("old", 200)];
    const result = await findBestFtpEstimate(rides);
    expect(result).toEqual({
      ftp: 285,
      avg20MinW: 300,
      rideId: "best",
      startOffsetS: 0,
      ridesChecked: 4,
    });
  });
  it("skips rides without a stream and rides under 20 minutes", async () => {
    const result = await findBestFtpEstimate([
      ride("none", null),
      ride("short", 400, 600),
      ride("ok", 200),
    ]);
    expect(result?.rideId).toBe("ok");
    expect(result?.ridesChecked).toBe(3);
  });
  it("returns null for no rides and for no usable ride", async () => {
    expect(await findBestFtpEstimate([])).toBeNull();
    expect(await findBestFtpEstimate([ride("a", null), ride("b", 300, 100)])).toBeNull();
  });
  it("stops at the cap and does not pull more rides", async () => {
    let pulled = 0;
    async function* source(): AsyncGenerator<RideStream> {
      for (let i = 0; i < 100; i += 1) {
        pulled += 1;
        yield ride(`r${i}`, i === 5 ? 400 : 200);
      }
    }
    const result = await findBestFtpEstimate(source(), { maxRides: 3 });
    expect(pulled).toBe(3);
    expect(result?.rideId).toBe("r0");
    expect(result?.ridesChecked).toBe(3);
  });
  it("defaults to 60 rides", async () => {
    let pulled = 0;
    function* source(): Generator<RideStream> {
      for (let i = 0; i < 200; i += 1) {
        pulled += 1;
        yield ride(`r${i}`, null);
      }
    }
    await findBestFtpEstimate(source());
    expect(pulled).toBe(60);
  });
  it("accepts an async source that loads one stream at a time", async () => {
    async function* source(): AsyncGenerator<RideStream> {
      await Promise.resolve();
      yield ride("a", 220);
      yield ride("b", 260);
    }
    expect((await findBestFtpEstimate(source()))?.rideId).toBe("b");
  });
  it("stops when aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    expect(await findBestFtpEstimate([ride("a", 300)], { signal: controller.signal })).toBeNull();
  });
  it("returns null for a cap below 1", async () => {
    expect(await findBestFtpEstimate([ride("a", 300)], { maxRides: 0 })).toBeNull();
  });
});

describe("readChannel", () => {
  it("reads a stored stream", () => {
    const parsed = { time: [0, 1, 2], watts: [100, null, 120], heartrate: [90, 91, 92] };
    expect(readChannel(parsed, "watts")).toEqual({ time: [0, 1, 2], values: [100, null, 120] });
    expect(readChannel(parsed, "heartrate")?.values).toEqual([90, 91, 92]);
  });
  it("returns null for anything unusable", () => {
    expect(readChannel(null, "watts")).toBeNull();
    expect(readChannel("x", "watts")).toBeNull();
    expect(readChannel({ time: [0, 1] }, "watts")).toBeNull();
    expect(readChannel({ time: [0, 1], watts: [1] }, "watts")).toBeNull();
    expect(readChannel({ time: [0, 2, 1], watts: [1, 1, 1] }, "watts")).toBeNull();
    expect(readChannel({ time: [0, 1.5], watts: [1, 1] }, "watts")).toBeNull();
    expect(readChannel({ time: [0, 1], watts: [1, "2"] }, "watts")).toBeNull();
    expect(readChannel({ time: [0, 1], watts: [1, NaN] }, "watts")).toBeNull();
  });
  it("accepts repeated seconds", () => {
    expect(readChannel({ time: [0, 0, 1], watts: [1, 2, 3] }, "watts")).not.toBeNull();
  });
});

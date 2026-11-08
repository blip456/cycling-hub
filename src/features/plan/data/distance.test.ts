import { describe, expect, it } from "vitest";
import { addDays } from "@/features/athlete";
import {
  formatKm,
  rideEffort,
  sessionDistance,
  sessionEffort,
  speedFor,
  speedModel,
  totalKm,
  type SpeedRide,
} from "./distance";

const TODAY = "2026-11-07";
const FTP = 250;

/** An outdoor ride `daysAgo` days back with a given effort (% FTP), speed (km/h) and climbing (m/km). */
function ride(
  daysAgo: number,
  effort: number,
  speed: number,
  climb = 5,
  over: Partial<SpeedRide> = {},
): SpeedRide {
  const hours = 2;
  const km = speed * hours;
  return {
    start_local: `${addDays(TODAY, -daysAgo) ?? TODAY}T09:00:00`,
    sport_type: "Ride",
    distance_m: km * 1000,
    moving_time_s: hours * 3600,
    elevation_m: climb * km,
    commute: false,
    trainer: false,
    average_watts: (effort / 100) * FTP,
    average_heartrate: null,
    ...over,
  };
}

/** Speed grows 0.2 km/h per % of FTP and drops 0.5 km/h per m/km of climbing. */
function trendRides(): SpeedRide[] {
  const efforts = [55, 60, 65, 70, 75, 80, 62, 68];
  const climbs = [3, 8, 5, 4, 6, 5, 12, 2];
  return efforts.map((effort, i) => {
    const climb = climbs[i] ?? 5;
    return ride(i * 7 + 1, effort, 9 + 0.2 * effort - 0.5 * (climb - 5), climb);
  });
}

const step = (minutes: number, percentFtp: number) => ({
  durationSec: minutes * 60,
  target: {
    percentFtp,
    minPercent: percentFtp - 5,
    maxPercent: percentFtp + 5,
    watts: { target: null, min: null, max: null },
    powerZone: 2,
    exact: false,
  },
});

describe("the speed trendline", () => {
  it("needs at least 3 outdoor rides in the last 90 days", () => {
    expect(speedModel({ rides: [], today: TODAY, ftp: FTP, lthr: null })).toBeNull();
    const old = [ride(100, 65, 22), ride(120, 65, 22), ride(130, 65, 22)];
    expect(speedModel({ rides: old, today: TODAY, ftp: FTP, lthr: null })).toBeNull();
  });

  it("leaves out indoor, virtual, e-bike, commute, short and future rides", () => {
    const rides = [
      ride(1, 65, 30, 5, { trainer: true }),
      ride(2, 65, 30, 5, { sport_type: "VirtualRide" }),
      ride(3, 65, 30, 5, { sport_type: "EBikeRide" }),
      ride(4, 65, 30, 5, { commute: true }),
      ride(5, 65, 30, 5, { moving_time_s: 600 }),
      ride(-2, 65, 30),
      ride(6, 65, 22),
      ride(7, 65, 22),
      ride(8, 65, 22),
    ];
    const model = speedModel({ rides, today: TODAY, ftp: FTP, lthr: null });
    expect(model).toEqual({ kind: "average", speed: 22, rides: 3 });
  });

  it("uses the average speed with fewer than 6 rides with an effort", () => {
    const rides = [ride(1, 60, 20), ride(2, 70, 24), ride(3, 65, 22), ride(4, 65, 22)];
    const model = speedModel({ rides, today: TODAY, ftp: FTP, lthr: null });
    expect(model?.kind).toBe("average");
    expect(model && speedFor(model, 90)).toBeCloseTo(22);
  });

  it("fits speed on effort and climbing, and predicts on typical roads", () => {
    const model = speedModel({ rides: trendRides(), today: TODAY, ftp: FTP, lthr: null });
    expect(model?.kind).toBe("trend");
    if (model?.kind !== "trend") return;
    expect(model.slope).toBeCloseTo(0.2, 5);
    expect(model.rides).toBe(8);
    // 65 % of FTP on roads with the typical 5 m/km: 9 + 13 = 22 km/h.
    expect(speedFor(model, 65)).toBeCloseTo(22, 1);
  });

  it("stays inside the speeds that were ridden", () => {
    const model = speedModel({ rides: trendRides(), today: TODAY, ftp: FTP, lthr: null });
    if (model?.kind !== "trend") throw new Error("no trend");
    expect(speedFor(model, 200)).toBeCloseTo(model.range[1]);
    expect(speedFor(model, 0)).toBeCloseTo(model.range[0]);
  });

  it("falls back to the average when all rides have the same effort", () => {
    const rides = [1, 2, 3, 4, 5, 6].map((d) => ride(d, 65, 20 + d));
    expect(speedModel({ rides, today: TODAY, ftp: FTP, lthr: null })?.kind).toBe("average");
  });

  it("uses heart rate for rides without power", () => {
    expect(rideEffort({ average_watts: 200, average_heartrate: 150 }, 250, 170)).toBe(80);
    expect(rideEffort({ average_watts: null, average_heartrate: 129.2 }, 250, 170)).toBeCloseTo(65);
    expect(rideEffort({ average_watts: null, average_heartrate: 170 }, 250, 170)).toBeCloseTo(100);
    expect(rideEffort({ average_watts: null, average_heartrate: null }, 250, 170)).toBeNull();
    expect(rideEffort({ average_watts: 200, average_heartrate: null }, null, null)).toBeNull();
  });
});

describe("the distance of a session", () => {
  const model = speedModel({ rides: trendRides(), today: TODAY, ftp: FTP, lthr: null });
  const none = new Map<string, { distance_m: number }>();
  const easy = {
    kind: "endurance" as const,
    durationMin: 120,
    steps: [step(120, 65)],
    indoor: false,
    status: "planned" as const,
    activityId: null,
  };

  it("weights the effort of the steps by time and caps all-out steps", () => {
    expect(sessionEffort([step(30, 50), step(30, 80)])).toBeCloseTo(65);
    expect(sessionEffort([step(10, 150), step(10, 60)])).toBeCloseTo(90);
    expect(sessionEffort([])).toBeNull();
  });

  it("estimates an outdoor session: 2 h easy is about 44 km", () => {
    const distance = sessionDistance(easy, model, none);
    expect(distance?.estimated).toBe(true);
    expect(distance?.km).toBeCloseTo(44, 0);
    expect(formatKm(distance?.km ?? 0)).toBe("about 44 km");
  });

  it("uses the ride's distance once a ride is linked", () => {
    const rides = new Map([["r-1", { distance_m: 51_400 }]]);
    const done = { ...easy, status: "done" as const, activityId: "r-1" };
    expect(sessionDistance(done, model, rides)).toEqual({ km: 51.4, estimated: false });
    expect(formatKm(51.4, false)).toBe("51 km");
  });

  it("has no distance indoors, for the event, when skipped or without a model", () => {
    expect(sessionDistance({ ...easy, indoor: true }, model, none)).toBeNull();
    expect(sessionDistance({ ...easy, kind: "event" }, model, none)).toBeNull();
    expect(sessionDistance({ ...easy, status: "skipped" }, model, none)).toBeNull();
    expect(sessionDistance(easy, null, none)).toBeNull();
  });

  it("adds up a week, and is null when nothing has a distance", () => {
    expect(totalKm([easy, easy, { ...easy, indoor: true }], model, none)).toBeCloseTo(88, 0);
    expect(totalKm([{ ...easy, indoor: true }], model, none)).toBeNull();
  });
});

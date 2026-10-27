import { describe, expect, it } from "vitest";
import type { Ride } from "../api";
import { CSV_COLUMNS, csvField, ridesToCsv } from "./csv";

function ride(overrides: Partial<Ride> = {}): Ride {
  return {
    id: "00000000-0000-0000-0000-000000000001",
    strava_id: 20584280211,
    name: "Afternoon Ride",
    sport_type: "Ride",
    start_local: "2026-10-14T15:27:43",
    start_at: "2026-10-14T13:27:43Z",
    distance_m: 22369,
    moving_time_s: 3960,
    elevation_m: 98,
    commute: false,
    trainer: false,
    average_watts: null,
    max_watts: null,
    average_heartrate: null,
    max_heartrate: null,
    average_cadence: null,
    polyline: null,
    ...overrides,
  };
}

describe("csvField (RFC 4180)", () => {
  it("leaves plain text alone", () => {
    expect(csvField("Morning Ride")).toBe("Morning Ride");
  });

  it("quotes commas, quotes and line breaks, doubling quotes", () => {
    expect(csvField("Ride, then coffee")).toBe('"Ride, then coffee"');
    expect(csvField('The "big" one')).toBe('"The ""big"" one"');
    expect(csvField("two\nlines")).toBe('"two\nlines"');
    expect(csvField("cr\r\nlf")).toBe('"cr\r\nlf"');
  });

  it("defuses text that a spreadsheet would run as a formula", () => {
    expect(csvField("=HYPERLINK(1)", { text: true })).toBe("'=HYPERLINK(1)");
    expect(csvField("-5 °C ride", { text: true })).toBe("'-5 °C ride");
    expect(csvField("+1,2", { text: true })).toBe(`"'+1,2"`);
    expect(csvField("@home", { text: true })).toBe("'@home");
  });
});

describe("ridesToCsv", () => {
  it("writes the header and one row per ride with CRLF line endings", () => {
    const csv = ridesToCsv([ride(), ride({ id: "2", strava_id: 2 })]);
    const lines = csv.split("\r\n");
    expect(lines).toHaveLength(4); // header, 2 rides, trailing empty after the last CRLF
    expect(lines[0]).toBe(CSV_COLUMNS.join(","));
    expect(lines[0]).toBe(
      "Date,Name,Type,Tags,Distance (km),Moving time,Avg speed (km/h),Avg power (W)," +
        "Avg heart rate (bpm),Elevation (m),Strava ID",
    );
    expect(lines[3]).toBe("");
  });

  it("writes Brussels wall-clock dates, metric units and empty cells for missing values", () => {
    const [, row] = ridesToCsv([ride()]).split("\r\n");
    expect(row).toBe("2026-10-14 15:27,Afternoon Ride,Road,,22.37,1:06:00,20.3,,,98,20584280211");
  });

  it("fills power and heart rate when present and lists the tags", () => {
    const [, row] = ridesToCsv([
      ride({
        sport_type: "GravelRide",
        commute: true,
        trainer: true,
        average_watts: 182.4,
        average_heartrate: 141.6,
        moving_time_s: 0,
      }),
    ]).split("\r\n");
    expect(row).toBe(
      "2026-10-14 15:27,Afternoon Ride,Gravel,Commute; Indoor,22.37,0:00:00,,182,142,98,20584280211",
    );
  });

  it("keeps accents and escapes names", () => {
    const [, row] = ridesToCsv([ride({ name: 'Tour "Ardennes", côte de Stockeu' })]).split("\r\n");
    expect(row).toContain(',"Tour ""Ardennes"", côte de Stockeu",');
  });

  it("writes only the header for no rides", () => {
    expect(ridesToCsv([])).toBe(`${CSV_COLUMNS.join(",")}\r\n`);
  });
});

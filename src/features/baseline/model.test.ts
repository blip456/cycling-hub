import { describe, expect, it } from "vitest";
import { heartRateZones, powerZones } from "@/features/athlete";
import {
  changeText,
  currentBaseline,
  historyRows,
  savedMessage,
  sortEntries,
  sourceLabel,
  zoneBarWeights,
  zonePercentText,
  zoneRangeText,
  zoneSummary,
  type BaselineEntry,
} from "./model";

function entry(overrides: Partial<BaselineEntry> & { id: string }): BaselineEntry {
  return {
    effective_date: "2026-01-10",
    ftp_w: null,
    max_hr: null,
    resting_hr: null,
    lthr: null,
    source: "manual",
    source_activity_id: null,
    note: null,
    created_at: "2026-01-10T10:00:00Z",
    ...overrides,
  };
}

const ENTRIES = [
  entry({ id: "a", effective_date: "2026-01-10", ftp_w: 215 }),
  entry({ id: "b", effective_date: "2026-03-07", ftp_w: 228, max_hr: 186 }),
  entry({ id: "c", effective_date: "2026-06-06", ftp_w: 240, source: "test_20min" }),
  entry({
    id: "d",
    effective_date: "2026-10-11",
    ftp_w: 250,
    source: "stream_estimate",
    source_activity_id: "ride-1",
  }),
];

describe("currentBaseline", () => {
  it("takes the value and date from the view and the source from the history", () => {
    const current = currentBaseline(
      {
        user_id: "u",
        ftp_w: 250,
        ftp_effective_date: "2026-10-11",
        max_hr: 186,
        max_hr_effective_date: "2026-03-07",
        lthr: null,
        lthr_effective_date: null,
        resting_hr: null,
        resting_hr_effective_date: null,
      },
      ENTRIES,
    );
    expect(current.ftp).toEqual({
      value: 250,
      effectiveDate: "2026-10-11",
      source: "stream_estimate",
      sourceActivityId: "ride-1",
    });
    expect(current.maxHr?.source).toBe("manual");
    expect(current.lthr).toBeNull();
    expect(current.restingHr).toBeNull();
  });

  it("is empty without a view row", () => {
    expect(currentBaseline(null, [])).toEqual({
      ftp: null,
      maxHr: null,
      lthr: null,
      restingHr: null,
    });
  });
});

describe("history", () => {
  it("sorts newest first, a later save winning on the same date", () => {
    const sorted = sortEntries([
      entry({ id: "x", effective_date: "2026-05-01", created_at: "2026-05-01T08:00:00Z" }),
      entry({ id: "y", effective_date: "2026-05-01", created_at: "2026-05-01T09:00:00Z" }),
      entry({ id: "z", effective_date: "2026-06-01" }),
    ]);
    expect(sorted.map((e) => e.id)).toEqual(["z", "y", "x"]);
  });

  it("marks only the newest row current and carries values forward for the zones", () => {
    const rows = historyRows(ENTRIES);
    expect(rows.map((r) => r.id)).toEqual(["d", "c", "b", "a"]);
    expect(rows.map((r) => r.current)).toEqual([true, false, false, false]);
    expect(rows[1]?.maxHrInForce).toBe(186);
    expect(rows[3]?.maxHrInForce).toBeNull();
    expect(rows[0]?.ftpInForce).toBe(250);
  });

  it("does not change the rows it was given", () => {
    const copy = JSON.stringify(ENTRIES);
    historyRows(ENTRIES);
    expect(JSON.stringify(ENTRIES)).toBe(copy);
  });
});

describe("texts", () => {
  it("names the sources in plain English", () => {
    expect(sourceLabel("stream_estimate")).toBe("Ride estimate");
    expect(sourceLabel("test_ramp")).toBe("Test, ramp");
    expect(sourceLabel("something_else")).toBe("something_else");
  });

  it("describes a change in words", () => {
    expect(changeText(250, 261, "W")).toBe("Up 11 W");
    expect(changeText(250, 245, "W")).toBe("Down 5 W");
    expect(changeText(250, 250, "W")).toBe("Same");
    expect(changeText(null, 250, "W")).toBeNull();
  });

  it("writes the saved message from the values", () => {
    expect(savedMessage({ ftp: 261, maxHr: null, restingHr: null, lthr: 171 })).toBe(
      "Baseline updated: FTP 261 W, LTHR 171 bpm. Zones are recalculated.",
    );
  });
});

describe("zone display", () => {
  it("shows the share of the reference as in the wireframe", () => {
    expect(zonePercentText("power", 1)).toBe("Under 55 %");
    expect(zonePercentText("power", 2)).toBe("56 to 75 %");
    expect(zonePercentText("power", 7)).toBe("Over 150 %");
    expect(zonePercentText("max-hr", 5)).toBe("Over 90 %");
    expect(zonePercentText("lthr", 3)).toBe("84 to 94 %");
  });

  it("writes ranges with the unit", () => {
    const zones = powerZones(250) ?? [];
    expect(zoneRangeText(zones[0]!, "W")).toBe("Up to 138 W");
    expect(zoneRangeText(zones[1]!, "W")).toBe("139 to 188 W");
    expect(zoneRangeText(zones[6]!, "W")).toMatch(/ W and above$/);
  });

  it("gives the bar a width per range and the top zone the width of the one below", () => {
    const zones = powerZones(200) ?? [];
    const weights = zoneBarWeights(zones);
    expect(weights).toHaveLength(7);
    expect(weights[6]).toBe(weights[5]);
    expect(weights[0]).toBe(111);
  });

  it("summarises heart rate zones in one line", () => {
    const set = heartRateZones({ maxHr: 188 });
    expect(zoneSummary(set?.zones ?? [])).toBe(
      "1: up to 113 · 2: 114 to 132 · 3: 133 to 150 · 4: 151 to 169 · 5: 170 and above",
    );
  });
});

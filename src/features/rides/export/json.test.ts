import { describe, expect, it } from "vitest";
import { parseExport } from "@/features/import/parse";
import valid from "@/features/import/fixtures/export-v1.json";
import { exportFileName } from "./download";
import { ridesToJson } from "./json";

describe("ridesToJson", () => {
  const original = parseExport(JSON.stringify(valid));
  if (!original.ok) throw new Error("fixture must parse");
  // What the database holds: the raw activity per row (T6).
  const stored = original.activities.map((activity) => ({ raw: activity.raw }));
  const now = new Date("2026-10-27T09:15:00Z");

  it("writes the extension's file format with version and export time", () => {
    const file = JSON.parse(ridesToJson(stored, now)) as Record<string, unknown>;
    expect(file.version).toBe(1);
    expect(file.exportedAt).toBe("2026-10-27T09:15:00.000Z");
    expect(file.activities).toEqual(stored.map((s) => s.raw));
  });

  it("is read back by the Sprint 1 import parser with every activity valid and unchanged", () => {
    const again = parseExport(ridesToJson(stored, now));
    expect(again.ok).toBe(true);
    if (!again.ok) return;
    expect(again.skipped).toEqual([]);
    expect(again.total).toBe(stored.length);
    // Same normalised fields as the first import, so import_activities() reports them as unchanged.
    expect(again.activities).toEqual(original.activities);
  });

  it("is a valid (empty) export without rides", () => {
    const again = parseExport(ridesToJson([], now));
    expect(again).toMatchObject({ ok: true, total: 0, activities: [], skipped: [] });
  });
});

describe("exportFileName", () => {
  it("uses today's date in Brussels", () => {
    expect(exportFileName("csv", new Date("2026-10-27T09:00:00Z"))).toBe(
      "cycling-hub-rides-2026-10-27.csv",
    );
    // 23:30 UTC on 27 Oct is already 28 Oct in Brussels (CET, UTC+1).
    expect(exportFileName("json", new Date("2026-10-27T23:30:00Z"))).toBe(
      "cycling-hub-rides-2026-10-28.json",
    );
  });
});

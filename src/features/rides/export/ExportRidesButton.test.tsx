import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "@/features/rides/api";
import type { Ride } from "@/features/rides/api";
import { parseExport } from "@/features/import/parse";
import { renderWithProviders } from "@/test/render";
import { ExportRidesButton } from "./ExportRidesButton";

vi.mock("@/features/rides/api", async (importOriginal) => {
  const actual = await importOriginal<typeof api>();
  return { ...actual, fetchRidesForExport: vi.fn() };
});

function row(id: number, name: string): Ride & { raw: Record<string, unknown> } {
  return {
    id: `00000000-0000-0000-0000-00000000000${id}`,
    strava_id: id,
    name,
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
    raw: {
      id,
      name,
      sportType: "Ride",
      startDateLocal: "2026-10-14T15:27:43Z",
      distance: 22369,
      movingTime: 3960,
      elevation: 98,
      commute: false,
      trainer: false,
    },
  };
}

let blobs: Blob[] = [];
let names: string[] = [];

beforeEach(() => {
  blobs = [];
  names = [];
  vi.mocked(api.fetchRidesForExport).mockResolvedValue([
    row(1, "Évening ride"),
    row(2, "Ride, with comma"),
  ] as Awaited<ReturnType<typeof api.fetchRidesForExport>>);
  URL.createObjectURL = vi.fn((blob: Blob) => {
    blobs.push(blob);
    return `blob:test/${blobs.length}`;
  });
  URL.revokeObjectURL = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    names.push(this.download);
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

async function exportAs(label: "Download CSV" | "Download JSON") {
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Export" }));
  const dialog = screen.getByRole("dialog", { name: "Export rides" });
  expect(within(dialog).getByRole("button", { name: "Download CSV" })).toHaveFocus();
  await user.click(within(dialog).getByRole("button", { name: label }));
}

describe("ExportRidesButton", () => {
  it("downloads a CSV with a BOM and one row per visible ride", async () => {
    renderWithProviders(<ExportRidesButton />);
    await exportAs("Download CSV");
    expect(await screen.findByRole("status")).toHaveTextContent("Exported 2 rides as CSV.");
    expect(names[0]).toMatch(/^cycling-hub-rides-\d{4}-\d{2}-\d{2}\.csv$/);
    const blob = blobs[0];
    expect(blob?.type).toBe("text/csv;charset=utf-8");
    const bytes = new Uint8Array(await blob!.arrayBuffer());
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    const text = new TextDecoder().decode(bytes.slice(3));
    const lines = text.trimEnd().split("\r\n");
    expect(lines).toHaveLength(3);
    expect(lines[1]).toContain("Évening ride");
    expect(lines[2]).toContain('"Ride, with comma"');
  });

  it("downloads a JSON file that imports again", async () => {
    renderWithProviders(<ExportRidesButton />);
    await exportAs("Download JSON");
    expect(await screen.findByRole("status")).toHaveTextContent("Exported 2 rides as JSON.");
    expect(names[0]).toMatch(/\.json$/);
    const parsed = parseExport(await blobs[0]!.text());
    expect(parsed).toMatchObject({ ok: true, total: 2, skipped: [] });
  });

  it("shows an error card with Try again when the rides cannot be loaded", async () => {
    vi.mocked(api.fetchRidesForExport).mockRejectedValueOnce(new Error("offline"));
    renderWithProviders(<ExportRidesButton />);
    await exportAs("Download CSV");
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Couldn't export your rides.");
    await userEvent.click(within(alert).getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Exported 2 rides as CSV.");
  });

  it("downloads nothing when there are no rides", async () => {
    vi.mocked(api.fetchRidesForExport).mockResolvedValueOnce([]);
    renderWithProviders(<ExportRidesButton />);
    await exportAs("Download CSV");
    expect(await screen.findByRole("status")).toHaveTextContent("No rides to export yet.");
    expect(blobs).toHaveLength(0);
  });
});

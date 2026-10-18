import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "@/features/import/api";
import type { ImportRecord } from "@/features/import/api";
import broken from "@/features/import/fixtures/export-v1-broken.json";
import valid from "@/features/import/fixtures/export-v1.json";
import { renderWithProviders } from "@/test/render";
import { ImportDetailPage } from "./ImportDetailPage";
import { ImportHistoryPage } from "./ImportHistoryPage";
import { ImportPage } from "./ImportPage";

vi.mock("@/features/import/api", async (importOriginal) => {
  const actual = await importOriginal<typeof api>();
  return {
    ...actual,
    importActivities: vi.fn(),
    logNotImported: vi.fn(),
    fetchImportHistory: vi.fn(),
    fetchImport: vi.fn(),
  };
});

function record(overrides: Partial<ImportRecord> = {}): ImportRecord {
  return {
    id: "00000000-0000-0000-0000-0000000000a1",
    user_id: "00000000-0000-0000-0000-000000000001",
    file_name: "export.json",
    imported_at: "2026-10-14T19:05:00Z",
    status: "imported",
    activity_count: 10,
    new_count: 7,
    updated_count: 0,
    unchanged_count: 0,
    not_a_ride_count: 3,
    skipped_count: 0,
    deleted_earlier_count: 0,
    errors: [],
    error_message: null,
    ...overrides,
  };
}

const jsonFile = (content: unknown, name = "export.json") =>
  new File([typeof content === "string" ? content : JSON.stringify(content)], name, {
    type: "application/json",
  });

beforeEach(() => {
  vi.mocked(api.fetchImportHistory).mockResolvedValue([]);
  vi.mocked(api.logNotImported).mockImplementation(async ({ fileName, reason }) =>
    record({
      file_name: fileName,
      status: "not_imported",
      error_message: reason,
      activity_count: 0,
    }),
  );
});

describe("ImportPage", () => {
  it("offers a labelled .json file picker without example values (C1)", async () => {
    renderWithProviders(<ImportPage />, { path: "/import" });
    const input = screen.getByLabelText("Choose file");
    expect(input).toHaveAttribute("type", "file");
    expect(input).toHaveAttribute("accept", ".json,application/json");
    expect(input).not.toHaveAttribute("placeholder");
    expect(input).toHaveAccessibleDescription(
      "Choose your export file The .json file from the Cycling Hub extension.",
    );
    expect(screen.queryByRole("link", { name: /Last import/ })).not.toBeInTheDocument();
  });

  it("links the last import to the history", async () => {
    vi.mocked(api.fetchImportHistory).mockResolvedValue([record()]);
    renderWithProviders(<ImportPage />, { path: "/import" });
    const link = await screen.findByRole("link", { name: /Last import/ });
    expect(link).toHaveAttribute("href", "/import/history");
    expect(link).toHaveTextContent(
      "14 Oct 2026, 21:05 · 7 new · 0 updated · 0 unchanged · 3 not a ride",
    );
  });

  it("checks and saves a valid export, then shows the summary (C2, C3)", async () => {
    const user = userEvent.setup();
    let finish: (value: ImportRecord) => void = () => undefined;
    vi.mocked(api.importActivities).mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    renderWithProviders(<ImportPage />, { path: "/import" });

    await user.upload(screen.getByLabelText("Choose file"), jsonFile(valid));

    expect(await screen.findByRole("progressbar", { name: "Saving rides" })).toBeInTheDocument();
    expect(screen.getByText("File checked")).toBeInTheDocument();
    expect(screen.getByText("10 activities")).toBeInTheDocument();

    expect(api.importActivities).toHaveBeenCalledTimes(1);
    const input = vi.mocked(api.importActivities).mock.calls[0]![0];
    expect(input.fileName).toBe("export.json");
    expect(input.activities).toHaveLength(10);
    expect(input.skipped).toEqual([]);

    act(() => {
      finish(record());
    });

    const heading = await screen.findByRole("heading", { name: "Import complete" });
    await waitFor(() => {
      expect(heading).toHaveFocus();
    });
    for (const [title, value] of [
      ["New rides", "7"],
      ["Updated", "0"],
      ["Unchanged", "0"],
      ["Not a ride", "3"],
      ["Skipped (errors)", "0"],
      ["Deleted earlier", "0"],
    ] as const) {
      const term = screen.getByText(title, { selector: "dt" });
      expect(term.nextElementSibling).toHaveTextContent(value);
    }
    expect(screen.getByRole("link", { name: "View rides" })).toHaveAttribute("href", "/rides");
    expect(screen.getByRole("link", { name: "Import history" })).toHaveAttribute(
      "href",
      "/import/history",
    );

    await user.click(screen.getByRole("button", { name: "Import another file" }));
    expect(screen.getByLabelText("Choose file")).toBeInTheDocument();
  });

  it("saves the valid activities of a partly broken file and lists the skipped ones (P14)", async () => {
    const user = userEvent.setup();
    vi.mocked(api.importActivities).mockImplementation(async ({ skipped }) =>
      record({
        activity_count: 7,
        new_count: 2,
        not_a_ride_count: 0,
        skipped_count: skipped.length,
        errors: skipped,
      }),
    );
    renderWithProviders(<ImportPage />, { path: "/import" });

    await user.upload(screen.getByLabelText("Choose file"), jsonFile(broken, "broken.json"));

    await screen.findByRole("heading", { name: "Import complete" });
    const input = vi.mocked(api.importActivities).mock.calls[0]![0];
    expect(input.activities.map((a) => a.strava_id)).toEqual([900000010, 900000006]);
    expect(input.skipped).toHaveLength(5);

    const list = screen.getByRole("region", { name: "Skipped (errors)" });
    const items = within(list).getAllByRole("listitem");
    expect(items).toHaveLength(5);
    expect(items[0]).toHaveTextContent("Activity 2 · Test hike");
    expect(items[0]).toHaveTextContent("activities[1].startDateLocal is not a valid date");
    expect(items[1]).toHaveTextContent("Activity 3 · Test gravel loop, 28 Jun 2026");
    expect(items[1]).toHaveTextContent("activities[2].distance must be a number (metres)");
    expect(items[3]).toHaveTextContent("Activity 5");
    expect(items[3]).toHaveTextContent("activities[4] is not an activity");
  });

  it("rejects a file that is not JSON, changes nothing and logs it as not imported (C4, P33)", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    renderWithProviders(<ImportPage />, { path: "/import" });

    await user.upload(
      screen.getByLabelText("Choose file"),
      jsonFile("not json at all", "notes.json"),
    );

    const heading = await screen.findByRole("heading", { name: "This file can’t be imported" });
    await waitFor(() => {
      expect(heading).toHaveFocus();
    });
    expect(screen.getByText("Nothing was changed.")).toBeInTheDocument();
    expect(screen.getByText("notes.json")).toBeInTheDocument();
    expect(
      screen.getByText("This is not a Cycling Hub export: the file is not valid JSON."),
    ).toBeInTheDocument();
    expect(api.importActivities).not.toHaveBeenCalled();
    expect(vi.mocked(api.logNotImported).mock.calls[0]?.[0]).toEqual({
      fileName: "notes.json",
      reason: "This is not a Cycling Hub export: the file is not valid JSON.",
    });

    await user.click(screen.getByRole("button", { name: "Copy error details" }));
    expect(writeText).toHaveBeenCalledWith(
      expect.stringContaining("Reason: This is not a Cycling Hub export"),
    );
    expect(await screen.findByRole("status")).toHaveTextContent("Error details copied.");

    // Choose another file goes straight to the picker.
    vi.mocked(api.importActivities).mockResolvedValue(record());
    await user.upload(screen.getByLabelText("Choose another file"), jsonFile(valid));
    expect(await screen.findByRole("heading", { name: "Import complete" })).toBeInTheDocument();
  });

  it("rejects a JSON file without an activities list", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ImportPage />, { path: "/import" });
    await user.upload(screen.getByLabelText("Choose file"), jsonFile({ version: 1, rides: [] }));
    expect(
      await screen.findByText("This is not a Cycling Hub export: the file has no activities list."),
    ).toBeInTheDocument();
    expect(api.importActivities).not.toHaveBeenCalled();
  });

  it("shows a status card with Try again when saving fails; nothing was changed", async () => {
    const user = userEvent.setup();
    vi.mocked(api.importActivities).mockRejectedValueOnce(new Error("Failed to fetch"));
    renderWithProviders(<ImportPage />, { path: "/import" });

    await user.upload(screen.getByLabelText("Choose file"), jsonFile(valid));

    // Errors are announced as alerts by the shared status card.
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The import failed and nothing was changed.",
    );
    vi.mocked(api.importActivities).mockResolvedValueOnce(record());
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("heading", { name: "Import complete" })).toBeInTheDocument();
    expect(api.importActivities).toHaveBeenCalledTimes(2);
  });

  it("imports a file dropped anywhere on the page (X2)", async () => {
    vi.mocked(api.importActivities).mockResolvedValue(record());
    renderWithProviders(<ImportPage />, { path: "/import" });
    const file = jsonFile(valid);
    const dataTransfer = { types: ["Files"], files: [file], dropEffect: "none" };

    fireEvent.dragEnter(window, { dataTransfer });
    expect(await screen.findByText("Drop the file to import")).toBeInTheDocument();
    fireEvent.dragLeave(window, { dataTransfer });
    expect(await screen.findByText("Choose your export file")).toBeInTheDocument();

    fireEvent.dragEnter(window, { dataTransfer });
    fireEvent.drop(window, { dataTransfer });
    expect(await screen.findByRole("heading", { name: "Import complete" })).toBeInTheDocument();
    expect(api.importActivities).toHaveBeenCalledTimes(1);
  });
});

describe("ImportHistoryPage", () => {
  it("lists past imports newest first, including files that were not imported (C5)", async () => {
    vi.mocked(api.fetchImportHistory).mockResolvedValue([
      record({
        id: "b",
        file_name: "week-42.json",
        new_count: 4,
        updated_count: 1,
        not_a_ride_count: 0,
      }),
      record({
        id: "c",
        file_name: "notes.txt",
        status: "not_imported",
        error_message: "This is not a Cycling Hub export: the file is not valid JSON.",
      }),
    ]);
    renderWithProviders(<ImportHistoryPage />, { path: "/import/history" });

    expect(await screen.findByText("2 imports")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Import rides" })).toHaveAttribute("href", "/import");

    const [phoneList] = screen.getAllByRole("list");
    const rows = within(phoneList!).getAllByRole("link");
    expect(rows[0]).toHaveTextContent("week-42.json");
    expect(rows[0]).toHaveTextContent("4 new · 1 updated · 0 unchanged");
    expect(rows[0]).toHaveAttribute("href", "/import/history/b");
    expect(rows[1]).toHaveTextContent(
      "Not imported. This is not a Cycling Hub export: the file is not valid JSON.",
    );

    const table = screen.getByRole("table", { name: "Import history, newest first" });
    expect(
      within(table)
        .getAllByRole("columnheader")
        .map((th) => th.textContent),
    ).toEqual([
      "Date",
      "File",
      "Activities",
      "New rides",
      "Updated",
      "Unchanged",
      "Not a ride",
      "Skipped",
      "Deleted earlier",
    ]);
    expect(within(table).getAllByRole("row")).toHaveLength(3);
  });

  it("says when there are no imports yet", async () => {
    renderWithProviders(<ImportHistoryPage />, { path: "/import/history" });
    expect(await screen.findByText("No imports yet.")).toBeInTheDocument();
  });
});

describe("ImportDetailPage", () => {
  const renderDetail = (id: string) =>
    renderWithProviders(
      <Routes>
        <Route path="/import/history/:id" element={<ImportDetailPage />} />
      </Routes>,
      { path: `/import/history/${id}` },
    );

  it("shows the summary of a past import", async () => {
    vi.mocked(api.fetchImport).mockResolvedValue(record({ id: "b" }));
    renderDetail("b");
    expect(await screen.findByRole("heading", { name: "Import complete" })).toBeInTheDocument();
    expect(api.fetchImport).toHaveBeenCalledWith("b");
    expect(screen.getByRole("link", { name: "Import history" })).toHaveAttribute(
      "href",
      "/import/history",
    );
  });

  it("shows why a file was not imported", async () => {
    vi.mocked(api.fetchImport).mockResolvedValue(
      record({ status: "not_imported", file_name: "notes.txt", error_message: "Reason here." }),
    );
    renderDetail("c");
    expect(
      await screen.findByRole("heading", { name: "This file can’t be imported" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Reason here.")).toBeInTheDocument();
  });

  it("says when the import does not exist", async () => {
    vi.mocked(api.fetchImport).mockResolvedValue(null);
    renderDetail("missing");
    expect(await screen.findByText("This import was not found.")).toBeInTheDocument();
  });
});

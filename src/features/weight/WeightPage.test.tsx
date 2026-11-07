import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockViewport } from "@/test/match-media";
import { renderWithProviders } from "@/test/render";
import * as api from "./api";
import { ENTRIES, mockWeightApi, NOW } from "./test-support";
import { UNDO_MS } from "./use-weight-cards";
import { WeightPage } from "./WeightPage";

vi.mock("./api", async (importOriginal) => {
  const actual = await importOriginal<typeof api>();
  return {
    ...actual,
    fetchWeightEntries: vi.fn(),
    saveWeightEntry: vi.fn(),
    deleteWeightEntry: vi.fn(),
    fetchReminderSettings: vi.fn(),
  };
});

function renderPage(path = "/weight") {
  return renderWithProviders(
    <Routes>
      <Route path="/weight/*" element={<WeightPage />} />
    </Routes>,
    { path },
  );
}

function setup() {
  return userEvent.setup({ advanceTimers: (ms) => vi.advanceTimersByTime(ms) });
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(NOW);
  mockWeightApi();
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("Log tab: history", () => {
  it("shows the form first and the history newest first", async () => {
    renderPage();
    expect(screen.getByRole("heading", { name: "Log weight" })).toBeInTheDocument();
    expect(screen.getByLabelText("Date")).toHaveValue("2026-10-28");
    expect(screen.getByRole("textbox", { name: "Weight" })).toHaveValue("");
    expect(screen.getByRole("textbox", { name: "Weight" })).not.toHaveAttribute("placeholder");
    expect(await screen.findByText("74.8 kg")).toBeInTheDocument();
    const rows = within(screen.getByRole("list", { name: "Weights, newest first" })).getAllByRole(
      "listitem",
    );
    expect(rows.map((r) => r.textContent)).toEqual([
      expect.stringContaining("74.8 kg"),
      expect.stringContaining("75.0 kg"),
      expect.stringContaining("75.6 kg"),
    ]);
    expect(rows[0]).toHaveTextContent("Wed 28 Oct · Morning, before breakfast");
  });

  it("shows the empty state", async () => {
    vi.mocked(api.fetchWeightEntries).mockResolvedValue([]);
    renderPage();
    expect(await screen.findByText("No weights yet")).toBeInTheDocument();
    expect(screen.getByText(/The trend appears after two entries/)).toBeInTheDocument();
  });

  it("shows a loading state", () => {
    vi.mocked(api.fetchWeightEntries).mockReturnValue(new Promise(() => undefined));
    renderPage();
    expect(screen.getByText("Loading")).toBeInTheDocument();
  });

  it("says when the history cannot be loaded, keeps the form and retries", async () => {
    const user = setup();
    vi.mocked(api.fetchWeightEntries).mockRejectedValueOnce(new Error("offline"));
    renderPage();
    expect(await screen.findByText("Your weights could not be loaded.")).toBeInTheDocument();
    const card = screen.getByRole("alert");
    expect(card).toHaveTextContent("Could not load your weights");
    expect(screen.getByRole("textbox", { name: "Weight" })).toBeInTheDocument();
    await user.click(within(card).getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("74.8 kg")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("uses a table with Edit and Delete buttons on desktop", async () => {
    const viewport = mockViewport(1280);
    try {
      renderPage();
      expect(
        await screen.findByRole("table", { name: "Weights, newest first" }),
      ).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Edit entry for Thu 22 Oct" })).toHaveTextContent(
        "Edit",
      );
      expect(screen.getByRole("button", { name: "Delete entry for Thu 22 Oct" })).toHaveTextContent(
        "Delete",
      );
    } finally {
      viewport.restore();
    }
  });
});

describe("Log tab: saving", () => {
  it("saves a weight for today with the note and clears the form", async () => {
    const user = setup();
    vi.mocked(api.fetchWeightEntries).mockResolvedValue([]);
    renderPage();
    await screen.findByText("No weights yet");
    await user.type(screen.getByRole("textbox", { name: "Weight" }), "74,6");
    await user.type(screen.getByLabelText("Note"), " Evening ");
    await user.click(screen.getByRole("button", { name: "Save weight" }));
    await waitFor(() => {
      expect(api.saveWeightEntry).toHaveBeenCalledWith({
        date: "2026-10-28",
        kg: 74.6,
        note: "Evening",
      });
    });
    await waitFor(() => {
      expect(screen.getByRole("textbox", { name: "Weight" })).toHaveValue("");
    });
    expect(screen.getByLabelText("Note")).toHaveValue("");
  });

  it.each([
    ["", "Enter your weight as a number."],
    ["abc", "Enter your weight as a number."],
    ["20", "Weight must be at least 30 kg."],
    ["300", "Weight can be at most 250 kg."],
    ["74.55", "Use at most one decimal."],
  ])("shows the inline error for %j and saves nothing", async (text, message) => {
    const user = setup();
    renderPage();
    await screen.findByText("74.8 kg");
    if (text) await user.type(screen.getByRole("textbox", { name: "Weight" }), text);
    await user.click(screen.getByRole("button", { name: "Save weight" }));
    const field = screen.getByRole("textbox", { name: "Weight" });
    expect(field).toHaveAttribute("aria-invalid", "true");
    expect(field).toHaveAccessibleDescription(expect.stringContaining(message));
    expect(api.saveWeightEntry).not.toHaveBeenCalled();
  });

  it("does not accept a date in the future", async () => {
    const user = setup();
    renderPage();
    await screen.findByText("74.8 kg");
    const date = screen.getByLabelText("Date");
    expect(date).toHaveAttribute("max", "2026-10-28");
    await user.clear(date);
    await user.type(date, "2026-10-29");
    await user.type(screen.getByRole("textbox", { name: "Weight" }), "75");
    await user.click(screen.getByRole("button", { name: "Save weight" }));
    expect(date).toHaveAccessibleDescription(expect.stringContaining("not in the future"));
    expect(api.saveWeightEntry).not.toHaveBeenCalled();
  });

  it("tells that a day with an entry is replaced, before saving", async () => {
    renderPage();
    await screen.findByText("74.8 kg");
    expect(screen.getByRole("status")).toHaveTextContent(
      "There is already an entry for Wed 28 Oct. Saving replaces it.",
    );
  });

  it("shows a failed save as a card, keeps the values and tries again", async () => {
    const user = setup();
    vi.mocked(api.saveWeightEntry).mockRejectedValueOnce(new Error("offline"));
    renderPage();
    await screen.findByText("74.8 kg");
    await user.type(screen.getByRole("textbox", { name: "Weight" }), "75.1");
    await user.click(screen.getByRole("button", { name: "Save weight" }));
    const card = await screen.findByRole("alert");
    expect(card).toHaveTextContent("Could not save your weight");
    expect(card).toHaveTextContent("Nothing was changed.");
    expect(screen.getByRole("textbox", { name: "Weight" })).toHaveValue("75.1");
    await user.click(within(card).getByRole("button", { name: "Try again" }));
    await waitFor(() => {
      expect(api.saveWeightEntry).toHaveBeenCalledTimes(2);
    });
    await waitFor(() => {
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });
  });

  it("edits an entry: loads it into the form, says Edit entry, and cancels", async () => {
    const user = setup();
    renderPage();
    await user.click(await screen.findByRole("button", { name: "Edit entry for Mon 19 Oct" }));
    expect(screen.getByRole("heading", { name: "Edit entry" })).toBeInTheDocument();
    expect(screen.getByLabelText("Date")).toHaveValue("2026-10-19");
    expect(screen.getByRole("textbox", { name: "Weight" })).toHaveValue("75.6");
    expect(screen.getByLabelText("Note")).toHaveValue("After a rest week");
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByRole("heading", { name: "Log weight" })).toBeInTheDocument();
  });

  it("saves the changes of an edited entry", async () => {
    const user = setup();
    renderPage();
    await user.click(await screen.findByRole("button", { name: "Edit entry for Mon 19 Oct" }));
    const kg = screen.getByRole("textbox", { name: "Weight" });
    await user.clear(kg);
    await user.type(kg, "75.4");
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => {
      expect(api.saveWeightEntry).toHaveBeenCalledWith({
        date: "2026-10-19",
        kg: 75.4,
        note: "After a rest week",
      });
    });
    expect(api.deleteWeightEntry).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Log weight" })).toBeInTheDocument();
    });
  });

  it("moves an entry when its date is changed", async () => {
    const user = setup();
    renderPage();
    await user.click(await screen.findByRole("button", { name: "Edit entry for Mon 19 Oct" }));
    const date = screen.getByLabelText("Date");
    await user.clear(date);
    await user.type(date, "2026-10-20");
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => {
      expect(api.deleteWeightEntry).toHaveBeenCalled();
    });
    expect(vi.mocked(api.deleteWeightEntry).mock.calls[0]?.[0]).toBe("2026-10-19");
    expect(vi.mocked(api.saveWeightEntry).mock.calls[0]?.[0].date).toBe("2026-10-20");
  });
});

describe("Log tab: delete and undo", () => {
  it("deletes at once and shows Undo, which saves the entry again", async () => {
    const user = setup();
    let stored = [...ENTRIES];
    vi.mocked(api.fetchWeightEntries).mockImplementation(() => Promise.resolve([...stored]));
    vi.mocked(api.deleteWeightEntry).mockImplementation((date) => {
      stored = stored.filter((e) => e.date !== date);
      return Promise.resolve();
    });
    renderPage();
    await user.click(await screen.findByRole("button", { name: "Delete entry for Thu 22 Oct" }));
    expect(api.deleteWeightEntry).toHaveBeenCalled();
    expect(vi.mocked(api.deleteWeightEntry).mock.calls[0]?.[0]).toBe("2026-10-22");
    expect(await screen.findByText("Entry for Thu 22 Oct deleted.")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Edit entry for Thu 22 Oct" }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Undo" }));
    await waitFor(() => {
      expect(api.saveWeightEntry).toHaveBeenCalledWith({ date: "2026-10-22", kg: 75, note: null });
    });
    expect(await screen.findByText("Entry restored.")).toBeInTheDocument();
  });

  it("removes the Undo card after about 8 seconds", async () => {
    const user = setup();
    renderPage();
    await user.click(await screen.findByRole("button", { name: "Delete entry for Thu 22 Oct" }));
    expect(await screen.findByText("Entry for Thu 22 Oct deleted.")).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(UNDO_MS + 100);
    });
    expect(screen.queryByText("Entry for Thu 22 Oct deleted.")).not.toBeInTheDocument();
    expect(api.saveWeightEntry).not.toHaveBeenCalled();
  });

  it("brings the row back and says so when the delete fails", async () => {
    const user = setup();
    vi.mocked(api.deleteWeightEntry).mockRejectedValueOnce(new Error("offline"));
    renderPage();
    await user.click(await screen.findByRole("button", { name: "Delete entry for Thu 22 Oct" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't delete the entry");
    expect(
      await screen.findByRole("button", { name: "Edit entry for Thu 22 Oct" }),
    ).toBeInTheDocument();
  });
});

describe("Trend tab", () => {
  it("shows the tiles, the chart and the 7-day average", async () => {
    renderPage("/weight/trend");
    expect(
      await screen.findByRole("img", { name: /Weight trend, this month/ }),
    ).toBeInTheDocument();
    const tile = (label: string) => screen.getByText(label, { selector: "dt" }).parentElement;
    expect(tile("Latest")).toHaveTextContent("74.8 kg");
    // 28 Oct: mean of 22 Oct (75.0) and 28 Oct (74.8) = 74.9.
    expect(tile("7-day average")).toHaveTextContent("74.9 kg");
    // The average at the end (74.9) minus the average at the start (75.6).
    expect(tile("Change")).toHaveTextContent("−0.7 kg");
    expect(tile("Change")).toHaveTextContent("this month");
  });

  it("switches the range", async () => {
    const user = setup();
    renderPage("/weight/trend");
    await screen.findByRole("img");
    expect(screen.getByRole("radio", { name: "Month" })).toBeChecked();
    await user.click(screen.getByRole("radio", { name: "Week" }));
    expect(await screen.findByRole("img", { name: /this week: 2 entries/ })).toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: "Year" }));
    expect(await screen.findByRole("img", { name: /this year/ })).toBeInTheDocument();
  });

  it("shows the same numbers as a table", async () => {
    const user = setup();
    renderPage("/weight/trend");
    const toggle = await screen.findByRole("button", { name: "Show as table" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    await user.click(toggle);
    const rows = within(screen.getByRole("table")).getAllByRole("row");
    expect(rows).toHaveLength(4);
    expect(rows[1]).toHaveTextContent("Wed 28 Oct74.874.9");
    expect(screen.getByRole("button", { name: "Hide table" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
  });

  it("explains that two entries are needed", async () => {
    vi.mocked(api.fetchWeightEntries).mockResolvedValue(ENTRIES.slice(2));
    renderPage("/weight/trend");
    expect(await screen.findByText("Not enough entries in this range yet.")).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("shows the load error in place of the chart, with retry", async () => {
    const user = setup();
    vi.mocked(api.fetchWeightEntries).mockRejectedValueOnce(new Error("offline"));
    renderPage("/weight/trend");
    expect(await screen.findByText("Your weights could not be loaded.")).toBeInTheDocument();
    await user.click(within(screen.getByRole("alert")).getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("img")).toBeInTheDocument();
  });
});

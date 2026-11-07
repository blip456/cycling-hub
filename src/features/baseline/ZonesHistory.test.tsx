import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockViewport } from "@/test/match-media";
import { renderWithProviders } from "@/test/render";
import * as api from "./api";
import { BaselinePage } from "./BaselinePage";
import { HISTORY, makeEntry, VIEW } from "./fixtures";

vi.mock("./api", async (importOriginal) => {
  const actual = await importOriginal<typeof api>();
  return {
    ...actual,
    fetchCurrentBaseline: vi.fn(),
    fetchBaselineEntries: vi.fn(),
    fetchPowerRides: vi.fn(),
    fetchActiveTestWeek: vi.fn(),
  };
});

/** The zone rows (the ordered lists), not the tab links. */
function zoneRows(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>("ol > li"));
}

function renderAt(path: string) {
  return renderWithProviders(
    <Routes>
      <Route path="/baseline/*" element={<BaselinePage />} />
    </Routes>,
    { path },
  );
}

beforeEach(() => {
  vi.mocked(api.fetchCurrentBaseline).mockResolvedValue(VIEW);
  vi.mocked(api.fetchBaselineEntries).mockResolvedValue(HISTORY);
  vi.mocked(api.fetchPowerRides).mockResolvedValue([]);
  vi.mocked(api.fetchActiveTestWeek).mockResolvedValue(null);
});

describe("Zones tab (Z7)", () => {
  let viewport: ReturnType<typeof mockViewport>;
  beforeEach(() => {
    viewport = mockViewport(390);
  });
  afterEach(() => {
    viewport.restore();
  });

  it("shows the seven power zones with number, name, share and range as text", async () => {
    const { container } = renderAt("/baseline/zones");
    expect(
      await screen.findByText(/Coggan, from FTP 250 W, effective Sun 11 Oct 2026/),
    ).toBeInTheDocument();
    const rows = zoneRows(container);
    expect(rows).toHaveLength(7);
    expect(rows[0]).toHaveTextContent("Zone 1 · Active recovery");
    expect(rows[0]).toHaveTextContent("Under 55 %");
    expect(rows[0]).toHaveTextContent("Up to 138 W");
    expect(rows[3]).toHaveTextContent("Zone 4 · Threshold");
    expect(rows[3]).toHaveTextContent("91 to 105 %");
    expect(rows[3]).toHaveTextContent("226 to 263 W");
    expect(rows[6]).toHaveTextContent("Zone 7 · Neuromuscular power");
    expect(rows[6]).toHaveTextContent("376 W and above");
    expect(screen.getByText("Zone 7 has no upper limit.")).toBeInTheDocument();
  });

  it("gives every zone its token colour and its number as text on the bar", async () => {
    renderAt("/baseline/zones");
    const bar = await screen.findByRole("img", { name: /Power zones 1 to 7/ });
    const segments = Array.from(bar.children) as HTMLElement[];
    expect(segments.map((s) => s.textContent)).toEqual(["1", "2", "3", "4", "5", "6", "7"]);
    expect(segments.map((s) => s.style.backgroundColor)).toEqual(
      [1, 2, 3, 4, 5, 6, 7].map((n) => `var(--zone-${String(n)})`),
    );
  });

  it("switches to the heart rate zones, from max HR when LTHR is not set", async () => {
    const { container } = renderAt("/baseline/zones");
    await userEvent.click(await screen.findByRole("radio", { name: "Heart rate" }));
    expect(screen.getByText(/From max HR 186 bpm, effective Sat 6 Jun 2026/)).toBeInTheDocument();
    expect(zoneRows(container)).toHaveLength(5);
    expect(screen.getByText(/LTHR \(not set\)/)).toBeInTheDocument();
    expect(screen.getByText(/LTHR is used when it is set; otherwise max HR/)).toBeInTheDocument();
  });

  it("uses LTHR for the heart rate zones when it is set", async () => {
    vi.mocked(api.fetchCurrentBaseline).mockResolvedValue({
      ...VIEW,
      lthr: 171,
      lthr_effective_date: "2026-10-27",
    });
    vi.mocked(api.fetchBaselineEntries).mockResolvedValue([
      makeEntry({ id: "t", effective_date: "2026-10-27", lthr: 171, source: "test_20min" }),
      ...HISTORY,
    ]);
    renderAt("/baseline/zones");
    await userEvent.click(await screen.findByRole("radio", { name: "Heart rate" }));
    expect(await screen.findByText(/From LTHR 171 bpm/)).toBeInTheDocument();
  });

  it("shows both tables side by side on desktop, without the switch", async () => {
    viewport.resize(1200);
    const { container } = renderAt("/baseline/zones");
    expect(await screen.findByRole("heading", { name: "Power zones (7)" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Heart rate zones (5)" })).toBeInTheDocument();
    expect(screen.queryByRole("radiogroup")).not.toBeInTheDocument();
    expect(zoneRows(container)).toHaveLength(12);
  });

  it("says what is missing: power zones need an FTP", async () => {
    vi.mocked(api.fetchCurrentBaseline).mockResolvedValue({
      ...VIEW,
      ftp_w: null,
      ftp_effective_date: null,
    });
    renderAt("/baseline/zones");
    expect(
      await screen.findByText("Power zones need an FTP. Set one to see them."),
    ).toBeInTheDocument();
  });

  it("shows the empty state with a way to set the baseline", async () => {
    vi.mocked(api.fetchCurrentBaseline).mockResolvedValue(null);
    vi.mocked(api.fetchBaselineEntries).mockResolvedValue([]);
    renderAt("/baseline/zones");
    expect(
      await screen.findByText("Zones need an FTP or a max heart rate. Set your baseline first."),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Enter values" })).toHaveAttribute(
      "href",
      "/baseline/values",
    );
  });

  it("shows loading and error states", async () => {
    vi.mocked(api.fetchCurrentBaseline).mockRejectedValue(new Error("offline"));
    renderAt("/baseline/zones");
    expect(
      await screen.findByText("Couldn't load your zones. Check your connection."),
    ).toBeInTheDocument();
  });
});

describe("History tab (Z8)", () => {
  it("lists the baselines newest first with source and note, marking the newest as current", async () => {
    renderAt("/baseline/history");
    const list = await screen.findByRole("region", { name: "Past baselines" });
    const rows = within(list).getAllByRole("listitem");
    expect(rows).toHaveLength(4);
    expect(rows[0]).toHaveTextContent("Sun 11 Oct 2026 · FTP 250 W");
    expect(rows[0]).toHaveTextContent("Ride estimate · Best 20 minutes");
    expect(rows[0]).toHaveTextContent("Current");
    expect(rows[1]).toHaveTextContent("Sat 6 Jun 2026 · FTP 240 W · max HR 186 bpm");
    expect(rows[1]).toHaveTextContent("Test, 20-minute");
    expect(rows[1]).not.toHaveTextContent("Current");
    expect(rows[3]).toHaveTextContent("First value");
    expect(
      screen.getByText("Nothing is overwritten. A new baseline adds a row."),
    ).toBeInTheDocument();
  });

  it("is read-only: the only controls are the disclosure buttons", async () => {
    renderAt("/baseline/history");
    await screen.findByRole("region", { name: "Past baselines" });
    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(4);
    for (const button of buttons) expect(button).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("button", { name: /edit|delete|remove/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("opens the zones of a row, from the FTP in force on that date", async () => {
    renderAt("/baseline/history");
    const buttons = await screen.findAllByRole("button", { name: /Sat 6 Jun 2026/ });
    await userEvent.click(buttons[0] as HTMLElement);
    expect(buttons[0]).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Power zones at 240 W (ranges in W)")).toBeInTheDocument();
    expect(
      screen.getByText(
        "1: up to 132 · 2: 133 to 180 · 3: 181 to 216 · 4: 217 to 252 · 5: 253 to 288 · 6: 289 to 360 · 7: 361 and above",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText(/Heart rate zones from max HR 186/)).toBeInTheDocument();
    await userEvent.click(buttons[0] as HTMLElement);
    expect(screen.queryByText("Power zones at 240 W (ranges in W)")).not.toBeInTheDocument();
  });

  it("carries values forward: a heart-rate-only row still shows the zones of the FTP in force", async () => {
    vi.mocked(api.fetchBaselineEntries).mockResolvedValue([
      makeEntry({ id: "hr", effective_date: "2026-10-20", max_hr: 190 }),
      ...HISTORY,
    ]);
    renderAt("/baseline/history");
    const row = await screen.findByRole("button", { name: /Tue 20 Oct 2026 · max HR 190 bpm/ });
    await userEvent.click(row);
    expect(screen.getByText("Power zones at 250 W (ranges in W)")).toBeInTheDocument();
  });

  it("draws FTP over time with a labelled dot per baseline and a text alternative", async () => {
    renderAt("/baseline/history");
    const chart = await screen.findByRole("img", { name: /FTP over time/ });
    expect(chart).toHaveAccessibleName(
      "FTP over time. 2026-01-10: 215 W, 2026-03-07: 228 W, 2026-06-06: 240 W, 2026-10-11: 250 W",
    );
    const labels = Array.from(chart.querySelectorAll("circle + text")).map((t) => t.textContent);
    expect(labels).toEqual(["215", "228", "240", "250"]);
  });

  it("draws a single baseline as one dot", async () => {
    vi.mocked(api.fetchBaselineEntries).mockResolvedValue([makeEntry({ id: "only", ftp_w: 200 })]);
    renderAt("/baseline/history");
    const chart = await screen.findByRole("img", { name: /FTP over time/ });
    expect(chart.querySelectorAll("circle")).toHaveLength(1);
  });

  it("explains an empty history", async () => {
    vi.mocked(api.fetchBaselineEntries).mockResolvedValue([]);
    renderAt("/baseline/history");
    expect(
      await screen.findByText(
        "No baseline has been saved yet. Set your baseline to start the history.",
      ),
    ).toBeInTheDocument();
  });

  it("shows an error with Try again", async () => {
    vi.mocked(api.fetchBaselineEntries).mockRejectedValue(new Error("offline"));
    renderAt("/baseline/history");
    expect(
      await screen.findByText("Couldn't load your history. Check your connection."),
    ).toBeInTheDocument();
  });
});

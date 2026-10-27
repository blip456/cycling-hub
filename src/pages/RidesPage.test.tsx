import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useLocation } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as importApi from "@/features/import/api";
import * as ridesApi from "@/features/rides/api";
import { makeRide } from "@/features/rides/list/fixtures";
import { mockViewport } from "@/test/match-media";
import { renderWithProviders } from "@/test/render";
import { RidesPage } from "./RidesPage";

vi.mock("@/features/rides/api", async (importOriginal) => {
  const actual = await importOriginal<typeof ridesApi>();
  return { ...actual, fetchRides: vi.fn() };
});
vi.mock("@/features/import/api", async (importOriginal) => {
  const actual = await importOriginal<typeof importApi>();
  return { ...actual, fetchImportHistory: vi.fn() };
});

const RIDES = [
  makeRide({
    id: "r1",
    name: "Sunday Long Ride",
    start_local: "2026-10-11T08:30:00",
    distance_m: 96_000,
    moving_time_s: 11_520,
    elevation_m: 1020,
    average_watts: 214,
    average_heartrate: 141,
  }),
  makeRide({
    id: "r2",
    name: "Evening Ride",
    start_local: "2026-10-08T17:48:00",
    distance_m: 18_600,
    moving_time_s: 2400,
    elevation_m: 84,
    commute: true,
  }),
  makeRide({
    id: "r3",
    name: "Kluisbos loop",
    start_local: "2026-10-04T09:02:00",
    distance_m: 104_200,
    moving_time_s: 12_960,
    elevation_m: 1310,
    sport_type: "MountainBikeRide",
  }),
  makeRide({
    id: "r4",
    name: "Old road ride",
    start_local: "2025-09-28T09:00:00",
    distance_m: 50_000,
    moving_time_s: 6000,
    elevation_m: 400,
  }),
];

function Where() {
  const location = useLocation();
  return <span data-testid="where">{location.pathname + location.search}</span>;
}
const where = () => screen.getByTestId("where").textContent;
/** The desktop count and totals line above the table. */
const countLine = () => document.querySelector("p[aria-live='polite']");

function renderPage(path = "/rides") {
  return renderWithProviders(
    <>
      <RidesPage />
      <Where />
    </>,
    { path },
  );
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(new Date("2026-10-27T12:00:00Z"));
  vi.mocked(ridesApi.fetchRides).mockResolvedValue(RIDES);
  vi.mocked(importApi.fetchImportHistory).mockResolvedValue([]);
});
afterEach(() => {
  vi.useRealTimers();
});

describe("RidesPage on the phone", () => {
  it("shows cards newest first, grouped by week with totals", async () => {
    renderPage();
    const week41 = (await screen.findByRole("heading", { name: "Week 41 · 5–11 Oct" })).closest(
      "section",
    )!;
    expect(within(week41).getByText("2 rides · 114.6 km · 3:52 h")).toBeInTheDocument();
    const names = screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent);
    expect(names).toEqual(["Sunday Long Ride", "Evening Ride", "Kluisbos loop", "Old road ride"]);
    expect(screen.getByRole("heading", { name: "Week 39 · 22–28 Sept 2025" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Sunday Long Ride" })).toHaveAttribute(
      "href",
      "/rides/r1",
    );
    // Tags in the date line, metrics with "—" when missing.
    expect(screen.getByText("Thu 8 Oct · 17:48 · Road · Commute")).toBeInTheDocument();
    expect(screen.getByText("Sun 4 Oct · 09:02 · MTB")).toBeInTheDocument();
    const card = screen.getByRole("link", { name: "Evening Ride" }).closest("article")!;
    expect(within(card).getByText("Avg power").nextSibling).toHaveTextContent("—W");
    // No desktop table or filters on the phone.
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.queryByRole("search")).not.toBeInTheDocument();
  });

  it("switches to months and hides commutes, kept in the URL", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime.bind(vi) });
    renderPage();
    await screen.findByRole("heading", { name: "Week 41 · 5–11 Oct" });

    await user.click(screen.getByRole("radio", { name: "Month" }));
    const october = screen.getByRole("heading", { name: "October 2026" }).closest("section")!;
    expect(within(october).getByText("3 rides · 218.8 km · 7:28 h")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "September 2025" })).toBeInTheDocument();
    expect(where()).toBe("/rides?view=month");

    await user.click(screen.getByRole("checkbox", { name: "Hide commutes" }));
    expect(screen.queryByText("Evening Ride")).not.toBeInTheDocument();
    expect(within(october).getByText("2 rides · 200.2 km · 6:48 h")).toBeInTheDocument();
    expect(where()).toBe("/rides?view=month&commutes=hide");
  });

  it("restores the view from the URL", async () => {
    renderPage("/rides?view=month&commutes=hide");
    expect(await screen.findByRole("heading", { name: "October 2026" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Month" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Hide commutes" })).toBeChecked();
    expect(screen.queryByText("Evening Ride")).not.toBeInTheDocument();
  });

  it("shows skeletons while loading", () => {
    vi.mocked(ridesApi.fetchRides).mockReturnValue(new Promise(() => undefined));
    renderPage();
    expect(screen.getByRole("status")).toHaveTextContent("Loading rides");
  });

  it("shows the empty state with a link to Import", async () => {
    vi.mocked(ridesApi.fetchRides).mockResolvedValue([]);
    renderPage();
    expect(await screen.findByRole("heading", { name: "No rides yet" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Import rides" })).toHaveAttribute("href", "/import");
    expect(screen.queryByRole("radiogroup")).not.toBeInTheDocument();
  });

  it("shows an error card with Try again", async () => {
    vi.mocked(ridesApi.fetchRides).mockRejectedValueOnce(new Error("offline"));
    renderPage();
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Couldn’t load your rides. Check your connection.");
    expect(screen.getByText("Your rides appear here once they load.")).toBeInTheDocument();
    fireEvent.click(within(alert).getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Sunday Long Ride")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });
  });
});

describe("RidesPage on desktop", () => {
  let viewport: ReturnType<typeof mockViewport>;
  beforeEach(() => {
    viewport = mockViewport(1280);
  });
  afterEach(() => {
    viewport.restore();
  });

  const rowNames = () =>
    within(screen.getByRole("table"))
      .getAllByRole("link")
      .map((a) => a.textContent);
  const header = (name: RegExp) => screen.getByRole("button", { name }).closest("th")!;

  it("shows the table by week with group rows, sorted by date", async () => {
    renderPage();
    const table = await screen.findByRole("table", { name: "Rides, newest first" });
    expect(within(table).getByText("Week 41")).toBeInTheDocument();
    expect(within(table).getByText("2 rides · 114.6 km · 3:52 h")).toBeInTheDocument();
    expect(rowNames()).toEqual([
      "Sunday Long Ride",
      "Evening Ride",
      "Kluisbos loop",
      "Old road ride",
    ]);
    expect(header(/^Date/)).toHaveAttribute("aria-sort", "descending");
    expect(header(/^Distance/)).not.toHaveAttribute("aria-sort");
    // Road is left out of the table's date line (X1).
    expect(within(table).getByText("Thu 8 Oct · 17:48 · Commute")).toBeInTheDocument();
    expect(screen.getByText("4 rides")).toBeInTheDocument();
  });

  it("sorts by any column both ways in a flat list with a count line", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime.bind(vi) });
    renderPage();
    await screen.findByRole("table");

    await user.click(screen.getByRole("button", { name: /^Distance/ }));
    expect(rowNames()).toEqual([
      "Kluisbos loop",
      "Sunday Long Ride",
      "Old road ride",
      "Evening Ride",
    ]);
    expect(header(/^Distance/)).toHaveAttribute("aria-sort", "descending");
    expect(screen.queryByText("Week 41")).not.toBeInTheDocument();
    expect(screen.queryByRole("radiogroup", { name: "Group rides by" })).not.toBeInTheDocument();
    expect(countLine()).toHaveTextContent("4 rides · 268.8 km · 9:08 h");
    expect(where()).toBe("/rides?sort=distance");

    await user.click(screen.getByRole("button", { name: /^Distance/ }));
    expect(rowNames()).toEqual([
      "Evening Ride",
      "Old road ride",
      "Sunday Long Ride",
      "Kluisbos loop",
    ]);
    expect(header(/^Distance/)).toHaveAttribute("aria-sort", "ascending");
    expect(where()).toBe("/rides?sort=distance&dir=asc");

    await user.click(screen.getByRole("button", { name: /^Name/ }));
    expect(rowNames()).toEqual([
      "Evening Ride",
      "Kluisbos loop",
      "Old road ride",
      "Sunday Long Ride",
    ]);

    await user.click(screen.getByRole("button", { name: /^Avg power/ }));
    expect(rowNames()[0]).toBe("Sunday Long Ride");

    await user.click(screen.getByRole("button", { name: /^Date/ }));
    expect(screen.getByRole("radiogroup", { name: "Group rides by" })).toBeInTheDocument();
    expect(where()).toBe("/rides");
  });

  it("filters by type, period, name and hide commutes, and clears them", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime.bind(vi) });
    renderPage();
    await screen.findByRole("table");
    const bar = screen.getByRole("search", { name: "Filter rides" });
    expect(within(bar).queryByRole("button", { name: "Clear filters" })).not.toBeInTheDocument();

    await user.selectOptions(within(bar).getByLabelText("Type"), "mtb");
    expect(rowNames()).toEqual(["Kluisbos loop"]);
    expect(countLine()).toHaveTextContent("1 ride · 104.2 km · 3:36 h");

    await user.selectOptions(within(bar).getByLabelText("Type"), "all");
    await user.selectOptions(within(bar).getByLabelText("Period"), "2025");
    expect(rowNames()).toEqual(["Old road ride"]);

    await user.selectOptions(within(bar).getByLabelText("Period"), "custom");
    fireEvent.change(within(bar).getByLabelText("From"), { target: { value: "2026-10-05" } });
    expect(rowNames()).toEqual(["Sunday Long Ride", "Evening Ride"]);

    await user.click(within(bar).getByRole("checkbox", { name: "Hide commutes" }));
    expect(rowNames()).toEqual(["Sunday Long Ride"]);

    await user.click(within(bar).getByRole("button", { name: "Clear filters" }));
    expect(rowNames()).toHaveLength(4);
    expect(where()).toBe("/rides");

    await user.type(within(bar).getByLabelText("Search by name"), "kluis");
    expect(rowNames()).toHaveLength(4); // waits for a pause in typing
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(rowNames()).toEqual(["Kluisbos loop"]);
    expect(where()).toBe("/rides?q=kluis");

    await user.clear(within(bar).getByLabelText("Search by name"));
    await user.type(within(bar).getByLabelText("Search by name"), "nothing");
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(screen.getByText("No rides match these filters.")).toBeInTheDocument();
    await user.click(
      within(screen.getByText("No rides match these filters.").parentElement!).getByRole("button", {
        name: "Clear filters",
      }),
    );
    expect(within(bar).getByLabelText("Search by name")).toHaveValue("");
    expect(rowNames()).toHaveLength(4);
  });

  it("restores sort and filters from the URL", async () => {
    renderPage("/rides?sort=name&dir=desc&type=road&q=ride");
    await screen.findByRole("table");
    expect(rowNames()).toEqual(["Sunday Long Ride", "Old road ride", "Evening Ride"]);
    expect(screen.getByLabelText("Search by name")).toHaveValue("ride");
    expect(screen.getByLabelText("Type")).toHaveValue("road");
    expect(header(/^Name/)).toHaveAttribute("aria-sort", "descending");
  });
});

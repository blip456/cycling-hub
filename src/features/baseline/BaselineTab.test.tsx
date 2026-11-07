import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/render";
import * as api from "./api";
import { BaselinePage } from "./BaselinePage";
import { HISTORY, makeSourceRide, makeWeek, rideFile, VIEW } from "./fixtures";

vi.mock("./api", async (importOriginal) => {
  const actual = await importOriginal<typeof api>();
  return {
    ...actual,
    fetchCurrentBaseline: vi.fn(),
    fetchBaselineEntries: vi.fn(),
    fetchPowerRides: vi.fn(),
    fetchHeartRateRides: vi.fn(),
    fetchActiveTestWeek: vi.fn(),
    downloadRideStreams: vi.fn(),
  };
});

function renderTab(path = "/baseline") {
  return renderWithProviders(
    <Routes>
      <Route path="/baseline/*" element={<BaselinePage />} />
    </Routes>,
    { path },
  );
}

beforeEach(() => {
  vi.mocked(api.fetchActiveTestWeek).mockResolvedValue(null);
  vi.mocked(api.fetchPowerRides).mockResolvedValue([makeSourceRide()]);
  vi.mocked(api.fetchHeartRateRides).mockResolvedValue([]);
});

describe("Baseline tab", () => {
  it("shows a loading state first", () => {
    vi.mocked(api.fetchCurrentBaseline).mockReturnValue(new Promise(() => undefined));
    vi.mocked(api.fetchBaselineEntries).mockReturnValue(new Promise(() => undefined));
    renderTab();
    expect(screen.getByRole("status")).toHaveTextContent("Loading your baseline");
  });

  it("shows FTP and heart rate with source and date, and a missing value as Not set", async () => {
    vi.mocked(api.fetchCurrentBaseline).mockResolvedValue(VIEW);
    vi.mocked(api.fetchBaselineEntries).mockResolvedValue(HISTORY);
    renderTab();
    const ftp = await screen.findByRole("region", { name: "Functional threshold power (FTP)" });
    expect(ftp).toHaveTextContent("250");
    expect(ftp).toHaveTextContent("Ride estimate · effective Sun 11 Oct 2026");
    expect(within(ftp).getByRole("link", { name: "Open the source ride" })).toHaveAttribute(
      "href",
      "/rides/ride-1",
    );
    const hr = screen.getByRole("region", { name: "Heart rate" });
    expect(hr).toHaveTextContent("Max heart rate");
    expect(hr).toHaveTextContent("186");
    expect(hr).toHaveTextContent("Test, 20-minute · effective Sat 6 Jun 2026");
    expect(hr).toHaveTextContent("Not set");
    expect(screen.getByRole("link", { name: "Update baseline" })).toHaveAttribute(
      "href",
      "/baseline/update",
    );
  });

  it("offers to plan a test week when none is planned and shows the next session when one is", async () => {
    vi.mocked(api.fetchCurrentBaseline).mockResolvedValue(VIEW);
    vi.mocked(api.fetchBaselineEntries).mockResolvedValue(HISTORY);
    const planned = renderTab();
    expect(await screen.findByRole("link", { name: "Plan a test week" })).toBeInTheDocument();
    expect(await screen.findByText(/Not planned/)).toBeInTheDocument();
    planned.unmount();

    vi.mocked(api.fetchActiveTestWeek).mockResolvedValue(
      makeWeek("20min", [{ scheduled_on: "2026-10-30" }, { scheduled_on: "2026-10-31" }, {}]),
    );
    renderTab();
    expect(await screen.findByText(/Next: Opener ride, Fri 30 Oct/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open the session" })).toHaveAttribute(
      "href",
      "/baseline/test-week/1",
    );
  });

  it("shows an error with Try again when the baseline cannot be loaded", async () => {
    vi.mocked(api.fetchCurrentBaseline).mockRejectedValue(new Error("offline"));
    vi.mocked(api.fetchBaselineEntries).mockResolvedValue([]);
    renderTab();
    expect(
      await screen.findByText("Couldn't load your baseline. Check your connection."),
    ).toBeInTheDocument();
    vi.mocked(api.fetchCurrentBaseline).mockResolvedValue(VIEW);
    vi.mocked(api.fetchBaselineEntries).mockResolvedValue(HISTORY);
    await userEvent.click(screen.getAllByRole("button", { name: "Try again" })[0] as HTMLElement);
    expect(await screen.findByRole("link", { name: "Update baseline" })).toBeInTheDocument();
  });
});

describe("Empty state (Z9)", () => {
  beforeEach(() => {
    vi.mocked(api.fetchCurrentBaseline).mockResolvedValue(null);
    vi.mocked(api.fetchBaselineEntries).mockResolvedValue([]);
  });

  it("puts the manual route first when no ride has power data", async () => {
    vi.mocked(api.fetchPowerRides).mockResolvedValue([]);
    renderTab();
    expect(await screen.findByRole("heading", { name: "No power data yet" })).toBeInTheDocument();
    const links = screen.getAllByRole("link").map((a) => a.textContent);
    expect(links.indexOf("Enter values by hand")).toBeLessThan(
      links.indexOf("Plan a guided test week"),
    );
    expect(screen.getByRole("link", { name: "Enter values by hand" })).toHaveAttribute(
      "href",
      "/baseline/values",
    );
    expect(screen.queryByRole("link", { name: "Suggest from my rides" })).not.toBeInTheDocument();
  });

  it("offers the highest heart rate found in the rides as a suggestion, not a saved value", async () => {
    vi.mocked(api.fetchPowerRides).mockResolvedValue([]);
    vi.mocked(api.fetchHeartRateRides).mockResolvedValue([
      makeSourceRide({ id: "hr-ride", strava_id: 5, start_local: "2026-09-12T10:00:00" }),
    ]);
    vi.mocked(api.downloadRideStreams).mockResolvedValue(rideFile(60, null, 191));
    renderTab();
    expect(await screen.findByText(/Highest value: 191 bpm, Sat 12 Sep 2026/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Use as max heart rate" })).toHaveAttribute(
      "href",
      "/baseline/values",
    );
  });

  it("offers a suggestion from the rides first when they have power data", async () => {
    renderTab();
    expect(await screen.findByRole("heading", { name: "No baseline yet" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Suggest from my rides" })).toHaveAttribute(
      "href",
      "/baseline/suggestion",
    );
    expect(screen.getByRole("link", { name: "Enter values by hand" })).toBeInTheDocument();
  });
});

describe("Update baseline (Z1b)", () => {
  it("lists the three ways, each as one link", async () => {
    renderTab("/baseline/update");
    expect(await screen.findByRole("link", { name: /Suggest from my rides/ })).toHaveAttribute(
      "href",
      "/baseline/suggestion",
    );
    expect(screen.getByRole("link", { name: /Enter values/ })).toHaveAttribute(
      "href",
      "/baseline/values",
    );
    expect(screen.getByRole("link", { name: /Do a guided test week/ })).toHaveAttribute(
      "href",
      "/baseline/test-week",
    );
    expect(screen.queryByRole("navigation", { name: "Baseline" })).not.toBeInTheDocument();
  });

  it("disables the suggestion with a reason when no ride has power data", async () => {
    vi.mocked(api.fetchPowerRides).mockResolvedValue([]);
    renderTab("/baseline/update");
    expect(await screen.findByText(/No rides with power data yet/)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Suggest from my rides/ })).not.toBeInTheDocument();
  });
});

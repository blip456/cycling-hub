import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes, useLocation } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { brusselsDate } from "@/features/athlete";
import { renderWithProviders } from "@/test/render";
import * as api from "./api";
import { BaselinePage } from "./BaselinePage";
import { HISTORY, makeSourceRide, rideFile, VIEW } from "./fixtures";

vi.mock("./api", async (importOriginal) => {
  const actual = await importOriginal<typeof api>();
  return {
    ...actual,
    fetchCurrentBaseline: vi.fn(),
    fetchBaselineEntries: vi.fn(),
    fetchPowerRides: vi.fn(),
    downloadRideStreams: vi.fn(),
    addBaselineEntry: vi.fn(),
  };
});

function Where() {
  const location = useLocation();
  return (
    <p data-testid="where">
      {location.pathname}
      {location.search} {JSON.stringify(location.state)}
    </p>
  );
}

function renderSuggestion() {
  return renderWithProviders(
    <>
      <Routes>
        <Route path="/baseline/*" element={<BaselinePage />} />
      </Routes>
      <Where />
    </>,
    { path: "/baseline/suggestion" },
  );
}

const RIDES = [
  makeSourceRide({ id: "ride-0", strava_id: 100, start_local: "2026-10-27T18:00:00" }),
  makeSourceRide({ id: "ride-1", strava_id: 101, start_local: "2026-10-25T08:30:00" }),
  makeSourceRide({
    id: "ride-2",
    strava_id: 102,
    start_local: "2026-05-04T09:00:00",
    name: "Old ride",
  }),
];

beforeEach(() => {
  vi.mocked(api.fetchCurrentBaseline).mockResolvedValue(VIEW);
  vi.mocked(api.fetchBaselineEntries).mockResolvedValue(HISTORY);
  vi.mocked(api.fetchPowerRides).mockResolvedValue(RIDES);
  vi.mocked(api.addBaselineEntry).mockResolvedValue(undefined);
  vi.mocked(api.downloadRideStreams).mockImplementation(async ({ stravaId }) =>
    stravaId === 101 ? rideFile(1500, 280) : rideFile(1500, 200),
  );
});

describe("FTP suggestion (Z2)", () => {
  it("shows the estimate, labelled as one, with the maths and a link to the source ride", async () => {
    renderSuggestion();
    expect(await screen.findByText("This is an estimate, not a test result.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Suggested FTP" }).parentElement).toHaveTextContent(
      "266",
    );
    expect(screen.getByText("Best 20-minute power")).toBeInTheDocument();
    expect(screen.getByText("280 W")).toBeInTheDocument();
    expect(screen.getByText("95 %")).toBeInTheDocument();
    expect(
      await screen.findByText(/Current FTP is 250 W, so this is 16 W higher/),
    ).toBeInTheDocument();
    expect(screen.getByText("Sun 25 Oct 2026 · 08:30")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Open ride/ })).toHaveAttribute(
      "href",
      "/rides/ride-1",
    );
    expect(
      screen.getByText("Looked at 3 rides with power data, 4 May 2026 to 27 Oct 2026."),
    ).toBeInTheDocument();
  });

  it("saves nothing until Confirm, then adds one row dated today and goes back with a message", async () => {
    renderSuggestion();
    await screen.findByText("This is an estimate, not a test result.");
    expect(api.addBaselineEntry).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Use 266 W as my FTP" }));
    await waitFor(() => {
      expect(api.addBaselineEntry).toHaveBeenCalledTimes(1);
    });
    expect(vi.mocked(api.addBaselineEntry).mock.calls[0]?.[0]).toMatchObject({
      effectiveDate: brusselsDate(),
      ftp: 266,
      maxHr: null,
      lthr: null,
      source: "stream_estimate",
      sourceActivityId: "ride-1",
    });
    await waitFor(() => {
      expect(screen.getByTestId("where")).toHaveTextContent(
        '/baseline {"flash":"Baseline updated: FTP 266 W. Zones are recalculated."}',
      );
    });
  });

  it("does not read the ride files again when the baseline is saved", async () => {
    renderSuggestion();
    await screen.findByText("This is an estimate, not a test result.");
    const reads = vi.mocked(api.downloadRideStreams).mock.calls.length;
    expect(reads).toBeGreaterThan(0);
    await userEvent.click(screen.getByRole("button", { name: "Use 266 W as my FTP" }));
    await waitFor(() => {
      expect(screen.getByTestId("where")).toHaveTextContent("/baseline");
    });
    expect(screen.queryByText("Reading your rides…")).not.toBeInTheDocument();
    expect(vi.mocked(api.downloadRideStreams).mock.calls).toHaveLength(reads);
  });

  it("lets the date change, but not to the future", async () => {
    renderSuggestion();
    await screen.findByText("This is an estimate, not a test result.");
    await userEvent.click(screen.getByRole("button", { name: "Change the effective date" }));
    const field = screen.getByLabelText("Effective from");
    await userEvent.clear(field);
    await userEvent.type(field, "2999-01-01");
    expect(screen.getByText("The date cannot be in the future.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Use 266 W as my FTP" }));
    expect(api.addBaselineEntry).not.toHaveBeenCalled();
  });

  it("goes to manual entry from Enter a value instead", async () => {
    renderSuggestion();
    await screen.findByText("This is an estimate, not a test result.");
    expect(screen.getByRole("link", { name: "Enter a value instead" })).toHaveAttribute(
      "href",
      "/baseline/values",
    );
  });

  it("keeps the baseline and shows an error when saving fails", async () => {
    vi.mocked(api.addBaselineEntry).mockRejectedValue(new Error("offline"));
    renderSuggestion();
    await screen.findByText("This is an estimate, not a test result.");
    await userEvent.click(screen.getByRole("button", { name: "Use 266 W as my FTP" }));
    expect(
      await screen.findByText("Couldn't save your baseline. Nothing was changed. Try again."),
    ).toBeInTheDocument();
    expect(screen.getByTestId("where")).toHaveTextContent("/baseline/suggestion");
  });

  it("suggests from the rest when some files fail, with the count, and can try again", async () => {
    vi.mocked(api.downloadRideStreams).mockImplementation(async ({ stravaId }) => {
      if (stravaId === 100) throw new Error("network");
      return stravaId === 101 ? rideFile(1500, 280) : rideFile(1500, 200);
    });
    renderSuggestion();
    expect(
      await screen.findByText(/Based on 2 of 3 rides with power data.*1 could not be read\./),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Use 266 W as my FTP" })).toBeInTheDocument();
    vi.mocked(api.downloadRideStreams).mockImplementation(async ({ stravaId }) =>
      stravaId === 101 ? rideFile(1500, 280) : rideFile(1500, 200),
    );
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText(/Looked at 3 rides with power data/)).toBeInTheDocument();
  });

  it("says so when no ride has 20 minutes of power", async () => {
    vi.mocked(api.downloadRideStreams).mockResolvedValue(rideFile(600, 300));
    renderSuggestion();
    expect(await screen.findByRole("heading", { name: "No FTP to suggest" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Enter values by hand" })).toBeInTheDocument();
  });

  it("says so when no ride has power data", async () => {
    vi.mocked(api.fetchPowerRides).mockResolvedValue([]);
    renderSuggestion();
    expect(
      await screen.findByRole("heading", { name: "No rides with power data yet" }),
    ).toBeInTheDocument();
  });
});

describe("Reading the rides (Z10)", () => {
  it("shows the progress with a number and a way out", async () => {
    let release: () => void = () => undefined;
    vi.mocked(api.downloadRideStreams).mockImplementation(async ({ stravaId }) => {
      if (stravaId === 100) return rideFile(10, 100);
      await new Promise<void>((resolve) => {
        release = resolve;
      });
      return null;
    });
    renderSuggestion();
    expect(await screen.findByRole("heading", { name: "Reading your rides…" })).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByRole("status", { name: "" })).toHaveTextContent(
        "1 of 3 rides with power data. The ride files are read on this device.",
      );
    });
    const bar = screen.getByRole("progressbar", { name: "Reading ride files" });
    expect(bar).toHaveAttribute("aria-valuenow", "1");
    expect(bar).toHaveAttribute("aria-valuemax", "3");
    release();
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByTestId("where")).toHaveTextContent("/baseline/update");
    expect(api.addBaselineEntry).not.toHaveBeenCalled();
  });

  it("says nothing changed and keeps the manual route when no file can be read", async () => {
    vi.mocked(api.downloadRideStreams).mockRejectedValue(new Error("network"));
    renderSuggestion();
    expect(
      await screen.findByRole("heading", { name: "We could not finish reading your rides" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Your baseline was not changed.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Enter a value instead" })).toBeInTheDocument();
    vi.mocked(api.downloadRideStreams).mockResolvedValue(rideFile(1500, 280));
    await userEvent.click(screen.getAllByRole("button", { name: "Try again" })[0] as HTMLElement);
    expect(await screen.findByText("This is an estimate, not a test result.")).toBeInTheDocument();
  });
});

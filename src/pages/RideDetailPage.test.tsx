import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "@/features/rides/api";
import type { Ride } from "@/features/rides/api";
import { UNDO_MS } from "@/features/rides/detail/use-ride-deleted-card";
import { useRides } from "@/features/rides/hooks";
import { mockViewport } from "@/test/match-media";
import { renderWithProviders } from "@/test/render";
import { RideDetailPage } from "./RideDetailPage";

vi.mock("@/features/rides/api", async (importOriginal) => {
  const actual = await importOriginal<typeof api>();
  return {
    ...actual,
    fetchRides: vi.fn(),
    fetchRide: vi.fn(),
    deleteRide: vi.fn(),
    restoreRide: vi.fn(),
  };
});

const ID = "6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b";

function ride(overrides: Partial<Ride> = {}): Ride {
  return {
    id: ID,
    strava_id: 20584280211,
    name: "Sunday Long Ride",
    sport_type: "Ride",
    start_local: "2026-10-11T08:30:00",
    start_at: "2026-10-11T06:30:00Z",
    distance_m: 96000,
    moving_time_s: 11520,
    elevation_m: 1020,
    commute: false,
    trainer: false,
    average_watts: null,
    max_watts: null,
    average_heartrate: null,
    max_heartrate: null,
    average_cadence: null,
    polyline: "_p~iF~ps|U_ulLnnqC_mqNvxq`@",
    ...overrides,
  };
}

/** A stand-in for the ride list: shows the names from useRides. */
function RideList() {
  const rides = useRides();
  return (
    <ul aria-label="Rides">
      {rides.data?.map((r) => (
        <li key={r.id}>{r.name}</li>
      ))}
    </ul>
  );
}

function renderDetail(path = `/rides/${ID}`) {
  return renderWithProviders(
    <Routes>
      <Route path="/rides" element={<RideList />} />
      <Route path="/rides/:id" element={<RideDetailPage />} />
    </Routes>,
    { path },
  );
}

beforeEach(() => {
  vi.mocked(api.fetchRide).mockResolvedValue(ride());
  vi.mocked(api.fetchRides).mockResolvedValue([ride()]);
  vi.mocked(api.deleteRide).mockResolvedValue(undefined);
  vi.mocked(api.restoreRide).mockResolvedValue(undefined);
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("ride detail states", () => {
  it("shows Loading… first", () => {
    vi.mocked(api.fetchRide).mockReturnValue(new Promise(() => undefined));
    renderDetail();
    expect(screen.getByRole("status")).toHaveTextContent("Loading…");
  });

  it("shows the ride: name, date line, metrics, route and the Strava link", async () => {
    vi.mocked(api.fetchRide).mockResolvedValue(
      ride({ average_watts: 214, average_heartrate: 141, max_watts: 690, commute: true }),
    );
    renderDetail();
    expect(await screen.findByRole("heading", { name: "Sunday Long Ride" })).toBeInTheDocument();
    expect(screen.getByText("Sun 11 Oct 2026 · 08:30 · Road · Commute")).toBeInTheDocument();
    expect(screen.getByText("96.0")).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: "Route shape of Sunday Long Ride" }),
    ).toBeInTheDocument();

    const tile = (label: string) => screen.getByText(label, { selector: "dt" }).nextElementSibling;
    expect(tile("Moving time")).toHaveTextContent("3:12h");
    expect(tile("Avg speed")).toHaveTextContent("30.0km/h");
    expect(tile("Avg power")).toHaveTextContent("214W");
    expect(tile("Avg power")).toHaveClass("text-m-power");
    expect(tile("Avg heart rate")).toHaveTextContent("141bpm");
    expect(tile("Elevation")).toHaveTextContent("1,020m");
    expect(tile("Max power")).toHaveTextContent("690W");
    // Not in the export: "—", read out as such.
    expect(tile("Max heart rate")).toHaveTextContent("—");
    expect(tile("Max heart rate")).toHaveTextContent("Not in the export");
    expect(tile("Avg cadence")).toHaveTextContent("—");
    expect(tile("Commute")).toHaveTextContent("Yes");

    const strava = screen.getByRole("link", { name: /Open in Strava/ });
    expect(strava).toHaveAttribute("href", "https://www.strava.com/activities/20584280211");
    expect(strava).toHaveAttribute("target", "_blank");
    expect(strava).toHaveAttribute("rel", expect.stringContaining("noopener"));
  });

  it("says when a ride has no route shape", async () => {
    vi.mocked(api.fetchRide).mockResolvedValue(ride({ polyline: null, trainer: true }));
    renderDetail();
    expect(await screen.findByText("No route shape for this ride.")).toBeInTheDocument();
  });

  it("shows the desktop layout with Back to rides in the header", async () => {
    const viewport = mockViewport(1280);
    try {
      renderDetail();
      expect(await screen.findByRole("link", { name: "Back to rides" })).toHaveAttribute(
        "href",
        "/rides",
      );
      expect(screen.getByText("Distance")).toBeInTheDocument();
    } finally {
      viewport.restore();
    }
  });

  it("shows a friendly empty state for a ride that is not there (or was deleted)", async () => {
    vi.mocked(api.fetchRide).mockResolvedValue(null);
    renderDetail();
    expect(await screen.findByText(/This ride was not found/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to rides" })).toHaveAttribute("href", "/rides");
  });

  it("does not ask the server for an id that cannot be a ride", () => {
    renderDetail("/rides/not-a-ride");
    expect(screen.getByText(/This ride was not found/)).toBeInTheDocument();
    expect(api.fetchRide).not.toHaveBeenCalled();
  });

  it("shows an error status card with Try again", async () => {
    vi.mocked(api.fetchRide).mockRejectedValueOnce(new Error("offline"));
    renderDetail();
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Couldn't load this ride.");
    await userEvent.click(within(alert).getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("heading", { name: "Sunday Long Ride" })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

describe("delete with undo", () => {
  it("cancels with Cancel or Escape and gives the focus back to Delete ride", async () => {
    const user = userEvent.setup();
    renderDetail();
    const remove = await screen.findByRole("button", { name: "Delete ride" });
    await user.click(remove);
    const dialog = screen.getByRole("dialog", { name: "Delete this ride?" });
    expect(dialog).toHaveAccessibleDescription(/skipped on later imports/);
    expect(within(dialog).getByRole("button", { name: "Cancel" })).toHaveFocus();
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(remove).toHaveFocus();
    expect(api.deleteRide).not.toHaveBeenCalled();
  });

  it("deletes at once, goes back to the list and offers Undo, which restores the ride", async () => {
    const user = userEvent.setup();
    const { queryClient } = renderDetail();
    await user.click(await screen.findByRole("button", { name: "Delete ride" }));
    // The list is cached: the ride leaves it before the server answers.
    queryClient.setQueryData(["rides", "list"], [ride()]);
    vi.mocked(api.fetchRides).mockResolvedValue([]);
    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Delete ride" }));

    expect(vi.mocked(api.deleteRide).mock.calls[0]?.[0]).toBe(ID);
    const list = await screen.findByRole("list", { name: "Rides" });
    await waitFor(() => {
      expect(within(list).queryByText("Sunday Long Ride")).not.toBeInTheDocument();
    });
    const card = screen.getByRole("status");
    expect(card).toHaveTextContent("Ride deleted.");

    vi.mocked(api.fetchRides).mockResolvedValue([ride()]);
    await user.click(within(card).getByRole("button", { name: "Undo" }));
    expect(api.restoreRide).toHaveBeenCalledWith(ID);
    expect(await within(list).findByText("Sunday Long Ride")).toBeInTheDocument();
    expect(await screen.findByRole("status")).toHaveTextContent("Ride restored.");
  });

  it("hides the Undo after a few seconds", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: (ms) => vi.advanceTimersByTime(ms) });
    renderDetail();
    await user.click(await screen.findByRole("button", { name: "Delete ride" }));
    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Delete ride" }),
    );
    expect(await screen.findByText("Ride deleted.")).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(UNDO_MS + 100);
    });
    expect(screen.queryByText("Ride deleted.")).not.toBeInTheDocument();
    expect(api.restoreRide).not.toHaveBeenCalled();
  });

  it("brings the ride back and says so when the delete fails", async () => {
    vi.mocked(api.deleteRide).mockRejectedValueOnce(new Error("offline"));
    const user = userEvent.setup();
    renderDetail();
    await user.click(await screen.findByRole("button", { name: "Delete ride" }));
    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Delete ride" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Couldn't delete Sunday Long Ride. It is back in your rides.",
    );
  });
});

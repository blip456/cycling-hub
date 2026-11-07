import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes, useLocation } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { brusselsDate } from "@/features/athlete";
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
    fetchActiveTestWeek: vi.fn(),
    createTestWeek: vi.fn(),
    updateTestSession: vi.fn(),
    setTestWeekStatus: vi.fn(),
    fetchPowerRideOnDay: vi.fn(),
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

function renderAt(path: string) {
  return renderWithProviders(
    <>
      <Routes>
        <Route path="/baseline/*" element={<BaselinePage />} />
      </Routes>
      <Where />
    </>,
    { path },
  );
}

const TODAY = brusselsDate() ?? "";

beforeEach(() => {
  window.localStorage.clear();
  vi.mocked(api.fetchCurrentBaseline).mockResolvedValue(VIEW);
  vi.mocked(api.fetchBaselineEntries).mockResolvedValue(HISTORY);
  vi.mocked(api.fetchActiveTestWeek).mockResolvedValue(null);
  vi.mocked(api.createTestWeek).mockResolvedValue("week-1");
  vi.mocked(api.updateTestSession).mockResolvedValue(undefined);
  vi.mocked(api.setTestWeekStatus).mockResolvedValue(undefined);
  vi.mocked(api.addBaselineEntry).mockResolvedValue(undefined);
  vi.mocked(api.fetchPowerRideOnDay).mockResolvedValue(null);
});

describe("Guided test week (Z4b)", () => {
  it("offers both protocols and lists three sessions for the 20-minute test", async () => {
    renderAt("/baseline/test-week");
    const group = await screen.findByRole("group", { name: "Test protocol" });
    expect(within(group).getByRole("radio", { name: /20-minute test/ })).toBeChecked();
    expect(within(group).getByRole("radio", { name: /Ramp test/ })).not.toBeChecked();
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
    expect(screen.getByLabelText("Date for session 2, FTP test")).toHaveValue("");
    expect(screen.getAllByText("Not planned")).toHaveLength(3);
  });

  it("switches to two sessions for the ramp test", async () => {
    renderAt("/baseline/test-week");
    await userEvent.click(await screen.findByRole("radio", { name: /Ramp test/ }));
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getByLabelText("Date for session 2, Ramp test")).toBeInTheDocument();
  });

  it("warns, without blocking, about a past date, the same day and the wrong order", async () => {
    renderAt("/baseline/test-week");
    const opener = await screen.findByLabelText("Date for session 1, Opener ride");
    await userEvent.type(opener, "2020-01-02");
    expect(opener).toHaveAccessibleDescription("Check: This date is in the past.");
    const test = screen.getByLabelText("Date for session 2, FTP test");
    await userEvent.type(test, "2020-01-02");
    expect(test).toHaveAccessibleDescription(/same day as the opener/);
    await userEvent.clear(test);
    await userEvent.type(test, "2019-12-30");
    expect(test).toHaveAccessibleDescription(/before session 1/);
    expect(screen.getByRole("button", { name: "Save test week" })).toBeEnabled();
  });

  it("saves the week with the sessions in order and the chosen dates, and lets the PO leave dates empty", async () => {
    renderAt("/baseline/test-week");
    await userEvent.type(
      await screen.findByLabelText("Date for session 2, FTP test"),
      "2027-03-06",
    );
    await userEvent.click(screen.getByRole("button", { name: "Save test week" }));
    await waitFor(() => {
      expect(api.createTestWeek).toHaveBeenCalledTimes(1);
    });
    expect(vi.mocked(api.createTestWeek).mock.calls[0]?.[0]).toEqual({
      protocol: "20min",
      sessions: [
        { position: 1, kind: "opener", scheduledOn: null },
        { position: 2, kind: "test", scheduledOn: "2027-03-06" },
        { position: 3, kind: "recovery", scheduledOn: null },
      ],
    });
  });

  it("saves the ramp protocol with two sessions", async () => {
    renderAt("/baseline/test-week");
    await userEvent.click(await screen.findByRole("radio", { name: /Ramp test/ }));
    await userEvent.click(screen.getByRole("button", { name: "Save test week" }));
    await waitFor(() => {
      expect(api.createTestWeek).toHaveBeenCalled();
    });
    expect(vi.mocked(api.createTestWeek).mock.calls[0]?.[0]).toMatchObject({
      protocol: "ramp",
      sessions: [
        { position: 1, kind: "opener" },
        { position: 2, kind: "test" },
      ],
    });
  });

  it("says so when the week cannot be saved", async () => {
    vi.mocked(api.createTestWeek).mockRejectedValue(new Error("offline"));
    renderAt("/baseline/test-week");
    await userEvent.click(await screen.findByRole("button", { name: "Save test week" }));
    expect(
      await screen.findByText("Couldn't save the test week. Nothing was changed. Try again."),
    ).toBeInTheDocument();
  });

  it("shows the saved week as a progress list with text status", async () => {
    vi.mocked(api.fetchActiveTestWeek).mockResolvedValue(
      makeWeek("20min", [
        { scheduled_on: "2026-10-30", completed_at: "2026-10-30T18:00:00Z" },
        { scheduled_on: "2026-10-31" },
        {},
      ]),
    );
    renderAt("/baseline/test-week");
    expect(await screen.findByText("Done")).toBeInTheDocument();
    expect(screen.getByText("Planned Sat 31 Oct")).toBeInTheDocument();
    expect(screen.getByText("Not planned")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Open session 2, FTP test/ })).toHaveAttribute(
      "href",
      "/baseline/test-week/2",
    );
  });

  it("changes a date and cancels the week", async () => {
    vi.mocked(api.fetchActiveTestWeek).mockResolvedValue(makeWeek("20min"));
    renderAt("/baseline/test-week");
    await userEvent.type(
      await screen.findByLabelText("Date for session 3, Recovery ride"),
      "2027-03-07",
    );
    await waitFor(() => {
      expect(api.updateTestSession).toHaveBeenCalledWith("session-3", {
        scheduled_on: "2027-03-07",
      });
    });
    await userEvent.click(screen.getByRole("button", { name: "Cancel this test week" }));
    await waitFor(() => {
      expect(api.setTestWeekStatus).toHaveBeenCalledWith("week-1", "cancelled");
    });
  });
});

describe("Test session (Z5)", () => {
  const week = () =>
    makeWeek("20min", [{ scheduled_on: "2026-10-30" }, { scheduled_on: "2026-10-31" }, {}]);

  it("shows the date, status, steps with targets from the current FTP and the checklist", async () => {
    vi.mocked(api.fetchActiveTestWeek).mockResolvedValue(week());
    renderAt("/baseline/test-week/2");
    expect(await screen.findByRole("heading", { name: "FTP test" })).toBeInTheDocument();
    expect(screen.getByText("Session 2 of 3 · 20-minute test")).toBeInTheDocument();
    expect(screen.getByText("Sat 31 Oct 2026")).toBeInTheDocument();
    expect(screen.getByText("Status: planned")).toBeInTheDocument();
    expect(await screen.findByText("Targets use your current FTP of 250 W.")).toBeInTheDocument();
    expect(screen.getByText("Zone 2: 139 to 188 W")).toBeInTheDocument();
    expect(screen.getByText("The test · 20 min")).toBeInTheDocument();
    expect(screen.getAllByRole("checkbox")).toHaveLength(5);
  });

  it("uses effort wording only when there is no baseline", async () => {
    vi.mocked(api.fetchCurrentBaseline).mockResolvedValue(null);
    vi.mocked(api.fetchBaselineEntries).mockResolvedValue([]);
    vi.mocked(api.fetchActiveTestWeek).mockResolvedValue(week());
    renderAt("/baseline/test-week/2");
    expect(
      await screen.findByText("No FTP is set yet, so the steps use effort wording."),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Zone 2: /)).not.toBeInTheDocument();
  });

  it("remembers the ticked items for the session", async () => {
    vi.mocked(api.fetchActiveTestWeek).mockResolvedValue(week());
    const first = renderAt("/baseline/test-week/2");
    await userEvent.click(await screen.findByRole("checkbox", { name: "Power meter zeroed" }));
    first.unmount();
    renderAt("/baseline/test-week/2");
    expect(await screen.findByRole("checkbox", { name: "Power meter zeroed" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Heart rate strap on" })).not.toBeChecked();
  });

  it("changes the date from the Change date button", async () => {
    vi.mocked(api.fetchActiveTestWeek).mockResolvedValue(week());
    renderAt("/baseline/test-week/2");
    await userEvent.click(await screen.findByRole("button", { name: "Change date" }));
    fireEvent.change(screen.getByLabelText("Date"), { target: { value: "2027-01-09" } });
    await waitFor(() => {
      expect(api.updateTestSession).toHaveBeenCalledWith("session-2", {
        scheduled_on: "2027-01-09",
      });
    });
  });

  it("needs a whole number of watts before the result can be reviewed", async () => {
    vi.mocked(api.fetchActiveTestWeek).mockResolvedValue(week());
    renderAt("/baseline/test-week/2");
    await userEvent.click(await screen.findByRole("button", { name: "Review result" }));
    expect(screen.getByText("Enter the power as a whole number of watts.")).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("Average power over the 20 minutes"), "9000");
    await userEvent.click(screen.getByRole("button", { name: "Review result" }));
    expect(screen.getByText("Power must be from 50 to 1500 W.")).toBeInTheDocument();
    expect(api.updateTestSession).not.toHaveBeenCalled();
    expect(api.addBaselineEntry).not.toHaveBeenCalled();
  });

  it("keeps the result on the session and opens the check page with the heart rate", async () => {
    vi.mocked(api.fetchActiveTestWeek).mockResolvedValue(week());
    renderAt("/baseline/test-week/2");
    await userEvent.type(await screen.findByLabelText("Average power over the 20 minutes"), "275");
    await userEvent.type(
      screen.getByLabelText("Average heart rate over the last 15 minutes (optional)"),
      "171",
    );
    await userEvent.click(screen.getByRole("button", { name: "Review result" }));
    await waitFor(() => {
      expect(api.updateTestSession).toHaveBeenCalledWith("session-2", { result_avg_power_w: 275 });
    });
    await waitFor(() => {
      expect(screen.getByTestId("where")).toHaveTextContent("/baseline/test-week/2/result?hr=171");
    });
    expect(api.addBaselineEntry).not.toHaveBeenCalled();
  });

  it("offers the ride found on the test day, read from its stream, and fills the fields from it", async () => {
    const ride = makeSourceRide({
      id: "ride-5",
      strava_id: 55,
      start_local: "2026-10-31T09:00:00",
    });
    vi.mocked(api.fetchPowerRideOnDay).mockResolvedValue(ride);
    vi.mocked(api.downloadRideStreams).mockResolvedValue(rideFile(1800, 275, 170));
    vi.mocked(api.fetchActiveTestWeek).mockResolvedValue(week());
    renderAt("/baseline/test-week/2");
    expect(await screen.findByText("A ride was found on this day")).toBeInTheDocument();
    expect(screen.getByText(/best 20 minutes: 275 W/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Use this ride" }));
    expect(screen.getByLabelText("Average power over the 20 minutes")).toHaveValue("275");
    expect(
      screen.getByLabelText("Average heart rate over the last 15 minutes (optional)"),
    ).toHaveValue("170");
    await userEvent.click(screen.getByRole("button", { name: "Review result" }));
    await waitFor(() => {
      expect(screen.getByTestId("where")).toHaveTextContent("?hr=170&ride=ride-5");
    });
  });

  it("leaves the heart rate to be typed when the ride has no heart rate stream", async () => {
    vi.mocked(api.fetchPowerRideOnDay).mockResolvedValue(
      makeSourceRide({ id: "ride-5", strava_id: 55, start_local: "2026-10-31T09:00:00" }),
    );
    vi.mocked(api.downloadRideStreams).mockResolvedValue(rideFile(1800, 275, null));
    vi.mocked(api.fetchActiveTestWeek).mockResolvedValue(week());
    renderAt("/baseline/test-week/2");
    await userEvent.click(await screen.findByRole("button", { name: "Use this ride" }));
    expect(
      screen.getByLabelText("Average heart rate over the last 15 minutes (optional)"),
    ).toHaveValue("");
  });

  it("uses the best minute for the ramp test and has no heart rate field", async () => {
    vi.mocked(api.fetchActiveTestWeek).mockResolvedValue(
      makeWeek("ramp", [{ scheduled_on: "2026-10-30" }, { scheduled_on: "2026-10-31" }]),
    );
    renderAt("/baseline/test-week/2");
    expect(await screen.findByLabelText("Best 1-minute power in the ramp")).toBeInTheDocument();
    expect(screen.queryByLabelText(/Average heart rate/)).not.toBeInTheDocument();
    expect(screen.getByText("The ramp · Until you cannot continue")).toBeInTheDocument();
  });

  it("lets an opener ride be ticked off and back", async () => {
    vi.mocked(api.fetchActiveTestWeek).mockResolvedValue(week());
    renderAt("/baseline/test-week/1");
    await userEvent.click(await screen.findByRole("button", { name: "Mark as done" }));
    await waitFor(() => {
      expect(api.updateTestSession).toHaveBeenCalledWith("session-1", {
        completed_at: expect.any(String) as string,
      });
    });
  });

  it("says so when the session does not exist", async () => {
    vi.mocked(api.fetchActiveTestWeek).mockResolvedValue(week());
    renderAt("/baseline/test-week/9");
    expect(await screen.findByText(/This session was not found/)).toBeInTheDocument();
  });
});

describe("Test result to baseline (Z6)", () => {
  const withResult = (protocol: "20min" | "ramp", watts: number) =>
    makeWeek(protocol, [
      { scheduled_on: "2026-10-26" },
      { scheduled_on: "2026-10-27", result_avg_power_w: watts },
      {},
    ]);

  it("shows the 95 % calculation line by line and the change in words, and saves nothing yet", async () => {
    vi.mocked(api.fetchActiveTestWeek).mockResolvedValue(withResult("20min", 275));
    renderAt("/baseline/test-week/2/result");
    expect(await screen.findByText("Average power over the 20 minutes")).toBeInTheDocument();
    expect(screen.getByText("275 W")).toBeInTheDocument();
    expect(screen.getByText("95 %")).toBeInTheDocument();
    expect(screen.getByText("261 W")).toBeInTheDocument();
    expect(await screen.findByText("Current FTP 250 W. Up 11 W.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirm FTP 261 W" })).toBeInTheDocument();
    expect(api.addBaselineEntry).not.toHaveBeenCalled();
  });

  it("confirms into one test_20min row with LTHR, the ride and the test date, and finishes the week", async () => {
    vi.mocked(api.fetchActiveTestWeek).mockResolvedValue(withResult("20min", 275));
    renderAt("/baseline/test-week/2/result?hr=171&ride=6f1d3c2e-0b1a-4c3d-8e9f-123456789abc");
    expect(await screen.findByRole("checkbox", { name: "Also save LTHR: 171 bpm" })).toBeChecked();
    expect(
      screen.getByText(/Average heart rate of the last 15 minutes of the test/),
    ).toBeInTheDocument();
    expect(screen.getByText("Tue 27 Oct 2026")).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("Note (optional)"), "felt good");
    await userEvent.click(screen.getByRole("button", { name: "Confirm FTP 261 W" }));
    await waitFor(() => {
      expect(api.addBaselineEntry).toHaveBeenCalledTimes(1);
    });
    expect(vi.mocked(api.addBaselineEntry).mock.calls[0]?.[0]).toEqual({
      effectiveDate: "2026-10-27",
      ftp: 261,
      maxHr: null,
      restingHr: null,
      lthr: 171,
      source: "test_20min",
      sourceActivityId: "6f1d3c2e-0b1a-4c3d-8e9f-123456789abc",
      note: "felt good",
    });
    await waitFor(() => {
      expect(api.updateTestSession).toHaveBeenCalledWith(
        "session-2",
        expect.objectContaining({ result_ftp_w: 261 }),
      );
      expect(api.setTestWeekStatus).toHaveBeenCalledWith("week-1", "completed");
    });
    await waitFor(() => {
      expect(screen.getByTestId("where")).toHaveTextContent(
        '/baseline {"flash":"Baseline updated: FTP 261 W, LTHR 171 bpm. Zones are recalculated."}',
      );
    });
  });

  it("leaves LTHR out when it is unticked", async () => {
    vi.mocked(api.fetchActiveTestWeek).mockResolvedValue(withResult("20min", 275));
    renderAt("/baseline/test-week/2/result?hr=171");
    await userEvent.click(await screen.findByRole("checkbox", { name: "Also save LTHR: 171 bpm" }));
    await userEvent.click(screen.getByRole("button", { name: "Confirm FTP 261 W" }));
    await waitFor(() => {
      expect(api.addBaselineEntry).toHaveBeenCalled();
    });
    expect(vi.mocked(api.addBaselineEntry).mock.calls[0]?.[0]).toMatchObject({
      ftp: 261,
      lthr: null,
      sourceActivityId: null,
    });
  });

  it("does not save an LTHR above the current max heart rate", async () => {
    vi.mocked(api.fetchActiveTestWeek).mockResolvedValue(withResult("20min", 275));
    renderAt("/baseline/test-week/2/result?hr=190");
    expect(
      await screen.findByText(/LTHR 190 bpm is higher than your max heart rate of 186 bpm/),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Confirm FTP 261 W" }));
    await waitFor(() => {
      expect(api.addBaselineEntry).toHaveBeenCalled();
    });
    expect(vi.mocked(api.addBaselineEntry).mock.calls[0]?.[0]).toMatchObject({ lthr: null });
  });

  it("uses 75 % of the best minute for the ramp test, source test_ramp, and no LTHR option", async () => {
    vi.mocked(api.fetchActiveTestWeek).mockResolvedValue(withResult("ramp", 348));
    renderAt("/baseline/test-week/2/result?hr=171");
    expect(await screen.findByText("Best 1-minute power in the ramp")).toBeInTheDocument();
    expect(screen.getByText("75 %")).toBeInTheDocument();
    expect(
      screen.getByText("The ramp test gives no LTHR, so there is no LTHR option here."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Confirm FTP 261 W" }));
    await waitFor(() => {
      expect(api.addBaselineEntry).toHaveBeenCalled();
    });
    expect(vi.mocked(api.addBaselineEntry).mock.calls[0]?.[0]).toMatchObject({
      ftp: 261,
      lthr: null,
      source: "test_ramp",
    });
  });

  it("caps the effective date at today when the session was planned for later", async () => {
    vi.mocked(api.fetchActiveTestWeek).mockResolvedValue(
      makeWeek("20min", [{}, { scheduled_on: "2999-01-01", result_avg_power_w: 275 }, {}]),
    );
    renderAt("/baseline/test-week/2/result");
    await userEvent.click(await screen.findByRole("button", { name: "Confirm FTP 261 W" }));
    await waitFor(() => {
      expect(api.addBaselineEntry).toHaveBeenCalled();
    });
    expect(vi.mocked(api.addBaselineEntry).mock.calls[0]?.[0]).toMatchObject({
      effectiveDate: TODAY,
    });
  });

  it("keeps the result for a different value, and discard changes nothing", async () => {
    vi.mocked(api.fetchActiveTestWeek).mockResolvedValue(withResult("20min", 275));
    renderAt("/baseline/test-week/2/result");
    const other = await screen.findByRole("link", { name: "Enter a different value" });
    expect(other).toHaveAttribute("href", "/baseline/values");
    expect(screen.getByRole("link", { name: "Discard result" })).toHaveAttribute(
      "href",
      "/baseline/test-week",
    );
    await userEvent.click(other);
    expect(screen.getByTestId("where")).toHaveTextContent(
      '"note":"20-minute test: average power over the 20 minutes 275 W"',
    );
    expect(api.addBaselineEntry).not.toHaveBeenCalled();
  });

  it("says so when there is no result yet", async () => {
    vi.mocked(api.fetchActiveTestWeek).mockResolvedValue(makeWeek("20min"));
    renderAt("/baseline/test-week/2/result");
    expect(await screen.findByText(/There is no result to check yet/)).toBeInTheDocument();
  });

  it("keeps the page and says nothing changed when saving fails", async () => {
    vi.mocked(api.addBaselineEntry).mockRejectedValue(new Error("offline"));
    vi.mocked(api.fetchActiveTestWeek).mockResolvedValue(withResult("20min", 275));
    renderAt("/baseline/test-week/2/result");
    await userEvent.click(await screen.findByRole("button", { name: "Confirm FTP 261 W" }));
    expect(
      await screen.findByText("Couldn't save your baseline. Nothing was changed. Try again."),
    ).toBeInTheDocument();
    expect(api.setTestWeekStatus).not.toHaveBeenCalled();
  });
});

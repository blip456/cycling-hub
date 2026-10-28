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
    fetchHeartRateRides: vi.fn(),
    downloadRideStreams: vi.fn(),
    addBaselineEntry: vi.fn(),
  };
});

function Where() {
  const location = useLocation();
  return (
    <p data-testid="where">
      {location.pathname} {JSON.stringify(location.state)}
    </p>
  );
}

function renderValues(entry: string | { pathname: string; state: unknown } = "/baseline/values") {
  return renderWithProviders(
    <>
      <Routes>
        <Route path="/baseline/*" element={<BaselinePage />} />
      </Routes>
      <Where />
    </>,
    { path: entry as never },
  );
}

beforeEach(() => {
  vi.mocked(api.fetchCurrentBaseline).mockResolvedValue(VIEW);
  vi.mocked(api.fetchBaselineEntries).mockResolvedValue(HISTORY);
  vi.mocked(api.fetchHeartRateRides).mockResolvedValue([]);
  vi.mocked(api.addBaselineEntry).mockResolvedValue(undefined);
});

async function type(label: string, value: string) {
  await userEvent.type(screen.getByLabelText(label), value);
}

describe("Enter values (Z3)", () => {
  it("has a visible label above every field and nothing typed or in a placeholder", async () => {
    renderValues();
    for (const label of [
      "FTP",
      "Max heart rate",
      "Lactate threshold heart rate (LTHR) (optional)",
      "Resting heart rate (optional)",
      "Effective from (optional)",
      "Note (optional)",
    ]) {
      const field = screen.getByLabelText(label);
      expect(field).toHaveValue("");
      expect(field).not.toHaveAttribute("placeholder");
    }
    expect(await screen.findByText(/Current value is 250 W/)).toBeInTheDocument();
    expect(screen.getByLabelText("FTP")).toHaveAccessibleDescription(
      "Whole watts, 50 to 600. Current value is 250 W.",
    );
  });

  it("asks for at least one value", async () => {
    renderValues();
    await userEvent.click(screen.getByRole("button", { name: "Save baseline" }));
    expect(screen.getAllByText("Enter at least one value to save.")).not.toHaveLength(0);
    expect(screen.getByRole("alert")).toHaveTextContent("Error: this baseline was not saved.");
    expect(api.addBaselineEntry).not.toHaveBeenCalled();
  });

  it("shows errors below the fields and in a summary, with the field marked invalid", async () => {
    renderValues();
    await type("FTP", "20");
    await type("Max heart rate", "150");
    await type("Lactate threshold heart rate (LTHR) (optional)", "170");
    await userEvent.click(screen.getByRole("button", { name: "Save baseline" }));
    expect(screen.getByLabelText("FTP")).toBeInvalid();
    expect(screen.getByLabelText("FTP")).toHaveAccessibleDescription(/FTP must be at least 50 W/);
    expect(screen.getAllByText("LTHR cannot be higher than max heart rate.")).toHaveLength(2);
    expect(api.addBaselineEntry).not.toHaveBeenCalled();
  });

  it("rejects text, decimals and a future date", async () => {
    renderValues();
    await type("FTP", "abc");
    await type("Resting heart rate (optional)", "55.5");
    await userEvent.type(screen.getByLabelText("Effective from (optional)"), "2999-01-01");
    await userEvent.click(screen.getByRole("button", { name: "Save baseline" }));
    expect(screen.getAllByText("Enter FTP as a number.")).not.toHaveLength(0);
    expect(screen.getAllByText("Enter resting heart rate as a whole number.")).not.toHaveLength(0);
    expect(screen.getAllByText("The date cannot be in the future.")).not.toHaveLength(0);
  });

  it("checks LTHR against the current max heart rate when only LTHR is typed", async () => {
    renderValues();
    await screen.findByText(/Current value is 186 bpm/);
    await type("Lactate threshold heart rate (LTHR) (optional)", "190");
    await userEvent.click(screen.getByRole("button", { name: "Save baseline" }));
    expect(
      screen.getAllByText("LTHR cannot be higher than your max heart rate of 186 bpm."),
    ).not.toHaveLength(0);
  });

  it("saves one manual row with only the typed values, dated today, and goes back with a message", async () => {
    renderValues();
    await type("FTP", "255");
    await type("Note (optional)", "after a good week");
    await userEvent.click(screen.getByRole("button", { name: "Save baseline" }));
    await waitFor(() => {
      expect(api.addBaselineEntry).toHaveBeenCalledTimes(1);
    });
    expect(vi.mocked(api.addBaselineEntry).mock.calls[0]?.[0]).toEqual({
      effectiveDate: brusselsDate(),
      ftp: 255,
      maxHr: null,
      restingHr: null,
      lthr: null,
      source: "manual",
      note: "after a good week",
    });
    await waitFor(() => {
      expect(screen.getByTestId("where")).toHaveTextContent(
        '/baseline {"flash":"Baseline updated: FTP 255 W. Zones are recalculated."}',
      );
    });
  });

  it("uses the chosen effective date", async () => {
    renderValues();
    await type("Resting heart rate (optional)", "52");
    await userEvent.type(screen.getByLabelText("Effective from (optional)"), "2026-10-01");
    await userEvent.click(screen.getByRole("button", { name: "Save baseline" }));
    await waitFor(() => {
      expect(api.addBaselineEntry).toHaveBeenCalled();
    });
    expect(vi.mocked(api.addBaselineEntry).mock.calls[0]?.[0]).toMatchObject({
      effectiveDate: "2026-10-01",
      restingHr: 52,
      ftp: null,
    });
  });

  it("keeps the page and says nothing was changed when saving fails", async () => {
    vi.mocked(api.addBaselineEntry).mockRejectedValue(new Error("offline"));
    renderValues();
    await type("FTP", "255");
    await userEvent.click(screen.getByRole("button", { name: "Save baseline" }));
    expect(
      (await screen.findAllByText("Couldn't save your baseline. Nothing was changed. Try again."))
        .length,
    ).toBeGreaterThan(0);
    expect(screen.getByTestId("where")).toHaveTextContent("/baseline/values");
  });
});

describe("Highest heart rate in your data (P42)", () => {
  beforeEach(() => {
    vi.mocked(api.fetchHeartRateRides).mockResolvedValue([
      makeSourceRide({
        id: "hr-ride",
        strava_id: 9,
        start_local: "2026-09-12T10:00:00",
        name: "Hill day",
      }),
    ]);
    vi.mocked(api.downloadRideStreams).mockResolvedValue(rideFile(60, null, 191));
  });

  it("shows the suggestion with its ride, and only fills the field when used", async () => {
    renderValues();
    expect(await screen.findByText(/Sat 12 Sep 2026 · Hill day/)).toBeInTheDocument();
    expect(screen.getByText(/A loose strap can cause a spike/)).toBeInTheDocument();
    expect(screen.getByLabelText("Max heart rate")).toHaveValue("");
    await userEvent.click(screen.getByRole("button", { name: "Use this value" }));
    expect(screen.getByLabelText("Max heart rate")).toHaveValue("191");
    expect(api.addBaselineEntry).not.toHaveBeenCalled();
  });

  it("saves the value as Highest in your data with its ride, apart from other typed values", async () => {
    renderValues();
    await userEvent.click(await screen.findByRole("button", { name: "Use this value" }));
    await type("FTP", "255");
    await userEvent.click(screen.getByRole("button", { name: "Save baseline" }));
    await waitFor(() => {
      expect(api.addBaselineEntry).toHaveBeenCalledTimes(2);
    });
    const [first, second] = vi.mocked(api.addBaselineEntry).mock.calls.map((c) => c[0]);
    expect(first).toMatchObject({
      source: "hr_data",
      maxHr: 191,
      sourceActivityId: "hr-ride",
      ftp: null,
    });
    expect(second).toMatchObject({ source: "manual", ftp: 255, maxHr: null });
  });

  it("saves a different typed value as manual", async () => {
    renderValues();
    await userEvent.click(await screen.findByRole("button", { name: "Use this value" }));
    await userEvent.clear(screen.getByLabelText("Max heart rate"));
    await type("Max heart rate", "189");
    await userEvent.click(screen.getByRole("button", { name: "Save baseline" }));
    await waitFor(() => {
      expect(api.addBaselineEntry).toHaveBeenCalledTimes(1);
    });
    expect(vi.mocked(api.addBaselineEntry).mock.calls[0]?.[0]).toMatchObject({
      source: "manual",
      maxHr: 189,
    });
  });

  it("opens with the value filled in, not saved, when it comes from the empty state", async () => {
    renderValues({ pathname: "/baseline/values", state: { maxHr: 191, rideId: "hr-ride" } });
    expect(screen.getByLabelText("Max heart rate")).toHaveValue("191");
    expect(api.addBaselineEntry).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Save baseline" }));
    await waitFor(() => {
      expect(api.addBaselineEntry).toHaveBeenCalledTimes(1);
    });
    expect(vi.mocked(api.addBaselineEntry).mock.calls[0]?.[0]).toMatchObject({
      source: "hr_data",
      maxHr: 191,
      sourceActivityId: "hr-ride",
    });
  });

  it("says when no suggestion could be made and keeps typing possible", async () => {
    vi.mocked(api.fetchHeartRateRides).mockResolvedValue([]);
    renderValues();
    expect(
      await screen.findByText("No heart rate data was found in your rides."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Use this value" })).not.toBeInTheDocument();
  });
});

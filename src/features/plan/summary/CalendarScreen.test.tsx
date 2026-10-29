import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EMPTY_PROFILE, fetchProfile } from "@/features/profile/api";
import { downloadFile } from "@/features/rides/export/download";
import { fakeAuth, fakeSession, renderWithProviders } from "@/test/render";
import { buildIcs, icsFingerprint, type IcsOptions } from "../export";
import { CalendarPage } from "../pages/CalendarPage";
import { sessionFromRow } from "./adapt";
import { fetchPlanChanges, fetchPlanData } from "./api";
import { ICS_STORAGE_KEY, loadIcsDownload } from "./storage";
import { PLAN_DATA, ROWS } from "./test-support";
import type { PlanData } from "./types";

vi.mock("./api", () => ({ fetchPlanData: vi.fn(), fetchPlanChanges: vi.fn() }));
vi.mock("@/features/rides/export/download", () => ({ downloadFile: vi.fn() }));
vi.mock("@/features/profile/api", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  fetchProfile: vi.fn(),
}));

const NOW = new Date("2026-10-28T10:00:00Z");
const TODO_COUNT = ROWS.length;

function renderPage() {
  return renderWithProviders(
    <Routes>
      <Route path="/plan/calendar" element={<CalendarPage />} />
    </Routes>,
    { path: "/plan/calendar", auth: fakeAuth({ status: "signedIn", session: fakeSession() }) },
  );
}

function setup() {
  return userEvent.setup({ advanceTimers: (ms) => vi.advanceTimersByTime(ms) });
}

function downloaded(): { content: string; type: string; name: string } {
  const call = vi.mocked(downloadFile).mock.calls.at(-1);
  if (!call) throw new Error("nothing was downloaded");
  return { content: call[0], type: call[1], name: call[2] };
}

/** Some done and missed sessions, so that "still to do" and "the whole plan" differ. */
const MIXED: PlanData = {
  ...PLAN_DATA,
  sessions: ROWS.map((row, i) =>
    i === 0 ? { ...row, status: "done" } : i === 1 ? { ...row, status: "missed" } : row,
  ),
};

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(NOW);
  window.localStorage.clear();
  vi.mocked(fetchPlanData).mockResolvedValue(MIXED);
  vi.mocked(fetchPlanChanges).mockResolvedValue([]);
  vi.mocked(fetchProfile).mockResolvedValue({
    ...EMPTY_PROFILE,
    eventName: "100 km ride",
    eventDate: "2027-01-17",
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("Calendar: states", () => {
  it("shows a loading state first", () => {
    vi.mocked(fetchPlanData).mockReturnValue(new Promise(() => undefined));
    renderPage();
    expect(screen.getByRole("status")).toHaveTextContent("Loading");
  });

  it("offers to try again when the plan cannot be loaded", async () => {
    const user = setup();
    vi.mocked(fetchPlanData).mockRejectedValueOnce(new Error("offline"));
    renderPage();
    expect(
      await screen.findByText("The calendar export could not be prepared."),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(
      await screen.findByRole("button", { name: "Download calendar file" }),
    ).toBeInTheDocument();
  });

  it("offers a plan when there is none", async () => {
    vi.mocked(fetchPlanData).mockResolvedValue({ plan: null, sessions: [] });
    renderPage();
    expect(
      await screen.findByText("There is no plan to add to your calendar yet."),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Make a plan" })).toHaveAttribute("href", "/plan/new");
  });

  it("disables the download when there is nothing to export", async () => {
    vi.mocked(fetchPlanData).mockResolvedValue({ ...PLAN_DATA, sessions: [] });
    vi.mocked(fetchProfile).mockResolvedValue(EMPTY_PROFILE);
    renderPage();
    const button = await screen.findByRole("button", { name: "Download calendar file" });
    expect(button).toBeDisabled();
    expect(button).toHaveAccessibleDescription("There is nothing to export for this choice.");
  });
});

describe("Calendar: the options", () => {
  it("counts the events for each choice, with the event day", async () => {
    const user = setup();
    renderPage();
    const button = await screen.findByRole("button", { name: "Download calendar file" });
    expect(screen.getByText(`${TODO_COUNT - 2} sessions and the event`)).toBeInTheDocument();
    expect(screen.getByText(`${TODO_COUNT} sessions and the event`)).toBeInTheDocument();
    expect(button).toHaveAccessibleDescription(
      `cycling-hub-plan.ics, ${TODO_COUNT - 2} sessions and the event`,
    );
    await user.click(screen.getByRole("radio", { name: /The whole plan/ }));
    expect(button).toHaveAccessibleDescription(
      `cycling-hub-plan.ics, ${TODO_COUNT} sessions and the event`,
    );
  });

  it("says only the sessions when the profile has no event", async () => {
    vi.mocked(fetchProfile).mockResolvedValue(EMPTY_PROFILE);
    renderPage();
    const button = await screen.findByRole("button", { name: "Download calendar file" });
    expect(button).toHaveAccessibleDescription(`cycling-hub-plan.ics, ${TODO_COUNT - 2} sessions`);
  });

  it("has labels above the inputs, no placeholders and the start time only for a set time", async () => {
    const user = setup();
    renderPage();
    const time = await screen.findByLabelText("Start time");
    expect(time).toBeDisabled();
    expect(time).not.toHaveAttribute("placeholder");
    expect(time).toHaveAccessibleDescription(/Only used with a set time\. Europe\/Brussels\./);
    expect(screen.getByRole("radio", { name: "All-day events" })).toBeChecked();
    await user.click(screen.getByRole("radio", { name: "At a set time" }));
    expect(time).toBeEnabled();
    expect(
      screen.getByRole("switch", { name: "Add steps and targets to the description" }),
    ).toHaveAttribute("aria-checked", "true");
  });
});

describe("Calendar: the download", () => {
  it("downloads the file for the sessions still to do as all-day events with the event day", async () => {
    const user = setup();
    renderPage();
    await user.click(await screen.findByRole("button", { name: "Download calendar file" }));

    const file = downloaded();
    expect(file.name).toBe("cycling-hub-plan.ics");
    expect(file.type).toBe("text/calendar;charset=utf-8");
    expect(file.content).toContain("BEGIN:VCALENDAR");
    expect(file.content.match(/BEGIN:VEVENT/g)).toHaveLength(TODO_COUNT - 2 + 1);
    expect(file.content).toContain("DTSTART;VALUE=DATE:");
    expect(file.content).toContain("SUMMARY:100 km ride");
    expect(file.content).toContain("Steps:");
    expect(file.content).not.toContain("Status: done");

    const card = await screen.findByRole("status");
    expect(card).toHaveTextContent("Downloaded cycling-hub-plan.ics");
    expect(card).toHaveTextContent(
      `Open the file in your calendar app to add ${TODO_COUNT - 2} sessions and the event.`,
    );
  });

  it("downloads the whole plan, timed, without steps", async () => {
    const user = setup();
    renderPage();
    await user.click(await screen.findByRole("radio", { name: /The whole plan/ }));
    await user.click(screen.getByRole("radio", { name: "At a set time" }));
    await user.type(screen.getByLabelText("Start time"), "0730");
    await user.click(
      screen.getByRole("switch", { name: "Add steps and targets to the description" }),
    );
    await user.click(screen.getByRole("button", { name: "Download calendar file" }));

    const file = downloaded();
    expect(file.content.match(/BEGIN:VEVENT/g)).toHaveLength(TODO_COUNT + 1);
    expect(file.content).toContain("DTSTART;TZID=Europe/Brussels:");
    expect(file.content).toContain("T073000");
    expect(file.content).not.toContain("Steps:");
    expect(file.content).toContain("Status: done");
  });

  it("asks for a valid start time and does not download without one", async () => {
    const user = setup();
    renderPage();
    await user.click(await screen.findByRole("radio", { name: "At a set time" }));
    await user.click(screen.getByRole("button", { name: "Download calendar file" }));
    const time = screen.getByLabelText("Start time");
    expect(time).toBeInvalid();
    expect(time).toHaveAccessibleDescription(
      /Enter the start time as hours and minutes \(hh:mm\)\./,
    );
    expect(downloadFile).not.toHaveBeenCalled();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("remembers the options and what the file looked like", async () => {
    const user = setup();
    renderPage();
    await user.click(await screen.findByRole("radio", { name: /The whole plan/ }));
    await user.click(screen.getByRole("button", { name: "Download calendar file" }));
    const stored = loadIcsDownload();
    expect(stored).toMatchObject({ scope: "all", timing: { mode: "all-day" }, includeSteps: true });
    expect(stored?.fingerprint).toMatch(/^ics1-/);
    expect(stored?.downloadedAt.startsWith("2026-10-28T10:00:00")).toBe(true);
  });

  it("starts from the options of the last download", async () => {
    window.localStorage.setItem(
      ICS_STORAGE_KEY,
      JSON.stringify({
        fingerprint: "x",
        scope: "all",
        timing: { mode: "timed", startTime: "06:45" },
        includeSteps: false,
        downloadedAt: NOW.toISOString(),
      }),
    );
    renderPage();
    expect(await screen.findByRole("radio", { name: /The whole plan/ })).toBeChecked();
    expect(screen.getByLabelText("Start time")).toHaveValue("06:45");
    expect(
      screen.getByRole("switch", { name: "Add steps and targets to the description" }),
    ).toHaveAttribute("aria-checked", "false");
  });
});

describe("Calendar: out of date", () => {
  const sessions = MIXED.sessions.flatMap((row) => sessionFromRow(row, 250) ?? []);
  const options: IcsOptions = {
    now: new Date(0),
    scope: "todo",
    timing: { mode: "all-day" },
    includeSteps: true,
    event: { id: "event", name: "100 km ride", date: "2027-01-17" },
  };

  function store(fingerprint: string) {
    window.localStorage.setItem(
      ICS_STORAGE_KEY,
      JSON.stringify({
        fingerprint,
        scope: "todo",
        timing: { mode: "all-day" },
        includeSteps: true,
        downloadedAt: "2026-10-20T10:00:00.000Z",
      }),
    );
  }

  it("says nothing before the first download", async () => {
    renderPage();
    await screen.findByRole("button", { name: "Download calendar file" });
    expect(screen.queryByText("Your calendar file is out of date")).not.toBeInTheDocument();
  });

  it("says nothing while the file still matches the plan", async () => {
    store(icsFingerprint(sessions, options));
    renderPage();
    await screen.findByRole("button", { name: "Download calendar file" });
    expect(screen.queryByText("Your calendar file is out of date")).not.toBeInTheDocument();
    // Sanity: the same options really make the file the page would download.
    expect(buildIcs(sessions, options)).toContain("BEGIN:VCALENDAR");
  });

  it("says the file is out of date, with the day of the last change, until it is downloaded again", async () => {
    const user = setup();
    store("ics1-of-an-older-plan");
    vi.mocked(fetchPlanChanges).mockResolvedValue([
      { created_at: "2026-10-26T09:00:00Z", reason: "Older", undone_at: null },
      { created_at: "2026-10-28T09:00:00Z", reason: "Newer", undone_at: null },
      { created_at: "2026-10-29T09:00:00Z", reason: "Undone", undone_at: "2026-10-29T09:05:00Z" },
    ]);
    renderPage();
    expect(await screen.findByText("Your calendar file is out of date")).toBeInTheDocument();
    expect(
      screen.getByText(/The plan changed on Wed 28 Oct\. Download the file again/),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Download calendar file" }));
    await waitFor(() => {
      expect(screen.queryByText("Your calendar file is out of date")).not.toBeInTheDocument();
    });
  });

  it("says it without a date when the change log is empty", async () => {
    store("ics1-of-an-older-plan");
    renderPage();
    expect(
      await screen.findByText(/^The plan changed\. Download the file again/),
    ).toBeInTheDocument();
  });

  it("is out of date after a session changed, using the options stored at download time", async () => {
    store(icsFingerprint(sessions, options));
    const changed: PlanData = {
      ...MIXED,
      sessions: MIXED.sessions.map((row, i) =>
        i === 3 ? { ...row, duration_min: row.duration_min + 15 } : row,
      ),
    };
    vi.mocked(fetchPlanData).mockResolvedValue(changed);
    renderPage();
    expect(await screen.findByText("Your calendar file is out of date")).toBeInTheDocument();
  });
});

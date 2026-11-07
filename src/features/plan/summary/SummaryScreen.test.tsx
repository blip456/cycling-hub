import { act, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EMPTY_PROFILE, fetchProfile } from "@/features/profile/api";
import { fetchRides, type Ride } from "@/features/rides/api";
import { fetchWeightEntries } from "@/features/weight/api";
import { fetchActiveWeightGoal } from "@/features/weight/goal-api";
import { fakeAuth, fakeSession, renderWithProviders } from "@/test/render";
import { DEFAULT_PROMPT_LINES } from "../export";
import { SummaryPage } from "../pages/SummaryPage";
import { fetchPlanChanges, fetchPlanData, fetchRideMetrics, fetchSummaryBaseline } from "./api";
import { SUMMARY_STORAGE_KEY } from "./storage";
import { PLAN_DATA, ROWS } from "./test-support";
import type { PlanSessionRow } from "./types";

vi.mock("./api", () => ({
  fetchPlanData: vi.fn(),
  fetchPlanChanges: vi.fn(),
  fetchSummaryBaseline: vi.fn(),
  fetchRideMetrics: vi.fn(),
}));
vi.mock("@/features/rides/api", () => ({ fetchRides: vi.fn() }));
vi.mock("@/features/weight/api", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  fetchWeightEntries: vi.fn(),
}));
vi.mock("@/features/weight/goal-api", () => ({ fetchActiveWeightGoal: vi.fn() }));
vi.mock("@/features/profile/api", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  fetchProfile: vi.fn(),
}));

const NOW = new Date("2026-10-28T10:00:00Z");
const FIRST = ROWS[0] as PlanSessionRow;

function ride(overrides: Partial<Ride> = {}): Ride {
  return {
    id: "ride-1",
    strava_id: 111,
    name: "Morning spin that must not leak",
    sport_type: "Ride",
    start_local: `${FIRST.session_date}T08:10:00`,
    start_at: `${FIRST.session_date}T07:10:00Z`,
    distance_m: 40_000,
    moving_time_s: 3600,
    elevation_m: 300,
    commute: false,
    trainer: false,
    average_watts: 150,
    max_watts: 400,
    average_heartrate: 135,
    max_heartrate: 160,
    average_cadence: 85,
    polyline: null,
    ...overrides,
  };
}

function renderAt(search = "") {
  return renderWithProviders(
    <Routes>
      <Route path="/plan/summary" element={<SummaryPage />} />
    </Routes>,
    {
      path: `/plan/summary${search}`,
      auth: fakeAuth({ status: "signedIn", session: fakeSession() }),
    },
  );
}

function preview() {
  return screen.getByRole("region", { name: "Preview" });
}

function setup() {
  return userEvent.setup({ advanceTimers: (ms) => vi.advanceTimersByTime(ms) });
}

const writeText = vi.fn<(text: string) => Promise<void>>();

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(NOW);
  window.localStorage.clear();
  vi.mocked(fetchPlanData).mockResolvedValue(PLAN_DATA);
  vi.mocked(fetchPlanChanges).mockResolvedValue([]);
  vi.mocked(fetchSummaryBaseline).mockResolvedValue({ ftp: 250, lthr: 165, maxHr: null });
  vi.mocked(fetchRideMetrics).mockResolvedValue({
    normalizedPowerW: 171,
    powerZoneMinutes: [8, 40, 10, 2, 0, 0, 0],
    hrZoneMinutes: [10, 40, 8, 2, 0],
  });
  vi.mocked(fetchRides).mockResolvedValue([ride()]);
  vi.mocked(fetchWeightEntries).mockResolvedValue([
    { date: "2026-10-20", kg: 75.4 },
    { date: "2026-10-28", kg: 75.1 },
  ]);
  vi.mocked(fetchActiveWeightGoal).mockResolvedValue({
    id: "g1",
    targetKg: 73,
    targetDate: "2026-12-13",
    startKg: 75.7,
    startDate: "2026-09-29",
    status: "active",
  });
  vi.mocked(fetchProfile).mockResolvedValue({
    ...EMPTY_PROFILE,
    trainingPurposes: ["weight_loss", "endurance"],
    level: "committed",
    weeklyHours: 8,
    ridingEnvironment: "both",
    eventName: "100 km ride",
    eventDate: "2027-01-17",
  });
  writeText.mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText },
    configurable: true,
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("Summary: loading and failing", () => {
  it("shows a loading state first", () => {
    vi.mocked(fetchPlanData).mockReturnValue(new Promise(() => undefined));
    renderAt();
    expect(screen.getByRole("status")).toHaveTextContent("Loading");
  });

  it("offers to try again when something cannot be loaded", async () => {
    const user = setup();
    vi.mocked(fetchRides).mockRejectedValueOnce(new Error("offline"));
    renderAt();
    expect(await screen.findByText("The summary could not be prepared.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("region", { name: "Preview" })).toBeInTheDocument();
  });
});

describe("Summary: the week", () => {
  it("is this week without parameters, with the standard prompt line and a character count", async () => {
    renderAt();
    expect(await screen.findByRole("heading", { name: "Week summary" })).toBeInTheDocument();
    expect(screen.getByText("Training week 1 of 12")).toBeInTheDocument();
    const text = preview().textContent;
    expect(text).toContain(DEFAULT_PROMPT_LINES.week);
    expect(text).toContain("# Training week 1 of 12: Mon 26 Oct to Sun 1 Nov 2026");
    expect(text).toContain("## Weight");
    expect(text).toContain("## Goals");
    expect(text).not.toContain("Morning spin that must not leak");
    expect(
      screen.getByText(new RegExp(`${(text ?? "").length.toLocaleString("en-US")} characters`)),
    ).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Prompt line" })).toHaveValue(
      DEFAULT_PROMPT_LINES.week,
    );
  });

  it("reads zone minutes and normalised power from the ride streams", async () => {
    renderAt("?type=week&date=2026-10-28");
    await screen.findByRole("region", { name: "Preview" });
    expect(fetchRideMetrics).toHaveBeenCalledWith(
      { stravaId: 111 },
      { ftp: 250, lthr: 165, maxHr: null },
    );
    expect(preview().textContent).toContain("171 W");
  });

  it("says plainly that a ride has no power data", async () => {
    vi.mocked(fetchRides).mockResolvedValue([ride({ average_watts: null, max_watts: null })]);
    vi.mocked(fetchRideMetrics).mockResolvedValue(null);
    renderAt("?type=week&date=2026-10-28");
    await screen.findByRole("region", { name: "Preview" });
    expect(preview().textContent?.toLowerCase()).toContain("no power");
  });

  it("works without a plan, from the rides alone", async () => {
    vi.mocked(fetchPlanData).mockResolvedValue({ plan: null, sessions: [] });
    renderAt("?type=week&date=2026-10-28");
    expect(await screen.findByText("Week of Mon 26 Oct")).toBeInTheDocument();
    expect(preview().textContent).toContain("# Training week: Mon 26 Oct to Sun 1 Nov 2026");
  });

  it("steps to the next and previous week through the address", async () => {
    const user = setup();
    renderAt("?type=week&date=2026-10-28");
    await screen.findByText("Training week 1 of 12");
    await user.click(screen.getByRole("button", { name: "Next week" }));
    expect(await screen.findByText("Training week 2 of 12")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Previous week" }));
    expect(await screen.findByText("Training week 1 of 12")).toBeInTheDocument();
  });
});

describe("Summary: the switches and the prompt line", () => {
  it("drops the Weight and Goals blocks with their switches and remembers them", async () => {
    const user = setup();
    const first = renderAt("?type=week&date=2026-10-28");
    await screen.findByRole("region", { name: "Preview" });
    await user.click(screen.getByRole("switch", { name: "Weight trend" }));
    expect(preview().textContent).not.toContain("## Weight");
    expect(preview().textContent).toContain("## Goals");
    await user.click(screen.getByRole("switch", { name: "Goals" }));
    expect(preview().textContent).not.toContain("## Goals");
    expect(screen.getByRole("switch", { name: "Weight trend" })).toHaveAttribute(
      "aria-checked",
      "false",
    );
    first.unmount();

    renderAt("?type=week&date=2026-10-28");
    await screen.findByRole("region", { name: "Preview" });
    expect(screen.getByRole("switch", { name: "Weight trend" })).toHaveAttribute(
      "aria-checked",
      "false",
    );
    expect(screen.getByRole("switch", { name: "Goals" })).toHaveAttribute("aria-checked", "false");
    expect(preview().textContent).not.toContain("## Weight");
  });

  it("keeps the choices of each kind apart", async () => {
    const user = setup();
    renderAt("?type=week&date=2026-10-28");
    await screen.findByRole("region", { name: "Preview" });
    await user.click(screen.getByRole("switch", { name: "Goals" }));
    await user.click(screen.getByRole("radio", { name: "Month" }));
    await screen.findByRole("heading", { name: "Month summary" });
    expect(screen.getByRole("switch", { name: "Goals" })).toHaveAttribute("aria-checked", "true");
    expect(preview().textContent).toContain("## Goals");
  });

  it("hides the prompt line field and the line itself with its switch", async () => {
    const user = setup();
    renderAt();
    await screen.findByRole("region", { name: "Preview" });
    await user.click(screen.getByRole("switch", { name: "Prompt line at the top" }));
    expect(screen.queryByRole("textbox", { name: "Prompt line" })).not.toBeInTheDocument();
    expect(preview().textContent).not.toContain(DEFAULT_PROMPT_LINES.week);
    expect(preview().textContent?.startsWith("# Training week")).toBe(true);
  });

  it("uses the PO's own prompt line, remembers it and can go back to the standard one", async () => {
    const user = setup();
    const first = renderAt();
    const field = await screen.findByRole("textbox", { name: "Prompt line" });
    await user.clear(field);
    await user.type(field, "Only the hard sessions, please.");
    expect(preview().textContent?.startsWith("Only the hard sessions, please.")).toBe(true);
    expect(JSON.parse(window.localStorage.getItem(SUMMARY_STORAGE_KEY) ?? "{}")).toMatchObject({
      week: { prompt: "Only the hard sessions, please." },
    });
    first.unmount();

    renderAt();
    expect(await screen.findByRole("textbox", { name: "Prompt line" })).toHaveValue(
      "Only the hard sessions, please.",
    );
    await user.click(screen.getByRole("button", { name: "Use the standard line" }));
    expect(screen.getByRole("textbox", { name: "Prompt line" })).toHaveValue(
      DEFAULT_PROMPT_LINES.week,
    );
    expect(JSON.parse(window.localStorage.getItem(SUMMARY_STORAGE_KEY) ?? "{}")).toMatchObject({
      week: { prompt: null },
    });
  });

  it("wires the helper text of the prompt line to the field", async () => {
    renderAt();
    const field = await screen.findByRole("textbox", { name: "Prompt line" });
    expect(field).toHaveAccessibleDescription(/Your words are kept for next time\./);
    expect(field).not.toHaveAttribute("placeholder");
  });
});

describe("Summary: a session and a month", () => {
  it("summarises the session named in the address", async () => {
    renderAt(`?type=session&id=${FIRST.id}`);
    expect(await screen.findByRole("heading", { name: "Session summary" })).toBeInTheDocument();
    expect(preview().textContent).toContain(DEFAULT_PROMPT_LINES.session);
    expect(preview().textContent).toContain(`# Session: ${FIRST.title}`);
    expect(screen.getByRole("button", { name: "Previous session" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Next session" })).toBeEnabled();
  });

  it("says when the session is not in the plan", async () => {
    renderAt("?type=session&id=nope");
    expect(
      await screen.findByText("That session is not in your plan any more."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Preview" })).not.toBeInTheDocument();
  });

  it("offers a plan when there are no sessions at all", async () => {
    vi.mocked(fetchPlanData).mockResolvedValue({ plan: null, sessions: [] });
    renderAt("?type=session");
    expect(
      await screen.findByText("There are no planned sessions to summarise yet."),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Make a plan" })).toHaveAttribute("href", "/plan/new");
  });

  it("summarises the month in the address", async () => {
    renderAt("?type=month&date=2026-10-01");
    expect(await screen.findByRole("heading", { name: "Month summary" })).toBeInTheDocument();
    expect(screen.getByText("October 2026")).toBeInTheDocument();
    expect(preview().textContent).toContain(DEFAULT_PROMPT_LINES.month);
    expect(preview().textContent).toContain("# Training month: October 2026");
  });

  it("switches between the kinds and keeps the moment", async () => {
    const user = setup();
    renderAt("?type=week&date=2026-10-28");
    await screen.findByText("Training week 1 of 12");
    await user.click(screen.getByRole("radio", { name: "Session" }));
    expect(await screen.findByRole("heading", { name: "Session summary" })).toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: "Month" }));
    expect(await screen.findByText("October 2026")).toBeInTheDocument();
  });
});

describe("Summary: Copy", () => {
  it("copies exactly the preview, says Copied and shows the status card", async () => {
    const user = setup();
    renderAt();
    await screen.findByRole("region", { name: "Preview" });
    const text = preview().textContent;
    await user.click(screen.getByRole("button", { name: "Copy summary" }));

    expect(await screen.findByRole("button", { name: /Copied/ })).toBeInTheDocument();
    // user-event gives the page its own clipboard; what was copied can be read back from it.
    expect(await navigator.clipboard.readText()).toBe(text);
    expect(screen.getByRole("status")).toHaveTextContent("Summary copied");
    expect(screen.getByRole("status")).toHaveTextContent(
      "Paste it into your AI chat. Nothing was sent anywhere.",
    );

    act(() => {
      vi.advanceTimersByTime(3500);
    });
    expect(screen.getByRole("button", { name: "Copy summary" })).toBeInTheDocument();
  });

  it("copies the text without the clipboard API through the copy command", async () => {
    const user = setup();
    Object.defineProperty(navigator, "clipboard", { value: undefined, configurable: true });
    const execCommand = vi.fn(() => true);
    Object.defineProperty(document, "execCommand", { value: execCommand, configurable: true });
    renderAt();
    await screen.findByRole("region", { name: "Preview" });
    await user.click(screen.getByRole("button", { name: "Copy summary" }));
    expect(await screen.findByRole("button", { name: /Copied/ })).toBeInTheDocument();
    expect(execCommand).toHaveBeenCalledWith("copy");
  });

  it("says it could not copy, focuses the preview and selects its text when copying is blocked", async () => {
    const user = setup();
    writeText.mockRejectedValue(new Error("blocked"));
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    const execCommand = vi.fn(() => false);
    Object.defineProperty(document, "execCommand", { value: execCommand, configurable: true });
    renderAt();
    await screen.findByRole("region", { name: "Preview" });
    await user.click(screen.getByRole("button", { name: "Copy summary" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not copy");
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Select the preview text and copy it by hand.",
    );
    expect(preview()).toHaveFocus();
    expect(screen.getByRole("button", { name: "Copy summary" })).toBeInTheDocument();
  });

  it("has a labelled, focusable preview region", async () => {
    renderAt();
    await screen.findByRole("region", { name: "Preview" });
    expect(preview()).toHaveAttribute("tabindex", "0");
    expect(within(preview()).getByText(/# Training week/)).toBeInTheDocument();
  });
});

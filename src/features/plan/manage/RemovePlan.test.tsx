import { act, configure, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Link, Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type * as baselineApi from "@/features/baseline/api";
import { EMPTY_PROFILE, fetchProfile } from "@/features/profile/api";
import type * as weightApi from "@/features/weight/api";
import { mockViewport } from "@/test/match-media";
import { fakeAuth, fakeSession, renderWithProviders } from "@/test/render";
import * as adaptationApi from "../adaptation/api";
import { createRunner } from "../adaptation/runner";
import type { FakeApi, FakeDb } from "../adaptation/fake-api";
import * as api from "../data/api";
import { planKeys } from "../data/hooks";
import { NOW, TODAY } from "../data/test-support";
import { PlanPage } from "../PlanPage";
import { PlanUpdatedCard } from "../PlanUpdatedCard";
import { fetchRides } from "@/features/rides/api";
import { fetchActiveWeightGoal } from "@/features/weight/goal-api";
import {
  fetchPlanChanges as fetchSummaryChanges,
  fetchPlanData,
  fetchSummaryBaseline,
} from "../summary/api";
import { summaryKeys } from "../summary/hooks";
import { ICS_STORAGE_KEY, SUMMARY_STORAGE_KEY } from "../summary/storage";
import { PLAN_DATA } from "../summary/test-support";
import { adaptationKeys, runnerFor } from "../adaptation/hooks";
import { editDb, wireDb } from "./test-support";

vi.mock("../data/api", async (importOriginal) => ({
  ...(await importOriginal<typeof api>()),
  fetchActivePlan: vi.fn(),
  fetchPlanSessions: vi.fn(),
  updateSessions: vi.fn(),
  createPlan: vi.fn(),
  deletePlan: vi.fn(),
  fetchPlanProfile: vi.fn(),
  savePlanProfile: vi.fn(),
  fetchActiveWeightGoal: vi.fn(),
  saveWeightGoal: vi.fn(),
}));
vi.mock("../adaptation/api", () => ({
  createSupabaseRunnerApi: vi.fn(),
  fetchPlanChanges: vi.fn(),
}));
vi.mock("../summary/api", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  fetchPlanData: vi.fn(),
  fetchPlanChanges: vi.fn(),
  fetchSummaryBaseline: vi.fn(),
  fetchRideMetrics: vi.fn(),
}));
vi.mock("@/features/rides/api", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  fetchRides: vi.fn(),
}));
vi.mock("@/features/weight/goal-api", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  fetchActiveWeightGoal: vi.fn(),
}));
vi.mock("@/features/profile/api", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  fetchProfile: vi.fn(),
}));
vi.mock("@/features/baseline/api", async (importOriginal) => ({
  ...(await importOriginal<typeof baselineApi>()),
  fetchCurrentBaseline: vi.fn(),
  fetchBaselineEntries: vi.fn(),
}));
vi.mock("@/features/weight/api", async (importOriginal) => ({
  ...(await importOriginal<typeof weightApi>()),
  fetchWeightEntries: vi.fn(),
}));

function renderApp(path = "/plan") {
  return renderWithProviders(
    <>
      <PlanUpdatedCard />
      <nav aria-label="Test links">
        <Link to="/plan">Go to plan</Link>
        <Link to="/plan/calendar">Go to calendar</Link>
        <Link to="/plan/summary?type=session">Go to session summary</Link>
        <Link to="/plan/summary?type=week&date=2026-10-28">Go to week summary</Link>
      </nav>
      <Routes>
        <Route path="/plan/*" element={<PlanPage />} />
      </Routes>
    </>,
    { path, auth: fakeAuth({ status: "signedIn", session: fakeSession() }) },
  );
}

function setup() {
  return userEvent.setup({ advanceTimers: (ms) => vi.advanceTimersByTime(ms) });
}

let viewport: ReturnType<typeof mockViewport>;
let db: FakeDb;
let runnerApi: FakeApi;
let removed: boolean;

beforeEach(async () => {
  // Findings after a click wait for the runner and several refetches: give them room on a slow CI runner.
  configure({ asyncUtilTimeout: 5000 });
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(NOW);
  viewport = mockViewport(390);
  window.localStorage.clear();
  db = editDb();
  runnerApi = await wireDb(db);
  removed = false;
  // The delete takes the plan, its sessions and its update log with it, like the cascade in the database.
  vi.mocked(api.deletePlan).mockImplementation(() => {
    removed = true;
    return Promise.resolve();
  });
  vi.mocked(api.fetchActivePlan).mockImplementation(() =>
    Promise.resolve(removed ? null : db.plan),
  );
  vi.mocked(api.fetchPlanSessions).mockImplementation(() =>
    Promise.resolve(removed ? [] : db.sessions.map((s) => ({ ...s }))),
  );
  vi.mocked(adaptationApi.createSupabaseRunnerApi).mockReturnValue({
    ...runnerApi,
    load: () => (removed ? Promise.resolve(null) : runnerApi.load()),
  });
  vi.mocked(fetchPlanData).mockImplementation(() =>
    Promise.resolve(removed ? { plan: null, sessions: [] } : PLAN_DATA),
  );
  vi.mocked(fetchSummaryChanges).mockResolvedValue([]);
  vi.mocked(fetchSummaryBaseline).mockResolvedValue({ ftp: 250, lthr: 165, maxHr: null });
  vi.mocked(fetchRides).mockResolvedValue([]);
  vi.mocked(fetchActiveWeightGoal).mockResolvedValue(null);
  vi.mocked(fetchProfile).mockResolvedValue({ ...EMPTY_PROFILE });
});

afterEach(() => {
  configure({ asyncUtilTimeout: 1000 });
  viewport.restore();
  vi.useRealTimers();
  vi.clearAllMocks();
  window.localStorage.clear();
});

type User = ReturnType<typeof setup>;

async function openDialog(user: User) {
  await user.click(await screen.findByRole("button", { name: /Plan options/ }));
  await user.click(screen.getByRole("button", { name: "Remove plan" }));
  return screen.findByRole("dialog", { name: "Remove this plan?" });
}

describe("the confirmation", () => {
  it("says what is removed, what stays and that it cannot be undone, in plain English", async () => {
    const user = setup();
    renderApp();
    const dialog = await openDialog(user);
    expect(within(dialog).getByText("This is removed:")).toBeInTheDocument();
    expect(within(dialog).getByText("All planned sessions.")).toBeInTheDocument();
    expect(
      within(dialog).getByText(
        "The plan history: the sessions you marked as done or missed, and the log of plan updates.",
      ),
    ).toBeInTheDocument();
    expect(within(dialog).getByText("This stays:")).toBeInTheDocument();
    expect(within(dialog).getByText("Your rides.")).toBeInTheDocument();
    expect(
      within(dialog).getByText("Your profile, your weight log and your weight goal."),
    ).toBeInTheDocument();
    expect(within(dialog).getByText("Your baseline (FTP and zones).")).toBeInTheDocument();
    expect(within(dialog).getByText("This cannot be undone.")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Remove plan" })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Keep plan" })).toBeInTheDocument();
  });

  it("puts the focus on the safe choice, and uses the destructive style", async () => {
    const user = setup();
    renderApp();
    const dialog = await openDialog(user);
    expect(within(dialog).getByRole("button", { name: "Keep plan" })).toHaveFocus();
    expect(within(dialog).getByRole("button", { name: "Remove plan" }).className).toMatch(
      /bg-danger text-on-danger/,
    );
  });

  it("keeps the plan when the PO chooses Keep plan", async () => {
    const user = setup();
    renderApp();
    const dialog = await openDialog(user);
    await user.click(within(dialog).getByRole("button", { name: "Keep plan" }));
    expect(api.deletePlan).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Remove this plan?" })).not.toBeInTheDocument();
    });
    expect(screen.getByRole("navigation", { name: "Plan" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Plan options/ })).toHaveFocus();

    expect(db.plan.id).toBe("plan-1");
  });
});

describe("removing", () => {
  it("deletes the plan, shows the no-plan state and a Plan removed card", async () => {
    const user = setup();
    renderApp();
    const dialog = await openDialog(user);
    await user.click(within(dialog).getByRole("button", { name: "Remove plan" }));
    expect(api.deletePlan).toHaveBeenCalledWith("plan-1");
    expect(await screen.findByText("No training plan yet")).toBeInTheDocument();
    expect(screen.getByText("Plan removed")).toBeInTheDocument();
    expect(
      screen.getByText("Your rides, profile, weight log and baseline are unchanged."),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Create my plan" })).toHaveAttribute(
      "href",
      "/plan/new",
    );
    // No tabs, no today's card, no plan options without a plan.
    expect(screen.queryByRole("navigation", { name: "Plan" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Plan options/ })).not.toBeInTheDocument();
  });

  it("removes the card after a while", async () => {
    const user = setup();
    renderApp();
    const dialog = await openDialog(user);
    await user.click(within(dialog).getByRole("button", { name: "Remove plan" }));
    await screen.findByText("Plan removed");
    act(() => {
      vi.advanceTimersByTime(8100);
    });
    expect(screen.queryByText("Plan removed")).not.toBeInTheDocument();
  });

  it("also works from the Overview and lands on the Week page", async () => {
    const user = setup();
    renderApp("/plan/overview");
    const dialog = await openDialog(user);
    await user.click(within(dialog).getByRole("button", { name: "Remove plan" }));
    expect(await screen.findByText("No training plan yet")).toBeInTheDocument();
  });

  it("clears every cache and local note about the plan", async () => {
    const user = setup();
    const { queryClient } = renderApp();
    await screen.findByRole("button", { name: /Plan options/ });
    // What the Summary and Calendar pages and the browser remember about the plan.
    queryClient.setQueryData(summaryKeys.plan(), PLAN_DATA);
    queryClient.setQueryData(summaryKeys.changes("plan-1"), []);
    window.localStorage.setItem(ICS_STORAGE_KEY, JSON.stringify({ fingerprint: "x" }));
    window.localStorage.setItem(
      SUMMARY_STORAGE_KEY,
      JSON.stringify({ week: { includeWeight: false } }),
    );
    window.localStorage.setItem("cycling-hub:plan-update-seen", "c-9");
    window.localStorage.setItem("cycling-hub:no-power-dismissed", "4");

    const dialog = await openDialog(user);
    await user.click(within(dialog).getByRole("button", { name: "Remove plan" }));
    await screen.findByText("No training plan yet");

    expect(queryClient.getQueryData(planKeys.active())).toBeNull();
    expect(queryClient.getQueryData(planKeys.sessions("plan-1"))).toBeUndefined();
    expect(queryClient.getQueryData(summaryKeys.plan())).toEqual({ plan: null, sessions: [] });
    expect(queryClient.getQueryData(summaryKeys.changes("plan-1"))).toBeUndefined();
    expect(window.localStorage.getItem(ICS_STORAGE_KEY)).toBeNull();
    expect(window.localStorage.getItem("cycling-hub:plan-update-seen")).toBeNull();
    expect(window.localStorage.getItem("cycling-hub:no-power-dismissed")).toBeNull();
    expect(queryClient.getQueryData(adaptationKeys.view())).toBeNull();
    // The Copy button choices are the PO's, not the plan's.
    expect(window.localStorage.getItem(SUMMARY_STORAGE_KEY)).not.toBeNull();
    // Rides, profile, goal and baseline were not touched.
    expect(api.savePlanProfile).not.toHaveBeenCalled();
    expect(api.saveWeightGoal).not.toHaveBeenCalled();
    expect(api.deletePlan).toHaveBeenCalledTimes(1);
  });

  it("shows the no-plan state on the Calendar and the Summary page, also after they were open before", async () => {
    const user = setup();
    renderApp("/plan/calendar");
    // The pages have seen the plan, so its data is in their cache.
    expect(await screen.findByText(/Sessions still to do/)).toBeInTheDocument();
    await user.click(screen.getByRole("link", { name: "Go to week summary" }));
    expect((await screen.findAllByText(/Training week/)).length).toBeGreaterThan(0);
    await user.click(screen.getByRole("link", { name: "Go to plan" }));
    const dialog = await openDialog(user);
    await user.click(within(dialog).getByRole("button", { name: "Remove plan" }));
    await screen.findByText("No training plan yet");

    await user.click(screen.getByRole("link", { name: "Go to calendar" }));
    expect(
      await screen.findByText("There is no plan to add to your calendar yet."),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Make a plan" })).toHaveAttribute("href", "/plan/new");

    await user.click(screen.getByRole("link", { name: "Go to session summary" }));
    expect(
      await screen.findByText("There are no planned sessions to summarise yet."),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("link", { name: "Go to week summary" }));
    expect(await screen.findByText(/^Week of /)).toBeInTheDocument();
    expect(screen.queryByText(/^Training week/)).not.toBeInTheDocument();
  });
});

describe("when it does not work", () => {
  it("says nothing was removed and removes it on Try again", async () => {
    const user = setup();
    vi.mocked(api.deletePlan).mockRejectedValueOnce(new Error("offline"));
    renderApp();
    const dialog = await openDialog(user);
    await user.click(within(dialog).getByRole("button", { name: "Remove plan" }));
    expect(await screen.findByText("Plan not removed")).toBeInTheDocument();
    expect(screen.getByText(/Nothing was removed/)).toBeInTheDocument();
    // The plan is still there.
    expect(screen.getByRole("navigation", { name: "Plan" })).toBeInTheDocument();
    expect(removed).toBe(false);
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("No training plan yet")).toBeInTheDocument();
    expect(screen.getByText("Plan removed")).toBeInTheDocument();
    expect(screen.queryByText("Plan not removed")).not.toBeInTheDocument();
    expect(api.deletePlan).toHaveBeenCalledTimes(2);
  });
});

describe("the runner without a plan", () => {
  it("does nothing: it does not evaluate, write or recreate anything", async () => {
    const user = setup();
    const { queryClient } = renderApp();
    const dialog = await openDialog(user);
    await user.click(within(dialog).getByRole("button", { name: "Remove plan" }));
    await screen.findByText("No training plan yet");
    runnerApi.writes.length = 0;
    const runner = runnerFor(queryClient, fakeSession().user.id);
    expect(await runner.run(TODAY)).toEqual({ status: "no-plan" });
    expect(await runner.preview(TODAY, db.plan.intake ?? ({} as never))).toEqual({
      status: "no-plan",
    });
    expect(runnerApi.writes).toEqual([]);
    expect(api.createPlan).not.toHaveBeenCalled();
    // A runner of its own, on an api without a plan, agrees.
    const bare = createRunner({ ...runnerApi, load: () => Promise.resolve(null) });
    expect(await bare.run(TODAY)).toEqual({ status: "no-plan" });
  });
});

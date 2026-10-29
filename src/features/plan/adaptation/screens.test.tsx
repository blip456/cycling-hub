import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type * as baselineApi from "@/features/baseline/api";
import * as ridesApi from "@/features/rides/api";
import type * as weightApi from "@/features/weight/api";
import { mockViewport } from "@/test/match-media";
import { fakeAuth, fakeSession, renderWithProviders } from "@/test/render";
import * as data from "../data/api";
import { mockPlanApi, NOW, planFixture } from "../data/test-support";
import { PlanUpdatedCard } from "../PlanUpdatedCard";
import { NoPowerDataWarning } from "../NoPowerDataWarning";
import { ChangesPage } from "../pages/ChangesPage";
import * as adaptApi from "./api";
import type { PlanChange } from "./changes";
import { NoPowerPage } from "./NoPowerPage";
import { fakeRide } from "./fake-api";
import { adaptationKeys } from "./hooks";
import type { AdaptationView } from "./runner";

vi.mock("../data/api", async (importOriginal) => ({
  ...(await importOriginal<typeof data>()),
  fetchActivePlan: vi.fn(),
  fetchPlanSessions: vi.fn(),
  updateSessions: vi.fn(),
  fetchPlanProfile: vi.fn(),
  savePlanProfile: vi.fn(),
  saveWeightGoal: vi.fn(),
  fetchActiveWeightGoal: vi.fn(),
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
vi.mock("@/features/rides/api", async (importOriginal) => ({
  ...(await importOriginal<typeof ridesApi>()),
  fetchRides: vi.fn(),
}));
vi.mock("./api", () => ({
  fetchPlanChanges: vi.fn(),
  createSupabaseRunnerApi: () => ({ load: () => Promise.resolve(null) }),
}));

const fixture = planFixture();

function change(over: Partial<PlanChange> = {}): PlanChange {
  return {
    id: "c1",
    planId: "plan-1",
    createdAt: "2026-10-28T08:12:00Z",
    undoneAt: null,
    message: "2 sessions changed because Tue 27 Oct was not ridden.",
    payload: {
      version: 1,
      message: "2 sessions changed because Tue 27 Oct was not ridden.",
      reasons: ["missed-session"],
      changes: [
        {
          date: "2026-10-29",
          change: "kind",
          before: { kind: "endurance", durationMin: 60, mainSet: null },
          after: { kind: "sweet-spot", durationMin: 65, mainSet: "2x12" },
          reasonCode: "missed-session",
          reason: "Part of the missed intervals moves here.",
        },
      ],
      fingerprint: fixture.plan.fingerprint,
      undo: {
        description: "Restores the plan as it was before Wed 28 Oct.",
        diff: { insert: [], update: [], delete: [] },
        restoreFingerprint: "old",
        undoneFingerprint: "pin",
      },
      before: { ftp: 250, intake: null },
    },
    ...over,
  };
}

function renderRoutes(path: string) {
  return renderWithProviders(
    <>
      <PlanUpdatedCard />
      <NoPowerDataWarning />
      <Routes>
        <Route path="/plan/changes" element={<ChangesPage />} />
        <Route path="/plan/no-power" element={<NoPowerPage />} />
        <Route path="/plan" element={<p>Plan page</p>} />
      </Routes>
    </>,
    { path, auth: fakeAuth({ status: "signedIn", session: fakeSession() }) },
  );
}

let viewport: ReturnType<typeof mockViewport>;
beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(NOW);
  window.localStorage.clear();
  viewport = mockViewport(390);
  mockPlanApi();
  vi.mocked(ridesApi.fetchRides).mockResolvedValue([]);
  vi.mocked(adaptApi.fetchPlanChanges).mockResolvedValue([]);
});
afterEach(() => {
  viewport.restore();
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("Plan updated card (R3)", () => {
  it("shows nothing without an update", async () => {
    renderRoutes("/plan");
    await screen.findByText("Plan page");
    expect(screen.queryByText("Plan updated")).not.toBeInTheDocument();
  });

  it("announces the newest update with See changes and Undo, and hides it once seen", async () => {
    const user = userEvent.setup({ advanceTimers: (ms) => vi.advanceTimersByTime(ms) });
    vi.mocked(adaptApi.fetchPlanChanges).mockResolvedValue([change()]);
    renderRoutes("/plan");
    const card = await screen.findByRole("status");
    expect(within(card).getByText("Plan updated")).toBeInTheDocument();
    expect(within(card).getByText(/Tue 27 Oct was not ridden/)).toBeInTheDocument();
    expect(within(card).getByRole("button", { name: "Undo" })).toBeInTheDocument();
    await user.click(within(card).getByRole("link", { name: "See changes" }));
    expect(await screen.findByText("Updated Wed 28 Oct, 09:12")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "See changes" })).not.toBeInTheDocument();
  });

  it("offers no Undo when the plan has moved on", async () => {
    const stale = change();
    stale.payload.fingerprint = "someone-else";
    vi.mocked(adaptApi.fetchPlanChanges).mockResolvedValue([stale]);
    renderRoutes("/plan");
    await screen.findByRole("link", { name: "See changes" });
    expect(screen.queryByRole("button", { name: "Undo" })).not.toBeInTheDocument();
  });
});

describe("Plan changes page (R4)", () => {
  it("shows a loading state, then the empty state", async () => {
    vi.mocked(adaptApi.fetchPlanChanges).mockReturnValue(new Promise(() => undefined));
    renderRoutes("/plan/changes");
    expect(await screen.findByRole("status")).toHaveTextContent("Loading your plan");
  });

  it("explains when there are no updates yet", async () => {
    renderRoutes("/plan/changes");
    expect(await screen.findByText(/No plan updates yet/)).toBeInTheDocument();
  });

  it("says when the updates could not be loaded", async () => {
    vi.mocked(adaptApi.fetchPlanChanges).mockRejectedValue(new Error("offline"));
    renderRoutes("/plan/changes");
    expect(await screen.findByText("We could not load your plan")).toBeInTheDocument();
  });

  it("lists before, now and why per session, with Undo all and earlier updates", async () => {
    const earlier = change({ id: "c0", message: "1 session changed because of a new FTP." });
    vi.mocked(adaptApi.fetchPlanChanges).mockResolvedValue([change(), earlier]);
    renderRoutes("/plan/changes");
    expect(await screen.findByText("Thu 29 Oct: Sweet spot")).toBeInTheDocument();
    expect(screen.getByText("Endurance, 1 h")).toBeInTheDocument();
    expect(screen.getByText("Sweet spot 2 x 12 min, 1 h 5")).toBeInTheDocument();
    expect(screen.getByText("Part of the missed intervals moves here.")).toBeInTheDocument();
    expect(screen.getByText("Restores the plan as it was before Wed 28 Oct.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Undo all" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Earlier updates (1)" })).toBeInTheDocument();
  });

  it("uses a table with header cells on desktop", async () => {
    viewport.restore();
    viewport = mockViewport(1280);
    vi.mocked(adaptApi.fetchPlanChanges).mockResolvedValue([change()]);
    renderRoutes("/plan/changes");
    expect(await screen.findByRole("columnheader", { name: "Why" })).toBeInTheDocument();
  });
});

describe("No power data (R7, R7b)", () => {
  const view = (count: number): AdaptationView => ({
    today: "2026-10-28",
    outcome: "unchanged",
    noPower: {
      count,
      dates: [],
      sessions: [],
      title: `No power data on ${String(count)} sessions`,
      message: "The plan stays the same. Power targets cannot be checked on these sessions.",
    },
    weight: null,
    inactivity: null,
    extraRides: 0,
    matches: {},
  });

  it("shows the card with the count and How to fix, and Not now hides it until the count changes", async () => {
    const user = userEvent.setup({ advanceTimers: (ms) => vi.advanceTimersByTime(ms) });
    const { queryClient } = renderRoutes("/plan");
    await screen.findByText("Plan page");
    queryClient.setQueryData(adaptationKeys.view(), view(5));
    const title = await screen.findByText("No power data on 5 sessions");
    expect(screen.getByRole("link", { name: "How to fix" })).toHaveAttribute(
      "href",
      "/plan/no-power",
    );
    await user.click(screen.getByRole("button", { name: "Not now" }));
    await waitFor(() => {
      expect(title).not.toBeInTheDocument();
    });
    queryClient.setQueryData(adaptationKeys.view(), view(6));
    expect(await screen.findByText("No power data on 6 sessions")).toBeInTheDocument();
  });

  it("lists the sessions on the how-to-fix page", async () => {
    const sessions = fixture.sessions.filter((s) => s.date < "2026-10-28" && s.kind !== "event");
    const rides = sessions.map((s) => fakeRide(s.date, s.durationMin, null));
    vi.mocked(data.fetchPlanSessions).mockResolvedValue(
      sessions.map((s, i) => ({
        ...s,
        status: "done" as const,
        activityId: rides[i]?.id ?? null,
        matchSource: "auto" as const,
      })),
    );
    vi.mocked(ridesApi.fetchRides).mockResolvedValue(rides);
    renderRoutes("/plan/no-power");
    expect(await screen.findByText(/Last 4 weeks, \d+ sessions/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to Import" })).toHaveAttribute("href", "/import");
    expect(screen.getAllByText("no power channel").length).toBeGreaterThan(3);
  });

  it("says there is nothing to fix with few sessions, and shows an error when rides fail", async () => {
    renderRoutes("/plan/no-power");
    expect(await screen.findByText(/nothing to fix/)).toBeInTheDocument();
  });

  it("shows the error state when the rides cannot be loaded", async () => {
    vi.mocked(ridesApi.fetchRides).mockRejectedValue(new Error("offline"));
    renderRoutes("/plan/no-power");
    expect(await screen.findByText("We could not load your plan")).toBeInTheDocument();
  });
});

import { screen, within } from "@testing-library/react";
import { Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fakeAuth, fakeSession, renderWithProviders } from "@/test/render";
import * as adaptationApi from "../adaptation/api";
import type { PlanChange } from "../adaptation/changes";
import * as api from "../data/api";
import { planFixture } from "../data/test-support";
import { ChangesPage } from "./ChangesPage";

vi.mock("../data/api", async (importOriginal) => ({
  ...(await importOriginal<typeof api>()),
  fetchActivePlan: vi.fn(),
}));
vi.mock("../adaptation/api", () => ({
  createSupabaseRunnerApi: vi.fn(),
  fetchPlanChanges: vi.fn(),
}));

const CHANGE: PlanChange = {
  id: "c-1",
  planId: "plan-1",
  createdAt: "2026-10-28T09:00:00Z",
  undoneAt: null,
  message: "2 sessions changed because you edited your plan.",
  payload: {
    version: 1,
    message: "2 sessions changed because you edited your plan.",
    reasons: ["plan-edited"],
    changes: [
      {
        date: "2026-10-30",
        change: "minutes",
        before: { kind: "endurance", durationMin: 60, mainSet: null },
        after: { kind: "endurance", durationMin: 75, mainSet: null },
        reasonCode: "plan-edited",
        reason: "You edited your plan, so this session was recalculated.",
      },
      {
        date: "2026-12-12",
        change: "removed",
        before: { kind: "event", durationMin: 240, mainSet: null },
        after: null,
        reasonCode: "plan-edited",
        reason: "You edited your plan, so this session was recalculated.",
      },
    ],
    fingerprint: "f",
    undo: null,
    before: { ftp: 250, intake: null },
  },
};

function renderPage() {
  return renderWithProviders(
    <Routes>
      <Route path="/plan/changes" element={<ChangesPage />} />
    </Routes>,
    { path: "/plan/changes", auth: fakeAuth({ status: "signedIn", session: fakeSession() }) },
  );
}

beforeEach(() => {
  vi.mocked(api.fetchActivePlan).mockResolvedValue(planFixture().plan);
  vi.mocked(adaptationApi.fetchPlanChanges).mockResolvedValue([CHANGE]);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("the list of plan changes", () => {
  it("lists what changed, before and now, with the reason", async () => {
    renderPage();
    const update = await screen.findByRole("region", {
      name: "2 sessions changed because you edited your plan.",
    });
    expect(within(update).getAllByRole("listitem")).toHaveLength(2);
    expect(within(update).getByText(/Endurance, 60 min/)).toBeInTheDocument();
    expect(within(update).getByText(/Endurance, 75 min/)).toBeInTheDocument();
    expect(within(update).getByText(/no session/)).toBeInTheDocument();
    expect(
      within(update).getAllByText("You edited your plan, so this session was recalculated."),
    ).toHaveLength(2);
  });

  it("says when nothing was updated yet", async () => {
    vi.mocked(adaptationApi.fetchPlanChanges).mockResolvedValue([]);
    renderPage();
    expect(await screen.findByText("Your plan has not been updated yet.")).toBeInTheDocument();
  });

  it("marks an update that was undone", async () => {
    vi.mocked(adaptationApi.fetchPlanChanges).mockResolvedValue([
      { ...CHANGE, undoneAt: "2026-10-28T09:05:00Z" },
    ]);
    renderPage();
    expect(await screen.findByText(/Undone/)).toBeInTheDocument();
  });

  it("offers a plan when there is none", async () => {
    vi.mocked(api.fetchActivePlan).mockResolvedValue(null);
    renderPage();
    expect(
      await screen.findByText("There is no plan, so there are no updates."),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Create my plan" })).toHaveAttribute(
      "href",
      "/plan/new",
    );
  });

  it("says it could not load and tries again", async () => {
    vi.mocked(adaptationApi.fetchPlanChanges).mockRejectedValueOnce(new Error("offline"));
    renderPage();
    expect(await screen.findByText("We could not load your plan")).toBeInTheDocument();
  });
});

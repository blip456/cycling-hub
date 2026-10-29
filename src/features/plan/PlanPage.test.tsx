import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as baselineApi from "@/features/baseline/api";
import * as weightApi from "@/features/weight/api";
import { UNDO_MS } from "@/features/weight/use-weight-cards";
import { mockViewport } from "@/test/match-media";
import { fakeAuth, fakeSession, renderWithProviders } from "@/test/render";
import * as api from "./data/api";
import { mockPlanApi, NOW, planFixture, PLAN_INPUT, TODAY } from "./data/test-support";
import { PlanPage } from "./PlanPage";

vi.mock("./data/api", async (importOriginal) => {
  const actual = await importOriginal<typeof api>();
  return {
    ...actual,
    fetchActivePlan: vi.fn(),
    fetchPlanSessions: vi.fn(),
    updateSessions: vi.fn(),
    createPlan: vi.fn(),
    fetchPlanProfile: vi.fn(),
    savePlanProfile: vi.fn(),
    fetchActiveWeightGoal: vi.fn(),
    saveWeightGoal: vi.fn(),
  };
});
vi.mock("@/features/baseline/api", async (importOriginal) => ({
  ...(await importOriginal<typeof baselineApi>()),
  fetchCurrentBaseline: vi.fn(),
  fetchBaselineEntries: vi.fn(),
}));
vi.mock("@/features/weight/api", async (importOriginal) => ({
  ...(await importOriginal<typeof weightApi>()),
  fetchWeightEntries: vi.fn(),
}));

const fixture = planFixture();
const today = fixture.sessions.find((s) => s.date === TODAY);
if (!today) throw new Error("the fixture has no session today");

function renderPage(path = "/plan") {
  return renderWithProviders(
    <Routes>
      <Route path="/plan/*" element={<PlanPage />} />
    </Routes>,
    { path, auth: fakeAuth({ status: "signedIn", session: fakeSession() }) },
  );
}

function setup() {
  return userEvent.setup({ advanceTimers: (ms) => vi.advanceTimersByTime(ms) });
}

let viewport: ReturnType<typeof mockViewport>;

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(NOW);
  viewport = mockViewport(390);
  mockPlanApi();
});

afterEach(() => {
  viewport.restore();
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("loading, error and empty states", () => {
  it("shows a loading state first", () => {
    vi.mocked(api.fetchActivePlan).mockReturnValue(new Promise(() => undefined));
    renderPage();
    expect(screen.getByRole("status")).toHaveTextContent("Loading your plan");
  });

  it("says the plan could not be loaded, shows the card and tries again", async () => {
    const user = setup();
    vi.mocked(api.fetchActivePlan).mockRejectedValueOnce(new Error("offline"));
    renderPage();
    expect(await screen.findByText("We could not load your plan")).toBeInTheDocument();
    expect(
      screen.getByText("Your plan is safe. The page could not reach the server."),
    ).toBeInTheDocument();
    expect(screen.getByText("Plan not loaded")).toBeInTheDocument();
    await user.click(screen.getAllByRole("button", { name: "Try again" })[0] as HTMLElement);
    expect(await screen.findByRole("heading", { name: /Week 5 of 12/ })).toBeInTheDocument();
  });

  it("says when the sessions could not be loaded", async () => {
    vi.mocked(api.fetchPlanSessions).mockRejectedValue(new Error("offline"));
    renderPage();
    expect(await screen.findByText("We could not load your plan")).toBeInTheDocument();
  });

  it("shows the empty state without a plan: what the plan will use and one primary action", async () => {
    mockPlanApi(null);
    renderPage();
    expect(
      await screen.findByRole("heading", { name: "No training plan yet" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Create my plan" })).toHaveAttribute(
      "href",
      "/plan/new",
    );
    expect(screen.getByText("FTP 250 W (baseline of 11 Oct)")).toBeInTheDocument();
    expect(screen.getByText("Training days from your profile")).toBeInTheDocument();
    expect(screen.getByText("Latest weight 78.4 kg")).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Plan" })).not.toBeInTheDocument();
  });

  it("turns a missing day or weight into a link to the page that fixes it", async () => {
    mockPlanApi(null);
    vi.mocked(api.fetchPlanProfile).mockResolvedValue({
      ridingEnvironment: null,
      weeklyHours: null,
      trainingPurposes: [],
      levelAnswers: null,
      eventName: null,
      eventDate: null,
      availableDays: ["mon"],
    });
    vi.mocked(weightApi.fetchWeightEntries).mockResolvedValue([]);
    renderPage();
    expect(await screen.findByRole("link", { name: "Add days in your profile" })).toHaveAttribute(
      "href",
      "/profile",
    );
    expect(screen.getByRole("link", { name: "Log your weight" })).toHaveAttribute(
      "href",
      "/weight",
    );
  });

  it("shows the empty state without an FTP, with the three ways to get one", async () => {
    mockPlanApi(null);
    vi.mocked(baselineApi.fetchCurrentBaseline).mockResolvedValue(null);
    renderPage();
    expect(
      await screen.findByRole("heading", { name: "Your plan needs an FTP first" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Estimate it from my rides/ })).toHaveAttribute(
      "href",
      "/baseline/suggestion",
    );
    expect(screen.getByRole("link", { name: /Enter it myself/ })).toHaveAttribute(
      "href",
      "/baseline/values",
    );
    expect(screen.getByRole("link", { name: /Do the guided test week/ })).toHaveAttribute(
      "href",
      "/baseline/test-week",
    );
    expect(screen.queryByRole("link", { name: "Create my plan" })).not.toBeInTheDocument();
  });
});

describe("Week tab", () => {
  it("shows today's session on top and the tabs", async () => {
    renderPage();
    const card = await screen.findByRole("article", { name: "Today's session" });
    expect(within(card).getByRole("heading", { name: "Today · Wed 28 Oct" })).toBeInTheDocument();
    expect(card).toHaveTextContent(today.title);
    expect(card).toHaveTextContent("Week 5 · Build");
    expect(card).toHaveTextContent(/Main set: \d × \d+ min at .* W \(Z\d · /);
    expect(within(card).getByRole("link", { name: "Open session" })).toHaveAttribute(
      "href",
      `/plan/session/${today.id}`,
    );
    const tabs = screen.getByRole("navigation", { name: "Plan" });
    expect(within(tabs).getByRole("link", { name: "Week" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(within(tabs).getByRole("link", { name: "Overview" })).toHaveAttribute(
      "href",
      "/plan/overview",
    );
  });

  it("lists the days of the current week with today marked and the status as text", async () => {
    renderPage();
    expect(
      await screen.findByRole("heading", { name: "Week 5 of 12 · Build" }),
    ).toBeInTheDocument();
    expect(screen.getByText("26 Oct – 1 Nov")).toBeInTheDocument();
    const days = within(screen.getByRole("list", { name: "Days of week 5" })).getAllByRole(
      "listitem",
    );
    expect(days).toHaveLength(7);
    expect(days[0]).toHaveTextContent("Rest day (not one of your training days)");
    expect(days[2]).toHaveTextContent("Today");
    expect(days[2]).toHaveTextContent(today.title);
    expect(days[2]).toHaveTextContent("Planned");
    expect(
      within(days[2] as HTMLElement).getByRole("link", {
        name: new RegExp(`Wednesday 28 Oct, today, ${today.title}`),
      }),
    ).toBeInTheDocument();
  });

  it("goes to the next and the previous week", async () => {
    const user = setup();
    renderPage();
    await screen.findByRole("heading", { name: "Week 5 of 12 · Build" });
    await user.click(screen.getByRole("button", { name: "Go to week 6" }));
    expect(
      await screen.findByRole("heading", { name: "Week 6 of 12 · Build" }),
    ).toBeInTheDocument();
    expect(screen.getByText("2 Nov – 8 Nov")).toBeInTheDocument();
    for (const week of [5, 4, 3]) {
      await user.click(screen.getByRole("button", { name: `Go to week ${String(week)}` }));
    }
    expect(await screen.findByRole("heading", { name: /Week 3 of 12/ })).toBeInTheDocument();
  });

  it("opens the week in the address (from the Overview)", async () => {
    renderPage("/plan?week=11");
    expect(
      await screen.findByRole("heading", { name: /Week 11 of 12 · Taper/ }),
    ).toBeInTheDocument();
  });

  it("shows the week as seven columns on a wide desktop", async () => {
    viewport.resize(1280);
    renderPage();
    await screen.findByRole("heading", { name: "Week 5 of 12 · Build" });
    const days = within(screen.getByRole("list", { name: "Days of week 5" })).getAllByRole(
      "listitem",
    );
    expect(days).toHaveLength(7);
    expect(screen.getByRole("button", { name: "Go to week 6" })).toHaveTextContent("Week 6");
  });

  it("shows a rest day card with the next session", async () => {
    vi.setSystemTime(new Date("2026-10-29T10:00:00Z"));
    renderPage();
    const card = await screen.findByRole("article", { name: "Today's session" });
    expect(card).toHaveTextContent("Rest day");
    expect(card).toHaveTextContent(/Nothing planned\. Next: Fri 30 Oct, /);
  });

  it("shows the plan start before the first day", async () => {
    vi.setSystemTime(new Date("2026-09-20T10:00:00Z"));
    renderPage();
    const card = await screen.findByRole("article", { name: "Today's session" });
    expect(card).toHaveTextContent("Your plan starts Mon 28 Sep");
    expect(await screen.findByRole("heading", { name: /Week 1 of 12/ })).toBeInTheDocument();
  });
});

describe("actions with Undo", () => {
  it("marks today's session as done from the card and undoes it", async () => {
    const user = setup();
    renderPage();
    const card = await screen.findByRole("article", { name: "Today's session" });
    await user.click(within(card).getByRole("button", { name: "Mark as done" }));
    await waitFor(() => {
      expect(api.updateSessions).toHaveBeenCalledWith([
        { id: today.id, patch: { status: "done", matchSource: "manual" } },
      ]);
    });
    expect(await screen.findByText(`${today.title} marked as done.`)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Undo" }));
    await waitFor(() => {
      expect(api.updateSessions).toHaveBeenLastCalledWith([
        { id: today.id, patch: { status: "planned", matchSource: null } },
      ]);
    });
    expect(await screen.findByText("Change undone.")).toBeInTheDocument();
  });

  it("shows the new status at once", async () => {
    const user = setup();
    vi.mocked(api.updateSessions).mockReturnValue(new Promise(() => undefined));
    renderPage();
    const card = await screen.findByRole("article", { name: "Today's session" });
    await user.click(within(card).getByRole("button", { name: "Mark as done" }));
    expect(await screen.findByRole("heading", { name: /Today/ })).toBeInTheDocument();
    await waitFor(() => {
      const row = within(screen.getByRole("list", { name: "Days of week 5" })).getAllByRole(
        "listitem",
      )[2];
      expect(row).toHaveTextContent("Done");
    });
  });

  it("keeps the Undo card for about 8 seconds, then removes it", async () => {
    const user = setup();
    renderPage();
    const card = await screen.findByRole("article", { name: "Today's session" });
    await user.click(within(card).getByRole("button", { name: "Mark as done" }));
    expect(await screen.findByText(`${today.title} marked as done.`)).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(UNDO_MS + 100);
    });
    expect(screen.queryByText(`${today.title} marked as done.`)).not.toBeInTheDocument();
  });

  it("opens the menu from a row, closes it with Escape and returns focus to the button", async () => {
    const user = setup();
    renderPage();
    await screen.findByRole("heading", { name: "Week 5 of 12 · Build" });
    const button = screen.getAllByRole("button", {
      name: `More actions for ${today.title}`,
    })[0] as HTMLElement;
    await user.click(button);
    const items = screen.getAllByRole("menuitem").map((i) => i.textContent);
    expect(items).toEqual(["Mark as done", "Move to another day", "Skip this session"]);
    expect(screen.getAllByRole("menuitem")[0]).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(screen.getAllByRole("menuitem")[1]).toHaveFocus();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(button).toHaveFocus();
  });

  it("asks before skipping, keeps Cancel as the safe choice and skips with a reason", async () => {
    const user = setup();
    renderPage();
    await screen.findByRole("heading", { name: "Week 5 of 12 · Build" });
    const row = within(screen.getByRole("list", { name: "Days of week 5" })).getAllByRole(
      "listitem",
    )[2] as HTMLElement;
    await user.click(within(row).getByRole("button", { name: /More actions/ }));
    await user.click(screen.getByRole("menuitem", { name: "Skip this session" }));
    const dialog = screen.getByRole("dialog", { name: `Skip ${today.title}?` });
    expect(dialog).toHaveTextContent("The session stays in the plan as skipped");
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(api.updateSessions).not.toHaveBeenCalled();

    await user.click(within(row).getByRole("button", { name: /More actions/ }));
    await user.click(screen.getByRole("menuitem", { name: "Skip this session" }));
    const again = screen.getByRole("dialog", { name: `Skip ${today.title}?` });
    await user.click(within(again).getByRole("radio", { name: "Ill or injured" }));
    await user.click(within(again).getByRole("button", { name: "Skip session" }));
    await waitFor(() => {
      expect(api.updateSessions).toHaveBeenCalledWith([
        { id: today.id, patch: { status: "skipped" } },
      ]);
    });
    expect(await screen.findByText(`${today.title} skipped (ill or injured).`)).toBeInTheDocument();
  });

  it("moves a session to a free day with the warning in words, and undoes it", async () => {
    const user = setup();
    renderPage();
    await screen.findByRole("heading", { name: "Week 5 of 12 · Build" });
    const row = within(screen.getByRole("list", { name: "Days of week 5" })).getAllByRole(
      "listitem",
    )[2] as HTMLElement;
    await user.click(within(row).getByRole("button", { name: /More actions/ }));
    await user.click(screen.getByRole("menuitem", { name: "Move to another day" }));
    const dialog = screen.getByRole("dialog", { name: `Move ${today.title}` });
    const labels = within(dialog)
      .getAllByRole("radio")
      .map((r) => r.closest("label")?.textContent);
    expect(labels).toEqual([
      expect.stringContaining("Thu 29 Oct"),
      expect.stringContaining("Fri 30 Oct"),
      expect.stringContaining("Sat 31 Oct"),
      expect.stringContaining("Sun 1 Nov"),
    ]);
    expect(dialog).toHaveTextContent("Free. Not one of your training days");
    await user.click(within(dialog).getByRole("radio", { name: /Thu 29 Oct/ }));
    expect(within(dialog).getByRole("note")).toHaveTextContent(
      "Thursday is not one of your training days. The session is moved anyway.",
    );
    await user.click(within(dialog).getByRole("button", { name: "Move session" }));
    await waitFor(() => {
      expect(api.updateSessions).toHaveBeenCalledWith([
        { id: today.id, patch: { date: "2026-10-29", movedFrom: TODAY } },
      ]);
    });
    expect(await screen.findByText(`${today.title} moved to Thu 29 Oct.`)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Undo" }));
    await waitFor(() => {
      expect(api.updateSessions).toHaveBeenLastCalledWith([
        { id: today.id, patch: { date: TODAY, movedFrom: null } },
      ]);
    });
  });

  it("swaps two sessions when the day is taken", async () => {
    const user = setup();
    renderPage();
    await screen.findByRole("heading", { name: "Week 5 of 12 · Build" });
    const friday = fixture.sessions.find((s) => s.date === "2026-10-30");
    if (!friday) throw new Error("no session on Friday");
    const row = within(screen.getByRole("list", { name: "Days of week 5" })).getAllByRole(
      "listitem",
    )[2] as HTMLElement;
    await user.click(within(row).getByRole("button", { name: /More actions/ }));
    await user.click(screen.getByRole("menuitem", { name: "Move to another day" }));
    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("radio", { name: /Fri 30 Oct/ }));
    await user.click(within(dialog).getByRole("button", { name: "Move session" }));
    await waitFor(() => {
      expect(api.updateSessions).toHaveBeenCalledWith([
        { id: today.id, patch: { date: "2026-10-30", movedFrom: TODAY } },
        { id: friday.id, patch: { date: TODAY, movedFrom: "2026-10-30" } },
      ]);
    });
    expect(
      await screen.findByText(`${today.title} and ${friday.title} swapped days.`),
    ).toBeInTheDocument();
  });

  it("says nothing was changed when the save fails and offers to try again", async () => {
    const user = setup();
    vi.mocked(api.updateSessions).mockRejectedValueOnce(new Error("offline"));
    renderPage();
    const card = await screen.findByRole("article", { name: "Today's session" });
    await user.click(within(card).getByRole("button", { name: "Mark as done" }));
    expect(await screen.findByText("Could not save the change")).toBeInTheDocument();
    expect(screen.getByText(/Nothing was changed/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText(`${today.title} marked as done.`)).toBeInTheDocument();
    expect(api.updateSessions).toHaveBeenCalledTimes(2);
  });

  it("offers no menu for a session that is done", async () => {
    const done = fixture.sessions.map((s) =>
      s.id === today.id ? { ...s, status: "done" as const } : s,
    );
    vi.mocked(api.fetchPlanSessions).mockResolvedValue(done);
    renderPage();
    const card = await screen.findByRole("article", { name: "Today's session" });
    expect(card).toHaveTextContent(`Done: ${today.title}`);
    expect(card).toHaveTextContent(/Marked as done\. /);
    expect(
      screen.queryByRole("button", { name: `More actions for ${today.title}` }),
    ).not.toBeInTheDocument();
  });
});

describe("Overview tab", () => {
  it("lists the 12 weeks under their phases with this week marked", async () => {
    renderPage("/plan/overview");
    expect(
      await screen.findByRole("heading", { name: "Week 5 of 12 · Build" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Event: Sat 19 Dec, in 52 days")).toBeInTheDocument();
    const groups = screen
      .getAllByRole("region")
      .map((r) => r.getAttribute("aria-label"))
      .filter(Boolean);
    expect(groups).toEqual([
      "Base, weeks 1 to 3",
      "Recovery, week 4",
      "Build, weeks 5 to 7",
      "Recovery, week 8",
      "Peak, weeks 9 to 10",
      "Taper, weeks 11 to 12",
    ]);
    const current = screen.getByRole("link", { name: /^Week 5, 26 Oct, this week/ });
    expect(current).toHaveAttribute("aria-current", "true");
    expect(current).toHaveAttribute("href", "/plan?week=5");
    expect(current).toHaveTextContent("This week");
    expect(screen.getByRole("link", { name: /^Week 12, .*event Sat 19 Dec/ })).toBeInTheDocument();
  });

  it("shows the column chart on desktop with the table as an alternative", async () => {
    const user = setup();
    viewport.resize(1280);
    renderPage("/plan/overview");
    await screen.findByRole("heading", { name: "Week 5 of 12 · Build" });
    expect(screen.getAllByRole("link", { name: /^Week \d+, \w+, load \d+/ })).toHaveLength(12);
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Show as table" }));
    const table = screen.getByRole("table", { name: "Planned hours and load for each week" });
    expect(within(table).getAllByRole("row")).toHaveLength(13);
    expect(
      within(table)
        .getAllByRole("columnheader")
        .map((c) => c.textContent),
    ).toEqual(["Week", "Dates", "Phase", "Hours", "Load"]);
    await user.click(screen.getByRole("button", { name: "Hide table" }));
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("shows the weight card only with weight loss as a purpose", async () => {
    renderPage("/plan/overview");
    await screen.findByRole("heading", { name: "Week 5 of 12 · Build" });
    expect(screen.queryByRole("heading", { name: "Weight" })).not.toBeInTheDocument();

    const loss = planFixture({
      ...PLAN_INPUT,
      intake: {
        ...PLAN_INPUT.intake,
        purposes: ["weight-loss", "endurance"],
        weightKg: 78.4,
        weightGoal: { targetKg: 76, targetDate: "2026-12-19" },
      },
    });
    mockPlanApi(loss);
    vi.mocked(api.fetchActiveWeightGoal).mockResolvedValue({
      targetKg: 76,
      targetDate: "2026-12-19",
      startKg: 78.4,
      startDate: "2026-10-01",
    });
    renderPage("/plan/overview");
    const card = await screen.findByRole("region", { name: "Weight" });
    await waitFor(() => expect(card).toHaveTextContent("78.4 kg"));
    expect(card).toHaveTextContent("Target 76.0 kg by Sat 19 Dec.");
    expect(card).toHaveTextContent(/Your trend is 0\.\d kg per week, inside the cap of 0\.4 kg\./);
    expect(within(card).getByRole("link", { name: "See weight trend" })).toHaveAttribute(
      "href",
      "/weight/trend",
    );
  });
});

describe("Session page", () => {
  const quality = fixture.sessions.find(
    (s) => s.week === 5 && (s.kind === "sweet-spot" || s.kind === "threshold"),
  );
  if (!quality) throw new Error("no quality session in week 5");

  it("shows the steps with watts, heart rate and the zones as number and name", async () => {
    renderPage(`/plan/session/${quality.id}`);
    expect(await screen.findByRole("heading", { name: quality.title })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Why this session" })).toBeInTheDocument();
    expect(screen.getByText(quality.reason)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "1. Warm-up" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "2. Main set" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "3. Cool-down" })).toBeInTheDocument();
    expect(screen.getAllByText(/^Z4 · Threshold$/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/ W$/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/ bpm$/).length).toBeGreaterThan(0);
  });

  it("changes where it is ridden when the plan is both indoor and outdoor", async () => {
    const user = setup();
    renderPage(`/plan/session/${quality.id}`);
    await screen.findByRole("heading", { name: quality.title });
    const group = screen.getByRole("group", { name: "Where do you ride it?" });
    expect(within(group).getByRole("radio", { name: "Indoor" })).toBeChecked();
    await user.click(within(group).getByRole("radio", { name: "Outdoor" }));
    await waitFor(() => {
      expect(api.updateSessions).toHaveBeenCalledWith([
        { id: quality.id, patch: { indoor: false } },
      ]);
    });
    expect(await screen.findByText(`${quality.title} set to outdoor.`)).toBeInTheDocument();
  });

  it("does not ask where to ride when the profile says indoor or outdoor only", async () => {
    const outdoor = planFixture({
      ...PLAN_INPUT,
      intake: { ...PLAN_INPUT.intake, environment: "outdoor" },
    });
    mockPlanApi(outdoor);
    const id =
      outdoor.sessions.find((s) => s.kind === "sweet-spot" || s.kind === "threshold")?.id ?? "";
    renderPage(`/plan/session/${id}`);
    await screen.findByText("Why this session");
    expect(screen.queryByRole("group", { name: "Where do you ride it?" })).not.toBeInTheDocument();
    expect(screen.getByText("Outdoor")).toBeInTheDocument();
  });

  it("marks the session as done, moves it and skips it from the page", async () => {
    const user = setup();
    vi.mocked(api.updateSessions).mockReturnValue(new Promise(() => undefined));
    renderPage(`/plan/session/${quality.id}`);
    await screen.findByRole("heading", { name: quality.title });
    await user.click(screen.getByRole("button", { name: "Mark as done" }));
    await waitFor(() => {
      expect(api.updateSessions).toHaveBeenCalledWith([
        { id: quality.id, patch: { status: "done", matchSource: "manual" } },
      ]);
    });
    expect(await screen.findByText(/· Done$/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Skip" })).not.toBeInTheDocument();
  });

  it("opens the move and skip dialogs from the page", async () => {
    const user = setup();
    renderPage(`/plan/session/${quality.id}`);
    await screen.findByRole("heading", { name: quality.title });
    await user.click(screen.getByRole("button", { name: "Move to another day" }));
    expect(screen.getByRole("dialog", { name: `Move ${quality.title}` })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await user.click(screen.getByRole("button", { name: "Skip" }));
    expect(screen.getByRole("dialog", { name: `Skip ${quality.title}?` })).toBeInTheDocument();
  });

  it("says when the session is no longer in the plan", async () => {
    renderPage("/plan/session/gone");
    expect(
      await screen.findByRole("heading", { name: "This session is no longer in your plan" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to the week" })).toHaveAttribute("href", "/plan");
  });

  it("shows loading and error states", async () => {
    vi.mocked(api.fetchActivePlan).mockReturnValue(new Promise(() => undefined));
    const first = renderPage(`/plan/session/${quality.id}`);
    expect(screen.getByRole("status")).toHaveTextContent("Loading your plan");
    first.unmount();
    vi.mocked(api.fetchActivePlan).mockRejectedValue(new Error("offline"));
    renderPage(`/plan/session/${quality.id}`);
    expect(await screen.findByText("We could not load your plan")).toBeInTheDocument();
  });

  it("shows the event as an event, without steps", async () => {
    const event = fixture.sessions.find((s) => s.kind === "event");
    if (!event) throw new Error("no event");
    renderPage(`/plan/session/${event.id}`);
    expect(await screen.findByRole("heading", { name: event.title })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Steps" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Mark as done" })).not.toBeInTheDocument();
  });
});

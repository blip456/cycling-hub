import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as baselineApi from "@/features/baseline/api";
import * as weightApi from "@/features/weight/api";
import { mockViewport } from "@/test/match-media";
import { fakeAuth, fakeSession, renderWithProviders } from "@/test/render";
import * as api from "./data/api";
import { EMPTY_PLAN_PROFILE, type PlanProfile } from "./data";
import { mockPlanApi, NOW, planFixture } from "./data/test-support";
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

const DAYS = ["tue", "wed", "fri", "sat", "sun"] as const;

/** A profile that already holds every answer, so the summary opens directly. */
const FULL_PROFILE: PlanProfile = {
  ...EMPTY_PLAN_PROFILE,
  ridingEnvironment: "both",
  weeklyHours: 8,
  trainingPurposes: ["endurance", "speed"],
  levelAnswers: [2, 2, 2, 1, 1],
  availableDays: [...DAYS],
};

function renderIntake(path = "/plan/new") {
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

function profile(over: Partial<PlanProfile> = {}) {
  vi.mocked(api.fetchPlanProfile).mockResolvedValue({
    ...EMPTY_PLAN_PROFILE,
    availableDays: [...DAYS],
    ...over,
  });
}

let viewport: ReturnType<typeof mockViewport>;

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(NOW);
  viewport = mockViewport(390);
  mockPlanApi(null);
  vi.mocked(api.createPlan).mockResolvedValue({
    ...planFixture().plan,
    startDate: "2026-11-02",
    weeks: 12,
  });
});

afterEach(() => {
  viewport.restore();
  vi.useRealTimers();
  vi.clearAllMocks();
});

async function choose(user: ReturnType<typeof setup>, group: string, answer: string) {
  const fieldset = screen.getByRole("group", { name: group });
  await user.click(within(fieldset).getByRole("radio", { name: answer }));
}

describe("before the questions", () => {
  it("shows a loading state", () => {
    vi.mocked(api.fetchPlanProfile).mockReturnValue(new Promise(() => undefined));
    renderIntake();
    expect(screen.getByRole("status")).toHaveTextContent("Loading your plan");
  });

  it("says when it could not load and tries again", async () => {
    const user = setup();
    vi.mocked(api.fetchPlanProfile).mockRejectedValueOnce(new Error("offline"));
    renderIntake();
    expect(await screen.findByText("We could not load your plan")).toBeInTheDocument();
    await user.click(screen.getAllByRole("button", { name: "Try again" })[0] as HTMLElement);
    expect(
      await screen.findByRole("heading", { name: "What do you want from this plan?" }),
    ).toBeInTheDocument();
  });

  it("shows the empty state of the baseline instead of the questions when there is no FTP", async () => {
    vi.mocked(baselineApi.fetchCurrentBaseline).mockResolvedValue(null);
    renderIntake();
    expect(
      await screen.findByRole("heading", { name: "Your plan needs an FTP first" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Next/ })).not.toBeInTheDocument();
  });
});

describe("step 1: purposes", () => {
  it("starts empty with visible labels and no placeholders", async () => {
    renderIntake();
    expect(
      await screen.findByRole("heading", { name: "What do you want from this plan?" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Step 1 of 4")).toBeInTheDocument();
    const group = screen.getByRole("group", { name: "Which purposes apply?" });
    expect(
      within(group)
        .getAllByRole("checkbox")
        .map((c) => c.closest("label")?.textContent),
    ).toEqual([
      "EnduranceRide longer and stay strong for hours",
      "SpeedShort hard efforts, faster average",
      "Muscle buildingStrength work on the bike, with notes for off the bike",
      "Weight lossLower weight at a safe weekly pace",
    ]);
    expect(
      within(group)
        .getAllByRole("checkbox")
        .every((c) => !(c as HTMLInputElement).checked),
    ).toBe(true);
    expect(screen.queryByRole("heading", { name: "Your order" })).not.toBeInTheDocument();
    for (const input of document.querySelectorAll("input"))
      expect(input).not.toHaveAttribute("placeholder");
  });

  it("needs at least one purpose and puts the focus on the group", async () => {
    const user = setup();
    renderIntake();
    await screen.findByRole("heading", { name: "What do you want from this plan?" });
    await user.click(screen.getByRole("button", { name: "Next: Level" }));
    expect(screen.getByText("Choose at least one purpose.")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: /^Endurance/ })).toHaveFocus();
    expect(screen.getByRole("checkbox", { name: /^Endurance/ })).toHaveAccessibleDescription(
      /Choose at least one purpose\./,
    );
    expect(api.savePlanProfile).not.toHaveBeenCalled();
  });

  it("allows two purposes: a main and a secondary one", async () => {
    const user = setup();
    renderIntake();
    await screen.findByRole("heading", { name: "What do you want from this plan?" });
    await user.click(screen.getByRole("checkbox", { name: /^Endurance/ }));
    await user.click(screen.getByRole("checkbox", { name: /^Speed/ }));
    expect(screen.getByRole("checkbox", { name: /^Muscle building/ })).toBeDisabled();
    expect(screen.getByRole("checkbox", { name: /^Weight loss/ })).toBeDisabled();
    const order = screen.getByRole("list");
    const items = within(order).getAllByRole("listitem");
    expect(items[0]).toHaveTextContent("Endurance");
    expect(items[0]).toHaveTextContent("main");
    expect(items[1]).toHaveTextContent("Speed");
    expect(items[1]).toHaveTextContent("secondary");
  });

  it("ranks with Move up and Move down, keeps the focus and says the new place", async () => {
    const user = setup();
    renderIntake();
    await screen.findByRole("heading", { name: "What do you want from this plan?" });
    await user.click(screen.getByRole("checkbox", { name: /^Endurance/ }));
    await user.click(screen.getByRole("checkbox", { name: /^Speed/ }));
    expect(screen.getByRole("button", { name: "Move Endurance up" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    expect(screen.getByRole("button", { name: "Move Speed down" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    await user.click(screen.getByRole("button", { name: "Move Speed up" }));
    const items = within(screen.getByRole("list")).getAllByRole("listitem");
    expect(items[0]).toHaveTextContent("Speed");
    expect(items[0]).toHaveTextContent("main");
    expect(screen.getByRole("status")).toHaveTextContent("Speed is now number 1");
    expect(screen.getByRole("button", { name: "Move Speed up" })).toHaveFocus();
    await user.click(screen.getByRole("button", { name: "Move Speed down" }));
    expect(screen.getByRole("status")).toHaveTextContent("Speed is now number 2");
    expect(screen.getByRole("button", { name: "Move Speed down" })).toHaveFocus();
  });

  it("opens the weight goal with weight loss and checks target and date", async () => {
    const user = setup();
    renderIntake();
    await screen.findByRole("heading", { name: "What do you want from this plan?" });
    expect(screen.queryByLabelText("Target weight")).not.toBeInTheDocument();
    await user.click(screen.getByRole("checkbox", { name: /^Weight loss/ }));
    expect(
      await screen.findByText("Your latest weight is 78.4 kg (7-day average)."),
    ).toBeInTheDocument();
    await user.type(screen.getByLabelText("Target weight"), "80");
    await user.click(screen.getByRole("button", { name: "Next: Level" }));
    expect(
      screen.getByText("Add the target date, or clear the target weight."),
    ).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Target date"), { target: { value: "2027-01-23" } });
    await user.click(screen.getByRole("button", { name: "Next: Level" }));
    expect(
      screen.getByText("The target must be below your current weight (78.4 kg)."),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Target weight")).toHaveFocus();
    await user.clear(screen.getByLabelText("Target weight"));
    await user.type(screen.getByLabelText("Target weight"), "76,5");
    await user.click(screen.getByRole("button", { name: "Next: Level" }));
    expect(
      await screen.findByRole("heading", { name: "Tell us about your riding" }),
    ).toBeInTheDocument();
  });

  it("asks for a logged weight before a target", async () => {
    const user = setup();
    vi.mocked(weightApi.fetchWeightEntries).mockResolvedValue([]);
    renderIntake();
    await screen.findByRole("heading", { name: "What do you want from this plan?" });
    await user.click(screen.getByRole("checkbox", { name: /^Weight loss/ }));
    expect(await screen.findByRole("link", { name: "Log your weight" })).toHaveAttribute(
      "href",
      "/weight",
    );
    await user.type(screen.getByLabelText("Target weight"), "70");
    fireEvent.change(screen.getByLabelText("Target date"), { target: { value: "2027-01-23" } });
    await user.click(screen.getByRole("button", { name: "Next: Level" }));
    expect(
      screen.getByText("Log your weight first, so the plan knows where you start."),
    ).toBeInTheDocument();
  });

  it("saves the purposes to the profile and moves the focus to the next heading", async () => {
    const user = setup();
    renderIntake();
    await screen.findByRole("heading", { name: "What do you want from this plan?" });
    await user.click(screen.getByRole("checkbox", { name: /^Muscle building/ }));
    await user.click(screen.getByRole("checkbox", { name: /^Endurance/ }));
    await user.click(screen.getByRole("button", { name: "Next: Level" }));
    const heading = await screen.findByRole("heading", { name: "Tell us about your riding" });
    expect(screen.getByText("Step 2 of 4")).toBeInTheDocument();
    expect(heading).toHaveFocus();
    expect(api.savePlanProfile).toHaveBeenCalledWith(expect.any(String), {
      trainingPurposes: ["muscle_building", "endurance"],
    });
  });

  it("keeps the answers when going back", async () => {
    const user = setup();
    renderIntake();
    await screen.findByRole("heading", { name: "What do you want from this plan?" });
    await user.click(screen.getByRole("checkbox", { name: /^Speed/ }));
    await user.click(screen.getByRole("button", { name: "Next: Level" }));
    await screen.findByRole("heading", { name: "Tell us about your riding" });
    await user.click(screen.getByRole("button", { name: "Back" }));
    expect(await screen.findByRole("checkbox", { name: /^Speed/ })).toBeChecked();
  });

  it("starts from what the profile holds", async () => {
    profile({ trainingPurposes: ["weight_loss", "endurance"] });
    vi.mocked(api.fetchActiveWeightGoal).mockResolvedValue({
      targetKg: 76,
      targetDate: "2027-01-23",
      startKg: 78.4,
      startDate: "2026-10-01",
    });
    renderIntake();
    expect(await screen.findByRole("checkbox", { name: /^Weight loss/ })).toBeChecked();
    expect(screen.getByLabelText("Target weight")).toHaveValue("76");
    expect(screen.getByLabelText("Target date")).toHaveValue("2027-01-23");
    const items = within(screen.getByRole("list")).getAllByRole("listitem");
    expect(items[0]).toHaveTextContent("Weight loss");
  });

  it("shows the step list on desktop with the current step marked", async () => {
    viewport.resize(1280);
    renderIntake();
    await screen.findByRole("heading", { name: "What do you want from this plan?" });
    const steps = within(screen.getByRole("navigation", { name: "Steps" })).getAllByRole(
      "listitem",
    );
    expect(steps.map((s) => s.textContent)).toEqual([
      "1Purposes",
      "2Level",
      "3Time and place",
      "4Start and event",
      "5Summary",
    ]);
    expect(steps[0]).toHaveAttribute("aria-current", "step");
  });
});

describe("step 2: level", () => {
  it("asks the five questions of the engine rules and needs every answer", async () => {
    const user = setup();
    renderIntake("/plan/new?step=2");
    await screen.findByRole("heading", { name: "Tell us about your riding" });
    const groups = screen.getAllByRole("group").map((g) => g.querySelector("legend")?.textContent);
    expect(groups).toEqual([
      "How long have you been riding regularly?",
      "How many hours a week did you ride in the last 3 months?",
      "How often do you train with intervals?",
      "What is your longest ride in the last 3 months?",
      "How many hard sessions a week can you handle comfortably?",
    ]);
    await user.click(screen.getByRole("button", { name: "Next: Time and place" }));
    expect(screen.getAllByText("Choose an answer.")).toHaveLength(5);
    expect(
      within(screen.getAllByRole("group")[0] as HTMLElement).getAllByRole("radio")[0],
    ).toHaveFocus();
  });

  it("saves the answers and goes on when all five are chosen", async () => {
    const user = setup();
    renderIntake("/plan/new?step=2");
    await screen.findByRole("heading", { name: "Tell us about your riding" });
    await choose(user, "How long have you been riding regularly?", "3 to 5 years");
    await choose(user, "How many hours a week did you ride in the last 3 months?", "8 to 11 hours");
    await choose(user, "How often do you train with intervals?", "Most weeks");
    await choose(user, "What is your longest ride in the last 3 months?", "2 to 3.5 hours");
    await choose(user, "How many hard sessions a week can you handle comfortably?", "One");
    await user.click(screen.getByRole("button", { name: "Next: Time and place" }));
    expect(
      await screen.findByRole("heading", { name: "How much time do you have?" }),
    ).toBeInTheDocument();
    expect(api.savePlanProfile).toHaveBeenCalledWith(expect.any(String), {
      levelAnswers: [2, 2, 2, 1, 1],
    });
  });
});

describe("step 3: time and place", () => {
  it("checks the hours, shows the days from the profile and the length of a session", async () => {
    const user = setup();
    profile({ ridingEnvironment: "both" });
    renderIntake("/plan/new?step=3");
    await screen.findByRole("heading", { name: "How much time do you have?" });
    expect(screen.getByText("Tue, Wed, Fri, Sat, Sun")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Change days in your profile" })).toHaveAttribute(
      "href",
      "/profile",
    );
    expect(screen.getByText("Both")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Next: Start and event" }));
    expect(screen.getByText("Enter your hours per week.")).toBeInTheDocument();
    expect(screen.getByLabelText("Average hours per week")).toHaveFocus();
    await user.type(screen.getByLabelText("Average hours per week"), "26");
    await user.click(screen.getByRole("button", { name: "Next: Start and event" }));
    expect(screen.getByText("Hours can be at most 25.")).toBeInTheDocument();
    await user.clear(screen.getByLabelText("Average hours per week"));
    await user.type(screen.getByLabelText("Average hours per week"), "8");
    expect(
      screen.getByText(/With 5 training days that is about 1 h 36 per session\./),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Next: Start and event" }));
    expect(await screen.findByRole("heading", { name: "When do you start?" })).toBeInTheDocument();
    expect(api.savePlanProfile).toHaveBeenCalledWith(expect.any(String), { weeklyHours: 8 });
  });

  it("blocks the step without two training days", async () => {
    const user = setup();
    profile({ availableDays: ["mon"] });
    renderIntake("/plan/new?step=3");
    await screen.findByRole("heading", { name: "How much time do you have?" });
    await user.type(screen.getByLabelText("Average hours per week"), "6");
    await user.click(screen.getByRole("button", { name: "Next: Start and event" }));
    expect(
      screen.getByText("A plan needs at least 2 training days. Add days in your profile."),
    ).toBeInTheDocument();
  });

  it("asks for indoor, outdoor or both when the profile has none and saves it to the profile", async () => {
    const user = setup();
    profile();
    renderIntake("/plan/new?step=3");
    await screen.findByRole("heading", { name: "How much time do you have?" });
    await user.type(screen.getByLabelText("Average hours per week"), "7.5");
    await user.click(screen.getByRole("button", { name: "Next: Start and event" }));
    expect(screen.getByText("Choose indoor, outdoor or both.")).toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: "Indoor" }));
    await user.click(screen.getByRole("button", { name: "Next: Start and event" }));
    expect(await screen.findByRole("heading", { name: "When do you start?" })).toBeInTheDocument();
    expect(api.savePlanProfile).toHaveBeenCalledWith(expect.any(String), {
      weeklyHours: 7.5,
      ridingEnvironment: "indoor",
    });
  });
});

describe("step 4: start and event", () => {
  it("starts on the next Monday and shows the error states of the event", async () => {
    const user = setup();
    renderIntake("/plan/new?step=4");
    await screen.findByRole("heading", { name: "When do you start?" });
    expect(screen.getByRole("radio", { name: /^Monday 2 Nov 2026/ })).toBeChecked();
    await user.click(screen.getByRole("checkbox", { name: "I am training for an event" }));
    await user.click(screen.getByRole("button", { name: "Review the summary" }));
    expect(screen.getByText("Enter the event date.")).toBeInTheDocument();
    expect(screen.getByLabelText("Event date")).toHaveFocus();
    expect(screen.getByLabelText("Event date")).toHaveAccessibleDescription(
      /Enter the event date\./,
    );
    fireEvent.change(screen.getByLabelText("Event date"), { target: { value: "2026-10-20" } });
    await user.click(screen.getByRole("button", { name: "Review the summary" }));
    expect(
      screen.getByText("The date is in the past. Pick a date from tomorrow."),
    ).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Event date"), { target: { value: "2026-10-30" } });
    await user.click(screen.getByRole("button", { name: "Review the summary" }));
    expect(
      screen.getByText(
        "The event is before the plan starts. Move the start date or choose a later event date.",
      ),
    ).toBeInTheDocument();
  });

  it("rolls another start date forward to a Monday and does not allow the past", async () => {
    const user = setup();
    renderIntake("/plan/new?step=4");
    await screen.findByRole("heading", { name: "When do you start?" });
    await user.click(screen.getByRole("radio", { name: "Another date" }));
    fireEvent.change(screen.getByLabelText("Start date"), { target: { value: "2026-10-01" } });
    await user.click(screen.getByRole("button", { name: "Review the summary" }));
    expect(
      screen.getByText("The start date is in the past. Pick today or a later date."),
    ).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Start date"), { target: { value: "2026-11-04" } });
    expect(
      screen.getByText("Plans run Monday to Sunday, so this plan starts on Monday 9 Nov 2026."),
    ).toBeInTheDocument();
  });

  it("saves the event to the profile and opens the summary", async () => {
    const user = setup();
    profile({
      ridingEnvironment: "both",
      weeklyHours: 8,
      trainingPurposes: ["endurance"],
      levelAnswers: [2, 2, 2, 1, 1],
    });
    renderIntake("/plan/new?step=4");
    await screen.findByRole("heading", { name: "When do you start?" });
    await user.click(screen.getByRole("checkbox", { name: "I am training for an event" }));
    await user.type(screen.getByLabelText("Event name (optional)"), "Spring sportive");
    fireEvent.change(screen.getByLabelText("Event date"), { target: { value: "2026-12-19" } });
    await user.click(screen.getByRole("radio", { name: "Over 6 hours" }));
    await user.click(screen.getByRole("button", { name: "Review the summary" }));
    expect(await screen.findByRole("heading", { name: "Check your answers" })).toBeInTheDocument();
    expect(api.savePlanProfile).toHaveBeenCalledWith(expect.any(String), {
      eventName: "Spring sportive",
      eventDate: "2026-12-19",
    });
  });
});

describe("summary and Build my plan", () => {
  function full(over: Partial<PlanProfile> = {}) {
    vi.mocked(api.fetchPlanProfile).mockResolvedValue({ ...FULL_PROFILE, ...over });
  }

  it("lists the answers with Change links and what the plan will assume", async () => {
    full();
    renderIntake("/plan/new?step=summary");
    expect(await screen.findByRole("heading", { name: "Check your answers" })).toBeInTheDocument();
    const answers = screen.getByRole("region", { name: "Your answers" });
    expect(answers).toHaveTextContent("1 Endurance, 2 Speed");
    expect(answers).toHaveTextContent("Committed");
    expect(answers).toHaveTextContent("8 h per week");
    expect(answers).toHaveTextContent("Tue, Wed, Fri, Sat, Sun");
    expect(answers).toHaveTextContent("12 weeks, Mon 2 Nov to Sun 24 Jan");
    expect(answers).toHaveTextContent("FTP 250 W");
    expect(within(answers).getByRole("link", { name: "Change purposes" })).toHaveAttribute(
      "href",
      "/plan/new?step=1",
    );
    expect(within(answers).getByRole("link", { name: "Change the hours" })).toHaveAttribute(
      "href",
      "/plan/new?step=3",
    );
    const assumptions = screen.getByRole("region", { name: "What the plan will assume" });
    expect(assumptions).toHaveTextContent(
      "Sessions only on Tue, Wed, Fri, Sat and Sun. Mon and Thu stay free.",
    );
    expect(assumptions).toHaveTextContent("Watts from your FTP of 250 W");
    expect(assumptions).toHaveTextContent("The plan is recalculated when rides come in");
  });

  it("shows the engine's notices and warnings (event too soon, start moved)", async () => {
    const user = setup();
    full();
    renderIntake("/plan/new?step=4");
    await screen.findByRole("heading", { name: "When do you start?" });
    await user.click(screen.getByRole("radio", { name: "Another date" }));
    fireEvent.change(screen.getByLabelText("Start date"), { target: { value: "2026-11-04" } });
    await user.click(screen.getByRole("checkbox", { name: "I am training for an event" }));
    fireEvent.change(screen.getByLabelText("Event date"), { target: { value: "2026-11-21" } });
    await user.click(screen.getByRole("button", { name: "Review the summary" }));
    const assumptions = await screen.findByRole("region", { name: "What the plan will assume" });
    expect(assumptions).toHaveTextContent(
      "Weeks start on Monday, so the plan starts on 2026-11-09.",
    );
    expect(assumptions).toHaveTextContent(/Your event is less than 4 weeks away/);
  });

  it("lets the PO change the level", async () => {
    const user = setup();
    full();
    renderIntake("/plan/new?step=summary");
    await screen.findByRole("heading", { name: "Check your answers" });
    await user.click(screen.getByRole("button", { name: "Change level" }));
    await user.click(screen.getByRole("radio", { name: "Amateur" }));
    expect(screen.getByRole("region", { name: "Your answers" })).toHaveTextContent(
      "Amateur (your choice)",
    );
    expect(screen.getByRole("region", { name: "What the plan will assume" })).toHaveTextContent(
      "You chose the amateur level instead of committed.",
    );
    await user.click(screen.getByRole("radio", { name: /Use the calculated level \(Committed\)/ }));
    expect(screen.getByRole("region", { name: "Your answers" })).toHaveTextContent("Committed");
  });

  it("sends the user to the first step with a missing answer", async () => {
    full({ levelAnswers: null, weeklyHours: null });
    renderIntake("/plan/new?step=summary");
    expect(await screen.findByText("Some answers are missing")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to step 2" })).toHaveAttribute(
      "href",
      "/plan/new?step=2",
    );
  });

  it("builds the plan: one call with the plan, the intake, the FTP and the weight", async () => {
    const user = setup();
    full();
    renderIntake("/plan/new?step=summary");
    await screen.findByRole("heading", { name: "Check your answers" });
    await user.click(screen.getByRole("button", { name: "Build my plan" }));
    await waitFor(() => {
      expect(api.createPlan).toHaveBeenCalledTimes(1);
    });
    const call = vi.mocked(api.createPlan).mock.calls[0]?.[0];
    expect(call).toBeDefined();
    if (!call) return;
    expect(call.plan.status).toBe("ok");
    expect(call.plan.startDate).toBe("2026-11-02");
    expect(call.plan.weeks).toHaveLength(12);
    expect(call.plan.sessions.length).toBeGreaterThan(40);
    expect(call.ftp).toBe(250);
    expect(call.weightKg).toBeNull();
    expect(call.intake).toMatchObject({
      purposes: ["endurance", "speed"],
      hoursPerWeek: 8,
      environment: "both",
      availableDays: ["tue", "wed", "fri", "sat", "sun"],
      levelAnswers: {
        experience: 2,
        weeklyHours: 2,
        intervals: 2,
        longestRide: 1,
        hardSessions: 1,
      },
    });
    expect(api.saveWeightGoal).not.toHaveBeenCalled();
  });

  it("opens the plan page with a card saying the plan is ready", async () => {
    const user = setup();
    full();
    renderIntake("/plan/new?step=summary");
    await screen.findByRole("heading", { name: "Check your answers" });
    mockPlanApi(planFixture());
    await user.click(screen.getByRole("button", { name: "Build my plan" }));
    expect(
      await screen.findByText("Your plan is ready. 12 weeks from Mon 2 Nov"),
    ).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: /Week 5 of 12/ })).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(9000);
    });
    expect(screen.queryByText(/Your plan is ready/)).not.toBeInTheDocument();
  });

  it("saves the weight goal with the plan when weight loss is a purpose", async () => {
    const user = setup();
    full({ trainingPurposes: ["weight_loss", "endurance"] });
    vi.mocked(api.fetchActiveWeightGoal).mockResolvedValue({
      targetKg: 76,
      targetDate: "2027-01-23",
      startKg: 78.4,
      startDate: "2026-10-01",
    });
    renderIntake("/plan/new?step=summary");
    await screen.findByRole("heading", { name: "Check your answers" });
    expect(screen.getByRole("region", { name: "Your answers" })).toHaveTextContent(
      "76.0 kg by Sat 23 Jan",
    );
    await user.click(screen.getByRole("button", { name: "Build my plan" }));
    await waitFor(() => {
      expect(api.createPlan).toHaveBeenCalledTimes(1);
    });
    expect(api.saveWeightGoal).toHaveBeenCalledWith({
      targetKg: 76,
      targetDate: "2027-01-23",
      startKg: 78.4,
    });
    const call = vi.mocked(api.createPlan).mock.calls[0]?.[0];
    expect(call?.weightKg).toBe(78.4);
    expect(call?.intake.weightGoal).toEqual({ targetKg: 76, targetDate: "2027-01-23" });
    expect(call?.plan.weight?.targetKg).toBe(76);
  });

  it("cancels the old goal when weight loss has no target", async () => {
    const user = setup();
    full({ trainingPurposes: ["weight_loss"] });
    renderIntake("/plan/new?step=summary");
    await screen.findByRole("heading", { name: "Check your answers" });
    await user.click(screen.getByRole("button", { name: "Build my plan" }));
    await waitFor(() => {
      expect(api.saveWeightGoal).toHaveBeenCalledWith(null);
    });
  });

  it("asks before replacing a plan that exists", async () => {
    const user = setup();
    mockPlanApi(planFixture());
    full();
    renderIntake("/plan/new?step=summary");
    await screen.findByRole("heading", { name: "Check your answers" });
    expect(screen.getByRole("note")).toHaveTextContent(
      "You already have a plan. Building a new one replaces it.",
    );
    await user.click(screen.getByRole("button", { name: "Build my plan" }));
    const dialog = screen.getByRole("dialog", { name: "Replace your current plan?" });
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(api.createPlan).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Build my plan" }));
    await user.click(
      within(screen.getByRole("dialog", { name: "Replace your current plan?" })).getByRole(
        "button",
        { name: "Replace plan" },
      ),
    );
    await waitFor(() => {
      expect(api.createPlan).toHaveBeenCalledTimes(1);
    });
  });

  it("shows Building your plan while it works and keeps the button", async () => {
    const user = setup();
    full();
    vi.mocked(api.createPlan).mockReturnValue(new Promise(() => undefined));
    renderIntake("/plan/new?step=summary");
    await screen.findByRole("heading", { name: "Check your answers" });
    await user.click(screen.getByRole("button", { name: "Build my plan" }));
    const button = await screen.findByRole("button", { name: "Building your plan" });
    expect(button).toHaveAttribute("aria-disabled", "true");
    await user.click(button);
    expect(api.createPlan).toHaveBeenCalledTimes(1);
  });

  it("says nothing was saved when the build fails, keeps the answers and tries again", async () => {
    const user = setup();
    full();
    vi.mocked(api.createPlan).mockRejectedValueOnce(new Error("offline"));
    renderIntake("/plan/new?step=summary");
    await screen.findByRole("heading", { name: "Check your answers" });
    await user.click(screen.getByRole("button", { name: "Build my plan" }));
    expect(await screen.findByText("Plan not built")).toBeInTheDocument();
    expect(screen.getByText(/Nothing was saved and your answers are kept/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Build my plan" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Your answers" })).toHaveTextContent("8 h per week");
    mockPlanApi(planFixture());
    await user.click(screen.getByRole("button", { name: "Try again" }));
    await waitFor(() => {
      expect(api.createPlan).toHaveBeenCalledTimes(2);
    });
    expect(await screen.findByRole("heading", { name: /Week 5 of 12/ })).toBeInTheDocument();
  });

  it("does not open the summary with fewer than two training days", async () => {
    full({ availableDays: ["mon"] });
    renderIntake("/plan/new?step=summary");
    expect(await screen.findByText("Some answers are missing")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to step 3" })).toHaveAttribute(
      "href",
      "/plan/new?step=3",
    );
    expect(screen.queryByRole("button", { name: "Build my plan" })).not.toBeInTheDocument();
  });
});

describe("a full walk through the steps", () => {
  it("goes from the purposes to the summary with the answers saved on the way", async () => {
    const user = setup();
    profile({ ridingEnvironment: "outdoor" });
    renderIntake("/plan/new");
    await screen.findByRole("heading", { name: "What do you want from this plan?" });
    await user.click(screen.getByRole("checkbox", { name: /^Endurance/ }));
    await user.click(screen.getByRole("button", { name: "Next: Level" }));
    await screen.findByRole("heading", { name: "Tell us about your riding" });
    for (const [group, answer] of [
      ["How long have you been riding regularly?", "1 to 2 years"],
      ["How many hours a week did you ride in the last 3 months?", "4 to 7 hours"],
      ["How often do you train with intervals?", "Sometimes"],
      ["What is your longest ride in the last 3 months?", "2 to 3.5 hours"],
      ["How many hard sessions a week can you handle comfortably?", "One"],
    ] as const)
      await choose(user, group, answer);
    await user.click(screen.getByRole("button", { name: "Next: Time and place" }));
    await user.type(await screen.findByLabelText("Average hours per week"), "5");
    await user.click(screen.getByRole("button", { name: "Next: Start and event" }));
    await screen.findByRole("heading", { name: "When do you start?" });
    await user.click(screen.getByRole("button", { name: "Review the summary" }));
    expect(await screen.findByRole("heading", { name: "Check your answers" })).toBeInTheDocument();
    const answers = screen.getByRole("region", { name: "Your answers" });
    expect(answers).toHaveTextContent("1 Endurance");
    expect(answers).toHaveTextContent("Amateur");
    expect(answers).toHaveTextContent("5 h per week");
    expect(answers).toHaveTextContent("Outdoor");
    expect(vi.mocked(api.savePlanProfile).mock.calls.map((c) => Object.keys(c[1]))).toEqual([
      ["trainingPurposes"],
      ["levelAnswers"],
      ["weeklyHours"],
      ["eventName", "eventDate"],
    ]);
    await user.click(screen.getByRole("button", { name: "Back" }));
    expect(await screen.findByRole("heading", { name: "When do you start?" })).toBeInTheDocument();
  });
});

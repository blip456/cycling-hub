import { configure, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as baselineApi from "@/features/baseline/api";
import type * as weightApi from "@/features/weight/api";
import { mockViewport } from "@/test/match-media";
import { fakeAuth, fakeSession, renderWithProviders } from "@/test/render";
import * as adaptationApi from "../adaptation/api";
import type { FakeApi, FakeDb } from "../adaptation/fake-api";
import * as api from "../data/api";
import { NOW, TODAY } from "../data/test-support";
import { PlanPage } from "../PlanPage";
import { PlanUpdatedCard } from "../PlanUpdatedCard";
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

beforeEach(async () => {
  // Findings after a click wait for the runner and several refetches: give them room on a slow CI runner.
  configure({ asyncUtilTimeout: 5000 });
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(NOW);
  viewport = mockViewport(390);
  window.localStorage.clear();
  db = editDb();
  runnerApi = await wireDb(db);
});

afterEach(() => {
  configure({ asyncUtilTimeout: 1000 });
  viewport.restore();
  vi.useRealTimers();
  vi.clearAllMocks();
});

type User = ReturnType<typeof setup>;

async function openEdit(user: User) {
  renderApp();
  await user.click(await screen.findByRole("button", { name: /Plan options/ }));
  await user.click(screen.getByRole("link", { name: "Edit plan" }));
  await screen.findByRole("heading", { name: "What do you want from this plan?" });
}

async function next(user: User, button: string, heading: string) {
  await user.click(screen.getByRole("button", { name: button }));
  await screen.findByRole("heading", { name: heading });
}

/** From step 1 to the summary without changing an answer. */
async function toSummary(user: User) {
  await next(user, "Next: Level", "Tell us about your riding");
  await next(user, "Next: Time and place", "How much time do you have?");
  await next(user, "Next: Start and event", "When do you start?");
  await next(user, "Review the summary", "Check your changes");
}

const pastBefore = () => db.sessions.filter((s) => s.date < TODAY).map((s) => structuredClone(s));

describe("the entry points", () => {
  it("opens the edit page from the plan options on the Week and the Overview tab", async () => {
    const user = setup();
    renderApp("/plan/overview");
    await user.click(await screen.findByRole("button", { name: /Plan options/ }));
    for (const link of screen.getAllByRole("link", { name: "Edit plan" }))
      expect(link).toHaveAttribute("href", "/plan/edit");
    expect(screen.getByRole("button", { name: "Remove plan" })).toBeInTheDocument();
  });

  it("offers an Edit plan link in the Overview too", async () => {
    renderApp("/plan/overview");
    expect(await screen.findByRole("link", { name: "Edit plan" })).toHaveAttribute(
      "href",
      "/plan/edit",
    );
  });

  it("closes the options with Escape and gives the focus back to the button", async () => {
    const user = setup();
    renderApp();
    const button = await screen.findByRole("button", { name: /Plan options/ });
    await user.click(button);
    expect(button).toHaveAttribute("aria-expanded", "true");
    await user.keyboard("{Escape}");
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(button).toHaveFocus();
    expect(screen.queryByRole("link", { name: "Edit plan" })).not.toBeInTheDocument();
  });
});

describe("the questions with the current answers", () => {
  it("fills step 1 from the plan: purposes in order", async () => {
    const user = setup();
    await openEdit(user);
    expect(screen.getByRole("checkbox", { name: /^Endurance/ })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: /^Speed/ })).toBeChecked();
    const items = within(screen.getByRole("list")).getAllByRole("listitem");
    expect(items[0]).toHaveTextContent("Endurance");
    expect(items[1]).toHaveTextContent("Speed");
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Back" })).not.toBeInTheDocument();
  });

  it("overlays the profile on the stored answers", async () => {
    const user = setup();
    // The PO changed the hours in the profile after the plan was built.
    db.profile = { ...db.profile, weeklyHours: 9.5, trainingPurposes: ["speed", "endurance"] };
    await openEdit(user);
    const items = within(screen.getByRole("list")).getAllByRole("listitem");
    expect(items[0]).toHaveTextContent("Speed");
    await next(user, "Next: Level", "Tell us about your riding");
    await next(user, "Next: Time and place", "How much time do you have?");
    expect(screen.getByLabelText("Average hours per week")).toHaveValue("9.5");
  });

  it("fills the level, the time and place and the event, and shows the start date as fixed", async () => {
    const user = setup();
    await openEdit(user);
    await next(user, "Next: Level", "Tell us about your riding");
    const first = screen.getByRole("group", { name: "How long have you been riding regularly?" });
    expect(within(first).getByRole("radio", { name: "3 to 5 years" })).toBeChecked();
    await next(user, "Next: Time and place", "How much time do you have?");
    expect(screen.getByLabelText("Average hours per week")).toHaveValue("8");
    expect(screen.getByText("Tue, Wed, Fri, Sat, Sun")).toBeInTheDocument();
    await next(user, "Next: Start and event", "When do you start?");
    expect(screen.getByText("Monday 28 Sep 2026")).toBeInTheDocument();
    expect(
      screen.getByText(
        /The start date of a plan cannot be changed\. To start on another date, remove this plan and build a new one\./,
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole("radio", { name: /Monday/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("radio", { name: "Another date" })).not.toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "I am training for an event" })).toBeChecked();
    expect(screen.getByLabelText("Event name (optional)")).toHaveValue("Autumn sportive");
    expect(screen.getByLabelText("Event date")).toHaveValue("2026-12-19");
    expect(screen.getByRole("radio", { name: "3 to 6 hours" })).toBeChecked();
  });

  it("prefills the weight target from the active goal", async () => {
    const user = setup();
    db.profile = { ...db.profile, trainingPurposes: ["weight_loss", "endurance"] };
    db.goal = { targetKg: 76, targetDate: "2027-01-23", startKg: 79, startDate: "2026-10-01" };
    await openEdit(user);
    expect(screen.getByLabelText("Target weight")).toHaveValue("76");
    expect(screen.getByLabelText("Target date")).toHaveValue("2027-01-23");
  });

  it("is blocked without an FTP, like the intake", async () => {
    vi.mocked(baselineApi.fetchCurrentBaseline).mockResolvedValue(null);
    renderApp("/plan/edit");
    expect(
      await screen.findByRole("heading", { name: "Your plan needs an FTP first" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Next/ })).not.toBeInTheDocument();
  });

  it("says there is no plan to edit when there is none", async () => {
    vi.mocked(api.fetchActivePlan).mockResolvedValue(null);
    renderApp("/plan/edit");
    expect(await screen.findByText("There is no plan to edit yet.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Create my plan" })).toHaveAttribute(
      "href",
      "/plan/new",
    );
  });
});

describe("validation is the one of the intake", () => {
  it("checks the hours", async () => {
    const user = setup();
    await openEdit(user);
    await next(user, "Next: Level", "Tell us about your riding");
    await next(user, "Next: Time and place", "How much time do you have?");
    await user.clear(screen.getByLabelText("Average hours per week"));
    await user.click(screen.getByRole("button", { name: "Next: Start and event" }));
    expect(screen.getByText("Enter your hours per week.")).toBeInTheDocument();
    await user.type(screen.getByLabelText("Average hours per week"), "26");
    await user.click(screen.getByRole("button", { name: "Next: Start and event" }));
    expect(screen.getByText("Hours can be at most 25.")).toBeInTheDocument();
  });

  it("wants an event inside the plan and points to a new plan", async () => {
    const user = setup();
    await openEdit(user);
    await next(user, "Next: Level", "Tell us about your riding");
    await next(user, "Next: Time and place", "How much time do you have?");
    await next(user, "Next: Start and event", "When do you start?");
    const date = screen.getByLabelText("Event date");
    await user.clear(date);
    await user.type(date, "2027-02-20");
    await user.click(screen.getByRole("button", { name: "Review the summary" }));
    expect(screen.getByText(/after the last week of your plan/)).toBeInTheDocument();
    expect(
      screen.getByText(/remove this plan and build a new one that starts closer/),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Event date")).toHaveFocus();
  });
});

describe("cancel", () => {
  it("leaves everything untouched, from the first step", async () => {
    const user = setup();
    await openEdit(user);
    await user.click(screen.getByRole("checkbox", { name: /^Speed/ }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(await screen.findByRole("navigation", { name: "Plan" })).toBeInTheDocument();
    expect(api.savePlanProfile).not.toHaveBeenCalled();
    expect(api.saveWeightGoal).not.toHaveBeenCalled();
    expect(runnerApi.writes).toEqual([]);
  });

  it("leaves everything untouched, from the summary after steps were saved with Next", async () => {
    const user = setup();
    await openEdit(user);
    await user.click(screen.getByRole("checkbox", { name: /^Speed/ }));
    await toSummary(user);
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(await screen.findByRole("navigation", { name: "Plan" })).toBeInTheDocument();
    expect(api.savePlanProfile).not.toHaveBeenCalled();
    expect(runnerApi.writes).toEqual([]);
    expect(db.profile.trainingPurposes).toEqual(["endurance", "speed"]);
  });

  it("does not save the answers when moving from step to step", async () => {
    const user = setup();
    await openEdit(user);
    await next(user, "Next: Level", "Tell us about your riding");
    expect(api.savePlanProfile).not.toHaveBeenCalled();
  });
});

describe("the summary", () => {
  it("says what will change in plain words and how many sessions", async () => {
    const user = setup();
    await openEdit(user);
    await next(user, "Next: Level", "Tell us about your riding");
    await next(user, "Next: Time and place", "How much time do you have?");
    await user.clear(screen.getByLabelText("Average hours per week"));
    await user.type(screen.getByLabelText("Average hours per week"), "10");
    await next(user, "Next: Start and event", "When do you start?");
    await next(user, "Review the summary", "Check your changes");
    const changes = screen.getByRole("region", { name: "What will change" });
    expect(within(changes).getByText("Hours per week change from 8 to 10.")).toBeInTheDocument();
    expect(await within(changes).findByText(/planned sessions? will change\./)).toBeInTheDocument();
    expect(
      within(changes).getByText(/Sessions in the past, sessions you marked as done/),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save changes" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Build my plan" })).not.toBeInTheDocument();
    expect(screen.queryByText(/Building a new one replaces it/)).not.toBeInTheDocument();
    // The start date is the plan's own.
    expect(screen.getByText("The start date cannot be changed.")).toBeInTheDocument();
    // The engine's notices are with the assumptions.
    expect(screen.getByRole("heading", { name: "What the plan will assume" })).toBeInTheDocument();
  });

  it("says nothing differs when no answer changed", async () => {
    const user = setup();
    await openEdit(user);
    await toSummary(user);
    expect(screen.getByText("You have not changed any answer.")).toBeInTheDocument();
    expect(await screen.findByText("No planned session changes.")).toBeInTheDocument();
  });

  it("keeps the Change links in the edit page", async () => {
    const user = setup();
    await openEdit(user);
    await toSummary(user);
    expect(screen.getByRole("link", { name: "Change the hours" })).toHaveAttribute(
      "href",
      "/plan/edit?step=3",
    );
  });
});

describe("saving", () => {
  async function saveHours(user: User, hours: string) {
    await openEdit(user);
    await next(user, "Next: Level", "Tell us about your riding");
    await next(user, "Next: Time and place", "How much time do you have?");
    await user.clear(screen.getByLabelText("Average hours per week"));
    await user.type(screen.getByLabelText("Average hours per week"), hours);
    await next(user, "Next: Start and event", "When do you start?");
    await next(user, "Review the summary", "Check your changes");
    await user.click(await screen.findByRole("button", { name: "Save changes" }));
  }

  it("writes the answers, re-evaluates the plan and shows Plan updated with See changes and Undo", async () => {
    const user = setup();
    const past = pastBefore();
    await saveHours(user, "10");

    const card = await screen.findByText(/changed because you edited your plan\./);
    expect(card).toBeInTheDocument();
    expect(screen.getByText("Plan updated")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "See changes" })).toHaveAttribute(
      "href",
      "/plan/changes",
    );
    expect(screen.getByRole("button", { name: "Undo" })).toBeInTheDocument();

    // The profile got every answer, like the intake saves them.
    expect(api.savePlanProfile).toHaveBeenCalledTimes(1);
    expect(api.savePlanProfile).toHaveBeenCalledWith(expect.any(String), {
      trainingPurposes: ["endurance", "speed"],
      levelAnswers: [2, 2, 2, 1, 1],
      weeklyHours: 10,
      eventName: "Autumn sportive",
      eventDate: "2026-12-19",
    });
    expect(api.saveWeightGoal).not.toHaveBeenCalled();
    // The plan's own answers follow, and the plan keeps its id and start date.
    expect(db.plan.intake?.hoursPerWeek).toBe(10);
    expect(db.plan.id).toBe("plan-1");
    expect(db.plan.startDate).toBe("2026-09-28");
    expect(db.changes[0]?.payload.reasons[0]).toBe("plan-edited");
    // Sessions before today are exactly as they were; later ones changed.
    expect(db.sessions.filter((s) => s.date < TODAY)).toEqual(past);
    expect(runnerApi.writes).toEqual(["diff", "change", "plan"]);
    // Back on the plan page.
    expect(await screen.findByRole("navigation", { name: "Plan" })).toBeInTheDocument();
  });

  it("leaves done and missed sessions and locked matches alone", async () => {
    const user = setup();
    const locked = db.sessions.find((s) => s.date > TODAY && s.kind !== "event");
    if (!locked) throw new Error("no future session");
    db.sessions = db.sessions.map((s) =>
      s.id === locked.id ? { ...s, matchSource: "manual" as const } : s,
    );
    const before = db.sessions.find((s) => s.id === locked.id);
    await saveHours(user, "10");
    await screen.findByText("Plan updated");
    expect(db.sessions.find((s) => s.id === locked.id)).toEqual(before);
    expect(db.sessions.filter((s) => s.status === "done").length).toBeGreaterThan(0);
  });

  it("says Nothing changed when no session needs a change", async () => {
    const user = setup();
    await openEdit(user);
    await toSummary(user);
    await user.click(await screen.findByRole("button", { name: "Save changes" }));
    expect(await screen.findByText("Nothing changed")).toBeInTheDocument();
    expect(screen.queryByText("Plan updated")).not.toBeInTheDocument();
    expect(db.changes).toEqual([]);
    expect(runnerApi.writes).toEqual([]);
    expect(await screen.findByRole("navigation", { name: "Plan" })).toBeInTheDocument();
  });

  it("follows a removed event: a longer plan without the event", async () => {
    const user = setup();
    await openEdit(user);
    await next(user, "Next: Level", "Tell us about your riding");
    await next(user, "Next: Time and place", "How much time do you have?");
    await next(user, "Next: Start and event", "When do you start?");
    await user.click(screen.getByRole("checkbox", { name: "I am training for an event" }));
    await next(user, "Review the summary", "Check your changes");
    expect(
      screen.getByText("The event is removed: Autumn sportive, Saturday 19 Dec 2026."),
    ).toBeInTheDocument();
    await user.click(await screen.findByRole("button", { name: "Save changes" }));
    await screen.findByText("Plan updated");
    expect(api.savePlanProfile).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ eventName: null, eventDate: null }),
    );
    expect(db.plan.intake?.event).toBeUndefined();
    expect(db.sessions.some((s) => s.kind === "event")).toBe(false);
  });

  it("follows a changed event date", async () => {
    const user = setup();
    await openEdit(user);
    await next(user, "Next: Level", "Tell us about your riding");
    await next(user, "Next: Time and place", "How much time do you have?");
    await next(user, "Next: Start and event", "When do you start?");
    const date = screen.getByLabelText("Event date");
    await user.clear(date);
    await user.type(date, "2026-12-12");
    await next(user, "Review the summary", "Check your changes");
    await user.click(await screen.findByRole("button", { name: "Save changes" }));
    await screen.findByText("Plan updated");
    expect(db.sessions.find((s) => s.kind === "event")?.date).toBe("2026-12-12");
    expect(db.plan.weeks).toBe(11);
  });

  it("reorders the purposes and picks a level", async () => {
    const user = setup();
    await openEdit(user);
    await user.click(screen.getByRole("button", { name: "Move Speed up" }));
    await toSummary(user);
    await user.click(screen.getByRole("button", { name: "Change level" }));
    await user.click(screen.getByRole("radio", { name: "Amateur" }));
    expect(
      screen.getByText(/Purposes change from 1 Endurance, 2 Speed to 1 Speed, 2 Endurance\./),
    ).toBeInTheDocument();
    expect(screen.getByText("Level changes from Committed to Amateur.")).toBeInTheDocument();
    await user.click(await screen.findByRole("button", { name: "Save changes" }));
    await screen.findByText("Plan updated");
    expect(db.plan.intake?.purposes).toEqual(["speed", "endurance"]);
    expect(db.plan.intake?.levelOverride).toBe("amateur");
  });

  it("writes a changed weight target to the goal", async () => {
    const user = setup();
    db.profile = { ...db.profile, trainingPurposes: ["weight_loss", "endurance"] };
    await openEdit(user);
    await user.type(screen.getByLabelText("Target weight"), "76");
    await user.type(screen.getByLabelText("Target date"), "2027-01-23");
    await toSummary(user);
    await user.click(await screen.findByRole("button", { name: "Save changes" }));
    await screen.findByText(/Plan updated|Nothing changed/);
    expect(api.saveWeightGoal).toHaveBeenCalledWith({
      targetKg: 76,
      targetDate: "2027-01-23",
      startKg: 78.4,
    });
    expect(db.profile.trainingPurposes).toEqual(["weight_loss", "endurance"]);
  });

  it("shows a pending state while it saves", async () => {
    const user = setup();
    let release: () => void = () => undefined;
    vi.mocked(api.savePlanProfile).mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );
    await openEdit(user);
    await toSummary(user);
    await user.click(await screen.findByRole("button", { name: "Save changes" }));
    expect(await screen.findByRole("button", { name: "Saving your changes" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    release();
    await screen.findByText("Nothing changed");
  });
});

describe("Undo", () => {
  it("takes the sessions, the plan's answers and the profile back", async () => {
    const user = setup();
    const sessionsBefore = db.sessions.map((s) => structuredClone(s));
    const intakeBefore = structuredClone(db.plan.intake);
    const profileBefore = structuredClone(db.profile);
    await openEdit(user);
    await next(user, "Next: Level", "Tell us about your riding");
    await next(user, "Next: Time and place", "How much time do you have?");
    await user.clear(screen.getByLabelText("Average hours per week"));
    await user.type(screen.getByLabelText("Average hours per week"), "10");
    await next(user, "Next: Start and event", "When do you start?");
    await next(user, "Review the summary", "Check your changes");
    await user.click(await screen.findByRole("button", { name: "Save changes" }));
    await user.click(await screen.findByRole("button", { name: "Undo" }));
    expect(
      await screen.findByText("Plan restored. Updated again when something changes."),
    ).toBeInTheDocument();
    expect(db.sessions).toEqual(sessionsBefore);
    expect(db.plan.intake).toEqual(intakeBefore);
    expect(db.profile).toEqual(profileBefore);
    expect(db.changes[0]?.undoneAt).not.toBeNull();
  });
});

describe("when something goes wrong", () => {
  async function saveUnchanged(user: User) {
    await openEdit(user);
    await toSummary(user);
    await user.click(await screen.findByRole("button", { name: "Save changes" }));
  }

  it("says nothing was saved when the profile cannot be written, keeps the answers and tries again", async () => {
    const user = setup();
    vi.mocked(api.savePlanProfile).mockRejectedValueOnce(new Error("offline"));
    await saveUnchanged(user);
    expect(await screen.findByText("Changes not saved")).toBeInTheDocument();
    expect(runnerApi.writes).toEqual([]);
    // Still on the summary with the answers.
    expect(screen.getByRole("heading", { name: "Check your changes" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Nothing changed")).toBeInTheDocument();
  });

  it("puts the profile back when the weight goal cannot be saved", async () => {
    const user = setup();
    db.profile = { ...db.profile, trainingPurposes: ["weight_loss", "endurance"] };
    vi.mocked(api.saveWeightGoal).mockRejectedValueOnce(new Error("offline"));
    await openEdit(user);
    await user.type(screen.getByLabelText("Target weight"), "76");
    await user.type(screen.getByLabelText("Target date"), "2027-01-23");
    await toSummary(user);
    await user.click(await screen.findByRole("button", { name: "Save changes" }));
    expect(await screen.findByText("Changes not saved")).toBeInTheDocument();
    expect(api.savePlanProfile).toHaveBeenCalledTimes(2);
    expect(vi.mocked(api.savePlanProfile).mock.calls[1]?.[1]).toMatchObject({
      trainingPurposes: ["weight_loss", "endurance"],
    });
  });

  it("says the plan was not updated when the update fails, and only runs the update again", async () => {
    const user = setup();
    runnerApi.failOn("load");
    await saveUnchanged(user);
    expect(await screen.findByText("Plan not updated")).toBeInTheDocument();
    expect(api.savePlanProfile).toHaveBeenCalledTimes(1);
    runnerApi.failOn(null);
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Nothing changed")).toBeInTheDocument();
    expect(api.savePlanProfile).toHaveBeenCalledTimes(1);
  });

  it("goes back to the plan page when the plan has gone", async () => {
    const user = setup();
    await openEdit(user);
    await toSummary(user);
    vi.mocked(adaptationApi.createSupabaseRunnerApi).mockReturnValue({
      ...runnerApi,
      load: () => Promise.resolve(null),
    });
    await user.click(await screen.findByRole("button", { name: "Save changes" }));
    await waitFor(() => {
      expect(screen.queryByRole("heading", { name: "Check your changes" })).not.toBeInTheDocument();
    });
  });
});

describe("desktop", () => {
  it("shows the plan options and the edit steps next to each other", async () => {
    viewport.resize(1280);
    const user = setup();
    await openEdit(user);
    const steps = within(screen.getByRole("navigation", { name: "Steps" })).getAllByRole(
      "listitem",
    );
    expect(steps).toHaveLength(5);
  });
});

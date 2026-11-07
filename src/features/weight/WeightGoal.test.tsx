import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WeightEntry } from "@/features/athlete";
import { EMPTY_PROFILE, fetchProfile } from "@/features/profile/api";
import { fakeAuth, fakeSession, renderWithProviders } from "@/test/render";
import * as api from "./api";
import { cancelActiveWeightGoal, fetchActiveWeightGoal, saveWeightGoal } from "./goal-api";
import type { WeightGoal } from "./goal-model";
import { NOW } from "./test-support";
import { WeightPage } from "./WeightPage";

vi.mock("./api", async (importOriginal) => ({
  ...(await importOriginal<typeof api>()),
  fetchWeightEntries: vi.fn(),
  fetchReminderSettings: vi.fn(),
}));
vi.mock("./goal-api", () => ({
  fetchActiveWeightGoal: vi.fn(),
  saveWeightGoal: vi.fn(),
  cancelActiveWeightGoal: vi.fn(),
}));
vi.mock("@/features/profile/api", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  fetchProfile: vi.fn(),
}));

/** A weigh-in every day from 29 Sep to 28 Oct falling about 0.14 kg a week, ending near 75.1 kg. */
function log(): WeightEntry[] {
  const entries: WeightEntry[] = [];
  for (let day = 0; day <= 29; day += 1) {
    const date = new Date(Date.UTC(2026, 8, 29) + day * 86_400_000).toISOString().slice(0, 10);
    entries.push({ date, kg: Math.round((75.7 - (0.14 / 7) * day) * 100) / 100 });
  }
  return entries;
}

const GOAL: WeightGoal = {
  id: "goal-1",
  targetKg: 73,
  targetDate: "2026-12-13",
  startKg: 75.7,
  startDate: "2026-09-29",
  status: "active",
};

function renderAt(path: string) {
  return renderWithProviders(
    <Routes>
      <Route path="/weight/*" element={<WeightPage />} />
    </Routes>,
    { path, auth: fakeAuth({ status: "signedIn", session: fakeSession() }) },
  );
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(NOW);
  vi.mocked(api.fetchWeightEntries).mockResolvedValue(log());
  vi.mocked(api.fetchReminderSettings).mockResolvedValue({ enabled: true, day: "sun" });
  vi.mocked(fetchActiveWeightGoal).mockResolvedValue(null);
  vi.mocked(fetchProfile).mockResolvedValue({
    ...EMPTY_PROFILE,
    trainingPurposes: ["weight_loss"],
  });
  vi.mocked(saveWeightGoal).mockResolvedValue(undefined);
  vi.mocked(cancelActiveWeightGoal).mockResolvedValue(undefined);
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

function setup() {
  return userEvent.setup({ advanceTimers: (ms) => vi.advanceTimersByTime(ms) });
}

describe("Trend tab: weight goal cards (R2a, R2b)", () => {
  it("shows the trend only, with a way to set a goal, when weight loss is a purpose and there is no goal (R2b)", async () => {
    renderAt("/weight/trend");
    expect(await screen.findByRole("heading", { name: "Weight loss trend" })).toBeInTheDocument();
    expect(screen.getByText("Inside the cap")).toBeInTheDocument();
    expect(screen.getAllByText(/^0\.1\d kg\/week$/, { selector: "dd" })).toHaveLength(2);
    expect(screen.getByRole("link", { name: "Set a target and date" })).toHaveAttribute(
      "href",
      "/weight/goal",
    );
    const pace = screen.getByRole("heading", { name: "Weekly pace" }).closest("section");
    expect(pace).toHaveTextContent("Cap (0.5 % of body weight)");
    expect(pace).not.toHaveTextContent("Needed to reach the target");
  });

  it("shows no goal card when weight loss is not a purpose and there is no goal", async () => {
    vi.mocked(fetchProfile).mockResolvedValue({
      ...EMPTY_PROFILE,
      trainingPurposes: ["endurance"],
    });
    renderAt("/weight/trend");
    await screen.findByText("Latest");
    await waitFor(() => {
      expect(fetchProfile).toHaveBeenCalled();
    });
    expect(screen.queryByRole("heading", { name: "Weight goal" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Weight loss trend" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Weekly pace" })).not.toBeInTheDocument();
  });

  it("shows the goal, what is left and the standing in words (R2a)", async () => {
    vi.mocked(fetchActiveWeightGoal).mockResolvedValue(GOAL);
    renderAt("/weight/trend");
    expect(await screen.findByRole("heading", { name: "Weight goal" })).toBeInTheDocument();
    expect(screen.getByText("73.0 kg")).toBeInTheDocument();
    expect(screen.getByText(/Still to lose \d\.\d kg from \d\d\.\d kg/)).toBeInTheDocument();
    expect(screen.getByText("Behind the pace you need")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Edit weight goal" })).toHaveAttribute(
      "href",
      "/weight/goal",
    );
    expect(screen.getByText("Needed to reach the target")).toBeInTheDocument();
  });

  it("explains the cap on request", async () => {
    const user = setup();
    renderAt("/weight/trend");
    await user.click(await screen.findByRole("button", { name: "How the cap works" }));
    expect(
      screen.getByText(/never aims for a loss faster than 0\.5 % of your body weight/),
    ).toBeInTheDocument();
    expect(screen.getByText(/It is a training rule, not medical advice\./)).toBeInTheDocument();
  });

  it("says so once the target is reached", async () => {
    vi.mocked(fetchActiveWeightGoal).mockResolvedValue({ ...GOAL, targetKg: 76 });
    renderAt("/weight/trend");
    expect(await screen.findByText(/You reached your target/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Set a new goal" })).toBeInTheDocument();
  });

  it("offers to try again when the goal cannot be loaded", async () => {
    const user = setup();
    vi.mocked(fetchActiveWeightGoal).mockRejectedValueOnce(new Error("offline"));
    renderAt("/weight/trend");
    expect(await screen.findByText("The weight goal could not be loaded.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("heading", { name: "Weight loss trend" })).toBeInTheDocument();
  });
});

describe("Set the weight goal (R2c)", () => {
  it("has no tabs, labelled fields, no placeholders and the cap explained", async () => {
    renderAt("/weight/goal");
    const target = await screen.findByLabelText("Target weight");
    expect(target).toHaveFocus();
    expect(target).not.toHaveAttribute("placeholder");
    expect(target).toHaveAccessibleDescription(/Your 7-day average is \d\d\.\d kg today\./);
    expect(screen.getByLabelText("Target date")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Log" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "How the cap works" })).toBeInTheDocument();
  });

  it("asks for a weigh-in first when the log is empty", async () => {
    vi.mocked(api.fetchWeightEntries).mockResolvedValue([]);
    renderAt("/weight/goal");
    expect(await screen.findByText(/Log a weigh-in first/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to the weight log" })).toBeInTheDocument();
  });

  it("shows an error when the weigh-ins cannot be loaded", async () => {
    const user = setup();
    vi.mocked(api.fetchWeightEntries).mockRejectedValueOnce(new Error("offline"));
    renderAt("/weight/goal");
    expect(await screen.findByText("The weight goal could not be loaded.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByLabelText("Target weight")).toBeInTheDocument();
  });

  it("validates both fields and shows Goal not saved", async () => {
    const user = setup();
    renderAt("/weight/goal");
    await user.click(await screen.findByRole("button", { name: "Save" }));
    expect(saveWeightGoal).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Target weight")).toBeInvalid();
    expect(screen.getByLabelText("Target weight")).toHaveFocus();
    expect(screen.getByLabelText("Target date")).toHaveAccessibleDescription(
      /Pick a target date\./,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Goal not saved");
  });

  it("rejects a target that is not below the current weight", async () => {
    const user = setup();
    renderAt("/weight/goal");
    await user.type(await screen.findByLabelText("Target weight"), "80");
    await user.type(screen.getByLabelText("Target date"), "2027-03-01");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(screen.getByLabelText("Target weight")).toHaveAccessibleDescription(
      /Choose a target below your current \d\d\.\d kg\./,
    );
    expect(saveWeightGoal).not.toHaveBeenCalled();
  });

  it("rejects a date too soon for the cap and fixes it with Use <date>, which does not save", async () => {
    const user = setup();
    renderAt("/weight/goal");
    await user.type(await screen.findByLabelText("Target weight"), "72");
    await user.type(screen.getByLabelText("Target date"), "2026-12-13");
    await user.click(screen.getByRole("button", { name: "Save" }));

    const date = screen.getByLabelText("Target date");
    expect(date).toBeInvalid();
    expect(date).toHaveFocus();
    expect(date).toHaveAccessibleDescription(/needs 0\.\d\d kg a week\. The cap is 0\.\d\d kg\./);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "The date is too soon for this target. Pick a later date.",
    );
    expect(saveWeightGoal).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: /^Use / }));
    expect(saveWeightGoal).not.toHaveBeenCalled();
    expect((date as HTMLInputElement).value > "2026-12-13").toBe(true);

    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => {
      expect(saveWeightGoal).toHaveBeenCalledTimes(1);
    });
  });

  it("saves the goal with the start weight snapshot and goes back to the trend", async () => {
    const user = setup();
    renderAt("/weight/goal");
    await user.type(await screen.findByLabelText("Target weight"), "74,2");
    await user.type(screen.getByLabelText("Target date"), "2026-12-30");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => {
      expect(saveWeightGoal).toHaveBeenCalled();
    });
    const [goal, previousId] = vi.mocked(saveWeightGoal).mock.calls[0] ?? [];
    expect(goal).toMatchObject({
      targetKg: 74.2,
      targetDate: "2026-12-30",
      startDate: "2026-10-28",
    });
    expect(goal?.startKg).toBeGreaterThan(74.2);
    expect(previousId).toBeNull();
    expect(await screen.findByRole("heading", { name: "Weight loss trend" })).toBeInTheDocument();
  });

  it("passes the old goal so it is cancelled first, and prefills its values", async () => {
    const user = setup();
    vi.mocked(fetchActiveWeightGoal).mockResolvedValue(GOAL);
    renderAt("/weight/goal");
    expect(await screen.findByLabelText("Target weight")).toHaveValue("73");
    expect(screen.getByLabelText("Target date")).toHaveValue("2026-12-13");
    await user.clear(screen.getByLabelText("Target date"));
    await user.type(screen.getByLabelText("Target date"), "2027-01-31");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => {
      expect(saveWeightGoal).toHaveBeenCalledWith(expect.anything(), "goal-1");
    });
  });

  it("starts the date at the event date when there is one", async () => {
    vi.mocked(fetchProfile).mockResolvedValue({
      ...EMPTY_PROFILE,
      eventName: "Winter sportive",
      eventDate: "2026-12-12",
    });
    renderAt("/weight/goal");
    expect(await screen.findByLabelText("Target date")).toHaveValue("2026-12-12");
  });

  it("shows Goal not saved when the save fails and keeps the values", async () => {
    const user = setup();
    vi.mocked(saveWeightGoal).mockRejectedValue(new Error("offline"));
    renderAt("/weight/goal");
    await user.type(await screen.findByLabelText("Target weight"), "74");
    await user.type(screen.getByLabelText("Target date"), "2026-12-30");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Goal not saved");
    expect(screen.getByLabelText("Target weight")).toHaveValue("74");
  });

  it("removes the goal", async () => {
    const user = setup();
    vi.mocked(fetchActiveWeightGoal).mockResolvedValue(GOAL);
    renderAt("/weight/goal");
    await user.click(await screen.findByRole("button", { name: "Remove the goal" }));
    await waitFor(() => {
      expect(cancelActiveWeightGoal).toHaveBeenCalled();
    });
  });

  it("cancel goes back without saving", async () => {
    const user = setup();
    renderAt("/weight/goal");
    await user.click(await screen.findByRole("button", { name: "Cancel" }));
    expect(saveWeightGoal).not.toHaveBeenCalled();
    expect(await screen.findByRole("heading", { name: "Weight loss trend" })).toBeInTheDocument();
  });
});

import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeAuth, fakeSession, renderWithProviders } from "@/test/render";
import { EMPTY_PROFILE, fetchProfile, saveProfileSection, type Profile } from "./api";
import { ProfilePage } from "./ProfilePage";

const run = vi.fn();
vi.mock("@/features/plan/adaptation/runner", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  createRunner: () => ({ run }),
}));

vi.mock("./api", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  fetchProfile: vi.fn(),
  saveProfileSection: vi.fn(),
}));

function renderPage() {
  return renderWithProviders(<ProfilePage />, {
    path: "/profile",
    auth: fakeAuth({ status: "signedIn", session: fakeSession() }),
  });
}

function useStore(initial: Profile) {
  let stored = initial;
  vi.mocked(fetchProfile).mockImplementation(async () => stored);
  vi.mocked(saveProfileSection).mockImplementation(async (_userId, patch) => {
    const { section: _section, ...fields } = patch;
    stored = { ...stored, ...fields };
  });
}

const COMMITTED: Profile = { ...EMPTY_PROFILE, level: "committed", weeklyHours: 8 };

/** The training settings of the last save. */
function savedTraining() {
  const patch = vi.mocked(saveProfileSection).mock.calls.at(-1)?.[1];
  return patch?.section === "training" ? patch.training : undefined;
}

const region = () => screen.findByRole("region", { name: "Training settings" });

describe("Profile: training settings (P96 to P98)", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    run.mockResolvedValue({ status: "no-plan" });
    useStore(COMMITTED);
  });

  it("says the plan uses its defaults, with one button to change them", async () => {
    renderPage();
    const card = await region();
    expect(card).toHaveTextContent("The plan uses its defaults: Zone 2 at 65 % of FTP");
    expect(within(card).getByRole("button", { name: "Change training settings" })).toBeVisible();
    expect(within(card).queryByRole("button", { name: /^Edit/ })).not.toBeInTheDocument();
  });

  it("shows what is set, and the limit of the level for what is not", async () => {
    useStore({
      ...COMMITTED,
      training: { ...EMPTY_PROFILE.training, zone2TargetPercent: 70, historyStat: "average" },
    });
    renderPage();
    const card = await region();
    expect(within(card).getByText("70 % of FTP")).toBeInTheDocument();
    expect(within(card).queryByText("Default")).not.toBeInTheDocument();
    expect(within(card).getByText("270 min")).toBeInTheDocument();
    expect(within(card).getByText("10 h")).toBeInTheDocument();
    expect(within(card).getAllByText("Set by your level")).toHaveLength(2);
    expect(within(card).getByText("Average of the last 24 weeks")).toBeInTheDocument();
  });

  it("explains the fields with a visible label and helper text, and no example values", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole("button", { name: "Change training settings" }));
    const zone2 = screen.getByLabelText("Zone 2 target");
    expect(zone2).toHaveValue("");
    expect(zone2).not.toHaveAttribute("placeholder");
    expect(zone2).toHaveAccessibleDescription(
      /Zone 2 itself stays 56 to 75 %\. Leave empty for 65 %\./,
    );
    expect(screen.getByLabelText("Longest long ride")).toHaveAccessibleDescription(
      /Leave empty for your level's limit \(270 minutes\)\./,
    );
    expect(screen.getByLabelText("Most hours in a week")).toHaveAccessibleDescription(
      /Leave empty for your level's limit \(10 h\)\./,
    );
    expect(screen.getByRole("radio", { name: /Median/ })).toBeChecked();
  });

  it("saves the values, with an empty field as the default", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole("button", { name: "Change training settings" }));
    await user.type(screen.getByLabelText("Zone 2 target"), "70");
    await user.type(screen.getByLabelText("Most hours in a week"), "12,5");
    await user.click(screen.getByRole("radio", { name: /Average/ }));
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => {
      expect(saveProfileSection).toHaveBeenCalledWith(expect.any(String), {
        section: "training",
        training: {
          zone2TargetPercent: 70,
          maxLongRideMin: null,
          maxWeeklyHours: 12.5,
          historyStat: "average",
          intensityBalance: "base",
        },
      });
    });
    const card = await region();
    expect(await within(card).findByText("70 % of FTP")).toBeInTheDocument();
    expect(within(card).getByText("12.5 h")).toBeInTheDocument();
    expect(within(card).getByText("Average of the last 24 weeks")).toBeInTheDocument();
  });

  it("keeps Zone 2 target inside the band and says how to fix it", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole("button", { name: "Change training settings" }));
    await user.type(screen.getByLabelText("Zone 2 target"), "80");
    await user.type(screen.getByLabelText("Longest long ride"), "243");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(saveProfileSection).not.toHaveBeenCalled();
    const zone2 = screen.getByLabelText("Zone 2 target");
    expect(zone2).toBeInvalid();
    expect(zone2).toHaveFocus();
    expect(zone2).toHaveAccessibleDescription(
      /The target can be at most 75 % \(the top of Zone 2\)\./,
    );
    expect(screen.getByLabelText("Longest long ride")).toHaveAccessibleDescription(
      /Use steps of 5 minutes\./,
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Check the training settings, then save again.",
    );
  });

  it("goes back to the defaults when the fields are emptied", async () => {
    const user = userEvent.setup();
    useStore({
      ...COMMITTED,
      training: {
        zone2TargetPercent: 70,
        maxLongRideMin: 300,
        maxWeeklyHours: 12,
        historyStat: "median",
        intensityBalance: "base",
      },
    });
    renderPage();
    const card = await region();
    expect(within(card).getByText("70 % of FTP")).toBeInTheDocument();
    expect(within(card).getByText("300 min")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Edit Training settings" }));
    await user.clear(screen.getByLabelText("Zone 2 target"));
    await user.clear(screen.getByLabelText("Longest long ride"));
    await user.clear(screen.getByLabelText("Most hours in a week"));
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => {
      expect(saveProfileSection).toHaveBeenCalledWith(expect.any(String), {
        section: "training",
        training: {
          zone2TargetPercent: null,
          maxLongRideMin: null,
          maxWeeklyHours: null,
          historyStat: "median",
          intensityBalance: "base",
        },
      });
    });
  });

  it("shows a not-saved card and keeps the values when the save fails", async () => {
    const user = userEvent.setup();
    vi.mocked(saveProfileSection).mockRejectedValue(new Error("down"));
    renderPage();
    await user.click(await screen.findByRole("button", { name: "Change training settings" }));
    await user.type(screen.getByLabelText("Zone 2 target"), "70");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Something went wrong. Try again.")).toBeInTheDocument();
    expect(screen.getByLabelText("Zone 2 target")).toHaveValue("70");
  });

  it("resets each field to its default, and only offers it when the field has a value", async () => {
    const user = userEvent.setup();
    useStore({
      ...COMMITTED,
      training: {
        zone2TargetPercent: 70,
        maxLongRideMin: 300,
        maxWeeklyHours: null,
        historyStat: "average",
        intensityBalance: "base",
      },
    });
    renderPage();
    await user.click(await screen.findByRole("button", { name: "Edit Training settings" }));

    expect(
      screen.getByRole("button", { name: "Reset Most hours in a week to default" }),
    ).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Reset Zone 2 target to default" }));
    expect(screen.getByLabelText("Zone 2 target")).toHaveValue("");
    expect(screen.getByLabelText("Zone 2 target")).toHaveFocus();
    expect(screen.getByRole("button", { name: "Reset Zone 2 target to default" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Reset Longest long ride to default" }));
    await user.click(screen.getByRole("button", { name: "Reset recent weekly hours to default" }));
    expect(screen.getByRole("radio", { name: /Median/ })).toBeChecked();

    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => {
      expect(saveProfileSection).toHaveBeenCalledWith(expect.any(String), {
        section: "training",
        training: {
          zone2TargetPercent: null,
          maxLongRideMin: null,
          maxWeeklyHours: null,
          historyStat: "median",
          intensityBalance: "base",
        },
      });
    });
  });

  it("lets a field with an error be reset, which clears the error", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole("button", { name: "Change training settings" }));
    await user.type(screen.getByLabelText("Zone 2 target"), "80");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(screen.getByLabelText("Zone 2 target")).toBeInvalid();
    await user.click(screen.getByRole("button", { name: "Reset Zone 2 target to default" }));
    expect(screen.getByLabelText("Zone 2 target")).toBeValid();
    expect(screen.getByLabelText("Zone 2 target")).toHaveValue("");
  });

  it("offers the three balances, base-focused first, and saves the one you choose", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole("button", { name: "Change training settings" }));
    expect(screen.getByRole("radio", { name: /Base-focused/ })).toBeChecked();
    expect(screen.getByRole("radio", { name: /Balanced/ })).not.toBeChecked();
    expect(screen.getByRole("radio", { name: /High-intensity/ })).toHaveAccessibleName(
      /No trial has tested this at 8 to 10 hours a week/,
    );
    expect(
      screen.getByRole("button", { name: "Reset intensity balance to default" }),
    ).toBeDisabled();
    await user.click(screen.getByRole("radio", { name: /Balanced/ }));
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => {
      expect(vi.mocked(saveProfileSection)).toHaveBeenCalled();
    });
    expect(savedTraining()?.intensityBalance).toBe("balanced");
    const card = await region();
    expect(await within(card).findByText("Balanced")).toBeInTheDocument();
  });

  it("resets the balance to base-focused", async () => {
    const user = userEvent.setup();
    useStore({
      ...COMMITTED,
      training: { ...EMPTY_PROFILE.training, intensityBalance: "high" },
    });
    renderPage();
    await user.click(await screen.findByRole("button", { name: "Edit Training settings" }));
    expect(screen.getByRole("radio", { name: /High-intensity/ })).toBeChecked();
    await user.click(screen.getByRole("button", { name: "Reset intensity balance to default" }));
    expect(screen.getByRole("radio", { name: /Base-focused/ })).toBeChecked();
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => {
      expect(vi.mocked(saveProfileSection)).toHaveBeenCalled();
    });
    expect(savedTraining()?.intensityBalance).toBe("base");
  });

  describe("the answer after saving (P100)", () => {
    async function saveZone2() {
      const user = userEvent.setup();
      renderPage();
      await user.click(await screen.findByRole("button", { name: "Change training settings" }));
      await user.type(screen.getByLabelText("Zone 2 target"), "70");
      await user.click(screen.getByRole("button", { name: "Save" }));
    }
    const done = (outcome: string, change: unknown = null) => ({
      status: "done",
      outcome,
      view: {},
      changeId: null,
      change,
    });

    it("evaluates the plan at once and says when no session changes", async () => {
      run.mockResolvedValue(done("unchanged"));
      await saveZone2();
      const card = await screen.findByText("Plan not changed");
      expect(card.closest("[role=status]")).toHaveTextContent(
        "Your settings are saved. No session in your plan changes with them.",
      );
      expect(run).toHaveBeenCalledTimes(1);
      expect(run.mock.calls[0]?.[1]).toBeUndefined();
    });

    it("leaves the announcement to the Plan updated card when sessions changed", async () => {
      run.mockResolvedValue(done("recalculated", { id: "c1" }));
      await saveZone2();
      await waitFor(() => {
        expect(run).toHaveBeenCalled();
      });
      expect(screen.queryByText("Plan not changed")).not.toBeInTheDocument();
      expect(screen.queryByText("Plan not updated")).not.toBeInTheDocument();
    });

    it("says the settings are saved when there is no plan yet", async () => {
      await saveZone2();
      const card = await screen.findByText("Settings saved");
      expect(card.closest("[role=status]")).toHaveTextContent("You have no plan yet.");
    });

    it("says the plan could not be updated, and that the settings are saved", async () => {
      run.mockResolvedValue({ status: "failed", error: new Error("down") });
      await saveZone2();
      expect(await screen.findByText("Plan not updated")).toBeInTheDocument();
      expect(screen.getByText("Reason: down")).toBeInTheDocument();
      expect(
        screen.getByText(/Your settings are saved, but the plan could not be updated/),
      ).toBeVisible();
    });
  });
});

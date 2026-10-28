import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeAuth, fakeSession, renderWithProviders } from "@/test/render";
import { EMPTY_PROFILE, fetchProfile, saveProfileSection, type Profile } from "./api";
import { ProfilePage } from "./ProfilePage";

vi.mock("./api", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  fetchProfile: vi.fn(),
  saveProfileSection: vi.fn(),
}));

const FILLED: Profile = {
  displayName: "Sam",
  birthYear: 1988,
  availableDays: ["tue", "thu", "sat", "sun"],
  goal: "Ride 200 km in one day.",
};

function renderPage() {
  return renderWithProviders(<ProfilePage />, {
    path: "/profile",
    auth: fakeAuth({ status: "signedIn", session: fakeSession() }),
  });
}

describe("Profile (H1 to H3)", () => {
  /** A tiny fake database: reads return what was saved last. */
  function useStore(initial: Profile) {
    let stored = initial;
    vi.mocked(fetchProfile).mockImplementation(async () => stored);
    vi.mocked(saveProfileSection).mockImplementation(async (_userId, patch) => {
      if (patch.section === "about") {
        stored = { ...stored, displayName: patch.displayName, birthYear: patch.birthYear };
      } else if (patch.section === "week") {
        stored = { ...stored, availableDays: patch.availableDays };
      } else {
        stored = { ...stored, goal: patch.goal };
      }
    });
  }

  beforeEach(() => {
    useStore(FILLED);
  });

  it("shows a loading state first", () => {
    vi.mocked(fetchProfile).mockReturnValue(new Promise(() => undefined));
    renderPage();
    expect(screen.getByRole("status")).toHaveTextContent("Loading");
  });

  it("shows the three sections with an Edit button each (H1)", async () => {
    renderPage();
    expect(await screen.findByRole("heading", { name: "About you" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Training week" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Goal" })).toBeInTheDocument();
    expect(screen.getByText("Sam")).toBeInTheDocument();
    expect(screen.getByText("1988")).toBeInTheDocument();
    expect(screen.getByText("Ride 200 km in one day.")).toBeInTheDocument();
    for (const name of ["Edit About you", "Edit Training week", "Edit Goal"]) {
      expect(screen.getByRole("button", { name })).toBeInTheDocument();
    }
    const week = screen.getByRole("region", { name: "Training week" });
    expect(within(week).getByText("Tue").parentElement).toHaveTextContent("available");
    expect(within(week).getByText("Mon").parentElement).toHaveTextContent("not available");
  });

  it("shows the empty state with an add button per section (H3)", async () => {
    useStore(EMPTY_PROFILE);
    renderPage();
    expect(await screen.findByText("Your profile is empty")).toBeInTheDocument();
    for (const name of ["Add details", "Add days", "Add a goal"]) {
      expect(screen.getByRole("button", { name })).toBeInTheDocument();
    }
    expect(screen.queryByRole("button", { name: /^Edit/ })).not.toBeInTheDocument();
  });

  it("shows the empty text for one empty section only", async () => {
    useStore({ ...FILLED, goal: null });
    renderPage();
    expect(await screen.findByText("No goal yet.")).toBeInTheDocument();
    expect(screen.queryByText("Your profile is empty")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit About you" })).toBeInTheDocument();
  });

  it("offers to try again when the profile cannot be loaded", async () => {
    const user = userEvent.setup();
    vi.mocked(fetchProfile).mockRejectedValueOnce(new Error("offline"));
    renderPage();
    expect(await screen.findByText("The profile could not be loaded.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Sam")).toBeInTheDocument();
  });

  it("edits one section in place and saves it", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole("button", { name: "Edit About you" }));

    const name = screen.getByLabelText("Display name");
    expect(name).toHaveFocus();
    expect(name).toHaveValue("Sam");
    expect(screen.getByLabelText("Birth year")).toHaveValue("1988");
    // The other sections stay in view mode.
    expect(screen.getByRole("button", { name: "Edit Training week" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit Goal" })).toBeInTheDocument();

    await user.clear(name);
    await user.type(name, "  Alex ");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(saveProfileSection).toHaveBeenCalledWith(expect.any(String), {
        section: "about",
        displayName: "Alex",
        birthYear: 1988,
      });
    });
    expect(await screen.findByText("Alex")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit About you" })).toHaveFocus();
  });

  it("clears a field into null", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole("button", { name: "Edit About you" }));
    await user.clear(screen.getByLabelText("Birth year"));
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => {
      expect(saveProfileSection).toHaveBeenCalledWith(expect.any(String), {
        section: "about",
        displayName: "Sam",
        birthYear: null,
      });
    });
  });

  it("shows the error below the field, moves focus there and shows Not saved (H2)", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole("button", { name: "Edit About you" }));
    const year = screen.getByLabelText("Birth year");
    await user.clear(year);
    await user.type(year, "1800");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(saveProfileSection).not.toHaveBeenCalled();
    expect(year).toHaveFocus();
    expect(year).toBeInvalid();
    expect(year).toHaveAccessibleDescription(
      /Enter a year from 1920\..*Four digits\. Used for heart rate estimates\. Optional\./,
    );
    const card = screen.getByRole("alert");
    expect(card).toHaveTextContent("Not saved");
    expect(card).toHaveTextContent("Check the birth year, then save again.");
  });

  it("rejects text that is not a year and a name that is too long", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole("button", { name: "Edit About you" }));
    const name = screen.getByLabelText("Display name");
    await user.clear(name);
    await user.type(name, "x".repeat(41));
    const year = screen.getByLabelText("Birth year");
    await user.clear(year);
    await user.type(year, "abc");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(name).toHaveAccessibleDescription(/Name can be at most 40 characters\./);
    expect(year).toHaveAccessibleDescription(/Enter a year as a number\./);
    expect(name).toHaveFocus();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Check the name and the birth year, then save again.",
    );
  });

  it("keeps one section's error while another section saves", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole("button", { name: "Edit About you" }));
    const year = screen.getByLabelText("Birth year");
    await user.clear(year);
    await user.type(year, "1800");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(year).toBeInvalid();

    await user.click(screen.getByRole("button", { name: "Edit Goal" }));
    const goal = screen.getByRole("textbox", { name: "Goal" });
    await user.clear(goal);
    await user.type(goal, "Climb Mont Ventoux");
    await user.click(
      within(screen.getByRole("region", { name: "Goal" })).getByRole("button", { name: "Save" }),
    );

    expect(await screen.findByText("Climb Mont Ventoux")).toBeInTheDocument();
    expect(screen.getByLabelText("Birth year")).toBeInvalid();
  });

  it("shows Not saved and keeps the form open when the save fails", async () => {
    const user = userEvent.setup();
    vi.mocked(saveProfileSection).mockRejectedValue(new Error("offline"));
    renderPage();
    await user.click(await screen.findByRole("button", { name: "Edit Goal" }));
    const goal = screen.getByRole("textbox", { name: "Goal" });
    await user.clear(goal);
    await user.type(goal, "New goal");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Not saved");
    expect(screen.getByRole("textbox", { name: "Goal" })).toHaveValue("New goal");
    await user.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("cancel discards the changes", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole("button", { name: "Edit Goal" }));
    await user.type(screen.getByRole("textbox", { name: "Goal" }), " extra");
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(saveProfileSection).not.toHaveBeenCalled();
    expect(screen.getByText("Ride 200 km in one day.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit Goal" })).toHaveFocus();
  });

  it("counts the goal characters", async () => {
    const user = userEvent.setup();
    useStore(EMPTY_PROFILE);
    renderPage();
    await user.click(await screen.findByRole("button", { name: "Add a goal" }));
    expect(screen.getByText("0 / 200")).toBeInTheDocument();
    await user.type(screen.getByRole("textbox", { name: "Goal" }), "Ride");
    expect(screen.getByText("4 / 200")).toBeInTheDocument();
  });

  it("saves the training days as chosen", async () => {
    const user = userEvent.setup();
    useStore(EMPTY_PROFILE);
    renderPage();
    await user.click(await screen.findByRole("button", { name: "Add days" }));
    const group = screen.getByRole("group", { name: "Available training days" });
    await user.click(within(group).getByRole("checkbox", { name: "Saturday" }));
    await user.click(within(group).getByRole("checkbox", { name: "Tuesday" }));
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => {
      expect(saveProfileSection).toHaveBeenCalledWith(expect.any(String), {
        section: "week",
        availableDays: ["tue", "sat"],
      });
    });
    expect(await screen.findByRole("button", { name: "Edit Training week" })).toBeInTheDocument();
  });
});

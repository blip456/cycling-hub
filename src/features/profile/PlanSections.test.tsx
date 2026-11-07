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

const PLANNED: Profile = {
  ...EMPTY_PROFILE,
  displayName: "Sam",
  availableDays: ["tue", "thu", "sat", "sun"],
  weeklyHours: 6,
  ridingEnvironment: "both",
  trainingPurposes: ["weight_loss", "endurance"],
  levelAnswers: [1, 2, 1, 1, 1],
  level: "committed",
  eventName: "Winter sportive",
  eventDate: "2099-12-12",
};

describe("Profile: what the plan adds (R1, R1b)", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    useStore(PLANNED);
  });

  it("shows hours, place, ranked purposes, level and event in view mode", async () => {
    renderPage();
    const week = await screen.findByRole("region", { name: "Training week" });
    expect(within(week).getByText("6 h")).toBeInTheDocument();
    expect(within(week).getByText("Indoor and outdoor")).toBeInTheDocument();

    const purposes = screen.getByRole("region", { name: "Training purposes" });
    const items = within(purposes).getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent("1.Weight lossmain purpose");
    expect(items[1]).toHaveTextContent("2.Endurancesecond");
    expect(purposes).toHaveTextContent("Not selected: muscle building, speed.");

    const level = screen.getByRole("region", { name: "Level" });
    expect(level).toHaveTextContent("Committed");
    expect(level).toHaveTextContent("Scored from your answers: 6 of 15.");

    const event = screen.getByRole("region", { name: "Event" });
    expect(event).toHaveTextContent("Winter sportive");
    expect(event).toHaveTextContent("Sat 12 Dec 2099");
    expect(event).toHaveTextContent(/\d+ days from today\. The plan builds a lighter last week/);
  });

  it("shows the empty text and add button of each new section", async () => {
    useStore(EMPTY_PROFILE);
    renderPage();
    await screen.findByText("Your profile is empty");
    expect(
      screen.getByText("No purposes yet. Without them the plan builds endurance."),
    ).toBeInTheDocument();
    expect(screen.getByText("No level yet. Five short questions set it.")).toBeInTheDocument();
    expect(screen.getByText("No event. The plan builds general fitness.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Answer the questions" })).toBeInTheDocument();
  });

  it("saves hours and the riding place with the training days", async () => {
    const user = userEvent.setup();
    useStore({ ...PLANNED, weeklyHours: null, ridingEnvironment: null });
    renderPage();
    await user.click(await screen.findByRole("button", { name: "Edit Training week" }));
    await user.type(screen.getByLabelText("Average hours per week"), "7,5");
    await user.click(screen.getByRole("radio", { name: "Indoor" }));
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => {
      expect(saveProfileSection).toHaveBeenCalledWith(expect.any(String), {
        section: "week",
        availableDays: ["tue", "thu", "sat", "sun"],
        weeklyHours: 7.5,
        ridingEnvironment: "indoor",
      });
    });
    expect(await screen.findByText("7.5 h")).toBeInTheDocument();
  });

  it("rejects hours outside 1 to 25 and quarter hours, with the error below the field", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole("button", { name: "Edit Training week" }));
    const hours = screen.getByLabelText("Average hours per week");
    await user.clear(hours);
    await user.type(hours, "30");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(saveProfileSection).not.toHaveBeenCalled();
    expect(hours).toBeInvalid();
    expect(hours).toHaveFocus();
    expect(hours).toHaveAccessibleDescription(/Hours can be at most 25\./);
    expect(screen.getByRole("alert")).toHaveTextContent("Check the training week");

    await user.clear(hours);
    await user.type(hours, "6.25");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(hours).toHaveAccessibleDescription(/Use whole or half hours\./);
  });

  describe("purposes", () => {
    it("ranks with Move up and Move down, keeps focus and announces the move", async () => {
      const user = userEvent.setup();
      renderPage();
      await user.click(await screen.findByRole("button", { name: "Edit Training purposes" }));
      const list = within(screen.getByRole("region", { name: "Training purposes" })).getByRole(
        "list",
      );
      expect(within(list).getAllByRole("listitem")[0]).toHaveTextContent("Weight loss");
      expect(screen.getByRole("button", { name: "Move Weight loss up" })).toBeDisabled();
      expect(screen.getByRole("button", { name: "Move Endurance down" })).toBeDisabled();

      await user.click(screen.getByRole("button", { name: "Move Endurance up" }));
      const rows = within(
        within(screen.getByRole("region", { name: "Training purposes" })).getByRole("list"),
      ).getAllByRole("listitem");
      expect(rows[0]).toHaveTextContent("Endurance");
      expect(rows[1]).toHaveTextContent("Weight loss");
      expect(screen.getByText("Endurance moved to position 1")).toBeInTheDocument();
      // The row is now first: its Move up is disabled, so focus goes to Move down of the same row.
      expect(screen.getByRole("button", { name: "Move Endurance down" })).toHaveFocus();

      await user.click(screen.getByRole("button", { name: "Save" }));
      await waitFor(() => {
        expect(saveProfileSection).toHaveBeenCalledWith(expect.any(String), {
          section: "purposes",
          trainingPurposes: ["endurance", "weight_loss"],
        });
      });
      const view = await screen.findByRole("region", { name: "Training purposes" });
      expect(within(view).getAllByRole("listitem")[0]).toHaveTextContent("1.Endurance");
    });

    it("allows at most two purposes", async () => {
      const user = userEvent.setup();
      renderPage();
      await user.click(await screen.findByRole("button", { name: "Edit Training purposes" }));
      await user.click(screen.getByRole("checkbox", { name: "Speed" }));
      await user.click(screen.getByRole("button", { name: "Save" }));
      expect(saveProfileSection).not.toHaveBeenCalled();
      expect(
        screen.getAllByRole("alert").some((a) => /at most 2 purposes/.test(a.textContent)),
      ).toBe(true);
    });

    it("saves an empty choice as no purposes", async () => {
      const user = userEvent.setup();
      renderPage();
      await user.click(await screen.findByRole("button", { name: "Edit Training purposes" }));
      await user.click(screen.getByRole("checkbox", { name: "Weight loss" }));
      await user.click(screen.getByRole("checkbox", { name: "Endurance" }));
      await user.click(screen.getByRole("button", { name: "Save" }));
      await waitFor(() => {
        expect(saveProfileSection).toHaveBeenCalledWith(expect.any(String), {
          section: "purposes",
          trainingPurposes: [],
        });
      });
    });
  });

  describe("level", () => {
    it("needs all five answers", async () => {
      const user = userEvent.setup();
      useStore(EMPTY_PROFILE);
      renderPage();
      await user.click(await screen.findByRole("button", { name: "Answer the questions" }));
      await user.click(screen.getByRole("button", { name: "Save" }));
      expect(saveProfileSection).not.toHaveBeenCalled();
      expect(
        screen.getAllByRole("alert").some((a) => /Answer all five questions\./.test(a.textContent)),
      ).toBe(true);
    });

    it("scores the answers, shows the level and saves it", async () => {
      const user = userEvent.setup();
      useStore({ ...EMPTY_PROFILE, weeklyHours: 12 });
      renderPage();
      await user.click(await screen.findByRole("button", { name: "Answer the questions" }));
      const groups = screen.getAllByRole("group");
      expect(groups).toHaveLength(5 + 0);
      for (const group of groups) {
        await user.click(within(group).getAllByRole("radio")[3] as HTMLElement);
      }
      expect(screen.getByText(/Your answers score 15 of 15: semi-pro\./)).toBeInTheDocument();
      expect(screen.getByRole("radio", { name: "Semi-pro" })).toBeChecked();
      await user.click(screen.getByRole("button", { name: "Save" }));
      await waitFor(() => {
        expect(saveProfileSection).toHaveBeenCalledWith(expect.any(String), {
          section: "level",
          levelAnswers: [3, 3, 3, 3, 3],
          level: "semi-pro",
        });
      });
    });

    it("lowers the level with the hours gate and lets the PO override it", async () => {
      const user = userEvent.setup();
      useStore({ ...EMPTY_PROFILE, weeklyHours: 4 });
      renderPage();
      await user.click(await screen.findByRole("button", { name: "Answer the questions" }));
      for (const group of screen.getAllByRole("group")) {
        await user.click(within(group).getAllByRole("radio")[3] as HTMLElement);
      }
      expect(
        screen.getByText(/Lowered to amateur because you train fewer hours/),
      ).toBeInTheDocument();
      await user.click(screen.getByRole("radio", { name: "Committed" }));
      await user.click(screen.getByRole("button", { name: "Save" }));
      await waitFor(() => {
        expect(saveProfileSection).toHaveBeenCalledWith(expect.any(String), {
          section: "level",
          levelAnswers: [3, 3, 3, 3, 3],
          level: "committed",
        });
      });
      expect(
        await screen.findByText(/You changed it\. Your answers score 15 of 15: amateur\./),
      ).toBeInTheDocument();
    });
  });

  describe("event", () => {
    it("rejects a date in the past and says how to fix it", async () => {
      const user = userEvent.setup();
      useStore(EMPTY_PROFILE);
      renderPage();
      await user.click(await screen.findByRole("button", { name: "Add an event" }));
      await user.type(screen.getByLabelText("Event name"), "Winter sportive");
      await user.type(screen.getByLabelText("Event date"), "2020-01-01");
      await user.click(screen.getByRole("button", { name: "Save" }));
      expect(saveProfileSection).not.toHaveBeenCalled();
      const date = screen.getByLabelText("Event date");
      expect(date).toBeInvalid();
      expect(date).toHaveFocus();
      expect(date).toHaveAccessibleDescription(
        /The date is in the past\. Pick a date from tomorrow\./,
      );
      expect(screen.getByRole("alert")).toHaveTextContent("Check the event date, then save again.");
    });

    it("asks for the other field when only one is given", async () => {
      const user = userEvent.setup();
      useStore(EMPTY_PROFILE);
      renderPage();
      await user.click(await screen.findByRole("button", { name: "Add an event" }));
      await user.type(screen.getByLabelText("Event name"), "Winter sportive");
      await user.click(screen.getByRole("button", { name: "Save" }));
      expect(screen.getByLabelText("Event date")).toHaveAccessibleDescription(
        /Add the event date\./,
      );
      expect(saveProfileSection).not.toHaveBeenCalled();
    });

    it("saves name and date, and clears the event with two empty fields", async () => {
      const user = userEvent.setup();
      renderPage();
      await user.click(await screen.findByRole("button", { name: "Edit Event" }));
      const name = screen.getByLabelText("Event name");
      await user.clear(name);
      await user.type(name, "  Spring classic ");
      await user.clear(screen.getByLabelText("Event date"));
      await user.type(screen.getByLabelText("Event date"), "2099-03-01");
      await user.click(screen.getByRole("button", { name: "Save" }));
      await waitFor(() => {
        expect(saveProfileSection).toHaveBeenCalledWith(expect.any(String), {
          section: "event",
          eventName: "Spring classic",
          eventDate: "2099-03-01",
        });
      });
      await user.click(await screen.findByRole("button", { name: "Edit Event" }));
      await user.clear(screen.getByLabelText("Event name"));
      await user.clear(screen.getByLabelText("Event date"));
      await user.click(screen.getByRole("button", { name: "Save" }));
      await waitFor(() => {
        expect(saveProfileSection).toHaveBeenLastCalledWith(expect.any(String), {
          section: "event",
          eventName: null,
          eventDate: null,
        });
      });
    });

    it("keeps Training week savable while Event shows an error", async () => {
      const user = userEvent.setup();
      renderPage();
      await user.click(await screen.findByRole("button", { name: "Edit Event" }));
      await user.clear(screen.getByLabelText("Event date"));
      await user.type(screen.getByLabelText("Event date"), "2020-01-01");
      await user.click(
        within(screen.getByRole("region", { name: "Event" })).getByRole("button", { name: "Save" }),
      );
      await user.click(screen.getByRole("button", { name: "Edit Training week" }));
      await user.click(
        within(screen.getByRole("region", { name: "Training week" })).getByRole("button", {
          name: "Save",
        }),
      );
      await waitFor(() => {
        expect(saveProfileSection).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({ section: "week" }),
        );
      });
      expect(screen.getByLabelText("Event date")).toBeInvalid();
    });

    it("shows Not saved when the save fails", async () => {
      const user = userEvent.setup();
      vi.mocked(saveProfileSection).mockRejectedValue(new Error("offline"));
      renderPage();
      await user.click(await screen.findByRole("button", { name: "Edit Event" }));
      await user.click(screen.getByRole("button", { name: "Save" }));
      expect(await screen.findByRole("alert")).toHaveTextContent("Not saved");
      expect(screen.getByLabelText("Event name")).toHaveValue("Winter sportive");
    });
  });
});

import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  fetchReminderSettings,
  saveReminderSettings,
  type ReminderSettings,
} from "@/features/profile/reminder-api";
import { fakeAuth, fakeSession, renderWithProviders } from "@/test/render";
import { WeightReminderSettings } from "./WeightReminderSettings";

vi.mock("@/features/profile/reminder-api", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  fetchReminderSettings: vi.fn(),
  saveReminderSettings: vi.fn(),
}));

function renderSettings() {
  return renderWithProviders(<WeightReminderSettings />, {
    path: "/settings",
    auth: fakeAuth({ status: "signedIn", session: fakeSession() }),
  });
}

describe("Weight reminder settings (W4)", () => {
  /** A tiny fake database: reads return what was saved last. */
  function useStore(initial: ReminderSettings) {
    let stored = initial;
    vi.mocked(fetchReminderSettings).mockImplementation(async () => stored);
    vi.mocked(saveReminderSettings).mockImplementation(async (_userId, settings) => {
      stored = settings;
    });
  }

  beforeEach(() => {
    useStore({ enabled: true, day: "sun" });
  });

  it("shows the switch on and Sunday selected by default", async () => {
    renderSettings();
    const toggle = await screen.findByRole("switch", { name: "Weight reminder" });
    await waitFor(() => {
      expect(toggle).toBeEnabled();
    });
    expect(toggle).toBeChecked();
    const day = screen.getByRole("combobox", { name: "Reminder day" });
    expect(day).toHaveValue("sun");
    expect(day).toBeEnabled();
    expect(day).toHaveAccessibleDescription(/The card appears from this day/);
    expect(screen.getAllByRole("option")).toHaveLength(7);
  });

  it("disables the day while the reminder is off", async () => {
    useStore({ enabled: false, day: "wed" });
    renderSettings();
    const day = await screen.findByRole("combobox", { name: "Reminder day" });
    await waitFor(() => {
      expect(screen.getByRole("switch")).not.toBeChecked();
    });
    expect(day).toBeDisabled();
    expect(day).toHaveValue("wed");
  });

  it("saves only the switch and confirms with a status card", async () => {
    const user = userEvent.setup();
    renderSettings();
    const toggle = await screen.findByRole("switch");
    await waitFor(() => {
      expect(toggle).toBeEnabled();
    });
    await user.click(toggle);
    await waitFor(() => {
      expect(saveReminderSettings).toHaveBeenCalledWith(expect.any(String), {
        enabled: false,
        day: "sun",
      } satisfies ReminderSettings);
    });
    expect(await screen.findByRole("status")).toHaveTextContent("Reminder settings saved");
    expect(screen.getByRole("combobox", { name: "Reminder day" })).toBeDisabled();
  });

  it("saves the chosen day", async () => {
    const user = userEvent.setup();
    renderSettings();
    const day = await screen.findByRole("combobox", { name: "Reminder day" });
    await waitFor(() => {
      expect(day).toBeEnabled();
    });
    await user.selectOptions(day, "Friday");
    await waitFor(() => {
      expect(saveReminderSettings).toHaveBeenCalledWith(expect.any(String), {
        enabled: true,
        day: "fri",
      });
    });
  });

  it("puts the old value back and says Not saved when the save fails", async () => {
    const user = userEvent.setup();
    vi.mocked(saveReminderSettings).mockRejectedValue(new Error("offline"));
    renderSettings();
    const toggle = await screen.findByRole("switch");
    await waitFor(() => {
      expect(toggle).toBeEnabled();
    });
    await user.click(toggle);
    expect(await screen.findByRole("alert")).toHaveTextContent("Not saved");
    await waitFor(() => {
      expect(screen.getByRole("switch")).toBeChecked();
    });
  });

  it("offers to try again when the settings cannot be loaded", async () => {
    const user = userEvent.setup();
    vi.mocked(fetchReminderSettings).mockRejectedValueOnce(new Error("offline"));
    renderSettings();
    expect(
      await screen.findByText("The reminder settings could not be loaded."),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("switch")).toBeInTheDocument();
  });
});

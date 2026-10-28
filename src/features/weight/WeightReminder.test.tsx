import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fakeAuth, fakeSession, renderWithProviders } from "@/test/render";
import * as api from "./api";
import { readDismissedOn } from "./reminder-dismissal";
import { ENTRIES, mockWeightApi, NOW } from "./test-support";
import { WeightReminder } from "./WeightReminder";

vi.mock("./api", async (importOriginal) => {
  const actual = await importOriginal<typeof api>();
  return {
    ...actual,
    fetchWeightEntries: vi.fn(),
    saveWeightEntry: vi.fn(),
    deleteWeightEntry: vi.fn(),
    fetchReminderSettings: vi.fn(),
  };
});

function renderReminder() {
  return renderWithProviders(<WeightReminder />, {
    auth: fakeAuth({ status: "signedIn", session: fakeSession() }),
  });
}

function setup() {
  return userEvent.setup({ advanceTimers: (ms) => vi.advanceTimersByTime(ms) });
}

/** Wednesday 28 Oct 2026. The newest entry of the fixtures is today, so these tests start without it. */
const OLD = ENTRIES.slice(0, 2);

beforeEach(() => {
  window.localStorage.clear();
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(NOW);
  mockWeightApi(OLD);
  vi.mocked(api.fetchReminderSettings).mockResolvedValue({ enabled: true, day: "wed" });
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("weight reminder card", () => {
  it("shows on the reminder day when nothing is logged since", async () => {
    renderReminder();
    const card = await screen.findByRole("status");
    expect(card).toHaveTextContent("Time to log your weight");
    expect(card).toHaveTextContent("Nothing logged in the last 7 days.");
    expect(within(card).getByLabelText("Weight")).not.toHaveAttribute("placeholder");
    expect(card).toHaveTextContent("Saved as today's entry.");
  });

  it("stays away when a weight is logged on or after the reminder day", async () => {
    mockWeightApi(ENTRIES);
    renderReminder();
    await waitFor(() => {
      expect(api.fetchWeightEntries).toHaveBeenCalled();
    });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("stays away when the reminder is switched off", async () => {
    vi.mocked(api.fetchReminderSettings).mockResolvedValue({ enabled: false, day: "wed" });
    renderReminder();
    await waitFor(() => {
      expect(api.fetchReminderSettings).toHaveBeenCalled();
    });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("stays away before the reminder day of this week", async () => {
    mockWeightApi([{ date: "2026-10-23", kg: 75, note: null }]);
    vi.mocked(api.fetchReminderSettings).mockResolvedValue({ enabled: true, day: "fri" });
    renderReminder();
    await waitFor(() => {
      expect(api.fetchWeightEntries).toHaveBeenCalled();
    });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("uses the default (Sunday, on) when the profile has no settings yet", async () => {
    vi.mocked(api.fetchReminderSettings).mockResolvedValue({ enabled: true, day: "sun" });
    renderReminder();
    expect(await screen.findByRole("status")).toHaveTextContent("Time to log your weight");
  });

  it("logs today's weight from the card, says so and goes", async () => {
    const user = setup();
    const stored = [...OLD];
    vi.mocked(api.fetchWeightEntries).mockImplementation(() => Promise.resolve([...stored]));
    vi.mocked(api.saveWeightEntry).mockImplementation((entry) => {
      stored.push(entry);
      return Promise.resolve();
    });
    renderReminder();
    const card = await screen.findByRole("status");
    await user.type(within(card).getByLabelText("Weight"), "74.8");
    await user.click(within(card).getByRole("button", { name: "Log weight" }));
    await waitFor(() => {
      expect(api.saveWeightEntry).toHaveBeenCalledWith({
        date: "2026-10-28",
        kg: 74.8,
        note: null,
      });
    });
    expect(await screen.findByText("Logged 74.8 kg")).toBeInTheDocument();
    vi.advanceTimersByTime(5000);
    await waitFor(() => {
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
    });
  });

  it("checks the weight in the card before saving", async () => {
    const user = setup();
    renderReminder();
    const card = await screen.findByRole("status");
    await user.type(within(card).getByLabelText("Weight"), "12");
    await user.click(within(card).getByRole("button", { name: "Log weight" }));
    expect(within(card).getByLabelText("Weight")).toHaveAccessibleDescription(
      expect.stringContaining("Weight must be at least 30 kg."),
    );
    expect(api.saveWeightEntry).not.toHaveBeenCalled();
  });

  it("keeps the card and says so when saving fails", async () => {
    const user = setup();
    vi.mocked(api.saveWeightEntry).mockRejectedValueOnce(new Error("offline"));
    renderReminder();
    const card = await screen.findByRole("status");
    await user.type(within(card).getByLabelText("Weight"), "74.8");
    await user.click(within(card).getByRole("button", { name: "Log weight" }));
    expect(await screen.findByText(/Could not save your weight/)).toBeInTheDocument();
    expect(screen.getByLabelText("Weight")).toHaveValue("74.8");
  });

  it("Not now hides it for today only and logs nothing", async () => {
    const user = setup();
    const { unmount } = renderReminder();
    await user.click(await screen.findByRole("button", { name: "Not now" }));
    expect(screen.queryByText("Time to log your weight")).not.toBeInTheDocument();
    expect(readDismissedOn()).toBe("2026-10-28");
    expect(api.saveWeightEntry).not.toHaveBeenCalled();
    unmount();

    // Still hidden when the app is opened again the same day.
    renderReminder();
    await waitFor(() => {
      expect(api.fetchReminderSettings).toHaveBeenCalledTimes(2);
    });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(screen.queryByText("Time to log your weight")).not.toBeInTheDocument();
  });

  it("comes back the next day after Not now", async () => {
    window.localStorage.setItem("cycling-hub:weight-reminder-dismissed-on", "2026-10-27");
    renderReminder();
    expect(await screen.findByText("Time to log your weight")).toBeInTheDocument();
  });

  it("Escape dismisses it like Not now", async () => {
    const user = setup();
    renderReminder();
    const card = await screen.findByRole("status");
    await user.click(within(card).getByLabelText("Weight"));
    await user.keyboard("{Escape}");
    expect(screen.queryByText("Time to log your weight")).not.toBeInTheDocument();
    expect(readDismissedOn()).toBe("2026-10-28");
  });
});

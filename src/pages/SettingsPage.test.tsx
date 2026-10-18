import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { THEME_STORAGE_KEY } from "@/lib/theme";
import { fakeAuth, fakeSession, renderWithProviders } from "@/test/render";
import { SettingsPage } from "./SettingsPage";

function renderSettings() {
  return renderWithProviders(<SettingsPage />, {
    path: "/settings",
    auth: fakeAuth({ status: "signedIn", session: fakeSession("rider@test.invalid") }),
  });
}

describe("Settings (G1)", () => {
  afterEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
  });

  it("shows the account, units, time zone and version", () => {
    renderSettings();
    expect(screen.getByText("rider@test.invalid")).toBeInTheDocument();
    expect(screen.getByText("Metric · km, km/h, W, bpm")).toBeInTheDocument();
    expect(screen.getByText("Europe/Brussels")).toBeInTheDocument();
    expect(screen.getByText(__APP_VERSION__)).toBeInTheDocument();
    for (const name of ["Account", "Appearance", "Units and time", "About"]) {
      expect(screen.getByRole("heading", { name })).toBeInTheDocument();
    }
  });

  it("links to What's new and What's next", () => {
    renderSettings();
    expect(screen.getByRole("link", { name: "What's new" })).toHaveAttribute(
      "href",
      "/settings/whats-new",
    );
    expect(screen.getByRole("link", { name: "What's next" })).toHaveAttribute(
      "href",
      "/settings/whats-next",
    );
  });

  it("switches the theme at once and remembers it", async () => {
    const user = userEvent.setup();
    const { unmount } = renderSettings();
    const group = screen.getByRole("radiogroup", { name: "Theme" });
    expect(group).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "System" })).toBeChecked();

    await user.click(screen.getByRole("radio", { name: "Dark" }));
    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");

    // Arrow keys move the selection (radio group).
    await user.keyboard("{ArrowLeft}");
    expect(screen.getByRole("radio", { name: "Light" })).toBeChecked();
    expect(document.documentElement).toHaveAttribute("data-theme", "light");

    unmount();
    renderSettings();
    expect(screen.getByRole("radio", { name: "Light" })).toBeChecked();

    await user.click(screen.getByRole("radio", { name: "System" }));
    expect(document.documentElement).not.toHaveAttribute("data-theme");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();
  });

  it("signs out from the Account group", async () => {
    const user = userEvent.setup();
    const { auth } = renderSettings();
    await user.click(screen.getByRole("button", { name: "Sign out" }));
    expect(auth.signOut).toHaveBeenCalled();
  });
});

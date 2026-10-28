import { screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { STATUS_PRIORITY } from "@/components/status/status-context";
import { navItems, subPageForPath, titleForPath } from "@/components/nav-items";
import { App } from "./App";
import { fakeAuth, fakeSession, renderWithProviders } from "./test/render";

// The shell asks Supabase for profiles.last_seen_version (What's new card); no backend in these tests.
vi.mock("@/features/release/profile-api", () => ({
  fetchLastSeenVersion: vi.fn(async () => __APP_VERSION__),
  saveLastSeenVersion: vi.fn(async () => undefined),
}));

vi.mock("@/features/profile/api", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  fetchProfile: vi.fn(async () => ({
    displayName: null,
    birthYear: null,
    availableDays: [],
    goal: null,
  })),
}));

const signedIn = () => fakeAuth({ status: "signedIn", session: fakeSession() });

describe("Sprint 3 navigation (P48)", () => {
  it("lists Rides, Import, Weight, Profile, Baseline, Settings in that order", () => {
    expect(navItems.map((i) => [i.label, i.to])).toEqual([
      ["Rides", "/rides"],
      ["Import", "/import"],
      ["Weight", "/weight"],
      ["Profile", "/profile"],
      ["Baseline", "/baseline"],
      ["Settings", "/settings"],
    ]);
  });

  it("names the pages and keeps the tabs top-level pages", () => {
    expect(titleForPath("/weight")).toBe("Weight");
    expect(titleForPath("/weight/trend")).toBe("Weight");
    expect(titleForPath("/profile")).toBe("Profile");
    expect(titleForPath("/baseline/zones")).toBe("Baseline");
    for (const path of [
      "/weight",
      "/weight/trend",
      "/baseline",
      "/baseline/zones",
      "/baseline/history",
    ]) {
      expect(subPageForPath(path)).toBeUndefined();
    }
  });
});

describe("Sprint 3 placeholder pages", () => {
  it.each([
    ["/weight", "Log"],
    ["/weight/trend", "Trend"],
    ["/baseline", "Baseline"],
    ["/baseline/zones", "Zones"],
    ["/baseline/history", "History"],
  ])("opens %s with the %s tab current", async (path, tab) => {
    renderWithProviders(<App />, { path, auth: signedIn() });
    const tabs = await screen.findByRole("navigation", {
      name: path.startsWith("/weight") ? "Weight" : "Baseline",
    });
    expect(within(tabs).getByRole("link", { name: tab })).toHaveAttribute("aria-current", "page");
    expect(within(tabs).getAllByRole("link", { current: "page" })).toHaveLength(1);
  });

  it("has the tabs Log and Trend on Weight, and Baseline, Zones and History on Baseline", async () => {
    const weight = renderWithProviders(<App />, { path: "/weight", auth: signedIn() });
    const weightTabs = await screen.findByRole("navigation", { name: "Weight" });
    expect(
      within(weightTabs)
        .getAllByRole("link")
        .map((a) => a.textContent),
    ).toEqual(["Log", "Trend"]);
    weight.unmount();
    renderWithProviders(<App />, { path: "/baseline", auth: signedIn() });
    const baselineTabs = await screen.findByRole("navigation", { name: "Baseline" });
    expect(
      within(baselineTabs)
        .getAllByRole("link")
        .map((a) => a.textContent),
    ).toEqual(["Baseline", "Zones", "History"]);
  });

  it("opens the profile page", async () => {
    renderWithProviders(<App />, { path: "/profile", auth: signedIn() });
    expect(await screen.findByText("Your profile is empty")).toBeInTheDocument();
  });

  it("shows a not-found message below an unknown tab", async () => {
    renderWithProviders(<App />, { path: "/weight/nope", auth: signedIn() });
    expect(await screen.findByText("This page doesn’t exist.")).toBeInTheDocument();
  });

  it("shows the weight reminder section on Settings and no reminder card yet", async () => {
    renderWithProviders(<App />, { path: "/settings", auth: signedIn() });
    expect(await screen.findByRole("heading", { name: "Weight reminder" })).toBeInTheDocument();
    expect(screen.queryByText("Time to log your weight")).not.toBeInTheDocument();
  });
});

describe("weight reminder slot", () => {
  it("goes before What's new and below the update prompt (P52)", () => {
    expect(STATUS_PRIORITY.weightReminder).toBeGreaterThan(STATUS_PRIORITY.whatsNew);
    expect(STATUS_PRIORITY.weightReminder).toBeLessThan(STATUS_PRIORITY.update);
  });
});

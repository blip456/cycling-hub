import { screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { navItems, subPageForPath, titleForPath } from "@/components/nav-items";
import { STATUS_PRIORITY } from "@/components/status/status-context";
import { App } from "./App";
import { fakeAuth, fakeSession, renderWithProviders } from "./test/render";

vi.mock("@/features/release/profile-api", () => ({
  fetchLastSeenVersion: vi.fn(async () => __APP_VERSION__),
  saveLastSeenVersion: vi.fn(async () => undefined),
}));

const signedIn = () => fakeAuth({ status: "signedIn", session: fakeSession() });

describe("Sprint 4 navigation (P68)", () => {
  it("lists Plan second, after Rides", () => {
    expect(navItems.map((i) => [i.label, i.to])).toEqual([
      ["Rides", "/rides"],
      ["Plan", "/plan"],
      ["Import", "/import"],
      ["Weight", "/weight"],
      ["Profile", "/profile"],
      ["Baseline", "/baseline"],
      ["Settings", "/settings"],
    ]);
  });

  it("keeps the tabs top-level pages and the flows sub-pages of Plan", () => {
    expect(titleForPath("/plan")).toBe("Plan");
    expect(subPageForPath("/plan")).toBeUndefined();
    expect(subPageForPath("/plan/overview")).toBeUndefined();
    for (const path of [
      "/plan/new",
      "/plan/session/abc",
      "/plan/changes",
      "/plan/summary",
      "/plan/calendar",
    ])
      expect(subPageForPath(path)?.parent).toBe("/plan");
  });
});

describe("Sprint 4 placeholder pages", () => {
  it("opens the Plan page with the tabs Week and Overview, Week current", async () => {
    renderWithProviders(<App />, { path: "/plan", auth: signedIn() });
    const tabs = await screen.findByRole("navigation", { name: "Plan" });
    expect(
      within(tabs)
        .getAllByRole("link")
        .map((a) => a.textContent),
    ).toEqual(["Week", "Overview"]);
    expect(within(tabs).getByRole("link", { name: "Week" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("opens the Overview tab with Overview current", async () => {
    renderWithProviders(<App />, { path: "/plan/overview", auth: signedIn() });
    const tabs = await screen.findByRole("navigation", { name: "Plan" });
    expect(within(tabs).getByRole("link", { name: "Overview" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(within(tabs).getAllByRole("link", { current: "page" })).toHaveLength(1);
  });

  it.each([["/plan/changes", "Plan changes"]])(
    "opens %s with its page title and no tabs",
    async (path, heading) => {
      renderWithProviders(<App />, { path, auth: signedIn() });
      expect((await screen.findAllByRole("heading", { name: heading })).length).toBeGreaterThan(0);
      expect(screen.queryByRole("navigation", { name: "Plan" })).not.toBeInTheDocument();
    },
  );

  it("shows a not-found message below an unknown Plan page", async () => {
    renderWithProviders(<App />, { path: "/plan/nope", auth: signedIn() });
    expect(await screen.findByText("This page doesn’t exist.")).toBeInTheDocument();
  });
});

describe("plan status card slots", () => {
  it("puts Plan updated above the weight reminder, and the power warning below it but above What's new", () => {
    expect(STATUS_PRIORITY.planUpdated).toBeGreaterThan(STATUS_PRIORITY.weightReminder);
    expect(STATUS_PRIORITY.planUpdated).toBeLessThan(STATUS_PRIORITY.update);
    expect(STATUS_PRIORITY.noPowerData).toBeGreaterThan(STATUS_PRIORITY.whatsNew);
    expect(STATUS_PRIORITY.noPowerData).toBeLessThan(STATUS_PRIORITY.weightReminder);
  });

  it("shows no card yet while the slots have no data", async () => {
    renderWithProviders(<App />, { path: "/plan", auth: signedIn() });
    await screen.findByRole("navigation", { name: "Plan" });
    expect(screen.queryByText("Plan updated")).not.toBeInTheDocument();
  });
});

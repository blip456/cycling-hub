import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";
import type * as ImportApi from "@/features/import/api";
import type * as RidesApi from "@/features/rides/api";
import { App } from "./App";
import { StatusProvider } from "./components/status/StatusProvider";
import { AuthContext, type AuthContextValue } from "./lib/auth/auth-context";
import { fakeAuth, fakeSession, renderWithProviders } from "./test/render";

// The shell asks Supabase for profiles.last_seen_version (What's new card); no backend in these tests.
vi.mock("@/features/release/profile-api", () => ({
  fetchLastSeenVersion: vi.fn(async () => __APP_VERSION__),
  saveLastSeenVersion: vi.fn(async () => undefined),
}));
// The rides page opens with no rides.
vi.mock("@/features/rides/api", async (importOriginal) => ({
  ...(await importOriginal<typeof RidesApi>()),
  fetchRides: vi.fn(async () => []),
}));
vi.mock("@/features/import/api", async (importOriginal) => ({
  ...(await importOriginal<typeof ImportApi>()),
  fetchImportHistory: vi.fn(async () => []),
}));

describe("route guard", () => {
  it.each(["/rides", "/import", "/settings", "/"])(
    "sends a signed-out visitor from %s to sign in",
    (path) => {
      renderWithProviders(<App />, { path });
      expect(screen.getByRole("heading", { name: "Sign in" })).toBeInTheDocument();
      expect(screen.queryByRole("navigation", { name: "Main" })).not.toBeInTheDocument();
    },
  );

  it("shows the app shell when signed in", async () => {
    renderWithProviders(<App />, {
      path: "/rides",
      auth: fakeAuth({ status: "signedIn", session: fakeSession() }),
    });
    expect(screen.getAllByRole("heading", { name: "Rides" }).length).toBeGreaterThan(0);
    expect(await screen.findByRole("heading", { name: "No rides yet" })).toBeInTheDocument();
  });

  it("sends a signed-in user away from the sign-in page", async () => {
    renderWithProviders(<App />, {
      path: "/sign-in",
      auth: fakeAuth({ status: "signedIn", session: fakeSession() }),
    });
    expect(screen.queryByRole("heading", { name: "Sign in" })).not.toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "No rides yet" })).toBeInTheDocument();
  });

  it("shows nothing protected while the session is loading", () => {
    renderWithProviders(<App />, { path: "/settings", auth: fakeAuth({ status: "loading" }) });
    expect(screen.getByRole("status")).toHaveTextContent("Loading");
    expect(screen.queryByRole("button", { name: "Sign out" })).not.toBeInTheDocument();
  });

  it("returns to the requested page after signing in", async () => {
    function Harness() {
      const [auth, setAuth] = useState<AuthContextValue>(() =>
        fakeAuth({
          signIn: async () => {
            setAuth((prev) => ({ ...prev, status: "signedIn", session: fakeSession() }));
            return { ok: true };
          },
        }),
      );
      return (
        <AuthContext.Provider value={auth}>
          <MemoryRouter initialEntries={["/settings"]}>
            <StatusProvider>
              <App />
            </StatusProvider>
          </MemoryRouter>
        </AuthContext.Provider>
      );
    }
    const user = userEvent.setup();
    render(
      <QueryClientProvider client={new QueryClient()}>
        <Harness />
      </QueryClientProvider>,
    );
    await user.type(screen.getByLabelText("Email"), "rider@test.invalid");
    await user.type(screen.getByLabelText("Password"), "correct horse battery");
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByRole("button", { name: "Sign out" })).toBeInTheDocument();
  });

  it("shows the configuration error when Supabase env is missing", () => {
    renderWithProviders(<App />, {
      auth: fakeAuth({ status: "misconfigured", configError: "Missing VITE_SUPABASE_URL" }),
    });
    expect(screen.getByRole("alert")).toHaveTextContent("Missing VITE_SUPABASE_URL");
  });
});

describe("no sign-up", () => {
  it.each(["/sign-in", "/forgot-password"])("offers no sign-up link on %s", (path) => {
    renderWithProviders(<App />, { path });
    for (const link of screen.queryAllByRole("link")) {
      expect(link.textContent ?? "").not.toMatch(/sign.?up|register|create.*account/i);
      expect(link.getAttribute("href") ?? "").not.toMatch(/sign-?up|register/i);
    }
    expect(screen.queryByText(/sign.?up|create (an )?account/i)).not.toBeInTheDocument();
  });

  it("has no sign-up route", () => {
    renderWithProviders(<App />, { path: "/sign-up" });
    // Unknown routes are behind sign-in, so a signed-out visitor lands on the sign-in page.
    expect(screen.getByRole("heading", { name: "Sign in" })).toBeInTheDocument();
  });
});

describe("app shell", () => {
  it("opens and closes the side menu", async () => {
    const user = userEvent.setup();
    renderWithProviders(<App />, {
      path: "/rides",
      auth: fakeAuth({ status: "signedIn", session: fakeSession() }),
    });
    const open = screen.getByRole("button", { name: "Open menu" });
    expect(open).toHaveAttribute("aria-expanded", "false");
    await user.click(open);
    expect(open).toHaveAttribute("aria-expanded", "true");
    await user.click(screen.getByRole("button", { name: "Close menu" }));
    expect(open).toHaveAttribute("aria-expanded", "false");
  });

  it("lists Rides, Import and Settings in the menu", () => {
    renderWithProviders(<App />, {
      path: "/rides",
      auth: fakeAuth({ status: "signedIn", session: fakeSession() }),
    });
    const navs = screen.getAllByRole("navigation", { name: "Main", hidden: true });
    expect(navs.length).toBeGreaterThan(0);
    for (const name of ["Rides", "Import", "Settings"]) {
      expect(screen.getAllByRole("link", { name, hidden: true }).length).toBeGreaterThan(0);
    }
  });

  it("signs out from Settings", async () => {
    const user = userEvent.setup();
    const { auth } = renderWithProviders(<App />, {
      path: "/settings",
      auth: fakeAuth({ status: "signedIn", session: fakeSession() }),
    });
    expect(screen.getByText(__APP_VERSION__)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Sign out" }));
    expect(auth.signOut).toHaveBeenCalled();
  });
});

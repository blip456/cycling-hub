import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "@/App";
import { mockViewport } from "@/test/match-media";
import { fakeAuth, fakeSession, renderWithProviders } from "@/test/render";
import { fetchLastSeenVersion, saveLastSeenVersion } from "./profile-api";
import type * as VersionModule from "./version";

vi.mock("./profile-api", () => ({
  fetchLastSeenVersion: vi.fn(),
  saveLastSeenVersion: vi.fn(),
}));
// The running app is v0.2.0 in these tests.
vi.mock("./version", async (importOriginal) => ({
  ...(await importOriginal<typeof VersionModule>()),
  APP_VERSION: "0.2.0",
}));

const session = fakeSession();
const userId = session.user.id;

/** A tiny in-memory profiles row, shared by every "device" (render) in a test. */
let stored: string | null;

function openApp(path = "/rides") {
  return renderWithProviders(<App />, {
    path,
    auth: fakeAuth({ status: "signedIn", session }),
  });
}

describe("What's new card (B1d)", () => {
  beforeEach(() => {
    stored = null;
    vi.mocked(fetchLastSeenVersion).mockImplementation(async () => stored);
    vi.mocked(saveLastSeenVersion).mockImplementation(async (_id, version) => {
      stored = version;
    });
  });

  it("does not show on the first sign-in and records the running version", async () => {
    openApp();
    await waitFor(() => {
      expect(saveLastSeenVersion).toHaveBeenCalledWith(userId, "0.2.0");
    });
    expect(screen.queryByText("Updated to v0.2.0")).not.toBeInTheDocument();
  });

  it("does not show when the running version was already seen", async () => {
    stored = "0.2.0";
    openApp();
    await waitFor(() => {
      expect(fetchLastSeenVersion).toHaveBeenCalledWith(userId);
    });
    expect(screen.queryByText("Updated to v0.2.0")).not.toBeInTheDocument();
    expect(saveLastSeenVersion).not.toHaveBeenCalled();
  });

  it("shows once after an update; dismissing stores the version for every device", async () => {
    stored = "0.1.0";
    const user = userEvent.setup();
    const phone = openApp();
    const card = (await screen.findByText("Updated to v0.2.0")).closest("[role=status]");
    expect(card).not.toBeNull();
    expect(within(card as HTMLElement).getByRole("link", { name: "What's new" })).toHaveAttribute(
      "href",
      "/settings/whats-new",
    );

    await user.click(within(card as HTMLElement).getByRole("button", { name: "Dismiss" }));
    // Optimistic: gone at once.
    expect(screen.queryByText("Updated to v0.2.0")).not.toBeInTheDocument();
    expect(saveLastSeenVersion).toHaveBeenCalledWith(userId, "0.2.0");
    phone.unmount();

    // The laptop (a fresh app with an empty cache) reads the stored version: no card.
    openApp();
    await waitFor(() => {
      expect(fetchLastSeenVersion).toHaveBeenCalledTimes(3);
    });
    expect(screen.queryByText("Updated to v0.2.0")).not.toBeInTheDocument();
  });

  it("comes back when the version could not be stored", async () => {
    stored = "0.1.0";
    vi.mocked(saveLastSeenVersion).mockRejectedValue(new Error("offline"));
    const user = userEvent.setup();
    openApp();
    await user.click(
      within(
        (await screen.findByText("Updated to v0.2.0")).closest("[role=status]") as HTMLElement,
      ).getByRole("button", { name: "Dismiss" }),
    );
    expect(await screen.findByText("Updated to v0.2.0")).toBeInTheDocument();
  });

  it("opening What's new from the card marks the version as seen", async () => {
    stored = "0.1.0";
    const user = userEvent.setup();
    openApp();
    await user.click(await screen.findByRole("link", { name: "What's new" }));
    await waitFor(() => {
      expect(saveLastSeenVersion).toHaveBeenCalledWith(userId, "0.2.0");
    });
    expect(screen.queryByText("Updated to v0.2.0")).not.toBeInTheDocument();
  });
});

describe("status card placement (P12, P31)", () => {
  let viewport: ReturnType<typeof mockViewport>;
  beforeEach(() => {
    stored = "0.1.0";
    vi.mocked(fetchLastSeenVersion).mockImplementation(async () => stored);
  });
  afterEach(() => {
    viewport.restore();
  });

  const card = async () =>
    (await screen.findByText("Updated to v0.2.0")).closest("[role=status]") as HTMLElement;
  const sideMenu = () => screen.getByRole("complementary");

  it("floats at the bottom of the page on the phone", async () => {
    viewport = mockViewport(390);
    openApp();
    expect(await card()).toHaveAttribute("data-placement", "floating");
    expect(sideMenu()).not.toContainElement(await card());
  });

  it("sits at the bottom of the side menu on desktop and moves when the window narrows", async () => {
    viewport = mockViewport(1280);
    openApp();
    expect(await card()).toHaveAttribute("data-placement", "side");
    expect(sideMenu()).toContainElement(await card());
    // Above the version, inside the menu.
    expect(within(sideMenu()).getByText(/^Version /)).toBeInTheDocument();

    viewport.resize(959);
    expect(await card()).toHaveAttribute("data-placement", "floating");
    expect(sideMenu()).not.toContainElement(await card());

    viewport.resize(960);
    expect(await card()).toHaveAttribute("data-placement", "side");
  });

  it("shows one card at a time: Password changed wins and sits in the side menu on desktop", async () => {
    viewport = mockViewport(1280);
    // ResetPasswordPage navigates to /rides with this state.
    renderWithProviders(<App />, {
      path: { pathname: "/rides", state: { flash: "Password changed." } },
      auth: fakeAuth({ status: "signedIn", session }),
    });
    await waitFor(() => {
      expect(fetchLastSeenVersion).toHaveBeenCalled();
    });
    const flash = screen.getByText("Password changed.").closest("[role=status]") as HTMLElement;
    expect(flash).toHaveAttribute("data-placement", "side");
    expect(sideMenu()).toContainElement(flash);
    expect(screen.queryByText("Updated to v0.2.0")).not.toBeInTheDocument();

    // Dismissing it lets the What's new card through.
    await userEvent.setup().click(within(flash).getByRole("button", { name: "Dismiss" }));
    expect(await card()).toHaveAttribute("data-placement", "side");
  });
});

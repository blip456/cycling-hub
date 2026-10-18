import { screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchLastSeenVersion, saveLastSeenVersion } from "@/features/release/profile-api";
import type { Release } from "@/features/release/data";
import { fakeAuth, fakeSession, renderWithProviders } from "@/test/render";
import { WhatsNewPage } from "./WhatsNewPage";

vi.mock("@/features/release/profile-api", () => ({
  fetchLastSeenVersion: vi.fn(),
  saveLastSeenVersion: vi.fn(),
}));

// What scripts/build-release-data.mjs makes of scripts/fixtures/CHANGELOG.release-please.md.
const releases: Release[] = [
  {
    version: "0.2.0",
    date: "2026-10-23",
    entries: [
      { type: "feature", text: "Import rides from your export file" },
      { type: "fix", text: "Sign-in keeps you signed in for 30 days on iOS" },
      { type: "technical", text: "Database checks run on every pull request" },
    ],
  },
  {
    version: "0.1.0",
    date: "2026-10-17",
    entries: [{ type: "feature", text: "Sign in and reset your password" }],
  },
];

const session = fakeSession();

function renderPage(props: Partial<Parameters<typeof WhatsNewPage>[0]> = {}) {
  return renderWithProviders(
    <WhatsNewPage releases={releases} currentVersion="0.2.0" {...props} />,
    {
      path: "/settings/whats-new",
      auth: fakeAuth({ status: "signedIn", session }),
    },
  );
}

describe("What's new (G2)", () => {
  beforeEach(() => {
    vi.mocked(fetchLastSeenVersion).mockResolvedValue("0.2.0");
    vi.mocked(saveLastSeenVersion).mockResolvedValue(undefined);
  });

  it("lists every release, newest first, with labelled changes", () => {
    renderPage();
    const headings = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);
    expect(headings).toEqual(["v0.2.0", "v0.1.0"]);
    expect(screen.getByText("23 Oct 2026")).toBeInTheDocument();

    const latest = screen.getByRole("region", { name: "v0.2.0" });
    const rows = within(latest)
      .getAllByRole("listitem")
      .map((li) => li.textContent);
    expect(rows).toEqual([
      "FeatureImport rides from your export file",
      "FixSign-in keeps you signed in for 30 days on iOS",
      "TechnicalDatabase checks run on every pull request",
    ]);
  });

  it("shows an empty state before the first release", () => {
    renderPage({ releases: [] });
    expect(screen.getByText("No releases yet.")).toBeInTheDocument();
  });

  it("marks the unseen version New and stores it as seen", async () => {
    vi.mocked(fetchLastSeenVersion).mockResolvedValue("0.1.0");
    renderPage();
    const latest = screen.getByRole("region", { name: "v0.2.0" });
    expect(await within(latest).findByText("New")).toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: "v0.1.0" })).queryByText("New")).toBeNull();
    await waitFor(() => {
      expect(saveLastSeenVersion).toHaveBeenCalledWith(session.user.id, "0.2.0");
    });
    // The mark stays while the page is open.
    expect(within(latest).getByText("New")).toBeInTheDocument();
  });

  it("marks nothing New when everything was seen", async () => {
    renderPage();
    await waitFor(() => {
      expect(fetchLastSeenVersion).toHaveBeenCalled();
    });
    expect(screen.queryByText("New")).not.toBeInTheDocument();
    expect(saveLastSeenVersion).not.toHaveBeenCalled();
  });
});

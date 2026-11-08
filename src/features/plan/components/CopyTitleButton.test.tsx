import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/render";
import { CopyTitleButton } from "./CopyTitleButton";

const TEXT = "Z2 · Endurance (Easy, 135 min)";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("CopyTitleButton", () => {
  it("copies the title and confirms it in a status card", async () => {
    // user-event gives the page its own clipboard; what was copied can be read back from it.
    const user = userEvent.setup();
    renderWithProviders(<CopyTitleButton text={TEXT} />);

    await user.click(screen.getByRole("button", { name: `Copy title: ${TEXT}` }));

    expect(await navigator.clipboard.readText()).toBe(TEXT);
    expect(await screen.findByRole("status")).toHaveTextContent("Title copied");
    expect(screen.getByRole("status")).toHaveTextContent(TEXT);
  });

  it("says so in an alert when copying is blocked", async () => {
    const user = userEvent.setup();
    vi.spyOn(navigator.clipboard, "writeText").mockRejectedValue(new Error("blocked"));
    Object.defineProperty(document, "execCommand", {
      value: vi.fn(() => false),
      configurable: true,
    });
    renderWithProviders(<CopyTitleButton text={TEXT} />);

    await user.click(screen.getByRole("button", { name: `Copy title: ${TEXT}` }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Could not copy");
  });
});

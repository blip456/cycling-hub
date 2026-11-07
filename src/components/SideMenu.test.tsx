import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";
import { SideMenu } from "./SideMenu";

function renderMenu(status?: string) {
  return render(
    <MemoryRouter>
      <SideMenu status={status ? <p>{status}</p> : undefined} />
    </MemoryRouter>,
  );
}

describe("SideMenu build info", () => {
  it("shows the version and the short commit id of the build at the bottom", () => {
    renderMenu();
    expect(screen.getByText(`Version ${__APP_VERSION__}`)).toBeInTheDocument();
    expect(screen.getByText(`Build ${__BUILD_ID__}`)).toBeInTheDocument();
  });

  it("has a build id that is a short commit id, or local when git is not available", () => {
    expect(__BUILD_ID__).toMatch(/^([0-9a-f]{7}|local)$/);
  });

  it("keeps the build id below the status card", () => {
    renderMenu("Some status");
    const status = screen.getByText("Some status");
    const build = screen.getByText(`Build ${__BUILD_ID__}`);
    expect(status.compareDocumentPosition(build) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

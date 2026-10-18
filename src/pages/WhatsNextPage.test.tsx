import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { roadmap, type RoadmapItem } from "@/features/release/data";
import { WhatsNextPage } from "./WhatsNextPage";

const items: RoadmapItem[] = [
  {
    version: "0.3.0",
    title: "Rides",
    sprint: 2,
    status: "in progress",
    tagline: "All your rides by week or month, with the details of every ride.",
  },
  {
    version: "0.4.0",
    title: "Baseline and zones",
    sprint: 3,
    status: "planned",
    tagline: "Test your FTP and get power and heart rate zones.",
  },
];

describe("What's next (G3)", () => {
  it("shows only version, title, sprint, status and tagline", () => {
    render(<WhatsNextPage items={items} />);
    const card = screen.getByRole("region", { name: "Rides" });
    expect(within(card).getByText("In progress")).toBeInTheDocument();
    expect(within(card).getByText("v0.3.0 · Sprint 2")).toBeInTheDocument();
    expect(card).toHaveTextContent(
      "RidesIn progressv0.3.0 · Sprint 2All your rides by week or month, with the details of every ride.",
    );
    expect(
      within(screen.getByRole("region", { name: "Baseline and zones" })).getByText("Planned"),
    ).toBeInTheDocument();
  });

  it("renders the build-time roadmap from docs/backlog.md without shipped sprints", () => {
    render(<WhatsNextPage />);
    expect(roadmap.length).toBeGreaterThan(0);
    expect(roadmap.every((item) => item.status !== "shipped")).toBe(true);
    expect(screen.getAllByRole("region")).toHaveLength(roadmap.length);
  });

  it("shows an empty state when nothing is planned", () => {
    render(<WhatsNextPage items={[]} />);
    expect(screen.getByText("Nothing planned yet.")).toBeInTheDocument();
  });
});

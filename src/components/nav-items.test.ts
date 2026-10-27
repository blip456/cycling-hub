import { describe, expect, it } from "vitest";
import { subPageForPath, titleForPath } from "./nav-items";

describe("sub-pages", () => {
  it("treats a ride detail as a sub-page of Rides (Back on the phone)", () => {
    expect(subPageForPath("/rides/6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b")).toMatchObject({
      label: "Ride",
      parent: "/rides",
    });
    expect(titleForPath("/rides/abc")).toBe("Ride");
  });

  it("keeps Rides itself a top-level page", () => {
    expect(subPageForPath("/rides")).toBeUndefined();
    expect(subPageForPath("/rides/")).toBeUndefined();
    expect(titleForPath("/rides")).toBe("Rides");
  });

  it("still matches the other sub-pages and their detail pages", () => {
    expect(subPageForPath("/import/history")?.parent).toBe("/import");
    expect(subPageForPath("/import/history/123")?.parent).toBe("/import");
    expect(subPageForPath("/import/historyx")).toBeUndefined();
    expect(subPageForPath("/settings/whats-new")?.parent).toBe("/settings");
    expect(subPageForPath("/settings")).toBeUndefined();
  });
});

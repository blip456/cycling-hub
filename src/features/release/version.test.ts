import { describe, expect, it } from "vitest";
import { compareVersions, formatReleaseDate, isNewerThanSeen } from "./version";

describe("version helpers", () => {
  it.each([
    ["0.2.0", "0.1.0", 1],
    ["0.1.0", "0.2.0", -1],
    ["0.10.0", "0.9.9", 1],
    ["v1.0.0", "1.0.0", 0],
    ["0.2.0", "nonsense", null],
  ])("compares %s with %s", (a, b, expected) => {
    expect(compareVersions(a, b)).toBe(expected);
  });

  it("treats an unreadable stored version as older", () => {
    expect(isNewerThanSeen("0.2.0", "")).toBe(true);
    expect(isNewerThanSeen("0.2.0", "0.2.0")).toBe(false);
    expect(isNewerThanSeen("0.1.0", "0.2.0")).toBe(false);
  });

  it("formats release dates like 23 Oct 2026", () => {
    expect(formatReleaseDate("2026-10-23")).toBe("23 Oct 2026");
  });
});

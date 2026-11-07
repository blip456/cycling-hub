import { describe, expect, it } from "vitest";
import { formatDateTime, formatLocalDate } from "./format";

describe("import dates (DESIGN.md: Sun 11 Oct · 08:30, 24 h, Europe/Brussels)", () => {
  const now = new Date("2026-11-07T12:00:00Z");

  it("writes weekday, day, month and 24 h time in Brussels time", () => {
    // 19:05 UTC on 14 Oct is 21:05 in Brussels (summer time).
    expect(formatDateTime("2026-10-14T19:05:00Z", now)).toBe("Wed 14 Oct · 21:05");
  });

  it("adds the year only when it is not the current one", () => {
    // 23:30 UTC on 31 Dec 2025 is already 1 Jan 2026 in Brussels.
    expect(formatDateTime("2025-12-31T23:30:00Z", now)).toBe("Thu 1 Jan · 00:30");
    expect(formatDateTime("2025-06-01T08:00:00Z", now)).toBe("Sun 1 Jun 2025 · 10:00");
  });

  it("writes September with three letters", () => {
    expect(formatDateTime("2026-09-09T08:00:00Z", now)).toBe("Wed 9 Sep · 10:00");
    expect(formatLocalDate("2019-09-03T10:00:00")).toBe("3 Sep 2019");
  });
});

import { describe, expect, it } from "vitest";
import { isSessionExpired, MAX_SESSION_AGE_DAYS } from "./session-age";

const now = new Date("2026-10-16T12:00:00Z");
const daysAgo = (days: number) => new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();

describe("isSessionExpired", () => {
  it("uses 30 days by default", () => {
    expect(MAX_SESSION_AGE_DAYS).toBe(30);
  });

  it("keeps a fresh sign-in", () => {
    expect(isSessionExpired(daysAgo(0), now)).toBe(false);
    expect(isSessionExpired(daysAgo(29), now)).toBe(false);
  });

  it("keeps a sign-in of exactly 30 days", () => {
    expect(isSessionExpired(daysAgo(30), now)).toBe(false);
  });

  it("expires a sign-in older than 30 days", () => {
    expect(isSessionExpired(new Date(new Date(daysAgo(30)).getTime() - 1000), now)).toBe(true);
    expect(isSessionExpired(daysAgo(45), now)).toBe(true);
  });

  it("treats a missing or unreadable value as expired", () => {
    expect(isSessionExpired(undefined, now)).toBe(true);
    expect(isSessionExpired(null, now)).toBe(true);
    expect(isSessionExpired("", now)).toBe(true);
    expect(isSessionExpired("not a date", now)).toBe(true);
  });

  it("accepts a sign-in slightly in the future (clock skew)", () => {
    expect(isSessionExpired(daysAgo(-1), now)).toBe(false);
  });

  it("accepts a custom maximum age", () => {
    expect(isSessionExpired(daysAgo(8), now, 7)).toBe(true);
    expect(isSessionExpired(daysAgo(6), now, 7)).toBe(false);
  });
});

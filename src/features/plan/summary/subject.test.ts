import { beforeEach, describe, expect, it } from "vitest";
import {
  DEFAULT_SUMMARY_OPTIONS,
  ICS_STORAGE_KEY,
  loadIcsDownload,
  loadSummaryOptions,
  saveIcsDownload,
  saveSummaryOptions,
  SUMMARY_STORAGE_KEY,
} from "./storage";
import { paramsFor, stepSubject, subjectFromParams, switchKind } from "./subject";

const TODAY = "2026-10-28";
const SESSIONS = [
  { id: "b", session_date: "2026-10-29" },
  { id: "a", session_date: "2026-10-27" },
  { id: "c", session_date: "2026-11-03" },
];

describe("the summary address", () => {
  it("is this week without parameters", () => {
    expect(subjectFromParams(new URLSearchParams(), TODAY)).toEqual({ kind: "week", date: TODAY });
  });

  it("reads session, week and month parameters", () => {
    expect(subjectFromParams(new URLSearchParams("type=session&id=abc"), TODAY)).toEqual({
      kind: "session",
      id: "abc",
    });
    expect(subjectFromParams(new URLSearchParams("type=week&date=2026-10-14"), TODAY)).toEqual({
      kind: "week",
      date: "2026-10-14",
    });
    expect(subjectFromParams(new URLSearchParams("type=month&date=2026-09-15"), TODAY)).toEqual({
      kind: "month",
      year: 2026,
      month: 9,
    });
    expect(subjectFromParams(new URLSearchParams("type=month&date=2026-09"), TODAY)).toEqual({
      kind: "month",
      year: 2026,
      month: 9,
    });
  });

  it("falls back to today for unreadable values", () => {
    expect(subjectFromParams(new URLSearchParams("type=week&date=nope"), TODAY)).toEqual({
      kind: "week",
      date: TODAY,
    });
    expect(subjectFromParams(new URLSearchParams("type=month&date=2026-13-01"), TODAY)).toEqual({
      kind: "month",
      year: 2026,
      month: 10,
    });
    expect(subjectFromParams(new URLSearchParams("type=other"), TODAY).kind).toBe("week");
    expect(subjectFromParams(new URLSearchParams("type=session"), TODAY)).toEqual({
      kind: "session",
      id: "",
    });
  });

  it("round-trips through the parameters", () => {
    for (const subject of [
      { kind: "session", id: "x1" },
      { kind: "week", date: "2026-10-26" },
      { kind: "month", year: 2026, month: 2 },
    ] as const) {
      expect(subjectFromParams(paramsFor(subject), TODAY)).toEqual(subject);
    }
  });
});

describe("moving between summaries", () => {
  it("steps through sessions in date order and stops at the ends", () => {
    expect(stepSubject({ kind: "session", id: "b" }, -1, SESSIONS)).toEqual({
      kind: "session",
      id: "a",
    });
    expect(stepSubject({ kind: "session", id: "b" }, 1, SESSIONS)).toEqual({
      kind: "session",
      id: "c",
    });
    expect(stepSubject({ kind: "session", id: "a" }, -1, SESSIONS)).toBeNull();
    expect(stepSubject({ kind: "session", id: "c" }, 1, SESSIONS)).toBeNull();
    expect(stepSubject({ kind: "session", id: "gone" }, 1, SESSIONS)).toBeNull();
  });

  it("steps by week to the Monday and by month across the year end", () => {
    expect(stepSubject({ kind: "week", date: "2026-10-28" }, 1, [])).toEqual({
      kind: "week",
      date: "2026-11-02",
    });
    expect(stepSubject({ kind: "week", date: "2026-10-28" }, -1, [])).toEqual({
      kind: "week",
      date: "2026-10-19",
    });
    expect(stepSubject({ kind: "month", year: 2026, month: 12 }, 1, [])).toEqual({
      kind: "month",
      year: 2027,
      month: 1,
    });
    expect(stepSubject({ kind: "month", year: 2026, month: 1 }, -1, [])).toEqual({
      kind: "month",
      year: 2025,
      month: 12,
    });
  });

  it("keeps the moment when the kind changes", () => {
    expect(switchKind({ kind: "week", date: "2026-10-28" }, "session", TODAY, SESSIONS)).toEqual({
      kind: "session",
      id: "b",
    });
    expect(switchKind({ kind: "session", id: "c" }, "week", TODAY, SESSIONS)).toEqual({
      kind: "week",
      date: "2026-11-03",
    });
    expect(switchKind({ kind: "session", id: "c" }, "month", TODAY, SESSIONS)).toEqual({
      kind: "month",
      year: 2026,
      month: 11,
    });
    expect(switchKind({ kind: "month", year: 2026, month: 10 }, "week", TODAY, SESSIONS)).toEqual({
      kind: "week",
      date: TODAY,
    });
    expect(switchKind({ kind: "month", year: 2026, month: 9 }, "week", TODAY, SESSIONS)).toEqual({
      kind: "week",
      date: "2026-09-01",
    });
    expect(switchKind({ kind: "week", date: TODAY }, "week", TODAY, SESSIONS)).toEqual({
      kind: "week",
      date: TODAY,
    });
  });

  it("has no session to switch to without a plan", () => {
    expect(switchKind({ kind: "week", date: TODAY }, "session", TODAY, [])).toEqual({
      kind: "session",
      id: "",
    });
  });
});

describe("remembered choices", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("gives the defaults when nothing is stored or the storage is garbage", () => {
    expect(loadSummaryOptions("week")).toEqual(DEFAULT_SUMMARY_OPTIONS);
    window.localStorage.setItem(SUMMARY_STORAGE_KEY, "{not json");
    expect(loadSummaryOptions("week")).toEqual(DEFAULT_SUMMARY_OPTIONS);
    window.localStorage.setItem(
      SUMMARY_STORAGE_KEY,
      JSON.stringify({ week: { includeWeight: "yes", prompt: 5 } }),
    );
    expect(loadSummaryOptions("week")).toEqual(DEFAULT_SUMMARY_OPTIONS);
  });

  it("remembers the options per kind", () => {
    saveSummaryOptions("week", {
      includeWeight: false,
      includeGoals: true,
      includePrompt: false,
      prompt: "Mine",
    });
    saveSummaryOptions("month", { ...DEFAULT_SUMMARY_OPTIONS, includeGoals: false });
    expect(loadSummaryOptions("week")).toEqual({
      includeWeight: false,
      includeGoals: true,
      includePrompt: false,
      prompt: "Mine",
    });
    expect(loadSummaryOptions("month").includeGoals).toBe(false);
    expect(loadSummaryOptions("session")).toEqual(DEFAULT_SUMMARY_OPTIONS);
  });

  it("remembers the calendar download and ignores a broken record", () => {
    expect(loadIcsDownload()).toBeNull();
    const record = {
      fingerprint: "ics1-abc",
      scope: "all",
      timing: { mode: "timed", startTime: "07:30" },
      includeSteps: false,
      downloadedAt: "2026-10-28T10:00:00.000Z",
    } as const;
    saveIcsDownload(record);
    expect(loadIcsDownload()).toEqual(record);
    window.localStorage.setItem(ICS_STORAGE_KEY, JSON.stringify({ ...record, scope: "weird" }));
    expect(loadIcsDownload()).toBeNull();
    window.localStorage.setItem(ICS_STORAGE_KEY, "nope");
    expect(loadIcsDownload()).toBeNull();
  });
});

import { describe, expect, it } from "vitest";
import {
  DEFAULT_STATE,
  hasFilters,
  nextSort,
  parseListState,
  writeListState,
  type ListState,
} from "./list-state";

describe("list state in the URL", () => {
  it("reads defaults from an empty query and writes nothing for them", () => {
    const state = parseListState(new URLSearchParams());
    expect(state).toEqual(DEFAULT_STATE);
    expect(writeListState(state).toString()).toBe("");
  });

  it("round-trips every setting", () => {
    const state: ListState = {
      view: "month",
      hideCommutes: true,
      q: "kluis",
      type: "mtb",
      period: "custom",
      from: "2026-01-01",
      to: "2026-03-31",
      sort: "power",
      dir: "asc",
    };
    const query = writeListState(state).toString();
    expect(query).toBe(
      "view=month&commutes=hide&q=kluis&type=mtb&period=custom&from=2026-01-01&to=2026-03-31&sort=power&dir=asc",
    );
    expect(parseListState(new URLSearchParams(query))).toEqual(state);
  });

  it("falls back to defaults for unknown or broken values", () => {
    const state = parseListState(
      new URLSearchParams("view=day&type=boat&period=soon&sort=colour&dir=up&from=x"),
    );
    expect(state).toEqual(DEFAULT_STATE);
  });

  it("ignores from and to unless the period is a custom range", () => {
    const state = parseListState(new URLSearchParams("period=2025&from=2025-01-01"));
    expect(state.period).toBe("2025");
    expect(state.from).toBe("");
  });

  it("uses the column's own first direction when dir is missing", () => {
    expect(parseListState(new URLSearchParams("sort=name")).dir).toBe("asc");
    expect(parseListState(new URLSearchParams("sort=distance")).dir).toBe("desc");
    expect(writeListState({ ...DEFAULT_STATE, sort: "name", dir: "asc" }).toString()).toBe(
      "sort=name",
    );
  });
});

describe("nextSort", () => {
  it("starts numbers highest first, names A to Z, and reverses on a second click", () => {
    expect(nextSort({ sort: "date", dir: "desc" }, "distance")).toEqual({
      sort: "distance",
      dir: "desc",
    });
    expect(nextSort({ sort: "date", dir: "desc" }, "name")).toEqual({ sort: "name", dir: "asc" });
    expect(nextSort({ sort: "name", dir: "asc" }, "name")).toEqual({ sort: "name", dir: "desc" });
    expect(nextSort({ sort: "date", dir: "desc" }, "date")).toEqual({ sort: "date", dir: "asc" });
  });
});

describe("hasFilters", () => {
  it("is on for search, type, period and hide commutes, not for sort or view", () => {
    expect(hasFilters(DEFAULT_STATE)).toBe(false);
    expect(hasFilters({ ...DEFAULT_STATE, sort: "name", view: "month" })).toBe(false);
    expect(hasFilters({ ...DEFAULT_STATE, q: "  " })).toBe(false);
    expect(hasFilters({ ...DEFAULT_STATE, q: "loop" })).toBe(true);
    expect(hasFilters({ ...DEFAULT_STATE, type: "road" })).toBe(true);
    expect(hasFilters({ ...DEFAULT_STATE, period: "3m" })).toBe(true);
    expect(hasFilters({ ...DEFAULT_STATE, hideCommutes: true })).toBe(true);
  });
});

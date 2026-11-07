import { describe, expect, it } from "vitest";
import { matchRides } from "./match";
import { markStatuses } from "./status";
import { ride, session } from "./test-helpers";

// 2026-12-02 is a Wednesday.
const TODAY = "2026-12-02";

function pairs(result: ReturnType<typeof matchRides>): string[] {
  return result.matches.map((m) => `${m.sessionDate}:${m.rideId}`);
}

describe("matchRides: candidates", () => {
  it("links a ride on the same day", () => {
    const s = session("2026-12-02", "endurance", 60);
    const r = ride("2026-12-02", 60);
    const result = matchRides([s], [r], TODAY);
    expect(result.matches).toHaveLength(1);
    expect(result.matches[0]).toMatchObject({
      sessionId: s.id,
      rideId: r.id,
      by: "automatic",
      flags: [],
      shortByMinutes: null,
      doneEarly: false,
    });
    expect(result.extraRides).toEqual([]);
  });

  it("links a ride one day before or after, not two days away", () => {
    const s = session("2026-12-02", "endurance", 60);
    expect(matchRides([s], [ride("2026-12-01", 60)], TODAY).matches).toHaveLength(1);
    expect(matchRides([s], [ride("2026-12-03", 60)], "2026-12-03").matches).toHaveLength(1);
    const far = matchRides([s], [ride("2026-11-30", 60)], TODAY);
    expect(far.matches).toEqual([]);
    expect(far.extraRides).toHaveLength(1);
  });

  it("marks a ride the day before as done early", () => {
    const s = session("2026-12-02", "endurance", 60);
    expect(matchRides([s], [ride("2026-12-01", 60)], TODAY).matches[0]?.doneEarly).toBe(true);
  });

  it("ignores commutes and rides under 20 minutes", () => {
    const s = session("2026-12-02", "endurance", 30);
    const commute = ride("2026-12-02", 40, { commute: true });
    const tiny = ride("2026-12-02", 19);
    const result = matchRides([s], [commute, tiny], TODAY);
    expect(result.matches).toEqual([]);
    expect(result.extraRides).toEqual([]);
  });

  it("never matches a skipped session", () => {
    const s = session("2026-12-02", "endurance", 60, { status: "skipped" });
    const result = matchRides([s], [ride("2026-12-02", 60)], TODAY);
    expect(result.matches).toEqual([]);
    expect(result.extraRides).toHaveLength(1);
  });

  it("matches sessions from 3 days ago to tomorrow, not older or later ones", () => {
    const old = session("2026-11-28", "endurance", 60);
    const inside = session("2026-11-29", "recovery", 60, { id: "in" });
    const late = session("2026-12-04", "endurance", 60);
    const rides = [ride("2026-11-28", 60), ride("2026-11-29", 60), ride("2026-12-03", 60)];
    const result = matchRides([old, inside, late], rides, TODAY);
    // 28 Nov is 4 days ago (outside), 4 Dec is 2 days ahead (outside).
    expect(result.matches.map((m) => m.sessionDate)).toEqual(["2026-11-29"]);
  });
});

describe("matchRides: duration fit and short flag", () => {
  const fit = (
    kind: "endurance" | "recovery" | "sweet-spot" | "long" | "openers" | "test",
    planned: number,
    ridden: number,
  ) =>
    matchRides([session("2026-12-02", kind, planned)], [ride("2026-12-02", ridden)], TODAY).matches;

  it("easy rides fit 0.60 to 1.50", () => {
    expect(fit("endurance", 100, 59)).toHaveLength(0);
    expect(fit("endurance", 100, 60)).toHaveLength(1);
    expect(fit("recovery", 100, 150)).toHaveLength(1);
    expect(fit("recovery", 100, 151)).toHaveLength(0);
  });

  it("structured sessions, openers and tests fit 0.70 to 1.30", () => {
    for (const kind of ["sweet-spot", "openers", "test"] as const) {
      expect(fit(kind, 100, 69)).toHaveLength(0);
      expect(fit(kind, 100, 70)).toHaveLength(1);
      expect(fit(kind, 100, 130)).toHaveLength(1);
      expect(fit(kind, 100, 131)).toHaveLength(0);
    }
  });

  it("a long ride fits from 0.75 up", () => {
    expect(fit("long", 200, 149)).toHaveLength(0);
    expect(fit("long", 200, 150)).toHaveLength(1);
    expect(fit("long", 200, 400)).toHaveLength(1);
  });

  it("flags short below 0.85 with the minutes short", () => {
    const [short] = fit("endurance", 100, 80);
    expect(short?.flags).toContain("short");
    expect(short?.shortByMinutes).toBe(20);
    expect(short?.info).toEqual({ by: "automatic", flags: ["short"], shortByMinutes: 20 });
    expect(fit("endurance", 100, 85)[0]?.flags).toEqual([]);
  });
});

describe("matchRides: intensity", () => {
  const planned = session("2026-12-02", "endurance", 60, { percent: 70 });

  it("flags easier and harder but never blocks", () => {
    // FTP 200, planned 70 % = 140 W. 100 W is 0.71 of it, 200 W is 1.43.
    const easy = matchRides([planned], [ride("2026-12-02", 60, { avgPowerW: 100 })], TODAY, {
      ftp: 200,
    });
    expect(easy.matches[0]?.flags).toEqual(["easier"]);
    const hard = matchRides([planned], [ride("2026-12-02", 60, { avgPowerW: 200 })], TODAY, {
      ftp: 200,
    });
    expect(hard.matches[0]?.flags).toEqual(["harder"]);
    const fine = matchRides([planned], [ride("2026-12-02", 60, { avgPowerW: 140 })], TODAY, {
      ftp: 200,
    });
    expect(fine.matches[0]?.flags).toEqual([]);
  });

  it("gives no intensity flag without power or without an FTP", () => {
    expect(
      matchRides([planned], [ride("2026-12-02", 60, { avgPowerW: null })], TODAY, { ftp: 200 })
        .matches[0]?.flags,
    ).toEqual([]);
    expect(
      matchRides([planned], [ride("2026-12-02", 60, { avgPowerW: 300 })], TODAY).matches[0]?.flags,
    ).toEqual([]);
  });

  it("breaks a tie between two equal rides by intensity", () => {
    const a = ride("2026-12-02", 60, { id: "a", avgPowerW: 80 });
    const b = ride("2026-12-02", 60, { id: "b", avgPowerW: 138 });
    const result = matchRides([planned], [a, b], TODAY, { ftp: 200 });
    expect(pairs(result)).toEqual(["2026-12-02:b"]);
    expect(result.extraRides.map((r) => r.id)).toEqual(["a"]);
  });
});

describe("matchRides: one ride, one session", () => {
  it("uses a ride once: the better fit wins, the other session stays open", () => {
    const monday = session("2026-12-01", "endurance", 90, { id: "tue" });
    const wednesday = session("2026-12-02", "endurance", 60, { id: "wed" });
    const r = ride("2026-12-01", 60, { id: "only" });
    const result = matchRides([monday, wednesday], [r], TODAY);
    // Same day as `tue` (penalty 0 + distance 20 * 0.33) against `wed` one day away (10 + 0).
    expect(result.matches).toHaveLength(1);
    expect(result.matches[0]?.sessionId).toBe("tue");
  });

  it("ties go to the earlier session", () => {
    const first = session("2026-12-01", "endurance", 60, { id: "first" });
    const second = session("2026-12-03", "endurance", 60, { id: "second" });
    const r = ride("2026-12-02", 60);
    expect(matchRides([second, first], [r], "2026-12-03").matches[0]?.sessionId).toBe("first");
  });

  it("two rides in one day: each takes its own best session, a third stays extra", () => {
    const am = session("2026-12-02", "endurance", 60, { id: "s1" });
    const pm = session("2026-12-01", "endurance", 120, { id: "s2" });
    const rides = [
      ride("2026-12-02", 60, { id: "r60" }),
      ride("2026-12-02", 120, { id: "r120" }),
      ride("2026-12-02", 45, { id: "r45" }),
    ];
    const result = matchRides([am, pm], rides, TODAY);
    expect(pairs(result).sort()).toEqual(["2026-12-01:r120", "2026-12-02:r60"]);
    expect(result.extraRides.map((r) => r.id)).toEqual(["r45"]);
  });

  it("is the same for any order of the input", () => {
    const sessions = [
      session("2026-11-30", "endurance", 60),
      session("2026-12-01", "sweet-spot", 75),
      session("2026-12-02", "endurance", 60),
      session("2026-12-03", "long", 120),
    ];
    const rides = [
      ride("2026-11-30", 55, { id: "a" }),
      ride("2026-12-01", 70, { id: "b" }),
      ride("2026-12-02", 62, { id: "c" }),
      ride("2026-12-02", 100, { id: "d" }),
    ];
    const expected = matchRides(sessions, rides, "2026-12-02");
    expect(matchRides([...sessions].reverse(), [...rides].reverse(), "2026-12-02")).toEqual(
      expected,
    );
  });
});

describe("matchRides: manual links are locked", () => {
  it("keeps a manual link, offers its ride to nobody else, and reports it as manual", () => {
    const linked = session("2026-12-02", "endurance", 60, {
      id: "linked",
      activityId: "r-manual",
      matchSource: "manual",
      status: "done",
    });
    const other = session("2026-12-03", "endurance", 60, { id: "other" });
    const manualRide = ride("2026-12-03", 60, { id: "r-manual" });
    const result = matchRides([linked, other], [manualRide], "2026-12-03");
    expect(result.matches).toHaveLength(1);
    expect(result.matches[0]).toMatchObject({ sessionId: "linked", by: "manual" });
    expect(result.matches[0]?.info.by).toBe("manual");
  });

  it("keeps a manual link to a ride that automatic matching would ignore", () => {
    const linked = session("2026-12-02", "endurance", 30, {
      id: "linked",
      activityId: "tiny",
      matchSource: "manual",
      status: "done",
    });
    const result = matchRides([linked], [ride("2026-12-02", 12, { id: "tiny" })], TODAY);
    expect(result.matches).toHaveLength(1);
    expect(result.extraRides).toEqual([]);
  });

  it("a manual unlink stays unlinked even when a perfect ride exists", () => {
    const unlinked = session("2026-12-02", "endurance", 60, {
      id: "unlinked",
      matchSource: "manual",
      activityId: null,
    });
    const result = matchRides([unlinked], [ride("2026-12-02", 60)], TODAY);
    expect(result.matches).toEqual([]);
    expect(result.extraRides).toHaveLength(1);
  });

  it("an automatic link outside the window is kept, inside the window it is matched again", () => {
    const old = session("2026-11-20", "endurance", 60, {
      id: "old",
      activityId: "r-old",
      matchSource: "auto",
      status: "done",
    });
    const recent = session("2026-12-01", "endurance", 60, {
      id: "recent",
      activityId: "r-gone",
      matchSource: "auto",
      status: "done",
    });
    const result = matchRides(
      [old, recent],
      [ride("2026-11-20", 60, { id: "r-old" }), ride("2026-12-01", 60, { id: "r-new" })],
      TODAY,
    );
    expect(pairs(result).sort()).toEqual(["2026-11-20:r-old", "2026-12-01:r-new"]);
  });
});

describe("matchRides: long ride substitution", () => {
  const sunday = session("2026-12-06", "long", 100, { id: "long" });

  it("counts a long enough ride earlier in the week as the long ride, done early", () => {
    const thursday = ride("2026-12-03", 150, { id: "thu" });
    const result = matchRides([sunday], [thursday], "2026-12-04");
    expect(result.matches).toHaveLength(1);
    expect(result.matches[0]).toMatchObject({ sessionId: "long", rideId: "thu", doneEarly: true });
  });

  it("needs 0.75 of the long ride and a free long ride this week", () => {
    expect(matchRides([sunday], [ride("2026-12-03", 74)], "2026-12-04").matches).toEqual([]);
    expect(matchRides([sunday], [ride("2026-12-03", 75)], "2026-12-04").matches).toHaveLength(1);
    const done = session("2026-12-06", "long", 100, {
      status: "done",
      activityId: "x",
      matchSource: "manual",
    });
    const second = session("2026-12-07", "long", 100, { id: "next-week" });
    expect(
      matchRides([done, second], [ride("2026-12-03", 150)], "2026-12-04").matches.map(
        (m) => m.sessionId,
      ),
    ).not.toContain("next-week");
  });

  it("does not take a long ride of another week or a session that is not planned", () => {
    expect(matchRides([sunday], [ride("2026-11-28", 150)], "2026-11-29").matches).toEqual([]);
    const missed = session("2026-12-06", "long", 100, { status: "missed" });
    expect(matchRides([missed], [ride("2026-12-03", 150)], "2026-12-04").matches).toEqual([]);
  });
});

describe("markStatuses", () => {
  it("marks a matched session done and an unmatched past one missed (R5-PO1)", () => {
    const yesterday = session("2026-12-01", "endurance", 60, { id: "y" });
    const day = session("2026-12-02", "endurance", 60, { id: "d" });
    const tomorrow = session("2026-12-03", "endurance", 60, { id: "t" });
    const rides = [ride("2026-12-02", 60, { id: "r" })];
    const { matches } = matchRides([yesterday, day, tomorrow], rides, TODAY);
    const updates = markStatuses([yesterday, day, tomorrow], matches, TODAY);
    // 2 Dec's ride also fits yesterday's session (one day apart) or today's; one of them gets it.
    const byId = Object.fromEntries(updates.map((u) => [u.id, u.status]));
    expect(Object.values(byId).filter((s) => s === "done")).toHaveLength(1);
    expect(updates.find((u) => u.id === "t")).toBeUndefined();
  });

  it("is missed only once the day is over: today stays planned", () => {
    const today = session("2026-12-02", "endurance", 60, { id: "today" });
    const yesterday = session("2026-12-01", "endurance", 60, { id: "yesterday" });
    const updates = markStatuses([today, yesterday], [], TODAY);
    expect(updates).toEqual([
      { id: "yesterday", status: "missed", activityId: null, matchSource: null },
    ]);
  });

  it("a late import turns missed back to done, with the link", () => {
    const missed = session("2026-11-30", "endurance", 60, { id: "m", status: "missed" });
    const late = ride("2026-11-30", 60, { id: "late" });
    const { matches } = matchRides([missed], [late], TODAY);
    expect(markStatuses([missed], matches, TODAY)).toEqual([
      { id: "m", status: "done", activityId: "late", matchSource: "auto" },
    ]);
  });

  it("never changes skipped, a manual done without a ride, or an old done session", () => {
    const skipped = session("2026-11-25", "endurance", 60, { id: "sk", status: "skipped" });
    const byHand = session("2026-12-01", "endurance", 60, {
      id: "hand",
      status: "done",
      matchSource: "manual",
    });
    const old = session("2026-11-20", "endurance", 60, {
      id: "old",
      status: "done",
      activityId: "gone",
      matchSource: "auto",
    });
    expect(markStatuses([skipped, byHand, old], [], TODAY)).toEqual([]);
  });

  it("a manual unlink in the past is missed and stays manual", () => {
    const unlinked = session("2026-12-01", "endurance", 60, { id: "u", matchSource: "manual" });
    expect(markStatuses([unlinked], [], TODAY)).toEqual([
      { id: "u", status: "missed", activityId: null, matchSource: "manual" },
    ]);
  });
});

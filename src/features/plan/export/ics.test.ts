import { describe, expect, it } from "vitest";
import {
  buildIcs,
  countIcsEvents,
  escapeIcsText,
  foldIcsLine,
  ICS_FILENAME,
  icsFilename,
  icsFingerprint,
  isIcsOutOfDate,
  selectIcsSessions,
  type IcsOptions,
  type IcsSessionInput,
} from "./ics";
import { THRESHOLD_STEPS } from "./fixtures";

// A tiny ICS reader for the tests: unfolds, splits properties and unescapes text.

type Prop = { name: string; params: Record<string, string>; value: string };
type Component = { type: string; props: Prop[]; children: Component[] };

function unescapeText(value: string): string {
  return value.replace(/\\([nN,;\\])/g, (_m, c: string) => (c === "n" || c === "N" ? "\n" : c));
}

function parseProp(line: string): Prop {
  const colon = line.indexOf(":");
  const head = line.slice(0, colon);
  const [name = "", ...rest] = head.split(";");
  const params: Record<string, string> = {};
  for (const part of rest) {
    const eq = part.indexOf("=");
    params[part.slice(0, eq)] = part.slice(eq + 1);
  }
  return { name, params, value: line.slice(colon + 1) };
}

function parseIcs(text: string): Component {
  const lines = text
    .replace(/\r\n[ \t]/g, "")
    .split("\r\n")
    .filter((l) => l !== "");
  const root: Component = { type: "ROOT", props: [], children: [] };
  const stack: Component[] = [root];
  for (const line of lines) {
    const top = stack[stack.length - 1] as Component;
    if (line.startsWith("BEGIN:")) {
      const child: Component = { type: line.slice(6), props: [], children: [] };
      top.children.push(child);
      stack.push(child);
    } else if (line.startsWith("END:")) {
      expect(top.type).toBe(line.slice(4));
      stack.pop();
    } else {
      top.props.push(parseProp(line));
    }
  }
  expect(stack).toHaveLength(1);
  return root.children[0] as Component;
}

function events(text: string): Component[] {
  return parseIcs(text).children.filter((c) => c.type === "VEVENT");
}

function prop(component: Component, name: string): Prop | undefined {
  return component.props.find((p) => p.name === name);
}

function text(component: Component, name: string): string {
  return unescapeText(prop(component, name)?.value ?? "");
}

const NOW = new Date(Date.UTC(2026, 9, 28, 8, 30, 15));

function options(patch: Partial<IcsOptions> = {}): IcsOptions {
  return {
    now: NOW,
    scope: "todo",
    timing: { mode: "all-day" },
    includeSteps: true,
    event: null,
    ...patch,
  };
}

function s(
  patch: Partial<IcsSessionInput> & Pick<IcsSessionInput, "id" | "date">,
): IcsSessionInput {
  return { title: "Endurance", minutes: 60, status: "planned", steps: [], ...patch };
}

function octets(line: string): number {
  return new TextEncoder().encode(line).length;
}

describe("file structure", () => {
  const file = buildIcs(
    [
      s({
        id: "a",
        date: "2026-10-29",
        title: "Threshold 3 x 10 min",
        minutes: 75,
        steps: THRESHOLD_STEPS,
      }),
      s({ id: "b", date: "2026-10-31", title: "Long ride", minutes: 150 }),
    ],
    options({ event: { id: "plan-1", name: "Winter sportive", date: "2026-12-12" } }),
  );

  it("is a VCALENDAR with version, product id and CRLF endings only", () => {
    expect(file.startsWith("BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:")).toBe(true);
    expect(file.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(file.replace(/\r\n/g, "")).not.toMatch(/[\r\n]/);
  });
  it("has no physical line longer than 75 octets", () => {
    for (const line of file.split("\r\n")) expect(octets(line)).toBeLessThanOrEqual(75);
  });
  it("round-trips the events through the parser", () => {
    const parsed = events(file);
    expect(parsed.map((e) => text(e, "SUMMARY"))).toEqual([
      "Threshold 3 x 10 min",
      "Long ride",
      "Winter sportive",
    ]);
    expect(parsed.map((e) => prop(e, "DTSTART")?.value)).toEqual([
      "20261029",
      "20261031",
      "20261212",
    ]);
    expect(parsed.map((e) => prop(e, "DTEND")?.value)).toEqual([
      "20261030",
      "20261101",
      "20261213",
    ]);
    for (const e of parsed) {
      expect(prop(e, "DTSTART")?.params).toEqual({ VALUE: "DATE" });
      expect(prop(e, "DTSTAMP")?.value).toBe("20261028T083015Z");
      expect(prop(e, "TRANSP")?.value).toBe("TRANSPARENT");
    }
  });
  it("describes the session with steps and targets", () => {
    const first = events(file)[0] as Component;
    expect(text(first, "DESCRIPTION")).toBe(
      [
        "75 min planned.",
        "Steps:",
        "- 15 min Warm-up, 50 to 70 % FTP, 125 to 175 W, zone 1 to 2",
        "- 3 x 10 min Threshold, 95 to 105 % FTP, 238 to 263 W, zone 4, 156 to 168 bpm",
        "- 2 x 5 min Rest, 50 % FTP, 125 W, zone 1",
        "- 10 min Cool-down, 50 % FTP, 125 W, zone 1",
      ].join("\n"),
    );
  });
  it("leaves the steps out when switched off", () => {
    const plain = events(
      buildIcs(
        [s({ id: "a", date: "2026-10-29", minutes: 75, steps: THRESHOLD_STEPS })],
        options({ includeSteps: false }),
      ),
    )[0] as Component;
    expect(text(plain, "DESCRIPTION")).toBe("75 min planned.");
  });
  it("exports the event day without workout details", () => {
    const day = events(file)[2] as Component;
    expect(prop(day, "DESCRIPTION")).toBeUndefined();
    expect(prop(day, "UID")?.value).toBe("plan-event-plan-1@cycling-hub");
  });
  it("has no reminder", () => {
    expect(file).not.toContain("VALARM");
  });
  it("an empty export is still a valid calendar", () => {
    const empty = buildIcs([], options());
    expect(events(empty)).toEqual([]);
    expect(empty.endsWith("END:VCALENDAR\r\n")).toBe(true);
  });
});

describe("text escaping and line folding", () => {
  it("escapes backslash, semicolon, comma and line breaks", () => {
    expect(escapeIcsText("a\\b;c,d\ne\r\nf\rg")).toBe("a\\\\b\\;c\\,d\\ne\\nf\\ng");
  });
  it("drops control characters", () => {
    expect(escapeIcsText("a\u0000b\u0007c\u007Fd")).toBe("abcd");
  });
  it("round-trips awkward text through a file", () => {
    const title = "Sweet spot; 2 x 15, \\ hard\nsecond line";
    const e = events(
      buildIcs([s({ id: "x", date: "2026-10-29", title })], options()),
    )[0] as Component;
    expect(text(e, "SUMMARY")).toBe(title);
    expect(prop(e, "SUMMARY")?.value).not.toMatch(/[\r\n]/);
  });
  it("folds at 75 octets with CRLF and a space, and unfolds back to the same line", () => {
    const line = `SUMMARY:${"abcdefghij".repeat(20)}`;
    const folded = foldIcsLine(line);
    const physical = folded.split("\r\n");
    expect(physical.length).toBeGreaterThan(1);
    expect(octets(physical[0] as string)).toBe(75);
    for (const [index, piece] of physical.entries()) {
      expect(octets(piece)).toBeLessThanOrEqual(75);
      if (index > 0) expect(piece.startsWith(" ")).toBe(true);
    }
    expect(folded.replace(/\r\n /g, "")).toBe(line);
  });
  it("does not fold a short line", () => {
    expect(foldIcsLine("SUMMARY:Long ride")).toBe("SUMMARY:Long ride");
  });
  it("never splits a multi-byte character", () => {
    const title =
      "Zomerrit één — hele dag fietsen \u{1F6B4} door de Ardennen met vrienden en veel koffie";
    const file = buildIcs([s({ id: "m", date: "2026-10-29", title })], options());
    for (const line of file.split("\r\n")) {
      expect(octets(line)).toBeLessThanOrEqual(75);
      expect(line).not.toContain("�");
    }
    expect(text(events(file)[0] as Component, "SUMMARY")).toBe(title);
  });
  it("folds every long property (description with many steps)", () => {
    const file = buildIcs(
      [s({ id: "a", date: "2026-10-29", minutes: 75, steps: THRESHOLD_STEPS })],
      options(),
    );
    expect(file).toContain("\r\n ");
    for (const line of file.split("\r\n")) expect(octets(line)).toBeLessThanOrEqual(75);
  });
});

describe("UIDs and re-import", () => {
  it("derives a stable UID from the session id", () => {
    const first = events(buildIcs([s({ id: "abc-123", date: "2026-10-29" })], options()));
    const later = events(
      buildIcs(
        [s({ id: "abc-123", date: "2026-11-02", title: "Moved and renamed", minutes: 90 })],
        options({ now: new Date(Date.UTC(2026, 10, 3)) }),
      ),
    );
    expect(prop(first[0] as Component, "UID")?.value).toBe("plan-session-abc-123@cycling-hub");
    expect(prop(later[0] as Component, "UID")?.value).toBe(
      prop(first[0] as Component, "UID")?.value,
    );
    expect(prop(later[0] as Component, "DTSTAMP")?.value).not.toBe(
      prop(first[0] as Component, "DTSTAMP")?.value,
    );
  });
  it("gives every session its own UID, whatever the order of the input", () => {
    const sessions = [
      s({ id: "b", date: "2026-10-31" }),
      s({ id: "a", date: "2026-10-29" }),
      s({ id: "c", date: "2026-10-29" }),
    ];
    const forward = events(buildIcs(sessions, options())).map((e) => prop(e, "UID")?.value);
    const reverse = events(buildIcs([...sessions].reverse(), options())).map(
      (e) => prop(e, "UID")?.value,
    );
    expect(new Set(forward).size).toBe(3);
    expect(forward).toEqual(reverse);
    expect(forward).toEqual([
      "plan-session-a@cycling-hub",
      "plan-session-c@cycling-hub",
      "plan-session-b@cycling-hub",
    ]);
  });
  it("keeps a UID free of characters that need escaping", () => {
    const e = events(
      buildIcs([s({ id: "a b;c,d\\e", date: "2026-10-29" })], options()),
    )[0] as Component;
    expect(prop(e, "UID")?.value).toBe("plan-session-a-b-c-d-e@cycling-hub");
  });
  it("the same input gives the same file", () => {
    const sessions = [s({ id: "a", date: "2026-10-29" })];
    expect(buildIcs(sessions, options())).toBe(buildIcs(sessions, options()));
  });
});

describe("which sessions go in", () => {
  const sessions = [
    s({ id: "p", date: "2026-10-29" }),
    s({ id: "d", date: "2026-10-20", status: "done" }),
    s({ id: "m", date: "2026-10-22", status: "missed" }),
    s({ id: "k", date: "2026-10-23", status: "skipped" }),
    s({ id: "bad", date: "2026-13-40" }),
  ];
  it("only the sessions still to do by default", () => {
    expect(selectIcsSessions(sessions, "todo").map((x) => x.id)).toEqual(["p"]);
    expect(countIcsEvents(sessions, { scope: "todo", event: null })).toEqual({
      sessions: 1,
      event: false,
    });
  });
  it("the whole plan, done and missed ones included, with their status in the notes", () => {
    const parsed = events(buildIcs(sessions, options({ scope: "all" })));
    expect(parsed).toHaveLength(4);
    expect(text(parsed[0] as Component, "DESCRIPTION")).toContain("Status: done.");
    expect(text(parsed[3] as Component, "DESCRIPTION")).not.toContain("Status");
  });
  it("counts the event day", () => {
    expect(
      countIcsEvents(sessions, { scope: "all", event: { id: "e", name: "E", date: "2026-12-12" } }),
    ).toEqual({ sessions: 4, event: true });
    expect(
      countIcsEvents(sessions, { scope: "all", event: { id: "e", name: "E", date: "oops" } }).event,
    ).toBe(false);
  });
});

describe("dates around the clock changes (Europe/Brussels, 29 Mar and 25 Oct 2026)", () => {
  const dst = [
    s({ id: "spring", date: "2026-03-29" }),
    s({ id: "autumn", date: "2026-10-25" }),
    s({ id: "newyear", date: "2026-12-31" }),
    s({ id: "leap", date: "2028-02-28" }),
  ];
  it("all-day events end on the next date", () => {
    const parsed = events(buildIcs(dst, options({ scope: "all" })));
    const byUid = new Map(
      parsed.map((e) => [
        prop(e, "UID")?.value,
        [prop(e, "DTSTART")?.value, prop(e, "DTEND")?.value],
      ]),
    );
    expect(byUid.get("plan-session-spring@cycling-hub")).toEqual(["20260329", "20260330"]);
    expect(byUid.get("plan-session-autumn@cycling-hub")).toEqual(["20261025", "20261026"]);
    expect(byUid.get("plan-session-newyear@cycling-hub")).toEqual(["20261231", "20270101"]);
    expect(byUid.get("plan-session-leap@cycling-hub")).toEqual(["20280228", "20280229"]);
  });
  it("timed events keep their local start time on both days and use an elapsed-time duration", () => {
    const file = buildIcs(
      dst.slice(0, 2),
      options({ timing: { mode: "timed", startTime: "18:30" } }),
    );
    const [spring, autumn] = events(file) as [Component, Component];
    for (const e of [spring, autumn]) {
      expect(prop(e, "DTSTART")?.params).toEqual({ TZID: "Europe/Brussels" });
      expect(prop(e, "DURATION")?.value).toBe("PT1H");
      expect(prop(e, "DTEND")).toBeUndefined();
    }
    expect(prop(spring, "DTSTART")?.value).toBe("20260329T183000");
    expect(prop(autumn, "DTSTART")?.value).toBe("20261025T183000");
  });
  it("timed events come with a VTIMEZONE that has the EU rules", () => {
    const calendar = parseIcs(
      buildIcs(dst, options({ timing: { mode: "timed", startTime: "07:00" } })),
    );
    const zone = calendar.children.find((c) => c.type === "VTIMEZONE") as Component;
    expect(prop(zone, "TZID")?.value).toBe("Europe/Brussels");
    const standard = zone.children.find((c) => c.type === "STANDARD") as Component;
    const daylight = zone.children.find((c) => c.type === "DAYLIGHT") as Component;
    expect([prop(standard, "TZOFFSETFROM")?.value, prop(standard, "TZOFFSETTO")?.value]).toEqual([
      "+0200",
      "+0100",
    ]);
    expect([prop(daylight, "TZOFFSETFROM")?.value, prop(daylight, "TZOFFSETTO")?.value]).toEqual([
      "+0100",
      "+0200",
    ]);
    expect(prop(daylight, "RRULE")?.value).toBe("FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU");
    expect(prop(standard, "RRULE")?.value).toBe("FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU");
    // The rule "last Sunday" really gives 29 Mar and 25 Oct in 2026.
    const lastSunday = (month: number) => {
      const last = new Date(Date.UTC(2026, month + 1, 0));
      return new Date(last.getTime() - last.getUTCDay() * 86_400_000).getUTCDate();
    };
    expect([lastSunday(2), lastSunday(9)]).toEqual([29, 25]);
    // The zone starts before the VEVENTs that use it.
    expect(calendar.children[0]?.type).toBe("VTIMEZONE");
  });
  it("all-day files have no VTIMEZONE", () => {
    expect(buildIcs(dst, options())).not.toContain("VTIMEZONE");
  });
  it("formats the duration of timed events", () => {
    const durations = [45, 60, 90, 150, 330].map(
      (minutes) =>
        prop(
          events(
            buildIcs(
              [s({ id: "d", date: "2026-10-29", minutes })],
              options({ timing: { mode: "timed", startTime: "09:05" } }),
            ),
          )[0] as Component,
          "DURATION",
        )?.value,
    );
    expect(durations).toEqual(["PT45M", "PT1H", "PT1H30M", "PT2H30M", "PT5H30M"]);
  });
  it("an invalid start time falls back to all-day events", () => {
    for (const startTime of ["", "24:00", "7:30", "12:60", "noon"]) {
      const e = events(
        buildIcs(
          [s({ id: "a", date: "2026-10-29" })],
          options({ timing: { mode: "timed", startTime } }),
        ),
      )[0] as Component;
      expect(prop(e, "DTSTART")?.params).toEqual({ VALUE: "DATE" });
    }
  });
  it("an invalid or zero length does not produce a broken duration", () => {
    const e = events(
      buildIcs(
        [s({ id: "a", date: "2026-10-29", minutes: Number.NaN })],
        options({ timing: { mode: "timed", startTime: "09:00" } }),
      ),
    )[0] as Component;
    expect(prop(e, "DURATION")?.value).toBe("PT1H");
  });
});

describe("filename and out-of-date check", () => {
  const sessions = [
    s({ id: "a", date: "2026-10-29", steps: THRESHOLD_STEPS }),
    s({ id: "b", date: "2026-10-31", title: "Long ride", minutes: 150 }),
  ];
  it("names the download as the wireframe does", () => {
    expect(icsFilename()).toBe("cycling-hub-plan.ics");
    expect(ICS_FILENAME).toBe("cycling-hub-plan.ics");
  });
  it("is not out of date for the same plan, whatever the time of the check or the order", () => {
    const stored = icsFingerprint(sessions, options());
    expect(
      isIcsOutOfDate(
        stored,
        [...sessions].reverse(),
        options({ now: new Date(Date.UTC(2027, 0, 1)) }),
      ),
    ).toBe(false);
  });
  it("is out of date after a change to a session", () => {
    const stored = icsFingerprint(sessions, options());
    const changes: IcsSessionInput[][] = [
      [{ ...(sessions[0] as IcsSessionInput), date: "2026-10-30" }, sessions[1] as IcsSessionInput],
      [
        { ...(sessions[0] as IcsSessionInput), title: "Sweet spot" },
        sessions[1] as IcsSessionInput,
      ],
      [{ ...(sessions[0] as IcsSessionInput), minutes: 80 }, sessions[1] as IcsSessionInput],
      [{ ...(sessions[0] as IcsSessionInput), steps: [] }, sessions[1] as IcsSessionInput],
      [sessions[0] as IcsSessionInput],
      [...sessions, s({ id: "c", date: "2026-11-01" })],
      [{ ...(sessions[0] as IcsSessionInput), status: "done" }, sessions[1] as IcsSessionInput],
    ];
    for (const next of changes) expect(isIcsOutOfDate(stored, next, options())).toBe(true);
  });
  it("is out of date when the event day changes or the options differ", () => {
    const stored = icsFingerprint(
      sessions,
      options({ event: { id: "e", name: "Sportive", date: "2026-12-12" } }),
    );
    expect(
      isIcsOutOfDate(
        stored,
        sessions,
        options({ event: { id: "e", name: "Sportive", date: "2026-12-12" } }),
      ),
    ).toBe(false);
    expect(
      isIcsOutOfDate(
        stored,
        sessions,
        options({ event: { id: "e", name: "Sportive", date: "2026-12-19" } }),
      ),
    ).toBe(true);
    expect(isIcsOutOfDate(stored, sessions, options({ event: null }))).toBe(true);
    expect(
      isIcsOutOfDate(
        icsFingerprint(sessions, options()),
        sessions,
        options({ timing: { mode: "timed", startTime: "08:00" } }),
      ),
    ).toBe(true);
  });
  it("is never out of date before the first download", () => {
    expect(isIcsOutOfDate(null, sessions, options())).toBe(false);
  });
  it("the fingerprint is a short stable string", () => {
    expect(icsFingerprint(sessions, options())).toMatch(/^ics1-[0-9a-f]{14}$/);
    expect(icsFingerprint(sessions, options())).toBe(icsFingerprint(sessions, options()));
  });
});

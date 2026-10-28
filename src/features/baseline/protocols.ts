import { powerZones, type IsoDate, type Zone } from "@/features/athlete";

/** The two guided test protocols (P39). Stored in `test_weeks.protocol`. */
export type Protocol = "20min" | "ramp";

/** Stored in `test_sessions.kind`. */
export type SessionKind = "opener" | "test" | "recovery";

export type SessionPlan = {
  /** 1 to n, the order the sessions are done in (`test_sessions.position`). */
  position: number;
  kind: SessionKind;
  title: string;
  /** What the session is, one or two sentences. */
  summary: string;
};

export type ProtocolInfo = {
  label: string;
  description: string;
  /** What the test result is called for the test session: the number to type in. */
  resultLabel: string;
  sessions: readonly SessionPlan[];
};

const OPENER: Omit<SessionPlan, "position"> = {
  kind: "opener",
  title: "Opener ride",
  summary: "About 45 min, easy with short efforts. The day before the test.",
};

export const PROTOCOLS: Record<Protocol, ProtocolInfo> = {
  "20min": {
    label: "20-minute test",
    description: "Three sessions. One hard 20-minute effort. FTP is 95 % of the average power.",
    resultLabel: "Average power over the 20 minutes",
    sessions: [
      { position: 1, ...OPENER },
      {
        position: 2,
        kind: "test",
        title: "FTP test",
        summary:
          "About 1 h 10. Warm-up, one 5-minute effort, then 20 minutes as hard as you can hold.",
      },
      {
        position: 3,
        kind: "recovery",
        title: "Recovery ride",
        summary: "About 30 min, easy. Optional, the day after.",
      },
    ],
  },
  ramp: {
    label: "Ramp test",
    description:
      "Two sessions. Power goes up every minute until you cannot continue. FTP is 75 % of your best minute.",
    resultLabel: "Best 1-minute power in the ramp",
    sessions: [
      { position: 1, ...OPENER },
      {
        position: 2,
        kind: "test",
        title: "Ramp test",
        summary:
          "About 40 min. Easy warm-up, then the power goes up every minute until you cannot continue.",
      },
    ],
  },
};

export function isProtocol(value: string): value is Protocol {
  return value === "20min" || value === "ramp";
}

export function isSessionKind(value: string): value is SessionKind {
  return value === "opener" || value === "test" || value === "recovery";
}

/** A step of a session. `target` is a power range from the current FTP, or effort wording without one. */
export type Step = { title: string; duration: string; target: string };

function zoneTarget(zones: Zone[] | null, index: number, effort: string): string {
  const zone = zones?.find((z) => z.index === index);
  if (!zone) return effort;
  if (zone.max === null) return `Zone ${String(index)}: ${String(zone.min)} W and above`;
  if (index === 1) return `Zone 1: up to ${String(zone.max)} W`;
  return `Zone ${String(index)}: ${String(zone.min)} to ${String(zone.max)} W`;
}

/** The steps of a session. Power targets come from `ftp` (P53, Z-PO8); without it only effort wording shows. */
export function stepsFor(protocol: Protocol, kind: SessionKind, ftp: number | null): Step[] {
  const zones = powerZones(ftp);
  const z1 = zoneTarget(zones, 1, "Very easy, you can talk freely");
  const z2 = zoneTarget(zones, 2, "Easy, you can still talk");
  if (kind === "opener") {
    return [
      { title: "Warm-up", duration: "15 min", target: z2 },
      {
        title: "Short efforts",
        duration: "3 × 1 min, 2 min easy between",
        target: zoneTarget(zones, 5, "Hard but controlled"),
      },
      { title: "Easy spin", duration: "15 min", target: z1 },
      { title: "Cool-down", duration: "5 min", target: z1 },
    ];
  }
  if (kind === "recovery") {
    return [{ title: "Easy ride", duration: "30 min", target: z1 }];
  }
  if (protocol === "ramp") {
    return [
      { title: "Warm-up", duration: "10 min", target: z2 },
      {
        title: "The ramp",
        duration: "Until you cannot continue",
        target:
          "Start at 100 W and go up 20 W every minute. Note your best full minute. Stop when you cannot hold the power.",
      },
      { title: "Cool-down", duration: "10 min", target: z1 },
    ];
  }
  return [
    { title: "Warm-up", duration: "15 min", target: z2 },
    {
      title: "Fast pedalling",
      duration: "3 × 1 min, 1 min easy between",
      target: "High cadence, easy gear",
    },
    { title: "Easy spin", duration: "5 min", target: z1 },
    { title: "Hard effort", duration: "5 min", target: "As hard as you can hold" },
    { title: "Recovery", duration: "10 min", target: z1 },
    {
      title: "The test",
      duration: "20 min",
      target: "Even effort, as hard as you can hold. Do not start too hard.",
    },
    { title: "Cool-down", duration: "10 min", target: z1 },
  ];
}

/** The "before you start" checklist of a session (advice, it never blocks). */
export function checklistFor(kind: SessionKind): string[] {
  if (kind === "test") {
    return [
      "No hard ride in the last 24 hours",
      "Flat road or trainer where you can ride 20 minutes without stops",
      "Power meter zeroed",
      "Heart rate strap on",
      "A meal 2 to 3 hours before, and a bottle ready",
    ];
  }
  if (kind === "opener") {
    return ["Power meter zeroed", "Heart rate strap on", "A bottle ready"];
  }
  return ["Keep it easy, no hard efforts", "A bottle ready"];
}

/**
 * Warnings for the chosen dates (warnings, not blocks): a date before today, a test on the same day as the
 * opener, and sessions out of order. `dates[i]` belongs to `sessions[i]`; the result has one list per session.
 */
export function dateWarnings(
  sessions: readonly Pick<SessionPlan, "kind">[],
  dates: readonly (IsoDate | null)[],
  today: IsoDate,
): string[][] {
  return sessions.map((session, i) => {
    const date = dates[i] ?? null;
    const warnings: string[] = [];
    if (date === null) return warnings;
    if (date < today) warnings.push("This date is in the past.");
    for (let j = 0; j < i; j += 1) {
      const earlier = dates[j] ?? null;
      if (earlier === null) continue;
      if (date < earlier) {
        warnings.push(`This is before session ${String(j + 1)}. Do the sessions in order.`);
        break;
      }
    }
    if (session.kind === "test") {
      const openerIndex = sessions.findIndex((s) => s.kind === "opener");
      if (openerIndex !== -1 && dates[openerIndex] === date) {
        warnings.push("This is the same day as the opener ride. Leave a day in between.");
      }
    }
    return warnings;
  });
}

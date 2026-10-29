/**
 * Self-check of a plan against the rules of docs/plan/engine-rules.md (the "self-check" tables of
 * docs/plan/example-plans.md). Used by the tests; returns a list of violations, empty when the plan is fine.
 */
import {
  heartRateZones,
  powerZones,
  WEEKDAYS,
  weekdayIndex,
  zoneForValue,
} from "@/features/athlete";
import { LEVEL_SETTINGS, QUALITY_PERCENT } from "./constants";
import { hardBudget } from "./mix";
import {
  STRUCTURED_KINDS,
  type Plan,
  type PlanInput,
  type PlannedSession,
  type Week,
} from "./types";

const EPS = 1e-6;

function isHard(session: PlannedSession): boolean {
  return (
    STRUCTURED_KINDS.includes(session.kind) || (session.kind === "long" && session.mainSet !== null)
  );
}

function ownMinutes(week: Week): number {
  return week.sessions.filter((s) => s.kind !== "event").reduce((sum, s) => sum + s.durationMin, 0);
}

export function checkPlan(plan: Plan, input: PlanInput): string[] {
  const out: string[] = [];
  if (plan.status !== "ok") return out;
  const settings = LEVEL_SETTINGS[plan.level];
  const available = new Set(input.intake.availableDays);
  const hMinutes = plan.hoursPerWeek * 60;
  const ftp = input.ftp ?? 0;
  const zones = powerZones(ftp);
  const hr = heartRateZones({ lthr: input.lthr, maxHr: input.maxHr });

  if (plan.hoursPerWeek < settings.hours[0] || plan.hoursPerWeek > settings.hours[1]) {
    out.push("H outside the level range");
  }

  const eventDate = plan.event?.date ?? null;
  let previousLoading: Week | null = null;
  let previousLong = 0;
  for (const week of plan.weeks) {
    const tag = `week ${week.number}`;
    const minutes = ownMinutes(week);
    if (Math.abs(minutes - week.plannedMinutes) > EPS) out.push(`${tag}: plannedMinutes differs`);
    if (minutes > week.targetMinutes + EPS) out.push(`${tag}: hours above the target`);
    if (minutes > hMinutes + EPS) out.push(`${tag}: hours above H`);
    if (minutes > settings.hours[1] * 60 + EPS) out.push(`${tag}: hours above the level maximum`);

    const rides = week.sessions.filter((s) => s.kind !== "event");
    if (rides.length > settings.rides[1]) out.push(`${tag}: more rides than the level allows`);
    if (week.sessions.length > 6) out.push(`${tag}: no free day`);

    const dates = new Set<string>();
    for (const s of week.sessions) {
      if (dates.has(s.date)) out.push(`${tag}: two sessions on ${s.date}`);
      dates.add(s.date);
      if (s.week !== week.number) out.push(`${tag}: session in the wrong week`);
      const day = WEEKDAYS[weekdayIndex(s.date) ?? 0];
      if (s.kind !== "event" && s.kind !== "openers" && day && !available.has(day)) {
        out.push(`${tag}: session on an unavailable day ${s.date}`);
      }
      if (s.status !== "planned") out.push(`${tag}: status is not planned`);
      if (s.kind === "sprint" && !settings.sprintAllowed) out.push(`${tag}: sprint for an amateur`);
      if (s.kind !== "event") {
        const seconds = s.steps.reduce((sum, step) => sum + step.durationSec, 0);
        if (Math.abs(seconds / 60 - s.durationMin) > 0.01)
          out.push(`${tag}: steps do not add up on ${s.date}`);
      }
      for (const step of s.steps) {
        const { watts } = step.target;
        if (watts.target !== null) {
          if (watts.target !== Math.round((ftp * step.target.percentFtp) / 100))
            out.push(`${tag}: watts do not follow FTP`);
          const zone = zones ? zoneForValue(zones, watts.target) : null;
          if (zone && zone.index !== step.target.powerZone)
            out.push(`${tag}: power zone does not match watts`);
          if (s.indoor && (watts.min !== watts.target || watts.max !== watts.target))
            out.push(`${tag}: indoor target is not exact`);
        }
        if (step.heartRate) {
          const from = hr?.zones[step.heartRate.zoneFrom - 1];
          const to = hr?.zones[step.heartRate.zoneTo - 1];
          if (!from || !to || from.min !== step.heartRate.min || to.max !== step.heartRate.max) {
            out.push(`${tag}: heart rate does not match the zones`);
          }
        }
      }
    }

    const m = {
      quality: week.sessions
        .filter((s) => s.kind !== "test")
        .flatMap((s) => s.steps)
        .filter((st) => st.kind === "work" && st.target.percentFtp >= QUALITY_PERCENT)
        .reduce((sum, st) => sum + st.durationSec / 60, 0),
    };
    if (m.quality > settings.qualityCap * minutes + 1e-6)
      out.push(`${tag}: quality share above the cap`);
    if (week.aboveThresholdMinutes > settings.aboveThresholdCap * minutes + 1e-6) {
      out.push(`${tag}: above-threshold share above the cap`);
    }
    const hard = rides.filter(isHard).length;
    if (hard > hardBudget(plan.level, plan.purposes.main))
      out.push(`${tag}: too many hard sessions`);
    if (hard !== week.structuredCount) out.push(`${tag}: structuredCount differs`);

    const long = rides.find((s) => s.kind === "long");
    if (week.type === "loading") {
      if (previousLoading) {
        if (week.plannedMinutes > previousLoading.plannedMinutes * 1.1 + EPS)
          out.push(`${tag}: hours grew more than 10 %`);
        if (week.load > previousLoading.load * 1.15 + 0.1)
          out.push(`${tag}: load grew more than 15 %`);
        if (long && previousLong > 0 && long.durationMin > previousLong * 1.1 + EPS) {
          out.push(`${tag}: long ride grew more than 10 %`);
        }
      }
      previousLoading = week;
      if (long) previousLong = long.durationMin;
    } else if (week.type === "recovery") {
      if (previousLoading && week.plannedMinutes > previousLoading.plannedMinutes * 0.7 + EPS) {
        out.push(`${tag}: recovery week above 70 %`);
      }
    }
    if (week.hasTest && !week.sessions.some((s) => s.kind === "test")) out.push(`${tag}: no test`);
    if (!week.hasTest && week.sessions.some((s) => s.kind === "test"))
      out.push(`${tag}: unexpected test`);
    if (week.type === "taper") {
      if (week.sessions.some((s) => s.strengthNote !== null))
        out.push(`${tag}: strength note in the taper`);
      if (week.sessions.filter((s) => isHard(s)).length > 1)
        out.push(`${tag}: more than one hard session in the taper`);
    }
  }

  const flat = [...plan.sessions];
  for (let i = 1; i < flat.length; i += 1) {
    const a = flat[i - 1];
    const b = flat[i];
    if (!a || !b) continue;
    if (a.date >= b.date) out.push("sessions are not ordered by date");
    const gap = (Date.parse(b.date) - Date.parse(a.date)) / 86_400_000;
    if (gap === 1 && isHard(a) && isHard(b))
      out.push(`hard sessions on consecutive days ${a.date} and ${b.date}`);
  }

  if (plan.event && eventDate) {
    const last = plan.weeks[plan.weeks.length - 1];
    if (!last || !last.sessions.some((s) => s.kind === "event" && s.date === eventDate))
      out.push("event missing in the last week");
    if (last?.type !== "taper") out.push("no taper before the event");
    const taper = plan.weeks.filter((w) => w.type === "taper").length;
    if (taper !== plan.event.taperWeeks) out.push("taper length differs");
    if (flat.some((s) => s.date > eventDate)) out.push("session after the event");
    if (last?.sessions.some((s) => s.kind === "long")) out.push("long ride in the event week");
    const day = new Date(Date.parse(eventDate) - 86_400_000).toISOString().slice(0, 10);
    if (
      day >= plan.startDate &&
      !plan.sessions.some((s) => s.kind === "openers" && s.date === day)
    ) {
      out.push("no openers the day before the event");
    }
  } else {
    if (plan.weeks.some((w) => w.type === "taper")) out.push("taper without an event");
    if (plan.weeks.length !== 12) out.push("plan is not 12 weeks");
  }
  return out;
}

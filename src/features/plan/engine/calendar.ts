/** The 12-week structure (section 4): phases, recovery weeks, taper and the event. */
import { addDays, diffDays, isIsoDate, weekdayIndex, type IsoDate } from "@/features/athlete";
import {
  DEFAULT_EVENT_DURATION,
  DEFAULT_RECOVERY_EVERY,
  MIN_EVENT_PLAN_WEEKS,
  MIN_RECOVERY_PLAN_WEEKS,
  PLAN_WEEKS,
  TAPER_WEEKS,
} from "./constants";
import type { EventDuration, Notice, Phase, PlanEvent, Warning, WeekType } from "./types";

export type WeekSkeleton = {
  number: number;
  startDate: IsoDate;
  phase: Phase;
  type: WeekType;
  hasTest: boolean;
  /** 0-based position inside the taper; null outside it. */
  taperIndex: number | null;
};

export type PlanStructure = {
  startDate: IsoDate;
  endDate: IsoDate;
  weeks: WeekSkeleton[];
  /** Weeks before the taper. */
  trainingWeeks: number;
  taperWeeks: number;
  event: { name: string; date: IsoDate; duration: EventDuration } | null;
  notices: Notice[];
  warnings: Warning[];
};

/** `date` plus days; an invalid date comes back unchanged (callers check input first). */
export function plusDays(date: IsoDate, days: number): IsoDate {
  return addDays(date, days) ?? date;
}

/** The Monday on or after a date (the date itself when it is a Monday). */
export function mondayOnOrAfter(date: IsoDate): IsoDate {
  const index = weekdayIndex(date) ?? 0;
  return index === 0 ? date : plusDays(date, 7 - index);
}

/** The Monday on or before a date. */
export function mondayOnOrBefore(date: IsoDate): IsoDate {
  return plusDays(date, -(weekdayIndex(date) ?? 0));
}

/** Whole weeks between two Mondays. */
function weeksBetween(from: IsoDate, to: IsoDate): number {
  return Math.round((diffDays(from, to) ?? 0) / 7);
}

/** Phase of a training week. Twelve weeks: 1 to 4, 5 to 8, 9 and later; shorter plans use thirds. */
export function phaseOf(week: number, trainingWeeks: number, totalWeeks: number): Phase {
  const first = totalWeeks >= PLAN_WEEKS ? 4 : Math.ceil(trainingWeeks / 3);
  const second = totalWeeks >= PLAN_WEEKS ? 8 : Math.ceil((2 * trainingWeeks) / 3);
  if (week <= first) return "base";
  if (week <= second) return "build";
  return "peak";
}

/**
 * Calendar skeleton of the plan: start Monday, weeks, phases, recovery weeks, taper and the event.
 * Without an event it is 12 weeks with the test in week 12. With an event it is built backwards: the last
 * week holds the event, the taper is the last 1 or 2 weeks, and the plan starts 12 weeks before the event
 * week when the event is further away (open question: the PO can start now without the event instead).
 */
export function planStructure(input: {
  today: IsoDate;
  startDate?: IsoDate | undefined;
  event?: PlanEvent | undefined;
  recoveryEvery?: number | undefined;
}): PlanStructure {
  const notices: Notice[] = [];
  const warnings: Warning[] = [];
  const requested =
    input.startDate !== undefined && isIsoDate(input.startDate) ? input.startDate : input.today;
  let startDate = mondayOnOrAfter(requested);
  if (input.startDate !== undefined && startDate !== input.startDate) {
    notices.push({
      code: "start-moved",
      message: `Weeks start on Monday, so the plan starts on ${startDate}.`,
    });
  }

  let event: PlanStructure["event"] = null;
  let totalWeeks = PLAN_WEEKS;
  let taperWeeks = 0;
  const recoveryEvery = input.recoveryEvery === 3 ? 3 : DEFAULT_RECOVERY_EVERY;

  if (input.event) {
    const duration = input.event.duration ?? DEFAULT_EVENT_DURATION;
    if (!isIsoDate(input.event.date) || input.event.date < startDate) {
      warnings.push({
        code: "event-past",
        message: "The event date is before the plan starts, so the plan is built without an event.",
      });
    } else {
      event = { name: input.event.name, date: input.event.date, duration };
      const eventMonday = mondayOnOrBefore(event.date);
      const weeksToEvent = weeksBetween(startDate, eventMonday) + 1;
      if (weeksToEvent > PLAN_WEEKS) {
        startDate = plusDays(eventMonday, -7 * (PLAN_WEEKS - 1));
        totalWeeks = PLAN_WEEKS;
        warnings.push({
          code: "event-far",
          message: `Your event is more than 12 weeks away, so the plan starts on ${startDate}, 12 weeks before the event week.`,
        });
      } else {
        totalWeeks = weeksToEvent;
        if (weeksToEvent < MIN_EVENT_PLAN_WEEKS) {
          warnings.push({
            code: "event-too-soon",
            message: `Your event is less than 4 weeks away. The plan has ${weeksToEvent} ${weeksToEvent === 1 ? "week" : "weeks"} and mostly holds the taper.`,
          });
        }
      }
      taperWeeks = Math.min(TAPER_WEEKS[duration], totalWeeks);
    }
  }

  const trainingWeeks = totalWeeks - taperWeeks;
  const recoveryPossible = event === null || totalWeeks >= MIN_RECOVERY_PLAN_WEEKS;
  const weeks: WeekSkeleton[] = [];
  for (let number = 1; number <= totalWeeks; number += 1) {
    const weekStart = plusDays(startDate, 7 * (number - 1));
    if (number > trainingWeeks) {
      weeks.push({
        number,
        startDate: weekStart,
        phase: "taper",
        type: "taper",
        hasTest: false,
        taperIndex: number - trainingWeeks - 1,
      });
      continue;
    }
    const isRecovery =
      recoveryPossible &&
      number % recoveryEvery === 0 &&
      !(event !== null && number === trainingWeeks);
    weeks.push({
      number,
      startDate: weekStart,
      phase: phaseOf(number, trainingWeeks, totalWeeks),
      type: isRecovery ? "recovery" : "loading",
      hasTest: event === null && number === totalWeeks && isRecovery,
      taperIndex: null,
    });
  }

  return {
    startDate,
    endDate: event ? event.date : plusDays(startDate, 7 * totalWeeks - 1),
    weeks,
    trainingWeeks,
    taperWeeks,
    event,
    notices,
    warnings,
  };
}

import type { Weekday } from "@/features/athlete";
import { hardBudget, type Plan, type PlanInput, type Purpose } from "../engine";
import { formatDay } from "./model";

const DAY_NAMES: Record<Weekday, string> = {
  mon: "Mon",
  tue: "Tue",
  wed: "Wed",
  thu: "Thu",
  fri: "Fri",
  sat: "Sat",
  sun: "Sun",
};
const ALL_DAYS: readonly Weekday[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

function list(items: readonly string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1] ?? ""}`;
}

function weeksText(numbers: readonly number[]): string {
  return numbers.length === 1 ? `Week ${String(numbers[0])}` : `Weeks ${list(numbers.map(String))}`;
}

const MAIN_TEXT: Record<Purpose, string> = {
  endurance: "Endurance comes first: a long easy ride at the weekend.",
  speed: "Speed comes first: short hard sessions near and above threshold.",
  "muscle-building":
    "Muscle building comes first: low-cadence strength work on the bike, with strength notes for off the bike.",
  "weight-loss": "Weight loss comes first: more easy volume and no hard days on a big deficit.",
};

const SECOND_TEXT: Record<Purpose, string> = {
  endurance: "Endurance, your second purpose, adds some long and easy volume.",
  speed: "Speed, your second purpose, gets one short hard session in some weeks.",
  "muscle-building": "Muscle building, your second purpose, gets a strength note a week.",
  "weight-loss": "Weight loss, your second purpose, keeps the weekly pace under the cap.",
};

/**
 * "What the plan will assume" (T2): the rules the engine applies to the answers, in plain English and metric
 * units, then the engine's own notices and warnings. It is the PO's chance to disagree before anything is built.
 */
export function assumptionLines(plan: Plan, input: PlanInput): string[] {
  const lines: string[] = [];
  const days = ALL_DAYS.filter((d) => input.intake.availableDays.includes(d));
  const free = ALL_DAYS.filter((d) => !days.includes(d));
  if (days.length > 0)
    lines.push(
      `Sessions only on ${list(days.map((d) => DAY_NAMES[d]))}.${free.length > 0 ? ` ${list(free.map((d) => DAY_NAMES[d]))} stay free.` : ""}`,
    );

  const recovery = plan.weeks.filter((w) => w.type === "recovery").map((w) => w.number);
  lines.push(
    `About ${String(plan.hoursPerWeek)} h in a normal week.${recovery.length > 0 ? ` ${weeksText(recovery)} ${recovery.length === 1 ? "is" : "are"} lighter (about 30 % lighter).` : ""}`,
  );

  const hr =
    input.lthr != null
      ? ` and heart rate from your lactate threshold heart rate of ${String(input.lthr)} bpm`
      : input.maxHr != null
        ? ` and heart rate from your maximum heart rate of ${String(input.maxHr)} bpm`
        : "";
  const hard = hardBudget(plan.level, plan.purposes.main);
  lines.push(
    `Watts from your FTP of ${String(input.ftp ?? 0)} W${hr}.${hr === "" ? " Without a heart rate reference the sessions show watts only." : ""} At your level, at most ${String(hard)} hard ${hard === 1 ? "session" : "sessions"} per week.`,
  );

  lines.push(MAIN_TEXT[plan.purposes.main]);
  if (plan.purposes.secondary) lines.push(SECOND_TEXT[plan.purposes.secondary]);

  if (plan.weight) lines.push(plan.weight.message);
  else if (input.intake.purposes.slice(0, 2).includes("weight-loss"))
    lines.push(
      "Weight loss never faster than 0.5 % of your weight per week, and no hard days planned on a big deficit. The app shows no calories.",
    );

  const taper = plan.weeks.filter((w) => w.type === "taper").map((w) => w.number);
  if (plan.event && taper.length > 0)
    lines.push(
      `${weeksText(taper)} ${taper.length === 1 ? "is a taper" : "are a taper"} before your event on ${formatDay(plan.event.date)}.`,
    );

  for (const notice of plan.notices) lines.push(notice.message);
  for (const warning of plan.warnings) lines.push(warning.message);

  lines.push(
    "The plan is recalculated when rides come in or a session is missed. You see what changed and can undo it.",
  );
  return lines;
}

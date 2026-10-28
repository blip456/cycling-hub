import type { IsoDate } from "@/features/athlete";

const WEEKDAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const MONTH = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

function parts(date: IsoDate): { weekday: string; day: number; month: string } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) return null;
  const value = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return {
    weekday: WEEKDAY[value.getUTCDay()] ?? "",
    day: value.getUTCDate(),
    month: MONTH[value.getUTCMonth()] ?? "",
  };
}

/** "Wed 28 Oct". */
export function formatDay(date: IsoDate): string {
  const p = parts(date);
  return p ? `${p.weekday} ${p.day} ${p.month}` : date;
}

/** "28 Oct", for chart axes. */
export function formatShortDay(date: IsoDate): string {
  const p = parts(date);
  return p ? `${p.day} ${p.month}` : date;
}

/** One decimal: "74.8". */
export function formatKg(kg: number): string {
  return kg.toFixed(1);
}

/** A signed change with a real minus sign: "−0.6", "+0.4", "0.0". */
export function formatChange(kg: number): string {
  if (Math.abs(kg) < 0.05) return "0.0";
  return `${kg < 0 ? "−" : "+"}${Math.abs(kg).toFixed(1)}`;
}

/** Parses the weight field: a comma counts as the decimal separator. Empty or text gives NaN. */
export function parseKg(text: string): number {
  const clean = text.trim().replace(",", ".");
  return clean === "" ? Number.NaN : Number(clean);
}

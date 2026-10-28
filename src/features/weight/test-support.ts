import { vi } from "vitest";
import type { WeightEntry } from "@/features/athlete";
import * as api from "./api";

/** Today in the tests: Wednesday 28 October 2026 (Brussels). */
export const NOW = new Date("2026-10-28T10:00:00Z");

export const ENTRIES: WeightEntry[] = [
  { date: "2026-10-19", kg: 75.6, note: "After a rest week" },
  { date: "2026-10-22", kg: 75.0, note: null },
  { date: "2026-10-28", kg: 74.8, note: "Morning, before breakfast" },
];

/** Makes the weight API mocks answer like a healthy server. Call it after `vi.mock("./api")`. */
export function mockWeightApi(entries: WeightEntry[] = ENTRIES) {
  vi.mocked(api.fetchWeightEntries).mockResolvedValue(entries);
  vi.mocked(api.saveWeightEntry).mockResolvedValue(undefined);
  vi.mocked(api.deleteWeightEntry).mockResolvedValue(undefined);
  vi.mocked(api.fetchReminderSettings).mockResolvedValue({ enabled: true, day: "sun" });
}

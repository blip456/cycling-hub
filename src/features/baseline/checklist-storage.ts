/**
 * The "before you start" ticks of a test session are advice, so they are kept on this device only (there is
 * no column for them), per session. A blocked or full storage just means the ticks are not remembered.
 */
const key = (sessionId: string) => `cycling-hub:test-checklist:${sessionId}`;

/** The ticked item indexes of a session. */
export function loadChecked(sessionId: string): number[] {
  try {
    const raw = window.localStorage.getItem(key(sessionId));
    const parsed: unknown = raw === null ? [] : JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((v): v is number => typeof v === "number" && Number.isInteger(v))
      : [];
  } catch {
    return [];
  }
}

export function saveChecked(sessionId: string, checked: readonly number[]): void {
  try {
    window.localStorage.setItem(key(sessionId), JSON.stringify(checked));
  } catch {
    // Not remembered; the ticks still work for this visit.
  }
}

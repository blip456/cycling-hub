/**
 * Small per-browser memory for the two plan cards: which update the PO has seen (R3: the card stays until
 * the changes are opened, Undo is used or the next update replaces it) and for which count the "no power
 * data" card was dismissed (R7: "Not now" hides it until the count changes).
 */
import { useSyncExternalStore } from "react";

const SEEN_KEY = "cycling-hub:plan-update-seen";
const NO_POWER_KEY = "cycling-hub:no-power-dismissed";

const listeners = new Set<() => void>();
const memory = new Map<string, string>();

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    // Storage is blocked: the choice holds for this visit only, in memory.
    return memory.get(key) ?? null;
  }
}

function write(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    memory.set(key, value);
  }
  listeners.forEach((listener) => {
    listener();
  });
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The id of the last update the PO has seen. */
export function useSeenUpdate(): { seenId: string | null; markSeen: (id: string) => void } {
  const seenId = useSyncExternalStore(subscribe, () => read(SEEN_KEY));
  return {
    seenId,
    markSeen: (id) => {
      write(SEEN_KEY, id);
    },
  };
}

/** The count of sessions without power for which "Not now" was pressed. */
export function useNoPowerDismissed(): {
  dismissedCount: number | null;
  dismiss: (count: number) => void;
} {
  const raw = useSyncExternalStore(subscribe, () => read(NO_POWER_KEY));
  const parsed = raw === null ? Number.NaN : Number(raw);
  return {
    dismissedCount: Number.isNaN(parsed) ? null : parsed,
    dismiss: (count) => {
      write(NO_POWER_KEY, String(count));
    },
  };
}

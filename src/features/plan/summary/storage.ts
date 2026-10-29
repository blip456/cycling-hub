import type { IcsScope, IcsTiming } from "../export";
import type { SummaryKind } from "./types";

/** What the PO chose for a kind of summary, remembered in this browser (R11: the switches and the prompt line). */
export type StoredSummaryOptions = {
  includeWeight: boolean;
  includeGoals: boolean;
  includePrompt: boolean;
  /** The PO's own prompt line; null means the app's default for the kind. */
  prompt: string | null;
};

export const DEFAULT_SUMMARY_OPTIONS: StoredSummaryOptions = {
  includeWeight: true,
  includeGoals: true,
  includePrompt: true,
  prompt: null,
};

export const SUMMARY_STORAGE_KEY = "cycling-hub.plan.summary-options";
export const ICS_STORAGE_KEY = "cycling-hub.plan.ics-download";

function read(key: string): unknown {
  try {
    const text = window.localStorage.getItem(key);
    return text === null ? null : (JSON.parse(text) as unknown);
  } catch {
    return null;
  }
}

function write(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage is full or blocked: the choices just are not remembered.
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** The remembered options of a summary kind; the defaults for anything missing or unreadable. */
export function loadSummaryOptions(kind: SummaryKind): StoredSummaryOptions {
  const all = read(SUMMARY_STORAGE_KEY);
  const stored = isRecord(all) ? all[kind] : null;
  if (!isRecord(stored)) return DEFAULT_SUMMARY_OPTIONS;
  const flag = (value: unknown, fallback: boolean) =>
    typeof value === "boolean" ? value : fallback;
  return {
    includeWeight: flag(stored["includeWeight"], DEFAULT_SUMMARY_OPTIONS.includeWeight),
    includeGoals: flag(stored["includeGoals"], DEFAULT_SUMMARY_OPTIONS.includeGoals),
    includePrompt: flag(stored["includePrompt"], DEFAULT_SUMMARY_OPTIONS.includePrompt),
    prompt: typeof stored["prompt"] === "string" ? stored["prompt"] : null,
  };
}

export function saveSummaryOptions(kind: SummaryKind, options: StoredSummaryOptions): void {
  const all = read(SUMMARY_STORAGE_KEY);
  write(SUMMARY_STORAGE_KEY, { ...(isRecord(all) ? all : {}), [kind]: options });
}

/** The calendar choices and what the file looked like when it was downloaded (R10a note 4). */
export type StoredIcsDownload = {
  /** `icsFingerprint` of the file at download time. */
  fingerprint: string;
  scope: IcsScope;
  timing: IcsTiming;
  includeSteps: boolean;
  /** ISO time of the download. */
  downloadedAt: string;
};

const SCOPES: readonly IcsScope[] = ["todo", "all"];

export function loadIcsDownload(): StoredIcsDownload | null {
  const stored = read(ICS_STORAGE_KEY);
  if (!isRecord(stored)) return null;
  const scope = SCOPES.find((s) => s === stored["scope"]);
  const timing = stored["timing"];
  const validTiming =
    isRecord(timing) &&
    (timing["mode"] === "all-day" ||
      (timing["mode"] === "timed" && typeof timing["startTime"] === "string"));
  if (
    typeof stored["fingerprint"] !== "string" ||
    scope === undefined ||
    !validTiming ||
    typeof stored["includeSteps"] !== "boolean" ||
    typeof stored["downloadedAt"] !== "string"
  ) {
    return null;
  }
  return {
    fingerprint: stored["fingerprint"],
    scope,
    timing:
      timing["mode"] === "timed"
        ? { mode: "timed", startTime: String(timing["startTime"]) }
        : { mode: "all-day" },
    includeSteps: stored["includeSteps"],
    downloadedAt: stored["downloadedAt"],
  };
}

export function saveIcsDownload(download: StoredIcsDownload): void {
  write(ICS_STORAGE_KEY, download);
}

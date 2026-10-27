import type { Json } from "@/lib/supabase/database.types";

/** The export format version this app writes; the import parser reads it (SUPPORTED_VERSIONS). */
export const EXPORT_VERSION = 1;

export interface RidesJsonExport {
  version: number;
  exportedAt: string;
  activities: Json[];
}

/**
 * The JSON export (P37): the raw activities as they came from the Chrome extension (T6), in the
 * extension's file format, so the file can be imported again (it then reports every ride as
 * Unchanged).
 */
export function ridesToJson(rides: readonly { raw: Json }[], now: Date = new Date()): string {
  const file: RidesJsonExport = {
    version: EXPORT_VERSION,
    exportedAt: now.toISOString(),
    activities: rides.map((ride) => ride.raw),
  };
  return JSON.stringify(file, null, 2);
}

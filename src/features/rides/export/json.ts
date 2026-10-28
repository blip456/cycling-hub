import type { Json } from "@/lib/supabase/database.types";

/**
 * The export format version this app writes; the import parser reads it (SUPPORTED_VERSIONS). The
 * activities are the stored raw ones (v1- or v2-shaped, never with streams); the parser reads every
 * activity on its own, so the file imports again as unchanged (`docs/export-format.md`).
 */
export const EXPORT_VERSION = 2;

export interface RidesJsonExport {
  version: number;
  exportedAt: string;
  activities: Json[];
}

/**
 * The JSON export (P37): the raw activities as they came from the Chrome extension (T6), in the
 * extension's file format (v2, without streams: they are in Storage, T12), so the file can be
 * imported again (it then reports every ride as Unchanged).
 */
export function ridesToJson(rides: readonly { raw: Json }[], now: Date = new Date()): string {
  const file: RidesJsonExport = {
    version: EXPORT_VERSION,
    exportedAt: now.toISOString(),
    activities: rides.map((ride) => ride.raw),
  };
  return JSON.stringify(file, null, 2);
}

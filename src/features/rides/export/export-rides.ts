import { fetchRidesForExport } from "../api";
import { UTF8_BOM, ridesToCsv } from "./csv";
import { downloadFile, exportFileName } from "./download";
import { ridesToJson } from "./json";

export type ExportFormat = "csv" | "json";

/** Fetches the visible rides and downloads them; resolves to the number of rides in the file. */
export async function exportRides(format: ExportFormat, now: Date = new Date()): Promise<number> {
  const rides = await fetchRidesForExport();
  if (rides.length === 0) return 0;
  if (format === "csv") {
    downloadFile(
      UTF8_BOM + ridesToCsv(rides),
      "text/csv;charset=utf-8",
      exportFileName("csv", now),
    );
  } else {
    downloadFile(ridesToJson(rides, now), "application/json", exportFileName("json", now));
  }
  return rides.length;
}

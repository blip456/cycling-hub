import type { ChangeEvent } from "react";

/** File types offered by the file picker. The content decides, not the extension. */
export const ACCEPT = ".json,application/json";

/** Takes the first file from a file input and clears it, so the same file can be picked again. */
export function takeFile(event: ChangeEvent<HTMLInputElement>): File | null {
  const file = event.target.files?.[0] ?? null;
  event.target.value = "";
  return file;
}

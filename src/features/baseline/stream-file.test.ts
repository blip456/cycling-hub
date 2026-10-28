// @vitest-environment node
import { describe, expect, it } from "vitest";
import { gzipText } from "@/features/import/streams";
import { parseStreamsFile } from "./stream-source";

const STREAMS = { time: [0, 1, 2], watts: [100, 110, null] };

describe("parseStreamsFile", () => {
  it("decompresses a gzipped JSON file", async () => {
    const blob = await gzipText(JSON.stringify(STREAMS));
    expect(await parseStreamsFile(blob)).toEqual(STREAMS);
  });

  it("also reads a plain JSON file", async () => {
    expect(await parseStreamsFile(new Blob([JSON.stringify(STREAMS)]))).toEqual(STREAMS);
  });

  it("rejects a file that is neither", async () => {
    await expect(parseStreamsFile(new Blob(["not json"]))).rejects.toThrow();
  });
});

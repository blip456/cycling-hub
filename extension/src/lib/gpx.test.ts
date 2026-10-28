import { describe, expect, it } from "vitest";
import { fakeGpx, HTML_PAGE } from "../test/fixtures";
import { parseGpx } from "./gpx";

function points(text: string) {
  const result = parseGpx(text);
  if (result.kind !== "gpx") throw new Error("expected a GPX");
  return result.points;
}

describe("parseGpx", () => {
  it("reads position, elevation, time, heart rate, cadence, temperature and bare power", () => {
    const [first] = points(
      fakeGpx([
        { t: 0, lat: 51.04451, lon: 4.89061, ele: 12.4, hr: 98, cad: 85, power: 180, temp: 14 },
      ]),
    );
    expect(first).toEqual({
      time: Date.parse("2026-10-18T06:04:40Z"),
      lat: 51.04451,
      lon: 4.89061,
      ele: 12.4,
      hr: 98,
      cad: 85,
      power: 180,
      temp: 14,
    });
  });

  it("reads namespaced power", () => {
    const [first] = points(
      fakeGpx([{ t: 0, lat: 1, lon: 2, power: 222 }], { powerStyle: "namespaced" }),
    );
    expect(first?.power).toBe(222);
  });

  it("leaves missing heart rate and power as null", () => {
    const [first] = points(fakeGpx([{ t: 0, lat: 1, lon: 2, cad: 80 }]));
    expect(first?.hr).toBeNull();
    expect(first?.power).toBeNull();
    expect(first?.cad).toBe(80);
  });

  it("reads a GPX without namespaces or extensions", () => {
    const text = `<gpx><trk><trkseg><trkpt lat="1.5" lon="2.5"><time>2026-01-01T00:00:00Z</time></trkpt></trkseg></trk></gpx>`;
    expect(points(text)).toHaveLength(1);
  });

  it("returns no points for a GPX without track points", () => {
    expect(points(fakeGpx([]))).toEqual([]);
  });

  it("treats an HTML page, broken XML and an empty answer as not a GPX", () => {
    expect(parseGpx(HTML_PAGE).kind).toBe("not_gpx");
    expect(parseGpx("<gpx><trk>").kind).toBe("not_gpx");
    expect(parseGpx("").kind).toBe("not_gpx");
    expect(parseGpx(`{"error":"not found"}`).kind).toBe("not_gpx");
  });
});

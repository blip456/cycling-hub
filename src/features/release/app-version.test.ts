import { describe, expect, it } from "vitest";
import { appVersion, releaseVersions } from "./app-version";

describe("the app version", () => {
  it("is the newest release when package.json is behind (releases are tags since D10)", () => {
    expect(appVersion("1.0.0", ["1.2.0", "1.1.0", "1.0.0"])).toBe("1.2.0");
  });

  it("compares versions as numbers, not as text", () => {
    expect(appVersion("1.0.0", ["1.9.0", "1.10.0"])).toBe("1.10.0");
    expect(appVersion("1.0.0", ["2.0.0", "1.12.3"])).toBe("2.0.0");
  });

  it("keeps package.json when it is the newest or there are no releases", () => {
    expect(appVersion("1.3.0", ["1.2.0"])).toBe("1.3.0");
    expect(appVersion("1.0.0", [])).toBe("1.0.0");
  });

  it("skips versions that are not semantic and drops a leading v", () => {
    expect(appVersion("1.0.0", ["next", "v1.1.0", ""])).toBe("1.1.0");
  });
});

describe("the release versions of the generated changelog", () => {
  it("reads the versions in order", () => {
    expect(
      releaseVersions({ releases: [{ version: "1.2.0", entries: [] }, { version: "1.1.0" }] }),
    ).toEqual(["1.2.0", "1.1.0"]);
  });

  it("is empty for anything else", () => {
    expect(releaseVersions(null)).toEqual([]);
    expect(releaseVersions({})).toEqual([]);
    expect(releaseVersions({ releases: "x" })).toEqual([]);
    expect(releaseVersions({ releases: [{ version: 2 }, null] })).toEqual([]);
  });
});

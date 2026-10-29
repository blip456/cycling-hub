import { afterEach, describe, expect, it, vi } from "vitest";
import { EXAMPLE_A } from "../engine/fixtures";
import * as api from "../data/api";
import { profilePatchOf, restoreAnswers } from "./restore";
import { addHistory, fakeApi, fakeDb } from "./fake-api";
import { createRunner } from "./runner";

vi.mock("../data/api", async (importOriginal) => ({
  ...(await importOriginal<typeof api>()),
  savePlanProfile: vi.fn(),
  saveWeightGoal: vi.fn(),
  fetchActiveWeightGoal: vi.fn(),
}));

afterEach(() => {
  vi.clearAllMocks();
});

describe("putting the answers of an edit back", () => {
  it("writes the profile fields of the stored intake", () => {
    expect(profilePatchOf(EXAMPLE_A.intake)).toEqual({
      trainingPurposes: ["endurance"],
      levelAnswers: [1, 1, 1, 1, 0],
      weeklyHours: 4,
      eventName: null,
      eventDate: null,
    });
  });

  it("puts the weight target back when it differs from the active goal", async () => {
    vi.mocked(api.fetchActiveWeightGoal).mockResolvedValue({
      targetKg: 70,
      targetDate: "2027-02-01",
      startKg: 78,
      startDate: "2026-10-29",
    });
    const before = {
      ...EXAMPLE_A.intake,
      weightKg: 80,
      weightGoal: { targetKg: 76, targetDate: "2027-01-23" },
    };
    expect(await restoreAnswers("u", before)).toBe(true);
    expect(api.saveWeightGoal).toHaveBeenCalledWith({
      targetKg: 76,
      targetDate: "2027-01-23",
      startKg: 80,
    });
  });

  it("reports a failure instead of throwing", async () => {
    vi.mocked(api.savePlanProfile).mockRejectedValue(new Error("offline"));
    expect(await restoreAnswers("u", EXAMPLE_A.intake)).toBe(false);
  });
});

describe("the runner queue", () => {
  it("whenIdle waits for a run that is in progress", async () => {
    const db = fakeDb(EXAMPLE_A);
    addHistory(db, "2026-12-04");
    const runner = createRunner(fakeApi(db));
    let finished = false;
    const run = runner.run("2026-12-04").then(() => {
      finished = true;
    });
    await runner.whenIdle();
    expect(finished).toBe(true);
    await run;
  });
});

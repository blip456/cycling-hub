/**
 * A plan that starts during the week (a partial week 1): re-evaluating it keeps week 1 as it was built, so
 * the rebuilt plan uses the plan's first day and not the Monday of week 1.
 */
import { describe, expect, it } from "vitest";
import { EXAMPLE_A } from "../engine/fixtures";
import type { PlanInput } from "../engine";
import { firstDayOf } from "../data/model";
import { fakeApi, fakeDb } from "./fake-api";
import { createRunner } from "./runner";

const FRIDAY = "2026-11-06";

const input: PlanInput = {
  ...EXAMPLE_A,
  today: FRIDAY,
  intake: { ...EXAMPLE_A.intake, availableDays: ["wed", "sun"], startDate: FRIDAY },
};

describe("a plan built on a Friday", () => {
  it("keeps Monday as the start of week 1 and Friday as its first day", () => {
    const db = fakeDb(input);
    expect(db.plan.startDate).toBe("2026-11-02");
    expect(firstDayOf(db.plan)).toBe(FRIDAY);
    expect(db.sessions[0]?.date).toBe("2026-11-08");
  });

  it("keeps its sessions when it is re-evaluated, on the same day and on the Sunday", async () => {
    for (const day of [FRIDAY, "2026-11-08"]) {
      const api = fakeApi(fakeDb(input));
      const before = structuredClone(api.db.sessions);
      const result = await createRunner(api).run(day);
      expect(result.status).toBe("done");
      expect(api.db.sessions).toEqual(before);
    }
  });
});

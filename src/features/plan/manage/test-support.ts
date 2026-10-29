import { vi } from "vitest";
import * as baselineApi from "@/features/baseline/api";
import { HISTORY, VIEW } from "@/features/baseline/fixtures";
import * as weightApi from "@/features/weight/api";
import * as adaptationApi from "../adaptation/api";
import { addHistory, fakeApi, fakeDb, type FakeApi, type FakeDb } from "../adaptation/fake-api";
import { createRunner } from "../adaptation/runner";
import * as api from "../data/api";
import { TODAY, WEIGHTS, PLAN_INPUT } from "../data/test-support";

/** The plan of the other plan tests (committed, 8 h, endurance and speed, event 19 Dec) in an in-memory database. */
export function editDb(): FakeDb {
  const db = fakeDb(PLAN_INPUT);
  db.goal = null;
  // Everything before today was ridden.
  addHistory(db, TODAY);
  return db;
}

/**
 * Makes the data layer and the runner answer from `db`, and write to it, like one database. Call it after the
 * `vi.mock` calls of the data API, the adaptation API, the baseline API and the weight API. Returns the runner's
 * API (its `writes` list says what the runner wrote) and settles the plan first, so the stored fingerprint is
 * the one an evaluation of these inputs gives.
 */
export async function wireDb(db: FakeDb): Promise<FakeApi> {
  const runnerApi = fakeApi(db);
  await createRunner(runnerApi).run(TODAY);
  runnerApi.writes.length = 0;

  vi.mocked(api.fetchActivePlan).mockImplementation(() => Promise.resolve(db.plan));
  vi.mocked(api.fetchPlanSessions).mockImplementation(() =>
    Promise.resolve(db.sessions.map((s) => ({ ...s }))),
  );
  vi.mocked(api.updateSessions).mockResolvedValue(undefined);
  vi.mocked(api.fetchPlanProfile).mockImplementation(() => Promise.resolve({ ...db.profile }));
  vi.mocked(api.savePlanProfile).mockImplementation((_user, patch) => {
    db.profile = { ...db.profile, ...patch };
    return Promise.resolve();
  });
  vi.mocked(api.fetchActiveWeightGoal).mockImplementation(() => Promise.resolve(db.goal ?? null));
  vi.mocked(api.saveWeightGoal).mockImplementation((goal) => {
    db.goal = goal ? { ...goal, startDate: TODAY } : null;
    return Promise.resolve();
  });
  vi.mocked(adaptationApi.createSupabaseRunnerApi).mockReturnValue(runnerApi);
  vi.mocked(adaptationApi.fetchPlanChanges).mockImplementation(() =>
    Promise.resolve([...db.changes]),
  );
  vi.mocked(baselineApi.fetchCurrentBaseline).mockResolvedValue({
    ...VIEW,
    lthr: 165,
    lthr_effective_date: "2026-10-11",
  });
  vi.mocked(baselineApi.fetchBaselineEntries).mockResolvedValue(HISTORY);
  vi.mocked(weightApi.fetchWeightEntries).mockResolvedValue(WEIGHTS);
  return runnerApi;
}

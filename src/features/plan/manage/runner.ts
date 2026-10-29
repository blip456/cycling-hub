import { useAuth } from "@/lib/auth/auth-context";
import { createSupabaseRunnerApi } from "../adaptation/api";
import { createRunner, type Runner } from "../adaptation/runner";

const runners = new Map<string, Runner>();

/**
 * The one runner of a user. Its queue is what keeps two evaluations from running at the same time, so every
 * caller (the edit page, the summary preview, later the automatic triggers) has to share it.
 */
export function runnerFor(userId: string): Runner {
  let runner = runners.get(userId);
  if (!runner) {
    runner = createRunner(createSupabaseRunnerApi(userId));
    runners.set(userId, runner);
  }
  return runner;
}

/** Forgets the runners (tests, sign-out). */
export function resetPlanRunners(): void {
  runners.clear();
}

export function usePlanRunner(): Runner {
  const userId = useAuth().session?.user.id ?? "";
  return runnerFor(userId);
}

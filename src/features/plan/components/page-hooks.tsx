import {
  STATUS_PRIORITY,
  statusActionClass,
  useStatusCard,
} from "@/components/status/status-context";
import { brusselsDate, type IsoDate } from "@/features/athlete";

/** The week grid and the load chart replace the phone layout from this width on (T4d, T5d). */
export const GRID_QUERY = "(min-width: 1100px)";

/** Today in Brussels (the only clock the plan screens use). */
export function useToday(): IsoDate {
  return brusselsDate() ?? "";
}

/** The error card of T9b at the bottom of the page (P12) while the page shows the failure. */
export function usePlanLoadErrorCard(failed: boolean, retry: () => void): void {
  useStatusCard(
    "plan-load-error",
    STATUS_PRIORITY.error,
    failed
      ? {
          tone: "error",
          message: (
            <>
              <strong className="font-semibold">Plan not loaded</strong>
              <br />
              Check your connection and try again.
            </>
          ),
          action: (
            <button type="button" className={statusActionClass} onClick={retry}>
              Try again
            </button>
          ),
        }
      : null,
  );
}

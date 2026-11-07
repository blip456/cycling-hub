import { Link, useLocation } from "react-router";
import {
  STATUS_PRIORITY,
  statusActionClass,
  useStatusCard,
} from "@/components/status/status-context";
import { useAdaptationView } from "./adaptation/hooks";
import { NO_POWER_PATH } from "./adaptation/NoPowerPage";
import { useNoPowerDismissed } from "./adaptation/seen";

/**
 * R7: the "no power data" warning card (P64). Four or more sessions in the last 28 days whose ride has no
 * power data: the card says first that the plan stays the same, then How to fix (R7b). Not now hides it
 * until the count changes (R7-PO1). It is a notice, not an error: neutral tone. The how-to-fix page itself
 * does not show it.
 */
export function NoPowerDataWarning() {
  const view = useAdaptationView();
  const { dismissedCount, dismiss } = useNoPowerDismissed();
  const { pathname } = useLocation();
  const warning = view?.noPower ?? null;
  const visible =
    warning !== null && dismissedCount !== warning.count && !pathname.startsWith(NO_POWER_PATH);

  useStatusCard(
    "no-power-data",
    STATUS_PRIORITY.noPowerData,
    visible
      ? {
          tone: "info",
          message: (
            <>
              <strong className="font-semibold">{warning.title}</strong>
              <br />
              {warning.message}
            </>
          ),
          action: (
            <span className="flex flex-wrap items-center">
              <Link to={NO_POWER_PATH} className={statusActionClass}>
                How to fix
              </Link>
              <button
                type="button"
                className={statusActionClass}
                onClick={() => {
                  dismiss(warning.count);
                }}
              >
                Not now
              </button>
            </span>
          ),
        }
      : null,
  );
  return null;
}

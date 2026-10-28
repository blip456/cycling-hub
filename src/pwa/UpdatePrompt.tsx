import { useRegisterSW } from "virtual:pwa-register/react";
import {
  STATUS_PRIORITY,
  statusActionClass,
  useStatusCard,
} from "@/components/status/status-context";

const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000;

/**
 * Asks before switching to a new version (prompt-to-update). No offline data (P12). Shown as a status
 * card: bottom of the page on the phone, in the side menu on desktop (P31).
 */
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      if (!registration) return;
      // Installed PWAs can stay open for days; look for a new version every hour.
      setInterval(() => void registration.update(), UPDATE_CHECK_INTERVAL_MS);
    },
  });

  useStatusCard(
    "update",
    STATUS_PRIORITY.update,
    needRefresh
      ? {
          tone: "info",
          message: "A new version is ready.",
          action: (
            <button
              type="button"
              className={statusActionClass}
              onClick={() => void updateServiceWorker(true)}
            >
              Reload
            </button>
          ),
          onDismiss: () => {
            setNeedRefresh(false);
          },
        }
      : null,
  );

  return null;
}

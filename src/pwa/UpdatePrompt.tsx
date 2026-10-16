import { useRegisterSW } from "virtual:pwa-register/react";
import { StatusCard } from "@/components/StatusCard";
import { Button } from "@/components/ui";

const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000;

/** Asks before switching to a new version (prompt-to-update). No offline data (P12). */
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

  if (!needRefresh) return null;
  return (
    <StatusCard
      onDismiss={() => {
        setNeedRefresh(false);
      }}
      action={
        <Button className="shrink-0 px-4" onClick={() => void updateServiceWorker(true)}>
          Update
        </Button>
      }
    >
      A new version is available.
    </StatusCard>
  );
}

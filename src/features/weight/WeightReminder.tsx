import { useEffect, useRef, useState, type SubmitEvent, type KeyboardEvent } from "react";
import { useLocation } from "react-router";
import { STATUS_PRIORITY, useStatusCard } from "@/components/status/status-context";
import { Button, TextField } from "@/components/ui";
import {
  brusselsDate,
  shouldShowWeightReminder,
  weightEntrySchema,
  type IsoDate,
} from "@/features/athlete";
import { formatKg, parseKg } from "./format";
import { useReminderSettings, useSaveWeight, useWeightEntries } from "./hooks";
import { readDismissedOn, storeDismissedOn } from "./reminder-dismissal";

/** How long "Logged 74.8 kg" stays before the card goes. */
const LOGGED_MS = 4000;

function QuickLog({
  saving,
  failed,
  onLog,
  onNotNow,
}: {
  saving: boolean;
  failed: boolean;
  onLog: (kg: number) => void;
  onNotNow: () => void;
}) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | undefined>();

  function submit(event: SubmitEvent) {
    event.preventDefault();
    const parsed = weightEntrySchema.shape.kg.safeParse(parseKg(text));
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message);
      return;
    }
    setError(undefined);
    onLog(parsed.data);
  }

  function onKeyDown(event: KeyboardEvent) {
    if (event.key === "Escape") onNotNow();
  }

  return (
    // Escape dismisses the card (W3). The handler sits on the form, whose fields hold the focus.
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <form onSubmit={submit} onKeyDown={onKeyDown} noValidate>
      <TextField
        label="Weight"
        type="text"
        inputMode="decimal"
        autoComplete="off"
        value={text}
        error={error ?? (failed ? "Could not save your weight. Try again." : undefined)}
        helper="Saved as today's entry."
        trailing={
          <span aria-hidden="true" className="pr-3.5 text-[15px] text-muted">
            kg
          </span>
        }
        onChange={(e) => {
          setText(e.target.value);
        }}
      />
      <div className="mt-3 flex flex-wrap gap-2">
        <Button type="submit" disabled={saving}>
          Log weight
        </Button>
        <Button variant="ghost" onClick={onNotNow}>
          Not now
        </Button>
      </div>
    </form>
  );
}

/**
 * The weight reminder (W3, P12, P31, P46, P52). Mounted in the app shell, so the card shows on every page:
 * at the bottom of the page on the phone and at the bottom of the side menu on desktop, with the same
 * priority rules as every status card (it goes before "What's new", W-PO4). It shows when
 * `shouldShowWeightReminder` says so for the entries and the profile's reminder settings. The quick-log
 * field saves today's entry; "Not now" (or Escape) hides it for today. Nothing shows while the data is
 * loading or when it failed to load.
 */
export function WeightReminder() {
  const entries = useWeightEntries();
  const settings = useReminderSettings();
  const save = useSaveWeight();
  const [dismissedOn, setDismissedOn] = useState<IsoDate | null>(readDismissedOn);
  const [loggedKg, setLoggedKg] = useState<number | null>(null);
  const { pathname } = useLocation();
  const today = brusselsDate();

  // Settings change on another page: read them again after every navigation.
  const { refetch: refetchSettings } = settings;
  const lastPath = useRef(pathname);
  useEffect(() => {
    if (lastPath.current === pathname) return;
    lastPath.current = pathname;
    void refetchSettings();
  }, [pathname, refetchSettings]);

  useEffect(() => {
    if (loggedKg === null) return;
    const timer = setTimeout(() => {
      setLoggedKg(null);
    }, LOGGED_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [loggedKg]);

  const due =
    today !== null &&
    entries.data !== undefined &&
    settings.data !== undefined &&
    shouldShowWeightReminder({
      entries: entries.data,
      today,
      reminderDay: settings.data.day,
      enabled: settings.data.enabled,
      dismissedOn,
    });

  function notNow() {
    if (today === null) return;
    storeDismissedOn(today);
    setDismissedOn(today);
  }

  function log(kg: number) {
    if (today === null) return;
    save.mutate(
      { entry: { date: today, kg, note: null } },
      {
        onSuccess: () => {
          setLoggedKg(kg);
        },
      },
    );
  }

  useStatusCard(
    "weight-reminder",
    STATUS_PRIORITY.weightReminder,
    loggedKg !== null
      ? { tone: "success", message: `Logged ${formatKg(loggedKg)} kg` }
      : due
        ? {
            tone: "info",
            message: (
              <>
                <strong className="font-semibold">Time to log your weight</strong>
                <br />
                Nothing logged since your reminder day.
              </>
            ),
            content: (
              <QuickLog
                saving={save.isPending}
                failed={save.isError}
                onLog={log}
                onNotNow={notNow}
              />
            ),
          }
        : null,
  );
  return null;
}

import { useEffect, useId, useState } from "react";
import { STATUS_PRIORITY, useStatusCard } from "@/components/status/status-context";
import { WEEKDAYS, type Weekday } from "@/features/athlete";
import { useReminderSettings, useSaveReminderSettings } from "@/features/profile/hooks";
import { DEFAULT_REMINDER, type ReminderSettings } from "@/features/profile/reminder-api";
import { WEEKDAY_LONG } from "@/features/profile/weekday-labels";
import { SelectField } from "@/features/rides/list/controls";
import { Group, row } from "./SettingsGroup";

/** How long the "saved" card stays (ms). */
const SAVED_CARD_MS = 4000;

function isWeekday(value: string): value is Weekday {
  return WEEKDAYS.some((d) => d === value);
}

/**
 * Settings (W4, P52): the weight reminder switch and the reminder day, stored on the profile row. On by
 * default, Sunday by default. The day is disabled while the reminder is off. A change shows at once and
 * saves on its own; a short status card confirms it, or says "Not saved" and puts the old value back.
 */
export function WeightReminderSettings() {
  const labelId = useId();
  const switchHelperId = useId();
  const dayHelperId = useId();
  const query = useReminderSettings();
  const { mutate } = useSaveReminderSettings();
  const [saved, setSaved] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!saved) return;
    const timer = setTimeout(() => {
      setSaved(false);
    }, SAVED_CARD_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [saved]);

  useStatusCard(
    "weight-reminder-saved",
    STATUS_PRIORITY.flash,
    saved
      ? {
          tone: "success",
          message: "Reminder settings saved",
          onDismiss: () => {
            setSaved(false);
          },
        }
      : null,
  );
  useStatusCard(
    "weight-reminder-not-saved",
    STATUS_PRIORITY.error,
    failed
      ? {
          tone: "error",
          message: (
            <>
              <span className="block font-semibold">Not saved</span>
              <span className="block">Something went wrong. Try again.</span>
            </>
          ),
          onDismiss: () => {
            setFailed(false);
          },
        }
      : null,
  );

  if (query.isError) {
    return (
      <Group title="Weight reminder">
        <div className={row}>
          <span className="grow">The reminder settings could not be loaded.</span>
          <button
            type="button"
            className="min-h-11 rounded-md px-2 font-semibold text-accent hover:bg-subtle"
            onClick={() => {
              void query.refetch();
            }}
          >
            Try again
          </button>
        </div>
      </Group>
    );
  }

  const loading = query.isPending;
  const settings: ReminderSettings = query.data ?? DEFAULT_REMINDER;

  const change = (next: ReminderSettings) => {
    setSaved(false);
    setFailed(false);
    mutate(next, {
      onSuccess: () => {
        setSaved(true);
      },
      onError: () => {
        setFailed(true);
      },
    });
  };

  return (
    <Group title="Weight reminder">
      <button
        type="button"
        role="switch"
        aria-checked={settings.enabled}
        aria-labelledby={labelId}
        aria-describedby={switchHelperId}
        disabled={loading}
        onClick={() => {
          change({ ...settings, enabled: !settings.enabled });
        }}
        className={`${row} min-h-12 w-full text-left hover:bg-surface-hover focus-visible:-outline-offset-2 disabled:cursor-not-allowed disabled:opacity-60`}
      >
        <span id={labelId} className="grow">
          Weight reminder
        </span>
        <span
          aria-hidden="true"
          className={
            "relative h-8 w-[52px] shrink-0 rounded-full border-2 transition-colors " +
            (settings.enabled ? "border-accent bg-accent" : "border-input-border bg-track")
          }
        >
          <span
            className={
              "absolute top-0.5 size-6 rounded-full motion-safe:transition-[left] " +
              (settings.enabled ? "left-[22px] bg-on-accent" : "left-0.5 bg-muted")
            }
          />
        </span>
      </button>
      <p id={switchHelperId} className="px-4 pb-3 text-[13px] text-muted">
        Shows a card in the app when you have not logged your weight in 7 days.
      </p>
      <div className="px-4 pb-3">
        <SelectField
          label="Reminder day"
          className="has-disabled:opacity-60"
          value={settings.day}
          disabled={loading || !settings.enabled}
          aria-describedby={dayHelperId}
          onChange={(e) => {
            const day = e.target.value;
            if (isWeekday(day)) change({ ...settings, day });
          }}
        >
          {WEEKDAYS.map((day) => (
            <option key={day} value={day}>
              {WEEKDAY_LONG[day]}
            </option>
          ))}
        </SelectField>
        <p id={dayHelperId} className="mt-1.5 text-[13px] text-muted">
          The card appears from this day until you log your weight.
        </p>
      </div>
    </Group>
  );
}

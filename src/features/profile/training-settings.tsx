import { useEffect, useRef, useState, type SubmitEvent } from "react";
import { TextField } from "@/components/ui";
import { HISTORY_WEEKS, LEVEL_SETTINGS, SETTING_LIMITS, ZONE2 } from "@/features/plan/engine";
import type { HistoryStat } from "@/features/plan/engine";
import {
  DEFAULT_HISTORY_STAT,
  historyStatSchema,
  maxLongRideSchema,
  maxWeeklyHoursSchema,
  zone2TargetSchema,
  type TrainingSettings,
} from "@/features/plan/schemas";
import type { Profile } from "./api";
import { FormButtons, ViewRow, type SaveReport } from "./form-parts";
import { useSaveProfileSection } from "./hooks";
import { SAVE_FAILED } from "./labels";
import { RadioGroup } from "./RadioGroup";
import { SectionCard } from "./SectionCard";

interface SectionProps {
  profile: Profile;
  report: SaveReport;
}

type Field = "zone2" | "longRide" | "hours" | "history";
type Errors = Partial<Record<Field, string>>;

const HISTORY_OPTIONS: readonly { value: HistoryStat; label: string; detail: string }[] = [
  {
    value: "median",
    label: "Median",
    detail: "The middle week. A holiday or an ill week hardly moves it.",
  },
  {
    value: "average",
    label: "Average",
    detail: "Every week counts, also the quiet ones.",
  },
];

const HISTORY_LABEL: Record<HistoryStat, string> = {
  median: "Median",
  average: "Average",
};

/** Text to a number: empty is null (use the default), a comma counts as the decimal separator, other text is NaN. */
function parseNumber(text: string): number | null {
  const trimmed = text.trim().replace(",", ".");
  return trimmed === "" ? null : Number(trimmed);
}

function hoursText(hours: number): string {
  return Number.isInteger(hours) ? String(hours) : hours.toFixed(1);
}

/** The long ride and hours limits of the level the plan uses; null when no level is set yet. */
function levelLimits(profile: Profile): { longRideMin: number; hours: number } | null {
  if (profile.level === null) return null;
  const settings = LEVEL_SETTINGS[profile.level];
  return { longRideMin: settings.long[1], hours: settings.hours[1] };
}

function Suffix({ children }: { children: string }) {
  return (
    <span aria-hidden="true" className="pr-3.5 text-body text-muted">
      {children}
    </span>
  );
}

function TrainingForm({ profile, onDone, report }: SectionProps & { onDone: () => void }) {
  const { training } = profile;
  const limits = levelLimits(profile);
  const [zone2, setZone2] = useState(training.zone2TargetPercent?.toString() ?? "");
  const [longRide, setLongRide] = useState(training.maxLongRideMin?.toString() ?? "");
  const [hours, setHours] = useState(training.maxWeeklyHours?.toString() ?? "");
  const [history, setHistory] = useState<HistoryStat>(training.historyStat);
  const [errors, setErrors] = useState<Errors>({});
  const zone2Ref = useRef<HTMLInputElement>(null);
  const longRideRef = useRef<HTMLInputElement>(null);
  const hoursRef = useRef<HTMLInputElement>(null);
  const { mutate, isPending } = useSaveProfileSection();

  useEffect(() => {
    zone2Ref.current?.focus();
  }, []);

  const submit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    const next: Errors = {};
    const zone2Value = parseNumber(zone2);
    const longRideValue = parseNumber(longRide);
    const hoursValue = parseNumber(hours);
    if (zone2Value !== null) {
      const result = zone2TargetSchema.safeParse(zone2Value);
      if (!result.success) next.zone2 = result.error.issues[0]?.message ?? "Check this number.";
    }
    if (longRideValue !== null) {
      const result = maxLongRideSchema.safeParse(longRideValue);
      if (!result.success) next.longRide = result.error.issues[0]?.message ?? "Check this number.";
    }
    if (hoursValue !== null) {
      const result = maxWeeklyHoursSchema.safeParse(hoursValue);
      if (!result.success) next.hours = result.error.issues[0]?.message ?? "Check this number.";
    }
    const stat = historyStatSchema.safeParse(history);
    if (!stat.success) next.history = stat.error.issues[0]?.message ?? "Choose median or average.";

    if (Object.keys(next).length > 0 || !stat.success) {
      setErrors(next);
      report.fail("training", "Check the training settings, then save again.");
      if (next.zone2) zone2Ref.current?.focus();
      else if (next.longRide) longRideRef.current?.focus();
      else if (next.hours) hoursRef.current?.focus();
      return;
    }
    setErrors({});
    const settings: TrainingSettings = {
      zone2TargetPercent: zone2Value,
      maxLongRideMin: longRideValue,
      maxWeeklyHours: hoursValue,
      historyStat: stat.data,
    };
    mutate(
      { section: "training", training: settings },
      {
        onSuccess: () => {
          report.clear("training");
          onDone();
        },
        onError: () => {
          report.fail("training", SAVE_FAILED);
        },
      },
    );
  };

  return (
    <form onSubmit={submit} noValidate className="mt-2 flex flex-col gap-5">
      <TextField
        ref={zone2Ref}
        label="Zone 2 target"
        helper={`Where inside Zone 2 your easy and long rides aim, as a percent of your FTP. Zone 2 itself stays ${String(ZONE2.min)} to ${String(ZONE2.max)} %. Leave empty for ${String(ZONE2.default)} %.`}
        error={errors.zone2}
        value={zone2}
        onChange={(e) => {
          setZone2(e.target.value);
        }}
        inputMode="numeric"
        autoComplete="off"
        trailing={<Suffix>%</Suffix>}
      />
      <TextField
        ref={longRideRef}
        label="Longest long ride"
        helper={`The longest the plan makes a long ride, from ${String(SETTING_LIMITS.maxLongRideMin.min)} to ${String(SETTING_LIMITS.maxLongRideMin.max)} minutes in steps of 5. The weekly hours decide how long a long ride really is; this is only the upper limit. Leave empty for ${limits ? `your level's limit (${String(limits.longRideMin)} minutes)` : "the limit of your level"}.`}
        error={errors.longRide}
        value={longRide}
        onChange={(e) => {
          setLongRide(e.target.value);
        }}
        inputMode="numeric"
        autoComplete="off"
        trailing={<Suffix>min</Suffix>}
      />
      <TextField
        ref={hoursRef}
        label="Most hours in a week"
        helper={`The most your average hours per week can be, from ${String(SETTING_LIMITS.maxHoursPerWeek.min)} to ${String(SETTING_LIMITS.maxHoursPerWeek.max)}. Half hours are fine. Leave empty for ${limits ? `your level's limit (${hoursText(limits.hours)} h)` : "the limit of your level"}.`}
        error={errors.hours}
        value={hours}
        onChange={(e) => {
          setHours(e.target.value);
        }}
        inputMode="decimal"
        autoComplete="off"
        trailing={<Suffix>h</Suffix>}
      />
      <RadioGroup
        legend="Your recent weekly hours"
        options={HISTORY_OPTIONS}
        value={history}
        onChange={setHistory}
        error={errors.history}
        helper={`Week 1 of the plan starts from the hours you rode per week over the last ${String(HISTORY_WEEKS)} full weeks, and this follows your rides as they come in. Choose how those weeks are summarised.`}
      />
      <FormButtons
        saving={isPending}
        onCancel={() => {
          report.clear("training");
          onDone();
        }}
      />
    </form>
  );
}

/** True when nothing differs from the defaults: the section then shows a sentence and one button. */
function isDefault(training: TrainingSettings): boolean {
  return (
    training.zone2TargetPercent === null &&
    training.maxLongRideMin === null &&
    training.maxWeeklyHours === null &&
    training.historyStat === DEFAULT_HISTORY_STAT
  );
}

/** What a limit shows: the PO's own value, else the level's, else a plain word when no level is set. */
function limitView(
  own: number | null,
  fromLevel: number | null,
  format: (value: number) => string,
): { text: string; setByLevel: boolean } {
  if (own !== null) return { text: format(own), setByLevel: false };
  if (fromLevel !== null) return { text: format(fromLevel), setByLevel: true };
  return { text: "Set by your level", setByLevel: false };
}

/** P96 to P98: the Zone 2 target, the limits of the level and how the ride history is summarised. */
export function TrainingSettingsSection({ profile, report }: SectionProps) {
  const [editing, setEditing] = useState(false);
  const { training } = profile;
  const limits = levelLimits(profile);
  const longRide = limitView(
    training.maxLongRideMin,
    limits?.longRideMin ?? null,
    (minutes) => `${String(minutes)} min`,
  );
  const hours = limitView(
    training.maxWeeklyHours,
    limits?.hours ?? null,
    (h) => `${hoursText(h)} h`,
  );
  return (
    <SectionCard
      title="Training settings"
      editing={editing}
      onEdit={() => {
        setEditing(true);
      }}
      empty={isDefault(training)}
      emptyText={`The plan uses its defaults: Zone 2 at ${String(ZONE2.default)} % of FTP, the long ride and weekly hour limits of your level, and the ${HISTORY_LABEL.median.toLowerCase()} of your last ${String(HISTORY_WEEKS)} weeks.`}
      addLabel="Change training settings"
      view={
        <div className="mt-1">
          <ViewRow label="Zone 2 target">
            <span className="tabular-nums">
              {training.zone2TargetPercent ?? ZONE2.default} % of FTP
            </span>
            {training.zone2TargetPercent === null ? (
              <span className="block text-caption text-muted">Default</span>
            ) : null}
          </ViewRow>
          <ViewRow label="Longest long ride">
            <span className="tabular-nums">{longRide.text}</span>
            {longRide.setByLevel ? (
              <span className="block text-caption text-muted">Set by your level</span>
            ) : null}
          </ViewRow>
          <ViewRow label="Most hours in a week">
            <span className="tabular-nums">{hours.text}</span>
            {hours.setByLevel ? (
              <span className="block text-caption text-muted">Set by your level</span>
            ) : null}
          </ViewRow>
          <ViewRow label="Recent weekly hours">
            {HISTORY_LABEL[training.historyStat]} of the last {HISTORY_WEEKS} weeks
          </ViewRow>
          <p className="mt-1 text-caption text-muted">
            Saving updates the sessions that have not happened yet.
          </p>
        </div>
      }
      form={
        <TrainingForm
          profile={profile}
          report={report}
          onDone={() => {
            setEditing(false);
          }}
        />
      }
    />
  );
}

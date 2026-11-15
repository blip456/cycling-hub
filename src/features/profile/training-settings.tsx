import { useEffect, useMemo, useRef, useState, type SubmitEvent } from "react";
import { SuggestionHint } from "@/components/SuggestionHint";
import { Button, TextField } from "@/components/ui";
import { useHistoryRides } from "@/features/plan/adaptation/use-history";
import { HISTORY_WEEKS, LEVEL_SETTINGS, SETTING_LIMITS, ZONE2 } from "@/features/plan/engine";
import {
  suggestMaxLongRide,
  suggestMaxWeeklyHours,
  type HistoryStat,
  type IntensityBalance,
} from "@/features/plan/engine";
import {
  DEFAULT_HISTORY_STAT,
  DEFAULT_INTENSITY_BALANCE,
  historyStatSchema,
  intensityBalanceSchema,
  maxLongRideSchema,
  maxWeeklyHoursSchema,
  zone2TargetSchema,
  type TrainingSettings,
} from "@/features/plan/schemas";
import type { Profile } from "./api";
import { FormButtons, ViewRow, type SaveReport } from "./form-parts";
import { useSaveProfileSection } from "./hooks";
import { usePlanRunFlow } from "@/features/plan/adaptation/use-replan-flow";
import { SAVE_FAILED } from "./labels";
import { RadioGroup } from "./RadioGroup";
import { SectionCard } from "./SectionCard";

interface SectionProps {
  profile: Profile;
  report: SaveReport;
}

type Field = "zone2" | "longRide" | "hours" | "history" | "balance";
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

const BALANCE_OPTIONS: readonly { value: IntensityBalance; label: string; detail: string }[] = [
  {
    value: "base",
    label: "Base-focused",
    detail:
      "The plan as it is: mostly easy riding, with sweet spot, tempo and threshold as the hard sessions.",
  },
  {
    value: "balanced",
    label: "Balanced",
    detail:
      "From the Build phase one VO2 max session a week, and one easy ride a week with a few short sprints. The limits on hard work are 1.5 times higher.",
  },
  {
    value: "high",
    label: "High-intensity",
    detail:
      "VO2 max from the first week, two VO2 max sessions a week from Build, and two easy rides a week with sprints. The limits on hard work are 2 times higher. No trial has tested this at 8 to 10 hours a week, so watch how tired you get.",
  },
];

const BALANCE_LABEL: Record<IntensityBalance, string> = {
  base: "Base-focused",
  balanced: "Balanced",
  high: "High-intensity",
};

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

/**
 * "Reset to default" under a field: puts the field back to what the plan uses without it. It is on for every
 * field that holds a value of its own, and off (nothing to reset) when the field is already at the default.
 */
function ResetButton({
  field,
  atDefault,
  onReset,
}: {
  field: string;
  atDefault: boolean;
  onReset: () => void;
}) {
  return (
    <div className="-mt-3">
      <Button
        type="button"
        variant="secondary"
        disabled={atDefault}
        aria-label={`Reset ${field} to default`}
        onClick={onReset}
      >
        Reset to default
      </Button>
    </div>
  );
}

function TrainingForm({
  profile,
  onDone,
  onSaved,
  report,
}: SectionProps & { onDone: () => void; onSaved: () => void }) {
  const { training } = profile;
  const limits = levelLimits(profile);
  const [zone2, setZone2] = useState(training.zone2TargetPercent?.toString() ?? "");
  const [longRide, setLongRide] = useState(training.maxLongRideMin?.toString() ?? "");
  const [hours, setHours] = useState(training.maxWeeklyHours?.toString() ?? "");
  const [history, setHistory] = useState<HistoryStat>(training.historyStat);
  const [balance, setBalance] = useState<IntensityBalance>(training.intensityBalance);
  const [errors, setErrors] = useState<Errors>({});
  const zone2Ref = useRef<HTMLInputElement>(null);
  const longRideRef = useRef<HTMLInputElement>(null);
  const hoursRef = useRef<HTMLInputElement>(null);
  const { mutate, isPending } = useSaveProfileSection();
  const rideHistory = useHistoryRides();
  const suggestedLongRide = useMemo(
    () => suggestMaxLongRide(rideHistory.rides, rideHistory.today),
    [rideHistory.rides, rideHistory.today],
  );
  const suggestedHours = useMemo(
    () => suggestMaxWeeklyHours(rideHistory.rides, rideHistory.today),
    [rideHistory.rides, rideHistory.today],
  );
  const clearError = (field: Field) => {
    setErrors((current) =>
      Object.fromEntries(Object.entries(current).filter(([key]) => key !== field)),
    );
  };

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
    const mix = intensityBalanceSchema.safeParse(balance);
    if (!mix.success) next.balance = mix.error.issues[0]?.message ?? "Choose one option.";
    const stat = historyStatSchema.safeParse(history);
    if (!stat.success) next.history = stat.error.issues[0]?.message ?? "Choose median or average.";

    if (Object.keys(next).length > 0 || !stat.success || !mix.success) {
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
      intensityBalance: mix.data,
    };
    mutate(
      { section: "training", training: settings },
      {
        onSuccess: () => {
          report.clear("training");
          onSaved();
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
      <ResetButton
        field="Zone 2 target"
        atDefault={zone2.trim() === ""}
        onReset={() => {
          setZone2("");
          clearError("zone2");
          zone2Ref.current?.focus();
        }}
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
      {suggestedLongRide ? (
        <SuggestionHint
          id="suggestedLongRide-suggestion"
          {...(longRide.trim() !== String(suggestedLongRide.value)
            ? {
                actionLabel: `Use ${String(suggestedLongRide.value)} min`,
                onUse: () => {
                  setLongRide(String(suggestedLongRide.value));
                },
              }
            : {})}
        >
          From your rides: {suggestedLongRide.note}.
        </SuggestionHint>
      ) : null}
      <ResetButton
        field="Longest long ride"
        atDefault={longRide.trim() === ""}
        onReset={() => {
          setLongRide("");
          clearError("longRide");
          longRideRef.current?.focus();
        }}
      />
      <TextField
        ref={hoursRef}
        label="Most hours in a week"
        helper={`The most the plan schedules in a week, from ${String(SETTING_LIMITS.maxHoursPerWeek.min)} to ${String(SETTING_LIMITS.maxHoursPerWeek.max)}. Half hours are fine. Leave empty for ${limits ? `your level's limit (${hoursText(limits.hours)} h)` : "the limit of your level"}.`}
        error={errors.hours}
        value={hours}
        onChange={(e) => {
          setHours(e.target.value);
        }}
        inputMode="decimal"
        autoComplete="off"
        trailing={<Suffix>h</Suffix>}
      />
      {suggestedHours ? (
        <SuggestionHint
          id="suggestedHours-suggestion"
          {...(hours.trim() !== String(suggestedHours.value)
            ? {
                actionLabel: `Use ${String(suggestedHours.value)} h`,
                onUse: () => {
                  setHours(String(suggestedHours.value));
                },
              }
            : {})}
        >
          From your rides: {suggestedHours.note}.
        </SuggestionHint>
      ) : null}
      <ResetButton
        field="Most hours in a week"
        atDefault={hours.trim() === ""}
        onReset={() => {
          setHours("");
          clearError("hours");
          hoursRef.current?.focus();
        }}
      />
      <RadioGroup
        legend="Intensity balance"
        options={BALANCE_OPTIONS}
        value={balance}
        onChange={setBalance}
        error={errors.balance}
        helper="How much of your riding is hard. The number of hard sessions, the rest days and the recovery weeks stay the same in every option. Zone 2 stays the base of your week."
      />
      <ResetButton
        field="intensity balance"
        atDefault={balance === DEFAULT_INTENSITY_BALANCE}
        onReset={() => {
          setBalance(DEFAULT_INTENSITY_BALANCE);
          clearError("balance");
        }}
      />
      <RadioGroup
        legend="Your recent weekly hours"
        options={HISTORY_OPTIONS}
        value={history}
        onChange={setHistory}
        error={errors.history}
        helper={`Week 1 of the plan starts from the hours you rode per week over the last ${String(HISTORY_WEEKS)} full weeks, and this follows your rides as they come in. Choose how those weeks are summarised.`}
      />
      <ResetButton
        field="recent weekly hours"
        atDefault={history === DEFAULT_HISTORY_STAT}
        onReset={() => {
          setHistory(DEFAULT_HISTORY_STAT);
          clearError("history");
        }}
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
    training.historyStat === DEFAULT_HISTORY_STAT &&
    training.intensityBalance === DEFAULT_INTENSITY_BALANCE
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
  // After a save the plan is evaluated at once; the answer (also "nothing changes") stays on this page.
  const { replan: apply } = usePlanRunFlow("settings");
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
      emptyText={`The plan uses its defaults: Zone 2 at ${String(ZONE2.default)} % of FTP, the long ride and weekly hour limits of your level, a base-focused intensity balance and the ${HISTORY_LABEL.median.toLowerCase()} of your last ${String(HISTORY_WEEKS)} weeks.`}
      addLabel="Change training settings"
      view={
        <div className="mt-1">
          <ViewRow label="Intensity balance">{BALANCE_LABEL[training.intensityBalance]}</ViewRow>
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
          <ViewRow label="Weekly hours basis">
            <span>{HISTORY_LABEL[training.historyStat]}</span>
            <span className="block text-caption text-muted">Of the last {HISTORY_WEEKS} weeks</span>
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
          onSaved={apply}
          onDone={() => {
            setEditing(false);
          }}
        />
      }
    />
  );
}

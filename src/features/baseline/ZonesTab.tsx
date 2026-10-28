import { useId, useState } from "react";
import { Link } from "react-router";
import { buttonClass } from "@/components/button-class";
import { heartRateZones, powerZones } from "@/features/athlete";
import { DESKTOP_QUERY, useMediaQuery } from "@/lib/use-media-query";
import { formatDate } from "./format";
import { useBaseline } from "./hooks";
import { isEmptyBaseline, valueOf, type CurrentBaseline } from "./model";
import { LoadError, Skeleton, ZoneBar, ZoneRows } from "./parts";

type View = "power" | "hr";

function Segmented({ value, onChange }: { value: View; onChange: (value: View) => void }) {
  const name = useId();
  const options: { value: View; label: string }[] = [
    { value: "power", label: "Power" },
    { value: "hr", label: "Heart rate" },
  ];
  return (
    <div
      role="radiogroup"
      aria-label="Zones to show"
      className="mb-4 flex h-11 gap-0.5 rounded-[12px] bg-track p-[3px]"
    >
      {options.map((option) => (
        <label
          key={option.value}
          className={
            "relative flex flex-1 cursor-pointer items-center justify-center rounded-[9px] px-4 text-[15px] font-medium text-muted " +
            "hover:text-text has-checked:bg-raised has-checked:font-semibold has-checked:text-text " +
            "has-checked:shadow-[inset_0_0_0_1px_var(--input-border)] " +
            "has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-accent"
          }
        >
          <input
            type="radio"
            name={name}
            value={option.value}
            checked={value === option.value}
            onChange={() => {
              onChange(option.value);
            }}
            className="sr-only"
          />
          {option.label}
        </label>
      ))}
    </div>
  );
}

function PowerZones({ baseline }: { baseline: CurrentBaseline }) {
  const zones = powerZones(valueOf(baseline, "ftp"));
  if (!zones || !baseline.ftp) {
    return (
      <section aria-labelledby="power-heading">
        <h2 id="power-heading" className="mb-1 text-[17px] font-semibold">
          Power zones (7)
        </h2>
        <p className="mb-3 text-[15px]">Power zones need an FTP. Set one to see them.</p>
        <Link to="/baseline/update" className={buttonClass("secondary")}>
          Update baseline
        </Link>
      </section>
    );
  }
  return (
    <section aria-labelledby="power-heading">
      <h2 id="power-heading" className="mb-1 text-[17px] font-semibold">
        Power zones (7)
      </h2>
      <p className="mb-3 text-[15px]">
        Coggan, from FTP {baseline.ftp.value} W, effective {formatDate(baseline.ftp.effectiveDate)}
      </p>
      <div className="mb-3">
        <ZoneBar zones={zones} label="Power zones 1 to 7, as wide as their range" />
      </div>
      <ZoneRows zones={zones} model="power" unit="W" />
      <p className="mt-2 text-[13px] text-muted">Zone 7 has no upper limit.</p>
    </section>
  );
}

function HeartRateZones({ baseline }: { baseline: CurrentBaseline }) {
  const set = heartRateZones({
    lthr: valueOf(baseline, "lthr"),
    maxHr: valueOf(baseline, "maxHr"),
  });
  if (!set) {
    return (
      <section aria-labelledby="hr-zones-heading">
        <h2 id="hr-zones-heading" className="mb-1 text-[17px] font-semibold">
          Heart rate zones (5)
        </h2>
        <p className="mb-3 text-[15px]">Heart rate zones need a max heart rate or an LTHR.</p>
        <Link to="/baseline/values" className={buttonClass("secondary")}>
          Enter values
        </Link>
      </section>
    );
  }
  const fromLthr = set.reference === "lthr";
  const reference = fromLthr ? baseline.lthr : baseline.maxHr;
  return (
    <section aria-labelledby="hr-zones-heading">
      <h2 id="hr-zones-heading" className="mb-1 text-[17px] font-semibold">
        Heart rate zones (5)
      </h2>
      <p className="mb-1 text-[15px]">
        From {fromLthr ? "LTHR" : "max HR"} {reference?.value} bpm
        {reference ? `, effective ${formatDate(reference.effectiveDate)}` : ""}
      </p>
      <p className="mb-3 text-[13px] text-muted">
        Heart rate reference: max HR{" "}
        {baseline.maxHr ? `${String(baseline.maxHr.value)} bpm` : "(not set)"}, LTHR{" "}
        {baseline.lthr ? `${String(baseline.lthr.value)} bpm` : "(not set)"}. LTHR is used when it
        is set; otherwise max HR.
      </p>
      <div className="mb-3">
        <ZoneBar zones={set.zones} label="Heart rate zones 1 to 5, as wide as their range" />
      </div>
      <ZoneRows zones={set.zones} model={set.reference} unit="bpm" />
    </section>
  );
}

/** Z7: power zones from FTP and heart rate zones from LTHR or max HR. Number, name and range are always text. */
export function ZonesTab() {
  const { baseline, isPending, isError, refetch } = useBaseline();
  const desktop = useMediaQuery(DESKTOP_QUERY);
  const [view, setView] = useState<View>("power");

  if (isError) {
    return (
      <LoadError
        id="zones-error"
        message="Couldn't load your zones. Check your connection."
        onRetry={refetch}
      />
    );
  }
  if (isPending || !baseline) return <Skeleton label="Loading your zones" />;
  if (
    isEmptyBaseline(baseline) ||
    (baseline.ftp === null && baseline.maxHr === null && baseline.lthr === null)
  ) {
    return (
      <div className="flex max-w-[640px] flex-col items-start gap-4">
        <p className="w-full rounded-2xl bg-surface px-5 py-8 text-center text-[15px] text-muted">
          Zones need an FTP or a max heart rate. Set your baseline first.
        </p>
        <Link to="/baseline/values" className={buttonClass("primary")}>
          Enter values
        </Link>
      </div>
    );
  }
  if (desktop) {
    return (
      <div className="grid grid-cols-2 items-start gap-8">
        <PowerZones baseline={baseline} />
        <HeartRateZones baseline={baseline} />
      </div>
    );
  }
  return (
    <div className="max-w-[640px]">
      <Segmented value={view} onChange={setView} />
      {view === "power" ? (
        <PowerZones baseline={baseline} />
      ) : (
        <HeartRateZones baseline={baseline} />
      )}
    </div>
  );
}

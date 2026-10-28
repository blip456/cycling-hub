import type { ReactNode } from "react";
import { Link } from "react-router";
import { ChevronRightIcon } from "@/components/icons";
import { useHasPowerRides } from "./hooks";

const row =
  "flex min-h-16 items-center gap-3 rounded-2xl bg-surface px-4 py-3 text-left lg:flex-col lg:items-start lg:p-5";

function Choice({
  to,
  title,
  description,
  action,
}: {
  to: string;
  title: string;
  description: ReactNode;
  action: string;
}) {
  return (
    <li>
      <Link to={to} className={`${row} h-full hover:bg-surface-hover`}>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-semibold">{title}</span>
          <span className="mt-0.5 block text-[13px] leading-[18px] text-muted">{description}</span>
        </span>
        <span className="hidden text-[15px] font-semibold text-accent lg:block">{action}</span>
        <ChevronRightIcon
          aria-hidden="true"
          width={18}
          height={18}
          className="shrink-0 text-muted lg:hidden"
        />
      </Link>
    </li>
  );
}

/** Z1b: three ways to set the baseline. Each ends in a confirm step; none of them saves on its own. */
export function UpdatePage() {
  const power = useHasPowerRides();
  const noPower = power.data === false;
  return (
    <div className="max-w-[640px] lg:max-w-none">
      <p className="mb-4 text-[15px]">
        How do you want to set your baseline? Nothing changes until you confirm.
      </p>
      <ul className="grid gap-3 lg:grid-cols-3">
        {noPower ? (
          <li>
            <div aria-disabled="true" className={`${row} h-full text-muted`}>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-semibold">Suggest from my rides</span>
                <span className="mt-0.5 block text-[13px] leading-[18px]">
                  No rides with power data yet. Import rides, or use one of the other ways.
                </span>
              </span>
            </div>
          </li>
        ) : (
          <Choice
            to="/baseline/suggestion"
            title="Suggest from my rides"
            description="Best 20-minute power from your rides with power data. Sets FTP."
            action="Look at my rides"
          />
        )}
        <Choice
          to="/baseline/values"
          title="Enter values"
          description="Type FTP, max heart rate, LTHR or resting heart rate."
          action="Enter values"
        />
        <Choice
          to="/baseline/test-week"
          title="Do a guided test week"
          description="A 20-minute or ramp test on days you choose. Sets FTP, and LTHR from the 20-minute test."
          action="Plan a test week"
        />
      </ul>
      <p className="mt-4 text-[13px] text-muted">Previous values stay in the history.</p>
    </div>
  );
}

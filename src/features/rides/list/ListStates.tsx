import { Link } from "react-router";
import { buttonClass } from "@/components/button-class";
import { RidesIcon } from "@/components/icons";

/** B2: no rides yet. On desktop the content sits in a card. */
export function RidesEmpty() {
  return (
    <section
      aria-labelledby="rides-empty-title"
      className="max-w-[520px] pt-16 lg:rounded-2xl lg:bg-surface lg:p-8"
    >
      <div className="mb-4 flex size-14 items-center justify-center rounded-[12px] bg-fill text-accent">
        <RidesIcon width={24} height={24} />
      </div>
      <h2 id="rides-empty-title" className="text-2xl leading-[30px] font-semibold tracking-tight">
        No rides yet
      </h2>
      <p className="mt-3 text-[15px] leading-[22px]">
        Import the file from the Cycling Hub extension to see your rides here.
      </p>
      <Link to="/import" className={buttonClass("primary", "mt-5")}>
        Import rides
      </Link>
    </section>
  );
}

const pulse = "motion-safe:animate-[pulse_1.6s_ease-in-out_infinite]";

/** B3a: skeleton cards (phone) or rows (desktop) in the fill tone; screen readers hear "Loading rides". */
export function RidesSkeleton({ desktop }: { desktop: boolean }) {
  return (
    <div role="status">
      <span className="sr-only">Loading rides</span>
      {desktop ? (
        <div aria-hidden="true" className={`rounded-2xl bg-surface px-4 py-3 ${pulse}`}>
          <div className="mb-4 h-4 w-full rounded-[8px] bg-fill" />
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="flex h-11 items-center gap-6">
              <div className="h-3.5 w-40 rounded-[8px] bg-fill" />
              <div className="h-3.5 w-48 rounded-[8px] bg-fill" />
              <div className="ml-auto h-3.5 w-80 rounded-[8px] bg-fill" />
            </div>
          ))}
        </div>
      ) : (
        <div aria-hidden="true" className={`flex flex-col gap-2.5 ${pulse}`}>
          <div className="mb-1 flex justify-between">
            <div className="h-3.5 w-36 rounded-[8px] bg-fill" />
            <div className="h-3.5 w-28 rounded-[8px] bg-fill" />
          </div>
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="rounded-2xl bg-surface p-4">
              <div className="flex items-center gap-3">
                <div className="size-11 rounded-[12px] bg-fill" />
                <div className="flex flex-1 flex-col gap-2">
                  <div className="h-3.5 w-3/5 rounded-[8px] bg-fill" />
                  <div className="h-3 w-2/5 rounded-[8px] bg-fill" />
                </div>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2.5">
                {Array.from({ length: 6 }, (_, j) => (
                  <div key={j} className="h-10 rounded-[8px] bg-fill" />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Nothing matches the filters (X1): one sentence and Clear filters. */
export function NoMatches({ onClear }: { onClear: () => void }) {
  return (
    <div className="flex flex-col items-start gap-2 rounded-2xl bg-surface px-5 py-6">
      <p className="text-[15px]">No rides match these filters.</p>
      <button
        type="button"
        onClick={onClear}
        className="-ml-3 inline-flex min-h-11 items-center rounded-[12px] px-3 text-[15px] font-semibold text-accent hover:bg-accent-soft"
      >
        Clear filters
      </button>
    </div>
  );
}

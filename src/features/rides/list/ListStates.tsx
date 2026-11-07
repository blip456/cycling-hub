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
      <div className="mb-4 flex size-14 items-center justify-center rounded-md bg-fill text-accent">
        <RidesIcon width={24} height={24} />
      </div>
      <h2 id="rides-empty-title" className="text-heading">
        No rides yet
      </h2>
      <p className="mt-3 text-body">
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
          <div className="mb-4 h-4 w-full rounded-sm bg-fill" />
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="flex h-11 items-center gap-6">
              <div className="h-3.5 w-40 rounded-sm bg-fill" />
              <div className="h-3.5 w-48 rounded-sm bg-fill" />
              <div className="ml-auto h-3.5 w-80 rounded-sm bg-fill" />
            </div>
          ))}
        </div>
      ) : (
        <div aria-hidden="true" className={`flex flex-col gap-2.5 ${pulse}`}>
          <div className="mb-1 flex justify-between">
            <div className="h-3.5 w-36 rounded-sm bg-fill" />
            <div className="h-3.5 w-28 rounded-sm bg-fill" />
          </div>
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="rounded-2xl bg-surface p-4">
              <div className="flex items-center gap-3">
                <div className="size-11 rounded-md bg-fill" />
                <div className="flex flex-1 flex-col gap-2">
                  <div className="h-3.5 w-3/5 rounded-sm bg-fill" />
                  <div className="h-3 w-2/5 rounded-sm bg-fill" />
                </div>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2.5">
                {Array.from({ length: 6 }, (_, j) => (
                  <div key={j} className="h-10 rounded-sm bg-fill" />
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
      <p className="text-body">No rides match these filters.</p>
      <button type="button" onClick={onClear} className={buttonClass("ghost", "-ml-5")}>
        Clear filters
      </button>
    </div>
  );
}

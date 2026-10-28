import { useId } from "react";
import { Checkbox, FieldLabel, SelectField } from "./controls";
import { fieldClass } from "./field-class";
import type { ListState, RideType } from "./list-state";

const TYPE_OPTIONS: { value: RideType; label: string }[] = [
  { value: "all", label: "All types" },
  { value: "road", label: "Road" },
  { value: "gravel", label: "Gravel" },
  { value: "mtb", label: "MTB" },
  { value: "ebike", label: "E-bike" },
  { value: "indoor", label: "Indoor" },
  { value: "commute", label: "Commute" },
];

function SearchIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width={18}
      height={18}
      aria-hidden="true"
      focusable={false}
      className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-muted"
    >
      <circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="m16 16 4 4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * X1 filter bar (P35): name search, type, period (with a custom range), hide commutes and, once a
 * filter is on, Clear filters. Labels above, fields empty by default, no placeholders.
 */
export function FilterBar({
  state,
  searchText,
  onSearchText,
  years,
  filtered,
  onChange,
  onClear,
}: {
  state: ListState;
  /** The search field's text; it reaches the URL (state.q) after a short pause in typing. */
  searchText: string;
  onSearchText: (text: string) => void;
  /** Earlier years with rides, newest first. */
  years: readonly string[];
  filtered: boolean;
  onChange: (patch: Partial<ListState>) => void;
  onClear: () => void;
}) {
  const id = useId();
  return (
    <div
      role="search"
      aria-label="Filter rides"
      className="flex flex-wrap items-end gap-x-3 gap-y-3"
    >
      <div className="w-60">
        <FieldLabel htmlFor={`${id}-q`}>Search by name</FieldLabel>
        <div className="relative">
          <SearchIcon />
          <input
            id={`${id}-q`}
            type="search"
            autoComplete="off"
            spellCheck={false}
            value={searchText}
            onChange={(e) => {
              onSearchText(e.target.value);
            }}
            className={`${fieldClass} pl-10`}
          />
        </div>
      </div>
      <SelectField
        label="Type"
        className="w-[156px]"
        value={state.type}
        onChange={(e) => {
          onChange({ type: e.target.value as RideType });
        }}
      >
        {TYPE_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </SelectField>
      <SelectField
        label="Period"
        className="w-[172px]"
        value={state.period}
        onChange={(e) => {
          onChange({ period: e.target.value, from: "", to: "" });
        }}
      >
        <option value="all">All time</option>
        <option value="4w">Last 4 weeks</option>
        <option value="3m">Last 3 months</option>
        <option value="year">This year</option>
        {years.map((year) => (
          <option key={year} value={year}>
            {year}
          </option>
        ))}
        {/^\d{4}$/.test(state.period) && !years.includes(state.period) ? (
          <option value={state.period}>{state.period}</option>
        ) : null}
        <option value="custom">Custom range</option>
      </SelectField>
      {state.period === "custom" ? (
        <>
          <div className="w-[156px]">
            <FieldLabel htmlFor={`${id}-from`}>From</FieldLabel>
            <input
              id={`${id}-from`}
              type="date"
              value={state.from}
              max={state.to || undefined}
              onChange={(e) => {
                onChange({ from: e.target.value });
              }}
              className={fieldClass}
            />
          </div>
          <div className="w-[156px]">
            <FieldLabel htmlFor={`${id}-to`}>To</FieldLabel>
            <input
              id={`${id}-to`}
              type="date"
              value={state.to}
              min={state.from || undefined}
              onChange={(e) => {
                onChange({ to: e.target.value });
              }}
              className={fieldClass}
            />
          </div>
        </>
      ) : null}
      <Checkbox
        checked={state.hideCommutes}
        onChange={(hideCommutes) => {
          onChange({ hideCommutes });
        }}
      >
        Hide commutes
      </Checkbox>
      {filtered ? (
        <button
          type="button"
          onClick={onClear}
          className="ml-auto inline-flex min-h-11 items-center rounded-[12px] px-3 text-[15px] font-semibold text-accent transition-colors duration-(--dur-fast) hover:bg-accent-soft"
        >
          Clear filters
        </button>
      ) : null}
    </div>
  );
}

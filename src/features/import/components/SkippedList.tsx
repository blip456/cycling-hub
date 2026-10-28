import { useId } from "react";
import { formatLocalDate } from "../format";
import type { SkippedActivity } from "../parse";

/** Activities that were skipped, with their position in the file and the reasons (C3, P14). */
export function SkippedList({ skipped }: { skipped: SkippedActivity[] }) {
  const headingId = useId();
  if (skipped.length === 0) return null;
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-2">
      <h3 id={headingId} className="mt-2 text-[15px] font-semibold">
        Skipped (errors)
      </h3>
      <ul className="overflow-hidden rounded-2xl bg-surface">
        {skipped.map((s) => {
          const what = [s.name, s.startLocal ? formatLocalDate(s.startLocal) : null]
            .filter((part) => part !== null && part !== "")
            .join(", ");
          return (
            <li
              key={s.index}
              className="flex flex-col gap-0.5 border-border px-4 py-3 not-first:border-t"
            >
              <span className="tabular-nums">
                Activity {s.index + 1}
                {what ? ` · ${what}` : ""}
              </span>
              {s.issues.map((issue) => (
                <span key={issue.path} className="text-[13px] break-words text-muted">
                  <code className="font-sans">{issue.path}</code> {issue.message}
                </span>
              ))}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

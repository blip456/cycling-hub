import type { EditPreview } from "./use-edit-preview";

function previewText(preview: EditPreview): string {
  if (preview.status === "loading") return "Checking what this changes in your sessions.";
  if (preview.status === "error")
    return "We could not check what changes in your sessions. You can still save.";
  if (preview.changed === 0) return "No planned session changes.";
  return `${String(preview.changed)} planned ${preview.changed === 1 ? "session" : "sessions"} will change.`;
}

/**
 * What an edit changes, in plain words (P81): the answers that differ, how many planned sessions that touches, and
 * what stays as it is. The engine's own notices and warnings are in "What the plan will assume" next to it.
 */
export function EditChanges({
  lines,
  preview,
}: {
  lines: readonly string[];
  preview: EditPreview;
}) {
  return (
    <section aria-labelledby="edit-changes" className="rounded-2xl bg-surface px-4 py-4">
      <h3 id="edit-changes" className="mb-1 text-[17px] font-semibold">
        What will change
      </h3>
      {lines.length === 0 ? (
        <p className="text-[15px]">You have not changed any answer.</p>
      ) : (
        <ul className="flex list-disc flex-col gap-1 pl-5 text-[15px]">
          {lines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      )}
      <p role="status" className="mt-3 text-[15px] font-semibold">
        {previewText(preview)}
      </p>
      <p className="mt-1 text-[15px] text-muted">
        Only sessions that have not happened yet are recalculated. Sessions in the past, sessions
        you marked as done or missed, and sessions you matched to a ride by hand stay as they are,
        and so do the start date and the history of your plan. You can undo the update right after
        saving.
      </p>
    </section>
  );
}

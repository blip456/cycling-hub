import { useEffect, useId, useRef, type ReactNode } from "react";
import { buttonClass } from "@/components/button-class";

interface SectionCardProps {
  title: string;
  editing: boolean;
  onEdit: () => void;
  /** True when the section has no value yet: the card shows `emptyText` and an add button. */
  empty: boolean;
  emptyText: string;
  addLabel: string;
  /** The read view, shown when the section has values. */
  view: ReactNode;
  /** The form, shown while editing; it brings its own Save and Cancel. */
  form: ReactNode;
}

/**
 * One profile section (H1 to H3): a card with its own Edit button, or its own add button when empty.
 * Editing opens the form in place and leaves the other sections alone. When the form closes, focus goes
 * back to the button that opened it.
 */
export function SectionCard({
  title,
  editing,
  onEdit,
  empty,
  emptyText,
  addLabel,
  view,
  form,
}: SectionCardProps) {
  const headingId = useId();
  const actionRef = useRef<HTMLButtonElement>(null);
  const wasEditing = useRef(false);

  useEffect(() => {
    if (wasEditing.current && !editing) actionRef.current?.focus();
    wasEditing.current = editing;
  }, [editing]);

  return (
    <section
      aria-labelledby={headingId}
      className={
        "rounded-2xl bg-surface p-4 " + (editing ? "outline-2 -outline-offset-2 outline-text" : "")
      }
    >
      <div className="flex min-h-11 items-center justify-between gap-3">
        <h2 id={headingId} className="text-[17px] font-semibold">
          {title}
        </h2>
        {!editing && !empty ? (
          <button
            ref={actionRef}
            type="button"
            className={buttonClass("secondary")}
            onClick={onEdit}
            aria-label={`Edit ${title}`}
          >
            Edit
          </button>
        ) : null}
      </div>
      {editing ? (
        form
      ) : empty ? (
        <>
          <p className="mt-1 text-[15px] text-muted">{emptyText}</p>
          <button
            ref={actionRef}
            type="button"
            className={buttonClass("secondary", "mt-3 w-full")}
            onClick={onEdit}
          >
            {addLabel}
          </button>
        </>
      ) : (
        view
      )}
    </section>
  );
}

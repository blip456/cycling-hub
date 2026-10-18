import { useId } from "react";
import { buttonClass } from "@/components/button-class";
import { ACCEPT, takeFile } from "../file-input";
import { FileIcon, UploadIcon } from "../icons";

/**
 * C1 / X2: the whole card is the target. It is a <label> for the file input, so a tap anywhere opens the
 * file picker; the input itself stays in the tab order (visually hidden) and shows the focus ring on the
 * card. While a file is dragged over the page (desktop) the card switches to the drop state.
 */
export function FilePicker({
  dragging,
  onFile,
}: {
  dragging: boolean;
  onFile: (file: File) => void;
}) {
  const id = useId();
  const titleId = `${id}-title`;
  const helpId = `${id}-help`;
  const buttonId = `${id}-button`;

  return (
    <label
      htmlFor={id}
      className={
        "flex cursor-pointer flex-col items-center gap-3 rounded-2xl px-5 py-8 text-center transition-colors " +
        "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent " +
        (dragging
          ? "bg-accent-soft shadow-[inset_0_0_0_2px_var(--accent)] lg:py-16"
          : "bg-surface hover:bg-(--surface-hover) lg:py-12")
      }
    >
      <span
        className={
          "flex size-14 items-center justify-center rounded-2xl text-accent " +
          (dragging ? "bg-surface" : "bg-fill")
        }
      >
        {dragging ? <UploadIcon width={28} height={28} /> : <FileIcon width={28} height={28} />}
      </span>
      <span id={titleId} className="text-xl font-semibold tracking-tight">
        {dragging ? "Drop the file to import" : "Choose your export file"}
      </span>
      <span id={helpId} className="max-w-[30ch] text-[13px] text-muted">
        {dragging
          ? "One .json file from the Cycling Hub extension."
          : "The .json file from the Cycling Hub extension."}
      </span>
      {dragging ? null : (
        <span id={buttonId} aria-hidden="true" className={buttonClass("primary", "mt-1")}>
          Choose file
        </span>
      )}
      <input
        id={id}
        type="file"
        accept={ACCEPT}
        // Named after the visible button text (label in name), described by the card's title and help.
        aria-labelledby={dragging ? titleId : buttonId}
        aria-describedby={dragging ? helpId : `${titleId} ${helpId}`}
        className="sr-only"
        onChange={(event) => {
          const file = takeFile(event);
          if (file) onFile(file);
        }}
      />
    </label>
  );
}

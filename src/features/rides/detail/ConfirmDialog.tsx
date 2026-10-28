import { useEffect, useId, useRef, type ReactNode } from "react";

/**
 * A native modal <dialog> (DESIGN.md: --raised, radius 20, float shadow, --overlay scrim). The browser
 * traps focus, makes the page inert and closes it on Escape; `onClose` runs for every way it closes.
 * Phone: a sheet above the bottom edge; desktop: centred, 400 px wide. The action marked
 * `data-autofocus` gets the focus when it opens.
 */
export function ConfirmDialog({
  open,
  title,
  children,
  actions,
  onClose,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  /** The buttons, first one on top. */
  actions: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const bodyId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      dialog.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    }
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    // Native modal dialog: Esc closes it via the keyboard; the click handler only adds "tap the
    // backdrop to close", which has no keyboard equivalent to provide.
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={bodyId}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) e.currentTarget.close();
      }}
      className={
        "confirm-dialog m-0 mt-auto mx-3 mb-[max(1rem,env(safe-area-inset-bottom))] w-auto max-w-none rounded-[20px] bg-raised p-5 text-text shadow-raised " +
        "backdrop:bg-[var(--overlay)] lg:m-auto lg:w-[400px]"
      }
    >
      <h2 id={titleId} className="text-xl leading-[26px] font-semibold tracking-tight">
        {title}
      </h2>
      <div id={bodyId} className="mt-3 text-[15px] leading-[22px] text-muted">
        {children}
      </div>
      <div className="mt-4 flex flex-col gap-3">{actions}</div>
    </dialog>
  );
}

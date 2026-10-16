import type { ReactNode } from "react";
import { CloseIcon } from "./icons";

/** Bottom-of-page status card (P12), used for confirmations and the update prompt. */
export function StatusCard({
  children,
  action,
  onDismiss,
}: {
  children: ReactNode;
  action?: ReactNode;
  onDismiss?: () => void;
}) {
  return (
    <div
      role="status"
      className="fixed inset-x-3 bottom-[max(1rem,env(safe-area-inset-bottom))] z-40 mx-auto flex max-w-md items-center gap-3 rounded-2xl bg-raised py-2 pl-4 pr-2 text-[15px] shadow-raised lg:left-56"
    >
      <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-accent" />
      <span className="min-w-0 flex-1 py-2">{children}</span>
      {action}
      {onDismiss ? (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="flex size-11 shrink-0 items-center justify-center rounded-xl text-muted hover:bg-border hover:text-text"
        >
          <CloseIcon width={18} height={18} />
        </button>
      ) : null}
    </div>
  );
}

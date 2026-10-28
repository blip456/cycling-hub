import { AlertIcon, CloseIcon } from "../icons";
import type { StatusCardSpec, StatusPlacement } from "./status-context";

const DOT_COLOR = { info: "bg-accent", success: "bg-positive" } as const;

/**
 * The status card itself (DS7, DS8). Floating (phone): one row, float shadow, above the bottom edge.
 * Side (desktop): inside the side menu, no shadow, message wraps and the action goes on a second line.
 */
export function StatusCard({
  spec,
  placement,
}: {
  spec: StatusCardSpec;
  placement: StatusPlacement;
}) {
  const { tone, message, action, onDismiss } = spec;
  const side = placement === "side";

  const indicator =
    tone === "error" ? (
      <AlertIcon width={18} height={18} className="shrink-0 text-danger" />
    ) : (
      <span aria-hidden="true" className={`size-2 shrink-0 rounded-full ${DOT_COLOR[tone]}`} />
    );

  const dismiss = onDismiss ? (
    <button
      type="button"
      onClick={onDismiss}
      aria-label="Dismiss"
      className={
        "flex size-11 shrink-0 items-center justify-center rounded-xl text-muted hover:bg-fill hover:text-text " +
        (side ? "-mt-2.5 [grid-area:x]" : "")
      }
    >
      <CloseIcon width={18} height={18} />
    </button>
  ) : null;

  if (side) {
    return (
      <div
        role={tone === "error" ? "alert" : "status"}
        data-placement="side"
        className={
          "status-in grid grid-cols-[auto_minmax(0,1fr)_auto] gap-x-2.5 rounded-2xl bg-raised pb-1 pl-3.5 pt-3 text-[15px] leading-[22px] text-text " +
          "[grid-template-areas:'ic_msg_x'_'._act_x'] " +
          (onDismiss ? "pr-0.5" : "pr-3")
        }
      >
        <span className={"flex [grid-area:ic] " + (tone === "error" ? "mt-0.5" : "mt-[7px]")}>
          {indicator}
        </span>
        <span className={"min-w-0 [grid-area:msg] " + (action ? "" : "pb-2")}>{message}</span>
        {action ? <span className="-ml-2 [grid-area:act]">{action}</span> : null}
        {dismiss}
      </div>
    );
  }

  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      data-placement="floating"
      className="status-in fixed inset-x-3 bottom-[max(1rem,env(safe-area-inset-bottom))] z-40 mx-auto flex min-h-14 max-w-md items-center gap-2 rounded-2xl bg-raised py-1.5 pl-4 pr-1.5 text-[15px] leading-[22px] text-text shadow-raised"
    >
      {indicator}
      <span className="min-w-0 flex-1 py-2 pl-1">{message}</span>
      {action}
      {dismiss}
    </div>
  );
}

import { createContext, useContext, useEffect, type ReactNode } from "react";

/**
 * Status cards (P12, P31): one card at a time. Phone: a floating card above the bottom edge. Desktop
 * (≥ 960 px, inside the app shell): at the bottom of the permanent side menu, as wide as the menu.
 * Any component can ask for a card with useStatusCard; the StatusProvider shows the one that matters most.
 */
export type StatusTone = "info" | "success" | "error";

export interface StatusCardSpec {
  tone: StatusTone;
  message: ReactNode;
  /** A link or button styled with statusActionClass. */
  action?: ReactNode;
  /** A block under the message, for a card with a small form (the weight reminder, W3). */
  content?: ReactNode;
  onDismiss?: () => void;
}

/** Higher wins when several cards want to show; an error replaces an info card (DESIGN.md). */
export const STATUS_PRIORITY = {
  whatsNew: 10,
  /** The no-power-data warning (R7, P64): a lasting warning, so it goes below the reminder and the notices. */
  noPowerData: 12,
  /** The weight reminder goes before "What's new" (W-PO4, P52). */
  weightReminder: 15,
  /** "Plan updated" with Undo (R3, P71): the result of something that just happened, so it goes first. */
  planUpdated: 18,
  update: 20,
  flash: 30,
  error: 40,
} as const;

export type StatusPlacement = "floating" | "side";

export interface StatusRegistry {
  set: (id: string, priority: number, spec: StatusCardSpec | null) => void;
  /** The desktop side menu takes over the card while it is mounted; returns the release function. */
  claimSide: () => () => void;
}

export const StatusRegistryContext = createContext<StatusRegistry | null>(null);
export const CurrentStatusContext = createContext<StatusCardSpec | null>(null);

function useRegistry(): StatusRegistry {
  const registry = useContext(StatusRegistryContext);
  if (!registry) throw new Error("Status cards need a <StatusProvider>");
  return registry;
}

/** Shows `spec` as a status card while it is not null (and nothing more important is showing). */
export function useStatusCard(id: string, priority: number, spec: StatusCardSpec | null): void {
  const { set } = useRegistry();
  // Runs after every render so the card always has the latest message and callbacks. The registry
  // lives in another component, so this never re-renders the caller.
  useEffect(() => {
    set(id, priority, spec);
  });
  useEffect(
    () => () => {
      set(id, priority, null);
    },
    [set, id, priority],
  );
}

export function useClaimSidePlacement(active: boolean): void {
  const { claimSide } = useRegistry();
  useEffect(() => (active ? claimSide() : undefined), [active, claimSide]);
}

export function useCurrentStatus(): StatusCardSpec | null {
  return useContext(CurrentStatusContext);
}

/** Text-button look for the card's action (DESIGN.md: accent, 600, 44 px target). */
export const statusActionClass =
  "inline-flex min-h-11 shrink-0 items-center whitespace-nowrap rounded-md px-2 text-[15px] " +
  "font-semibold text-accent hover:bg-accent-soft";

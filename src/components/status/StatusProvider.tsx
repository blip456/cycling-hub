import { useCallback, useMemo, useState, type ReactNode } from "react";
import { StatusCard } from "./StatusCard";
import {
  CurrentStatusContext,
  StatusRegistryContext,
  type StatusCardSpec,
  type StatusRegistry,
} from "./status-context";

interface Entry {
  priority: number;
  spec: StatusCardSpec;
}

/**
 * Holds the requested status cards and shows the most important one. Without a desktop side menu
 * (phone, or the sign-in pages) it renders the card floating at the bottom of the page.
 */
export function StatusProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<ReadonlyMap<string, Entry>>(() => new Map());
  const [sideClaims, setSideClaims] = useState(0);

  const set = useCallback((id: string, priority: number, spec: StatusCardSpec | null) => {
    setEntries((prev) => {
      if (!spec && !prev.has(id)) return prev;
      const next = new Map(prev);
      if (spec) next.set(id, { priority, spec });
      else next.delete(id);
      return next;
    });
  }, []);

  const claimSide = useCallback(() => {
    setSideClaims((n) => n + 1);
    return () => {
      setSideClaims((n) => n - 1);
    };
  }, []);

  const registry = useMemo<StatusRegistry>(() => ({ set, claimSide }), [set, claimSide]);

  const current = useMemo(() => {
    let best: Entry | null = null;
    for (const entry of entries.values()) {
      if (!best || entry.priority > best.priority) best = entry;
    }
    return best?.spec ?? null;
  }, [entries]);

  return (
    <StatusRegistryContext.Provider value={registry}>
      <CurrentStatusContext.Provider value={current}>
        {children}
        {current && sideClaims === 0 ? <StatusCard spec={current} placement="floating" /> : null}
      </CurrentStatusContext.Provider>
    </StatusRegistryContext.Provider>
  );
}

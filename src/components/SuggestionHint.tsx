import type { ReactNode } from "react";
import { Button } from "./ui";

/**
 * A suggestion from the rides under a field or question: a plain sentence and, when given, a button that
 * takes the suggested value over. Wire it to the field with `aria-describedby` through `id`.
 */
export function SuggestionHint({
  id,
  children,
  actionLabel,
  onUse,
}: {
  id: string;
  children: ReactNode;
  actionLabel?: string;
  onUse?: () => void;
}) {
  return (
    <div className="mt-1.5 flex flex-col items-start gap-2">
      <p id={id} className="text-caption text-muted">
        {children}
      </p>
      {actionLabel && onUse ? (
        <Button variant="secondary" onClick={onUse}>
          {actionLabel}
        </Button>
      ) : null}
    </div>
  );
}

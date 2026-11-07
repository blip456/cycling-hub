import type { ReactNode } from "react";
import { AlertIcon } from "@/components/icons";
import { Button } from "@/components/ui";

export type SectionId = "about" | "week" | "purposes" | "level" | "event" | "goal";

/** How a section tells the page that a save failed ("Not saved" card, P12) or is no longer relevant. */
export type SaveReport = {
  fail: (section: SectionId, message: string) => void;
  clear: (section: SectionId) => void;
};

export function FormButtons({ saving, onCancel }: { saving: boolean; onCancel: () => void }) {
  return (
    <div className="mt-5 flex gap-3">
      <Button type="submit" disabled={saving}>
        {saving ? "Saving…" : "Save"}
      </Button>
      <Button variant="secondary" onClick={onCancel} disabled={saving}>
        Cancel
      </Button>
    </div>
  );
}

export function ViewRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-h-11 items-center justify-between gap-4 text-body">
      <span className="text-muted">{label}</span>
      <span className="min-w-0 break-words text-right">{children}</span>
    </div>
  );
}

export function NotSet() {
  return <span className="text-muted">Not set</span>;
}

/** A field error under the field: alert icon and text in the danger colour (never colour alone). */
export function FieldError({
  id,
  role,
  className = "mt-1.5",
  children,
}: {
  id?: string;
  role?: "alert";
  className?: string;
  children: ReactNode;
}) {
  return (
    <p
      id={id}
      role={role}
      className={`flex items-start gap-1.5 text-caption font-medium text-danger ${className}`}
    >
      <AlertIcon width={16} height={16} className="mt-px shrink-0" />
      <span>{children}</span>
    </p>
  );
}

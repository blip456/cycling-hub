import type { ReactNode } from "react";
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
    <div className="flex min-h-11 items-center justify-between gap-4 text-[15px]">
      <span className="text-muted">{label}</span>
      <span className="min-w-0 break-words text-right">{children}</span>
    </div>
  );
}

export function NotSet() {
  return <span className="text-muted">Not set</span>;
}

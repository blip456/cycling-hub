import type { ReactNode } from "react";

// Group rows (DESIGN.md "Card and group"): 52 px, a 1 px divider inset 16 px between rows.
export const row =
  "relative flex min-h-[52px] items-center gap-3 px-4 text-[15px] " +
  "not-first:before:absolute not-first:before:left-4 not-first:before:right-0 not-first:before:top-0 " +
  "not-first:before:border-t not-first:before:border-border";

// Rows that act: hover tone step; the focus ring sits inside so the rounded group does not clip it.
export const actionRow = `${row} w-full text-left hover:bg-surface-hover focus-visible:-outline-offset-2`;

/** A titled group of rows on the Settings page. */
export function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 text-[15px] font-semibold">{title}</h2>
      <div className="overflow-hidden rounded-2xl bg-surface">{children}</div>
    </section>
  );
}

/** A label on the left and a read-only value on the right. */
export function InfoRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className={row}>
      <span className="shrink-0 grow">{label}</span>
      <span className="min-w-0 truncate text-right text-muted">{value}</span>
    </div>
  );
}

import type { ChangeType } from "./data";

const LABELS: Record<ChangeType, { text: string; className: string }> = {
  feature: { text: "Feature", className: "bg-accent-soft text-accent" },
  fix: { text: "Fix", className: "bg-positive-soft text-positive" },
  technical: { text: "Technical", className: "bg-fill text-muted" },
};

/** P18: the change-type label, the only pill in the app (P24). */
export function ChangeLabel({ type }: { type: ChangeType }) {
  const { text, className } = LABELS[type];
  return (
    <span
      className={`inline-flex h-6 items-center justify-self-start whitespace-nowrap rounded-full px-2.5 text-[13px] font-medium leading-none ${className}`}
    >
      {text}
    </span>
  );
}

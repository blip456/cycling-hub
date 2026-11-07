import { EmptyState } from "@/components/ui";
import { roadmap, type RoadmapItem } from "@/features/release/data";

const STATUS_TEXT: Record<RoadmapItem["status"], string> = {
  planned: "Planned",
  "in progress": "In progress",
  shipped: "Shipped",
};

/** G3: the coming sprints from docs/backlog.md (build time): version, title, sprint, status, tagline (P18). */
export function WhatsNextPage({ items = roadmap }: { items?: RoadmapItem[] }) {
  if (items.length === 0) {
    return (
      <div className="max-w-[640px]">
        <EmptyState>Nothing planned yet.</EmptyState>
      </div>
    );
  }

  return (
    <div className="flex max-w-[640px] flex-col gap-3">
      <p className="px-0.5 text-caption text-muted">Plans can change.</p>
      {items.map((item) => (
        <section
          key={item.version}
          aria-labelledby={`next-${item.version}`}
          className="flex flex-col gap-2 rounded-lg bg-surface p-4"
        >
          <div className="flex items-start justify-between gap-3">
            <h2 id={`next-${item.version}`} className="text-title">
              {item.title}
            </h2>
            <p
              className={
                "shrink-0 pt-1 text-caption " +
                (item.status === "in progress" ? "font-semibold text-accent" : "text-muted")
              }
            >
              {STATUS_TEXT[item.status]}
            </p>
          </div>
          <p className="text-caption text-muted tabular-nums">
            v{item.version} · Sprint {item.sprint}
          </p>
          <p className="text-body">{item.tagline}</p>
        </section>
      ))}
    </div>
  );
}

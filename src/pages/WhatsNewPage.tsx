import { useEffect, useRef, useState } from "react";
import { EmptyState } from "@/components/ui";
import { ChangeLabel } from "@/features/release/ChangeLabel";
import { changelog, type Release } from "@/features/release/data";
import { useWhatsNew } from "@/features/release/use-whats-new";
import {
  APP_VERSION,
  compareVersions,
  formatReleaseDate,
  isNewerThanSeen,
} from "@/features/release/version";

/**
 * G2: the changelog, built from CHANGELOG.md at build time. Versions the user had not seen when the page
 * opened are marked New; opening the page stores the running version as seen (B1d).
 */
export function WhatsNewPage({
  releases = changelog,
  currentVersion = APP_VERSION,
}: {
  releases?: Release[];
  currentVersion?: string;
}) {
  const { state, lastSeen, markSeen } = useWhatsNew(currentVersion);

  // Remember what was unseen on arrival, so the New marks stay while the page is open
  // (state derived during render, the pattern React recommends over an effect).
  const [unseenSince, setUnseenSince] = useState<string | null>(null);
  if (state === "updated" && lastSeen && unseenSince === null) setUnseenSince(lastSeen);

  // Store the version as seen once per visit (no retry loop when saving fails).
  const marked = useRef(false);
  useEffect(() => {
    if (state === "updated" && !marked.current) {
      marked.current = true;
      markSeen();
    }
  }, [state, markSeen]);

  const isNew = (version: string) =>
    unseenSince !== null &&
    isNewerThanSeen(version, unseenSince) &&
    (compareVersions(version, currentVersion) ?? 1) <= 0;

  if (releases.length === 0) {
    return (
      <div className="max-w-[640px]">
        <EmptyState>No releases yet.</EmptyState>
      </div>
    );
  }

  return (
    <div className="flex max-w-[640px] flex-col gap-3">
      {releases.map((release) => (
        <section
          key={release.version}
          aria-labelledby={`release-${release.version}`}
          className="flex flex-col gap-4 rounded-2xl bg-surface p-4"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-col">
              <h2
                id={`release-${release.version}`}
                className="text-xl font-semibold tracking-tight tabular-nums"
              >
                v{release.version}
              </h2>
              {release.date ? (
                <p className="text-[13px] text-muted tabular-nums">
                  {formatReleaseDate(release.date)}
                </p>
              ) : null}
            </div>
            {isNew(release.version) ? (
              <p className="flex items-center gap-1.5 pt-1 text-[13px] font-semibold text-accent">
                <span aria-hidden="true" className="size-[7px] rounded-full bg-accent" />
                New
              </p>
            ) : null}
          </div>
          {release.entries.length > 0 ? (
            <ul className="flex flex-col gap-2.5">
              {release.entries.map((entry, index) => (
                <li
                  // Entries have no id and are never reordered.
                  key={`${entry.type}-${index}`}
                  className="grid grid-cols-[84px_minmax(0,1fr)] items-start gap-x-3 text-[15px] leading-[22px]"
                >
                  <ChangeLabel type={entry.type} />
                  <span>{entry.text}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[15px] text-muted">Maintenance release.</p>
          )}
        </section>
      ))}
    </div>
  );
}

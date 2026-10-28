import { useMutation } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { Link, useNavigate } from "react-router";
import { ChevronRightIcon } from "@/components/icons";
import { ThemeSwitch } from "@/features/settings/ThemeSwitch";
import { APP_VERSION } from "@/features/release/version";
import { useAuth } from "@/lib/auth/auth-context";

// Group rows (DESIGN.md "Card and group"): 52 px, a 1 px divider inset 16 px between rows.
const row =
  "relative flex min-h-[52px] items-center gap-3 px-4 text-[15px] " +
  "not-first:before:absolute not-first:before:left-4 not-first:before:right-0 not-first:before:top-0 " +
  "not-first:before:border-t not-first:before:border-border";
// Rows that act: hover tone step; the focus ring sits inside so the rounded group does not clip it.
const actionRow = `${row} w-full text-left hover:bg-surface-hover focus-visible:-outline-offset-2`;

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 text-[15px] font-semibold">{title}</h2>
      <div className="overflow-hidden rounded-2xl bg-surface">{children}</div>
    </section>
  );
}

function InfoRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className={row}>
      <span className="shrink-0 grow">{label}</span>
      <span className="min-w-0 truncate text-right text-muted">{value}</span>
    </div>
  );
}

function LinkRow({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className={actionRow}>
      <span className="grow">{children}</span>
      <ChevronRightIcon className="text-muted" />
    </Link>
  );
}

/** G1: account, appearance (P9), units and time zone (info, P6), version and release pages. */
export function SettingsPage() {
  const { signOut, session } = useAuth();
  const navigate = useNavigate();
  const mutation = useMutation({
    mutationFn: signOut,
    onSettled: () => void navigate("/sign-in", { replace: true }),
  });

  return (
    <div className="flex max-w-[560px] flex-col gap-5">
      <Group title="Account">
        {session?.user.email ? <InfoRow label="Email" value={session.user.email} /> : null}
        <button
          type="button"
          className={`${actionRow} font-semibold text-accent disabled:cursor-not-allowed disabled:text-muted`}
          onClick={() => {
            mutation.mutate();
          }}
          disabled={mutation.isPending}
        >
          {mutation.isPending ? "Signing out…" : "Sign out"}
        </button>
      </Group>

      <Group title="Appearance">
        <ThemeSwitch />
      </Group>

      <Group title="Units and time">
        <InfoRow label="Units" value="Metric · km, km/h, W, bpm" />
        <InfoRow label="Time zone" value="Europe/Brussels" />
      </Group>

      <Group title="About">
        <InfoRow label="Version" value={<span className="tabular-nums">{APP_VERSION}</span>} />
        <LinkRow to="/settings/whats-new">What&apos;s new</LinkRow>
        <LinkRow to="/settings/whats-next">What&apos;s next</LinkRow>
      </Group>
    </div>
  );
}

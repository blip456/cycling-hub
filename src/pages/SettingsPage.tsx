import { useMutation } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { Link, useNavigate } from "react-router";
import { ChevronRightIcon } from "@/components/icons";
import { actionRow, Group, InfoRow } from "@/features/settings/SettingsGroup";
import { ThemeSwitch } from "@/features/settings/ThemeSwitch";
import { WeightReminderSettings } from "@/features/settings/WeightReminderSettings";
import { APP_VERSION } from "@/features/release/version";
import { useAuth } from "@/lib/auth/auth-context";

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

      {/* owned by settings stream */}
      <WeightReminderSettings />

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

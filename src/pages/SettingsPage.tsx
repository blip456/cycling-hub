import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import { Button } from "@/components/ui";
import { useAuth } from "@/lib/auth/auth-context";

/** G1 placeholder: version and sign out. Theme switch, What's new and What's next arrive in Sprint 1. */
export function SettingsPage() {
  const { signOut, session } = useAuth();
  const navigate = useNavigate();
  const mutation = useMutation({
    mutationFn: signOut,
    onSettled: () => void navigate("/sign-in", { replace: true }),
  });

  return (
    <div className="flex max-w-xl flex-col gap-4">
      <dl className="overflow-hidden rounded-2xl bg-surface">
        {session?.user.email ? (
          <div className="flex min-h-12 items-center gap-3 px-4">
            <dt className="flex-1 text-[15px]">Account</dt>
            <dd className="min-w-0 truncate text-[15px] text-muted">{session.user.email}</dd>
          </div>
        ) : null}
        <div className="flex min-h-12 items-center gap-3 border-t border-border px-4 first:border-t-0">
          <dt className="flex-1 text-[15px]">Version</dt>
          <dd className="text-[15px] text-muted tabular-nums">{__APP_VERSION__}</dd>
        </div>
      </dl>
      <Button variant="secondary" block className="sm:w-auto sm:self-start" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
        {mutation.isPending ? "Signing out…" : "Sign out"}
      </Button>
    </div>
  );
}

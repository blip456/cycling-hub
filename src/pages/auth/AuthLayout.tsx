import { useEffect, type ReactNode } from "react";
import { Link } from "react-router";
import { BackIcon } from "@/components/icons";

interface AuthLayoutProps {
  title: string;
  /** Shown as a back link in the top bar (A3, A4). */
  back?: { to: string; label: string };
  children: ReactNode;
}

/** Layout for the signed-out screens A1–A5: wordmark, one heading, a narrow column. */
export function AuthLayout({ title, back, children }: AuthLayoutProps) {
  useEffect(() => {
    document.title = `${title} · Cycling Hub`;
  }, [title]);

  return (
    <div className="flex min-h-dvh flex-col px-4 pb-10 pt-[max(0.75rem,env(safe-area-inset-top))]">
      <div className="flex h-14 items-center">
        {back ? (
          <Link
            to={back.to}
            className="-ml-2 flex min-h-11 items-center gap-1 rounded-md px-2 text-[15px] font-semibold text-text hover:bg-subtle"
          >
            <BackIcon />
            {back.label}
          </Link>
        ) : null}
      </div>
      <main className="mx-auto w-full max-w-sm flex-1 sm:pt-[8vh]">
        <p className="mb-8 text-lg font-semibold tracking-tight text-text">Cycling Hub</p>
        <h1 className="mb-6 text-2xl font-semibold tracking-tight">{title}</h1>
        {children}
      </main>
    </div>
  );
}

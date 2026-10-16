/** Shown when the Supabase env vars are missing, instead of a blank screen. */
export function ConfigErrorPage({ message }: { message: string }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center gap-4 px-4">
      <h1 className="text-2xl font-semibold tracking-tight">App not configured</h1>
      <p role="alert" className="text-[15px] text-muted">
        {message}
      </p>
    </main>
  );
}

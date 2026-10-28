/** Fallback while a lazy-loaded page downloads. Screen readers hear "Loading". */
export function PageLoading() {
  return (
    <div role="status">
      <span className="sr-only">Loading</span>
      <div
        aria-hidden="true"
        className="h-24 max-w-[560px] rounded-2xl bg-surface motion-safe:animate-[pulse_1.6s_ease-in-out_infinite]"
      />
    </div>
  );
}

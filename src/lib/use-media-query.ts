import { useCallback, useSyncExternalStore } from "react";

/** Desktop layout: permanent side menu, status cards inside it (DESIGN.md, P31). */
export const DESKTOP_QUERY = "(min-width: 960px)";

/** The MediaQueryList, or null where matchMedia is missing (jsdom in tests). */
function mediaQueryList(query: string): MediaQueryList | null {
  const { matchMedia } = window as Partial<Window>;
  return typeof matchMedia === "function" ? window.matchMedia(query) : null;
}

/** Live result of a CSS media query; false where matchMedia is missing. */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const mql = mediaQueryList(query);
      mql?.addEventListener("change", onChange);
      return () => {
        mql?.removeEventListener("change", onChange);
      };
    },
    [query],
  );
  return useSyncExternalStore(
    subscribe,
    () => mediaQueryList(query)?.matches ?? false,
    () => false,
  );
}

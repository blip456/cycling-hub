import { act } from "@testing-library/react";

/**
 * jsdom has no matchMedia. This installs one that answers min-width queries for a given window width,
 * and `resize` changes the width and notifies the listeners (like a real window resize).
 */
export function mockViewport(initialWidth: number) {
  let width = initialWidth;
  const listeners = new Set<{ query: string; fn: (e: MediaQueryListEvent) => void }>();
  const matches = (query: string) => {
    const min = /min-width:\s*(\d+)px/.exec(query);
    return min ? width >= Number(min[1]) : false;
  };

  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      media: query,
      get matches() {
        return matches(query);
      },
      onchange: null,
      addEventListener: (_type: string, fn: (e: MediaQueryListEvent) => void) => {
        listeners.add({ query, fn });
      },
      removeEventListener: (_type: string, fn: (e: MediaQueryListEvent) => void) => {
        for (const l of listeners) if (l.fn === fn) listeners.delete(l);
      },
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    }),
  });

  return {
    resize(next: number) {
      act(() => {
        width = next;
        for (const { query, fn } of [...listeners]) {
          fn({ matches: matches(query), media: query } as MediaQueryListEvent);
        }
      });
    },
    restore() {
      // @ts-expect-error -- jsdom has no matchMedia; remove the mock again.
      delete window.matchMedia;
    },
  };
}

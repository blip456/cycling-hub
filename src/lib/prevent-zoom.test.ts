import { describe, expect, it } from "vitest";
import { preventPinchZoom } from "./prevent-zoom";

/** Dispatches a cancelable event and tells whether it was cancelled. */
function fire(name: string): boolean {
  const event = new Event(name, { cancelable: true });
  document.dispatchEvent(event);
  return event.defaultPrevented;
}

describe("preventPinchZoom", () => {
  it("cancels the iOS pinch gesture events", () => {
    const stop = preventPinchZoom();
    expect(fire("gesturestart")).toBe(true);
    expect(fire("gesturechange")).toBe(true);
    expect(fire("gestureend")).toBe(true);
    stop();
  });

  it("removes the listeners when stopped", () => {
    const stop = preventPinchZoom();
    stop();
    expect(fire("gesturestart")).toBe(false);
  });

  it("leaves other events alone", () => {
    const stop = preventPinchZoom();
    expect(fire("touchmove")).toBe(false);
    stop();
  });
});

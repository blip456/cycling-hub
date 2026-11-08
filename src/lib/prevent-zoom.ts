/**
 * Stops pinch zoom in the app, so it feels like a native app. The viewport tag (index.html) does this on
 * Android, but iOS Safari ignores `user-scalable=no` since iOS 10, so the pinch gesture is cancelled here.
 * Double-tap zoom is stopped in CSS (`touch-action` on html). Returns a function that removes the listeners.
 */
const GESTURE_EVENTS = ["gesturestart", "gesturechange", "gestureend"] as const;

export function preventPinchZoom(target: Document = document): () => void {
  const cancel = (event: Event) => {
    event.preventDefault();
  };
  for (const name of GESTURE_EVENTS) {
    target.addEventListener(name, cancel, { passive: false });
  }
  return () => {
    for (const name of GESTURE_EVENTS) {
      target.removeEventListener(name, cancel);
    }
  };
}

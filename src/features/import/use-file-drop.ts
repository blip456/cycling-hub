import { useEffect, useRef, useState } from "react";

function hasFiles(event: DragEvent): boolean {
  return event.dataTransfer?.types.includes("Files") ?? false;
}

/**
 * X2: a file can be dropped anywhere on the page (desktop). Returns whether a file is being dragged
 * over the window. Dropped files are always caught, so the browser never navigates away to open the
 * file; while `enabled` is false they are ignored.
 */
export function useFileDrop(enabled: boolean, onFile: (file: File) => void): boolean {
  const [dragging, setDragging] = useState(false);
  const onFileRef = useRef(onFile);
  const enabledRef = useRef(enabled);
  useEffect(() => {
    onFileRef.current = onFile;
    enabledRef.current = enabled;
  });

  useEffect(() => {
    let depth = 0;
    const onEnter = (event: DragEvent) => {
      if (!hasFiles(event)) return;
      event.preventDefault();
      depth += 1;
      setDragging(true);
    };
    const onOver = (event: DragEvent) => {
      if (!hasFiles(event)) return;
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = enabledRef.current ? "copy" : "none";
    };
    const onLeave = (event: DragEvent) => {
      if (!hasFiles(event)) return;
      depth = Math.max(0, depth - 1);
      if (depth === 0) setDragging(false);
    };
    const onDrop = (event: DragEvent) => {
      if (!hasFiles(event)) return;
      event.preventDefault();
      depth = 0;
      setDragging(false);
      const file = event.dataTransfer?.files[0];
      if (file && enabledRef.current) onFileRef.current(file);
    };
    window.addEventListener("dragenter", onEnter);
    window.addEventListener("dragover", onOver);
    window.addEventListener("dragleave", onLeave);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragenter", onEnter);
      window.removeEventListener("dragover", onOver);
      window.removeEventListener("dragleave", onLeave);
      window.removeEventListener("drop", onDrop);
    };
  }, []);

  return enabled && dragging;
}

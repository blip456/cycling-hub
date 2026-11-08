import { useEffect, useId, useRef, useState } from "react";
import { STATUS_PRIORITY, useStatusCard } from "@/components/status/status-context";
import { copyText } from "../summary/copy";
import { CheckIcon, CopyIcon } from "./icons";

const COPIED_ICON_MS = 3000;
const COPIED_CARD_MS = 8000;

/**
 * An icon button that copies the title of a session for Strava. The icon turns into a check for a moment,
 * and a status card at the bottom of the page shows the text that was copied (P12).
 */
export function CopyTitleButton({ text }: { text: string }) {
  const id = useId();
  const [copied, setCopied] = useState(false);
  const [result, setResult] = useState<"copied" | "failed" | null>(null);
  const iconTimer = useRef<number | undefined>(undefined);
  const cardTimer = useRef<number | undefined>(undefined);

  useEffect(
    () => () => {
      window.clearTimeout(iconTimer.current);
      window.clearTimeout(cardTimer.current);
    },
    [],
  );

  const copy = async () => {
    const ok = await copyText(text);
    window.clearTimeout(iconTimer.current);
    window.clearTimeout(cardTimer.current);
    setCopied(ok);
    setResult(ok ? "copied" : "failed");
    if (!ok) return;
    iconTimer.current = window.setTimeout(() => {
      setCopied(false);
    }, COPIED_ICON_MS);
    cardTimer.current = window.setTimeout(() => {
      setResult(null);
    }, COPIED_CARD_MS);
  };

  useStatusCard(
    id,
    result === "failed" ? STATUS_PRIORITY.error : STATUS_PRIORITY.flash,
    result === null
      ? null
      : result === "copied"
        ? {
            tone: "success",
            message: (
              <>
                <span className="block font-semibold">Title copied</span>
                <span className="block [overflow-wrap:anywhere]">{text}</span>
              </>
            ),
            onDismiss: () => {
              setResult(null);
            },
          }
        : {
            tone: "error",
            message: (
              <>
                <span className="block font-semibold">Could not copy</span>
                <span className="block">Try again, or copy the title from the session page.</span>
              </>
            ),
            onDismiss: () => {
              setResult(null);
            },
          },
  );

  return (
    <button
      type="button"
      aria-label={`Copy title: ${text}`}
      onClick={() => {
        void copy();
      }}
      className="flex size-11 shrink-0 items-center justify-center rounded-md text-text hover:bg-fill"
    >
      {copied ? <CheckIcon /> : <CopyIcon />}
    </button>
  );
}

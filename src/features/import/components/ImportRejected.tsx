import { useEffect, useRef, type ReactNode } from "react";
import { AlertIcon } from "../icons";

/** C4: a file that is not a valid export. Nothing was saved; only the history knows about it (P33). */
export function ImportRejected({
  fileName,
  message,
  caption,
  children,
}: {
  fileName: string;
  message: string;
  /** Extra line under "Nothing was changed." (the date, for a past attempt). */
  caption?: string;
  /** Actions: Choose another file, Copy error details. */
  children?: ReactNode;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <div className="flex items-start gap-2.5">
        <AlertIcon className="mt-1.5 shrink-0 text-danger" />
        <div className="min-w-0">
          <h2
            ref={headingRef}
            tabIndex={-1}
            className="text-2xl font-semibold tracking-[-0.015em] outline-none"
          >
            This file can&rsquo;t be imported
          </h2>
          <p className="text-[13px] text-muted">
            Nothing was changed.{caption ? ` ${caption}` : ""}
          </p>
        </div>
      </div>
      <div className="flex flex-col gap-2 rounded-2xl bg-surface p-4">
        <b className="font-semibold break-words">{fileName}</b>
        <p>{message}</p>
      </div>
      {children ? <div className="flex flex-col gap-3 lg:flex-row">{children}</div> : null}
    </div>
  );
}

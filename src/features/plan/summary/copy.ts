/** Copies the old way: a hidden text area, selected, and the copy command. For browsers without the clipboard API. */
function legacyCopy(text: string): boolean {
  const area = document.createElement("textarea");
  area.value = text;
  area.setAttribute("readonly", "");
  area.style.position = "fixed";
  area.style.top = "0";
  area.style.opacity = "0";
  document.body.append(area);
  area.select();
  let copied = false;
  try {
    // The copy command is deprecated but is the only way where the clipboard API is missing (plain http).
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    copied = document.execCommand("copy");
  } catch {
    copied = false;
  } finally {
    area.remove();
  }
  return copied;
}

/**
 * Puts `text` on the clipboard: the async clipboard API first, then the copy command as a fallback.
 * Returns false when both fail (for example when the browser blocks it); never throws.
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    // Missing where the page is not a secure context.
    const clipboard = navigator.clipboard as Clipboard | undefined;
    if (clipboard) {
      await clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall through to the copy command.
  }
  return legacyCopy(text);
}

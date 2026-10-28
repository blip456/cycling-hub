import { useId, useState } from "react";
import { applyTheme, getStoredTheme, THEME_CHOICES, type ThemeChoice } from "@/lib/theme";

const LABELS: Record<ThemeChoice, string> = { system: "System", light: "Light", dark: "Dark" };

/**
 * P9: System / Light / Dark as a segmented control (DESIGN.md). Native radio buttons, so arrow keys move
 * the selection and screen readers announce a radio group. Applies and stores the choice at once.
 */
export function ThemeSwitch() {
  const [theme, setTheme] = useState<ThemeChoice>(getStoredTheme);
  const id = useId();

  return (
    <div className="flex flex-col gap-2 px-4 py-3">
      <span id={`${id}-label`} className="text-[15px]">
        Theme
      </span>
      <div
        role="radiogroup"
        aria-labelledby={`${id}-label`}
        className="flex h-11 gap-0.5 rounded-md bg-track p-[3px]"
      >
        {THEME_CHOICES.map((choice) => (
          <label
            key={choice}
            className={
              "flex min-w-[72px] flex-1 cursor-pointer items-center justify-center rounded-[9px] px-4 text-[15px] font-medium text-muted " +
              "transition-colors hover:text-text has-checked:bg-raised has-checked:font-semibold has-checked:text-text " +
              "has-checked:shadow-[inset_0_0_0_1px_var(--input-border)] " +
              "has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-accent"
            }
          >
            <input
              type="radio"
              name={`${id}-theme`}
              value={choice}
              checked={theme === choice}
              onChange={() => {
                setTheme(choice);
                applyTheme(choice);
              }}
              className="sr-only"
            />
            {LABELS[choice]}
          </label>
        ))}
      </div>
    </div>
  );
}

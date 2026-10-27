// Destructive button styles (DESIGN.md "Buttons"), kept apart from the components for fast refresh.
const buttonBase =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-5 text-[15px] font-semibold " +
  "transition-colors disabled:cursor-not-allowed disabled:opacity-60";

/** "Destructive": --fill with --danger text and a trash icon (Delete ride in the page). */
export const dangerButtonClass = `${buttonBase} bg-fill text-danger hover:bg-fill-hover`;

/** "Destructive confirm": solid --danger, only inside the confirm dialog. */
export const dangerSolidButtonClass = `${buttonBase} bg-danger text-on-danger hover:opacity-90`;

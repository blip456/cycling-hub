import { buttonClass } from "@/components/button-class";

// Destructive button styles (DESIGN.md "Buttons"): the shared variants, kept under their old names.

/** "Destructive": --fill with --danger text and a trash icon (Delete ride in the page). */
export const dangerButtonClass = buttonClass("destructive");

/** "Destructive confirm": solid --danger, only inside the confirm dialog. */
export const dangerSolidButtonClass = buttonClass("danger");

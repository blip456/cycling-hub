import { createContext } from "react";

/** Where the Change links of the summary go: the intake (/plan/new) or the edit page (/plan/edit). */
export const StepBaseContext = createContext("/plan/new");

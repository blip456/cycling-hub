// Adds the Testing Library matchers (toBeInTheDocument, toHaveAccessibleName, ...) to Vitest's
// expect and unmounts rendered components after every test.
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(() => {
  cleanup();
});

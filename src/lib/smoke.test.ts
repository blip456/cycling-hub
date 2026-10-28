import { describe, expect, it } from "vitest";

// Proves the test setup works: jsdom provides a DOM and the Testing Library matchers are loaded.
describe("test setup", () => {
  it("runs in a DOM with Testing Library matchers", () => {
    const heading = document.createElement("h1");
    heading.textContent = "Cycling Hub";
    document.body.append(heading);

    expect(heading).toBeInTheDocument();
    expect(heading).toHaveTextContent("Cycling Hub");

    heading.remove();
  });
});

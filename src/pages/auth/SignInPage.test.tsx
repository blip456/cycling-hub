import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { fakeAuth, renderWithProviders } from "@/test/render";
import { SignInPage } from "./SignInPage";

describe("SignInPage", () => {
  it("has labelled, empty, password-manager friendly fields", () => {
    renderWithProviders(<SignInPage />);
    const email = screen.getByLabelText("Email");
    const password = screen.getByLabelText("Password");
    expect(email).toHaveAttribute("type", "email");
    expect(email).toHaveAttribute("autocomplete", "username");
    expect(password).toHaveAttribute("type", "password");
    expect(password).toHaveAttribute("autocomplete", "current-password");
    for (const input of [email, password]) {
      expect(input).toHaveValue("");
      expect(input).not.toHaveAttribute("placeholder");
    }
  });

  it("shows and hides the password", async () => {
    const user = userEvent.setup();
    renderWithProviders(<SignInPage />);
    const toggle = screen.getByRole("button", { name: "Show password" });
    await user.click(toggle);
    expect(screen.getByLabelText("Password")).toHaveAttribute("type", "text");
    await user.click(screen.getByRole("button", { name: "Hide password" }));
    expect(screen.getByLabelText("Password")).toHaveAttribute("type", "password");
  });

  it("shows field errors linked to the inputs", async () => {
    const user = userEvent.setup();
    renderWithProviders(<SignInPage />);
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    const email = screen.getByLabelText("Email");
    expect(email).toHaveAttribute("aria-invalid", "true");
    expect(email).toHaveAccessibleDescription("Enter your email address.");
    expect(screen.getByLabelText("Password")).toHaveAccessibleDescription("Enter your password.");
    expect(email).toHaveFocus();
  });

  it("shows one generic error for wrong credentials, keeps the email and focuses the cleared password", async () => {
    const user = userEvent.setup();
    const signIn = vi.fn(async () => ({
      ok: false as const,
      error: "invalid_credentials" as const,
    }));
    renderWithProviders(<SignInPage />, { auth: fakeAuth({ signIn }) });
    await user.type(screen.getByLabelText("Email"), "Rider@Test.invalid ");
    await user.type(screen.getByLabelText("Password"), "wrong password");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(signIn).toHaveBeenCalledWith("rider@test.invalid", "wrong password");
    expect(await screen.findByRole("alert")).toHaveTextContent("Email or password is incorrect.");
    expect(screen.getByLabelText("Email")).toHaveValue("Rider@Test.invalid");
    expect(screen.getByLabelText("Password")).toHaveValue("");
    expect(screen.getByLabelText("Password")).toHaveFocus();
  });

  it("shows the network error", async () => {
    const user = userEvent.setup();
    const signIn = vi.fn(async () => ({ ok: false as const, error: "network" as const }));
    renderWithProviders(<SignInPage />, { auth: fakeAuth({ signIn }) });
    await user.type(screen.getByLabelText("Email"), "rider@test.invalid");
    await user.type(screen.getByLabelText("Password"), "a password");
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("No connection.");
  });

  it("explains a sign-out after 30 days", () => {
    renderWithProviders(<SignInPage />, { auth: fakeAuth({ signedOutReason: "expired" }) });
    expect(screen.getByRole("status")).toHaveTextContent("Please sign in again.");
  });

  it("links to forgot password", () => {
    renderWithProviders(<SignInPage />);
    expect(screen.getByRole("link", { name: "Forgot password?" })).toHaveAttribute(
      "href",
      "/forgot-password",
    );
  });
});

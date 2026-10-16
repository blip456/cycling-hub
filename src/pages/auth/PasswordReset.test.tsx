import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { fakeAuth, fakeSession, renderWithProviders } from "@/test/render";
import { ForgotPasswordPage } from "./ForgotPasswordPage";
import { ResetPasswordPage } from "./ResetPasswordPage";

describe("ForgotPasswordPage (A3, A4)", () => {
  it("sends the link and shows the neutral confirmation with a delayed resend", async () => {
    const user = userEvent.setup();
    const requestPasswordReset = vi.fn(async () => ({ ok: true as const }));
    renderWithProviders(<ForgotPasswordPage />, { auth: fakeAuth({ requestPasswordReset }) });

    const email = screen.getByLabelText("Email");
    expect(email).toHaveAccessibleDescription("The link works once and expires after 1 hour.");
    await user.type(email, "rider@test.invalid");
    await user.click(screen.getByRole("button", { name: "Send reset link" }));

    expect(requestPasswordReset).toHaveBeenCalledWith("rider@test.invalid");
    expect(await screen.findByRole("heading", { name: "Check your email" })).toBeInTheDocument();
    expect(screen.getByText(/If an account exists for this address/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Resend link \(available in \d+ s\)/ })).toBeDisabled();
  });

  it("validates the email", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ForgotPasswordPage />);
    await user.click(screen.getByRole("button", { name: "Send reset link" }));
    expect(screen.getByLabelText("Email")).toHaveAccessibleDescription(/Enter your email address\./);
  });
});

describe("ResetPasswordPage (A5)", () => {
  it("saves a new password from a recovery session", async () => {
    const user = userEvent.setup();
    const updatePassword = vi.fn(async () => ({ ok: true as const }));
    renderWithProviders(<ResetPasswordPage />, {
      auth: fakeAuth({ status: "signedIn", session: fakeSession(), recovery: true, updatePassword }),
    });
    const field = screen.getByLabelText("New password");
    expect(field).toHaveAttribute("autocomplete", "new-password");
    await user.type(field, "short");
    await user.click(screen.getByRole("button", { name: "Save and sign in" }));
    expect(field).toHaveAccessibleDescription(/Use at least 12 characters\./);
    expect(updatePassword).not.toHaveBeenCalled();

    await user.clear(field);
    await user.type(field, "four words long enough");
    await user.click(screen.getByRole("button", { name: "Save and sign in" }));
    expect(updatePassword).toHaveBeenCalledWith("four words long enough");
  });

  it("shows the expired message without a session", () => {
    renderWithProviders(<ResetPasswordPage />, { auth: fakeAuth({ status: "signedOut" }) });
    expect(screen.getByText("This link has expired or was already used.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Send a new link" })).toHaveAttribute("href", "/forgot-password");
  });

  it("shows the expired message when the link carried an error", () => {
    renderWithProviders(<ResetPasswordPage />, {
      auth: fakeAuth({ status: "signedIn", session: fakeSession(), recoveryError: "otp_expired" }),
    });
    expect(screen.queryByLabelText("New password")).not.toBeInTheDocument();
  });
});

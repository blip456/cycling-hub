import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import type { Session } from "@supabase/supabase-js";
import type { ReactElement } from "react";
import { MemoryRouter } from "react-router";
import { vi } from "vitest";
import { AuthContext, type AuthContextValue } from "@/lib/auth/auth-context";

export function fakeSession(email = "rider@test.invalid"): Session {
  return {
    access_token: "test",
    refresh_token: "test",
    expires_in: 3600,
    token_type: "bearer",
    user: {
      id: "00000000-0000-0000-0000-000000000001",
      aud: "authenticated",
      app_metadata: {},
      user_metadata: {},
      created_at: new Date().toISOString(),
      last_sign_in_at: new Date().toISOString(),
      email,
    },
  };
}

export function fakeAuth(overrides: Partial<AuthContextValue> = {}): AuthContextValue {
  return {
    status: "signedOut",
    session: null,
    recovery: false,
    recoveryError: null,
    signedOutReason: null,
    configError: null,
    signIn: vi.fn(async () => ({ ok: true as const })),
    signOut: vi.fn(async () => undefined),
    requestPasswordReset: vi.fn(async () => ({ ok: true as const })),
    updatePassword: vi.fn(async () => ({ ok: true as const })),
    ...overrides,
  };
}

/** Renders `ui` inside a router at `path` with a fake auth context (no Supabase involved). */
export function renderWithProviders(ui: ReactElement, { path = "/", auth = fakeAuth() } = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const result = render(
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider value={auth}>
        <MemoryRouter initialEntries={[path]}>{ui}</MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
  return { ...result, auth };
}

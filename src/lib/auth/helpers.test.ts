import { AuthApiError, AuthRetryableFetchError } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { MissingEnvError, parseEnv } from "@/lib/env";
import { toAuthErrorKind } from "./errors";
import { readAuthParams } from "./initial-url";

describe("parseEnv", () => {
  it("accepts a URL and a publishable key", () => {
    const env = parseEnv({
      VITE_SUPABASE_URL: "http://127.0.0.1:54321",
      VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_x",
    });
    expect(env.VITE_SUPABASE_URL).toBe("http://127.0.0.1:54321");
  });

  it("names the missing variables", () => {
    expect(() => parseEnv({})).toThrow(MissingEnvError);
    expect(() => parseEnv({ VITE_SUPABASE_URL: "nope" })).toThrow(
      /VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY/,
    );
  });
});

describe("toAuthErrorKind", () => {
  it("maps wrong credentials to one generic kind", () => {
    expect(
      toAuthErrorKind(new AuthApiError("Invalid login credentials", 400, "invalid_credentials")),
    ).toBe("invalid_credentials");
  });

  it("maps rate limits and network failures", () => {
    expect(toAuthErrorKind(new AuthApiError("Too many", 429, "over_request_rate_limit"))).toBe(
      "rate_limited",
    );
    expect(toAuthErrorKind(new AuthRetryableFetchError("Failed to fetch", 0))).toBe("network");
  });

  it("maps password problems", () => {
    expect(toAuthErrorKind(new AuthApiError("weak", 422, "weak_password"))).toBe("weak_password");
    expect(toAuthErrorKind(new AuthApiError("same", 422, "same_password"))).toBe("same_password");
  });

  it("falls back to unknown", () => {
    expect(toAuthErrorKind(new Error("boom"))).toBe("unknown");
  });
});

describe("readAuthParams", () => {
  it("detects a recovery link", () => {
    expect(readAuthParams("https://app.test/reset-password#access_token=x&type=recovery")).toEqual({
      isRecovery: true,
      errorCode: null,
    });
  });

  it("detects an expired link", () => {
    const parsed = readAuthParams(
      "https://app.test/reset-password#error=access_denied&error_code=otp_expired&error_description=expired",
    );
    expect(parsed).toEqual({ isRecovery: false, errorCode: "otp_expired" });
  });

  it("ignores a normal URL", () => {
    expect(readAuthParams("https://app.test/rides")).toEqual({
      isRecovery: false,
      errorCode: null,
    });
  });
});

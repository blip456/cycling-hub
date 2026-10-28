import { defineConfig, mergeConfig } from "vitest/config";
import viteConfig from "./vite.config";

// Reuses the app config (aliases, injected constants such as __APP_VERSION__), plus test settings.
export default defineConfig((env) =>
  mergeConfig(
    viteConfig(env),
    defineConfig({
      test: {
        environment: "jsdom",
        setupFiles: ["./src/test/setup.ts"],
        include: ["src/**/*.test.{ts,tsx}", "scripts/**/*.test.mjs"],
        css: false,
        restoreMocks: true,
        coverage: {
          provider: "v8",
          reporter: ["text", "html", "lcov"],
          include: ["src/**/*.{ts,tsx}"],
          exclude: ["src/**/*.test.{ts,tsx}", "src/main.tsx", "src/lib/supabase/database.types.ts"],
        },
      },
    }),
  ),
);

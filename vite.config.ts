import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath, URL } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv, type Plugin } from "vite";
import { VitePWA } from "vite-plugin-pwa";

const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8")) as {
  version: string;
};

// Dark tokens from src/styles/tokens.css (--bg). The manifest can't read CSS variables.
const DARK_BG = "#111318";

/**
 * Supabase settings for the client. Our own names (VITE_*) win; otherwise the names that the
 * Supabase integration for Vercel syncs are used, so its automatic env sync works for this Vite app.
 * Only these two public values are mapped. Secret keys and database passwords from the integration
 * are never read here, so they never reach the bundle.
 */
const SUPABASE_PUBLIC_ENV = {
  VITE_SUPABASE_URL: ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_URL"],
  VITE_SUPABASE_PUBLISHABLE_KEY: [
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    "SUPABASE_PUBLISHABLE_KEY",
  ],
} as const;

function supabaseEnvDefines(env: Record<string, string>): Record<string, string> {
  const defines: Record<string, string> = {};
  for (const [target, fallbacks] of Object.entries(SUPABASE_PUBLIC_ENV)) {
    if (env[target]) continue;
    const value = fallbacks.map((name) => env[name]).find(Boolean);
    if (value) defines[`import.meta.env.${target}`] = JSON.stringify(value);
  }
  return defines;
}

/**
 * What's new / What's next data (scripts/build-release-data.mjs). package.json runs the script before
 * dev, build, lint, typecheck and tests; this plugin re-runs it when CHANGELOG.md or docs/backlog.md
 * changes while `pnpm dev` is running. A broken backlog entry is reported and the old data stays.
 */
function releaseData(): Plugin {
  const script = fileURLToPath(new URL("./scripts/build-release-data.mjs", import.meta.url));
  const sources = ["CHANGELOG.md", "docs/backlog.md"].map((file) =>
    fileURLToPath(new URL(`./${file}`, import.meta.url)),
  );
  return {
    name: "cycling-hub:release-data",
    apply: "serve",
    configureServer(server) {
      server.watcher.add(sources);
      const regenerate = (file: string) => {
        if (!sources.includes(file)) return;
        try {
          execFileSync(process.execPath, [script], { stdio: "inherit" });
        } catch {
          server.config.logger.error("release data not updated: fix docs/backlog.md (see above)");
        }
      };
      server.watcher.on("change", regenerate);
      server.watcher.on("add", regenerate);
    },
  };
}

export default defineConfig(({ mode }) => ({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    ...supabaseEnvDefines(loadEnv(mode, process.cwd(), "")),
  },
  plugins: [
    releaseData(),
    react(),
    tailwindcss(),
    VitePWA({
      // P12: no offline data. The service worker only precaches the app shell and asks before updating.
      registerType: "prompt",
      injectRegister: null,
      includeAssets: ["icon.svg", "apple-touch-icon-180x180.png"],
      manifest: {
        name: "Cycling Hub",
        short_name: "Cycling Hub",
        description: "Personal cycling training hub.",
        lang: "en",
        start_url: "/",
        scope: "/",
        display: "standalone",
        orientation: "any",
        theme_color: DARK_BG,
        background_color: DARK_BG,
        icons: [
          { src: "pwa-192x192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "pwa-512x512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          {
            src: "maskable-icon-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,webmanifest}"],
        navigateFallback: "/index.html",
        cleanupOutdatedCaches: true,
        // No runtime caching: Supabase requests always go to the network.
        runtimeCaching: [],
      },
      devOptions: { enabled: false },
    }),
  ],
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
}));

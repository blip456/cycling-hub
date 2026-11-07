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

/**
 * The short commit id of this build, shown in the side menu so it is clear which build is running (a
 * preview, the installed app or production all carry the same package version). Vercel and GitHub Actions
 * give the full SHA in the environment; locally it comes from git, and "local" when git is unavailable.
 */
function buildId(): string {
  const fromEnv = process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GITHUB_SHA;
  if (fromEnv && /^[0-9a-f]{7,40}$/i.test(fromEnv)) return fromEnv.slice(0, 7);
  try {
    const id = execFileSync("git", ["rev-parse", "--short=7", "HEAD"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    return id !== "" ? id : "local";
  } catch {
    return "local";
  }
}

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

/**
 * Preloads the Latin subset of Inter (P36) so text does not wait for the CSS to be parsed before the font is
 * requested. The file name is hashed, so the link is written at build time from the bundle. The other subsets
 * (latin-ext, cyrillic, ...) load on demand through unicode-range.
 */
function preloadInter(): Plugin {
  return {
    name: "cycling-hub:preload-inter",
    apply: "build",
    transformIndexHtml: {
      order: "post",
      handler(_html, ctx) {
        const file = Object.keys(ctx.bundle ?? {}).find((name) =>
          /inter-latin-wght-normal-.*\.woff2$/.test(name),
        );
        if (!file) return [];
        return [
          {
            tag: "link",
            attrs: {
              rel: "preload",
              as: "font",
              type: "font/woff2",
              crossorigin: "",
              href: `/${file}`,
            },
            injectTo: "head-prepend",
          },
        ];
      },
    },
  };
}

export default defineConfig(({ mode }) => ({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __BUILD_ID__: JSON.stringify(buildId()),
    ...supabaseEnvDefines(loadEnv(mode, process.cwd(), "")),
  },
  plugins: [
    releaseData(),
    preloadInter(),
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
        // Fonts (P36): the installed app must render Inter offline-first. Only the Latin and Latin Extended
        // subsets are precached (about 130 kB); the rest of the subsets are fetched on demand.
        globPatterns: [
          "**/*.{js,css,html,svg,png,webmanifest}",
          "assets/inter-latin{,-ext}-wght-normal-*.woff2",
        ],
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

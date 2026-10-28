// Build of the Chrome extension (extension/dist, loaded unpacked). Separate from the app's
// vite.config.ts, so `pnpm build` never builds or ships the extension. Run with `pnpm ext:build`.
import { readFileSync } from "node:fs";
import { fileURLToPath, URL } from "node:url";
import { defineConfig, type Plugin } from "vite";

const root = fileURLToPath(new URL(".", import.meta.url));

/** The toolbar icon is the app icon (public/pwa-192x192.png), so there is one source. */
function appIcon(): Plugin {
  return {
    name: "cycling-hub-extension:icon",
    generateBundle() {
      this.emitFile({
        type: "asset",
        fileName: "icon.png",
        source: readFileSync(new URL("../public/pwa-192x192.png", import.meta.url)),
      });
    },
  };
}

export default defineConfig({
  root,
  base: "./",
  publicDir: "public",
  plugins: [appIcon()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    target: "chrome120",
    modulePreload: false,
    rollupOptions: {
      input: {
        export: fileURLToPath(new URL("./export.html", import.meta.url)),
        background: fileURLToPath(new URL("./src/background.ts", import.meta.url)),
      },
      output: {
        // The manifest names the service worker file, so it has a fixed name.
        entryFileNames: (chunk) =>
          chunk.name === "background" ? "background.js" : "assets/[name]-[hash].js",
      },
    },
  },
});

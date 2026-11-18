// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
    plugins: [
      VitePWA({
        strategies: "generateSW",
        registerType: "autoUpdate",
        injectRegister: null,
        filename: "sw.js",
        manifest: false,
        devOptions: { enabled: false },
        workbox: {
          // Cache the actual entry pages during service-worker installation, not only
          // after the app JavaScript has started. This lets an installed app reopen
          // while offline, including its existing local sign-in session.
          additionalManifestEntries: [
            { url: "/", revision: null },
            { url: "/app", revision: null },
            { url: "/manifest.webmanifest", revision: null },
          ],
          globPatterns: ["**/*.{js,mjs,css,html}"],
          // Take control on the first load so offline navigation is handled consistently.
          clientsClaim: true,
          skipWaiting: true,
          cleanupOutdatedCaches: true,
          navigateFallback: "/",
          navigateFallbackDenylist: [/^\/api\//, /^\/~oauth/],
          runtimeCaching: [
            {
              urlPattern: ({ request, url }) =>
                request.mode === "navigate" && !url.pathname.startsWith("/~oauth") && !url.pathname.startsWith("/api/"),
              handler: "NetworkFirst",
              options: { cacheName: "ec-pages", networkTimeoutSeconds: 4 },
            },
            {
              urlPattern: ({ url }) => url.origin === self.location.origin && url.pathname.startsWith("/assets/"),
              handler: "CacheFirst",
              options: { cacheName: "ec-assets" },
            },
            {
              urlPattern: ({ url }) => url.host.includes("fonts.g"),
              handler: "StaleWhileRevalidate",
              options: { cacheName: "ec-fonts" },
            },
          ],
        },
      }),
    ],
  },
});

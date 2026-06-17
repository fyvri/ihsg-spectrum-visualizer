import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import songLibrary from "./vite-plugin-song-library";

// Single-Worker topology: the Vite build in ./dist is served by the Worker's
// Assets binding; /api/* is handled by worker/index.ts. During `vite` dev the
// API is proxied to `wrangler dev` (npm run cf:dev) on :8787.
export default defineConfig({
  plugins: [
    react(),
    // builds `virtual:song-library` (SONGS) from public/audio/ ID3 tags at build time
    songLibrary(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: [
        "favicon.ico",
        "icons/favicon-16x16.png",
        "icons/favicon-32x32.png",
        "icons/apple-touch-icon.png",
        "icons/icon-120x120.png",
        "icons/icon-152x152.png",
        "icons/icon-167x167.png",
        "icons/icon-180x180.png",
      ],
      manifest: {
        name: "IHSG Spectrum Visualizer",
        short_name: "IHSG",
        description:
          "Google-Finance-style IDX Composite (IHSG) quote page whose price chart renders as a live audio spectrum and whose headline sings the melody.",
        start_url: "/",
        scope: "/",
        display: "standalone",
        orientation: "portrait",
        // light theme tokens (--bg #ffffff) — the app's default theme
        theme_color: "#ffffff",
        background_color: "#ffffff",
        icons: [
          { src: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
          { src: "/icons/icon-512x512.png", sizes: "512x512", type: "image/png" },
          {
            src: "/icons/icon-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        // precache the app shell; audio is large → runtime CacheFirst instead
        globPatterns: ["**/*.{js,css,html,ico,png,svg,webmanifest,woff,woff2}"],
        globIgnores: ["audio/**"],
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          // NEVER cache /api/* — live quote/news must stay fresh (offline, the
          // app falls back to its last polled payload kept in localStorage).
          { urlPattern: /\/api\//, handler: "NetworkOnly" },
          {
            urlPattern: /\/audio\/.*\.(mp3|m4a|ogg|wav)$/,
            handler: "CacheFirst",
            options: {
              cacheName: "ihsg-audio",
              expiration: { maxEntries: 12 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\//,
            handler: "StaleWhileRevalidate",
            options: { cacheName: "google-fonts-styles" },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\//,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts-webfonts",
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  server: {
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8787",
        // While the Worker (npm run cf:dev) is still starting — or not running —
        // answer 503 JSON instead of spamming ECONNREFUSED stack traces; the
        // client treats any !ok response as "keep the last good snapshot".
        configure(proxy) {
          proxy.on("error", (_err, _req, res) => {
            if ("writeHead" in res && !res.headersSent) {
              res.writeHead(503, { "content-type": "application/json" });
            }
            res.end(JSON.stringify({ error: "api unavailable (is `npm run cf:dev` up?)" }));
          });
        },
      },
    },
  },
});

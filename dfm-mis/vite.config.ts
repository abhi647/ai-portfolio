import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";
import { VitePWA } from "vite-plugin-pwa";
import { askPlugin } from "./server/ask";

/** Two apps, one build: the desktop dashboard at `/` and the installable phone app at `/app`. */
function mobileSpaFallback(): Plugin {
  // Deep links like /app/monitor must load the phone app's HTML, not the desktop one.
  const rewrite = (req: { url?: string; headers: { accept?: string } }) => {
    const url = req.url ?? "";
    if (/^\/app(\/(?!.*\.\w+$).*)?$/.test(url.split("?")[0]) && (req.headers.accept ?? "").includes("text/html")) req.url = "/app/index.html";
  };
  return {
    name: "dfm-mobile-spa-fallback",
    configureServer(s) { s.middlewares.use((req, _res, next) => { rewrite(req); next(); }); },
    configurePreviewServer(s) { s.middlewares.use((req, _res, next) => { rewrite(req); next(); }); },
  };
}

/** vite-plugin-pwa adds the manifest link to every page; keep it on the phone app only. */
function desktopNoManifest(): Plugin {
  return {
    name: "dfm-desktop-no-manifest",
    enforce: "post",
    transformIndexHtml: { order: "post", handler: (html, ctx) => (ctx.filename.includes(`${path.sep}app${path.sep}`) ? html : html.replace(/<link rel="manifest"[^>]*>/g, "")) },
  };
}

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    askPlugin(),
    mobileSpaFallback(),
    VitePWA({
      // The service worker and manifest only cover the phone app; the desktop dashboard stays a plain website.
      registerType: "autoUpdate",
      injectRegister: false,
      filename: "app-sw.js",
      manifestFilename: "app/manifest.webmanifest",
      scope: "/app/",
      base: "/",
      includeAssets: ["icons/*.png", "brand/*"],
      manifest: {
        id: "/app/",
        name: "DFM Foods MIS",
        short_name: "DFM MIS",
        description: "Ask your supply, sales and finance data anything — with a live operations monitor.",
        start_url: "/app/",
        scope: "/app/",
        display: "standalone",
        orientation: "portrait",
        background_color: "#ffffff",
        theme_color: "#ffffff",
        categories: ["business", "productivity"],
        icons: [
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
        shortcuts: [
          { name: "Ask AI", short_name: "Ask", url: "/app/", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
          { name: "Live monitor", short_name: "Monitor", url: "/app/monitor", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,png,webp,svg,woff2}"],
        // Desktop-only chunks don't need to be precached for the phone app.
        globIgnores: ["**/Trips-*.js", "**/Orders-*.js", "**/Sales-*.js", "**/Settings-*.js", "**/Cfa-*.js", "**/Pnl-*.js"],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        navigateFallback: "/app/index.html",
        navigateFallbackAllowlist: [/^\/app(\/|$)/],
        navigateFallbackDenylist: [/^\/api\//],
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          // Ask AI answers always go to the network; offline mode takes over in the app if it fails.
          { urlPattern: /\/api\//, handler: "NetworkOnly" },
        ],
      },
      devOptions: { enabled: false },
    }),
    desktopNoManifest(),
  ],
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
  build: {
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, "index.html"),
        app: path.resolve(__dirname, "app/index.html"),
      },
      output: {
        manualChunks: {
          react: ["react", "react-dom", "react-router-dom"],
          charts: ["recharts-analytics"],
          table: ["@tanstack/react-table"],
        },
      },
    },
  },
});

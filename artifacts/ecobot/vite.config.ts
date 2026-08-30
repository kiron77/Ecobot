import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

// PORT is only meaningful for the dev/preview server. Default to 5173 (Vite's
// default) so `vite build` works on any host. Replit still injects its own PORT,
// which this respects.
const port = Number(process.env.PORT) || 5173;

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${process.env.PORT}"`);
}

// BASE_PATH lets you serve under a sub-path (e.g. "/app/"). Most hosts serve at
// root, so default to "/". Replit sets this when it needs a sub-path.
const basePath = process.env.BASE_PATH || "/";

// Replit-only dev plugins. Loaded lazily and ONLY when running inside Replit
// (REPL_ID is set), so builds on Render/Netlify/Vercel/local don't need the
// @replit/* packages at all.
const isReplit = process.env.REPL_ID !== undefined;
const isDev = process.env.NODE_ENV !== "production";

const replitPlugins =
  isDev && isReplit
    ? [
        await import("@replit/vite-plugin-runtime-error-modal")
          .then((m) => m.default())
          .catch(() => null),
        await import("@replit/vite-plugin-cartographer")
          .then((m) => m.cartographer({ root: path.resolve(import.meta.dirname, "..") }))
          .catch(() => null),
        await import("@replit/vite-plugin-dev-banner")
          .then((m) => m.devBanner())
          .catch(() => null),
      ].filter((p): p is NonNullable<typeof p> => p !== null)
    : [];

export default defineConfig({
  base: basePath,
  plugins: [
    react(),
    tailwindcss({ optimize: false }),
    ...replitPlugins,
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@assets": path.resolve(import.meta.dirname, "..", "..", "attached_assets"),
    },
    dedupe: ["react", "react-dom"],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  envDir: path.resolve(import.meta.dirname, "..", ".."),
  server: {
    port,
    strictPort: true,
    host: "0.0.0.0",
    allowedHosts: true,
    fs: { strict: true },
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
  },
});

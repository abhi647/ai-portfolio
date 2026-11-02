import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { askPlugin } from "./server/ask";

export default defineConfig({
  plugins: [react(), tailwindcss(), askPlugin()],
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
  build: {
    chunkSizeWarningLimit: 900,
    rollupOptions: {
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

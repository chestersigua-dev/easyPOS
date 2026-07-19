import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "./",
  server: {
    port: 5173,
    allowedHosts: ["aa679eff93c536vlc
      .lhr.life"],
    proxy: {
      "/api": {
        target: "http://localhost:8085",
        changeOrigin: true,
      },
    },
  },
});

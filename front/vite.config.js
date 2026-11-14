import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { ocrDevPlugin } from "./vite-ocr-plugin.js";

// Live preview: `npm run dev` -> http://localhost:5173
// Tailwind v4 se učitava preko Vite plugina (bez postcss.config.js).
//
// /api pozivi idu na backend. Podrazumevano lokalni (apps/platform na portu 3000);
// za rad bez lokalnog backenda: VITE_API_TARGET=https://<railway-adresa> npm run dev
const API_TARGET = (process.env.VITE_API_TARGET || "http://localhost:3000").replace(/\/$/, "");

export default defineConfig({
  // Apsolutna bazna putanja za standardno SPA HTML5 routing rutiranje
  base: "/",
  plugins: [ocrDevPlugin(), react(), tailwindcss()],
  server: {
    port: 5173,
    open: false,
    proxy: {
      "/api": {
        target: API_TARGET,
        changeOrigin: true,
        secure: true,
        headers: {
          Origin: new URL(API_TARGET).origin,
        },
      },
    },
  },
});

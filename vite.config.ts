import { fileURLToPath, URL } from "node:url";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
  // 配る先（Cloudflare / GitHub Pages のサブパス）が決まったら VITE_BASE で変える
  base: process.env.VITE_BASE ?? "/",
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "@content": fileURLToPath(new URL("./content", import.meta.url)),
    },
  },
  build: {
    target: "es2022",
    chunkSizeWarningLimit: 1600,
  },
});

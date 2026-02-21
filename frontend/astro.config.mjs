// @ts-check
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";
import { fileURLToPath } from "node:url";

import node from "@astrojs/node";
import react from "@astrojs/react";

const backendTarget = process.env.BACKEND_URL || "http://localhost:3000";

// https://astro.build/config
export default defineConfig({
  output: "server",
  adapter: node({
    mode: "standalone",
  }),
  vite: {
    plugins: [tailwindcss()],
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
        "@components": fileURLToPath(
          new URL("./src/components", import.meta.url),
        ),
        "@layout": fileURLToPath(new URL("./src/layout", import.meta.url)),
      },
    },
    server: {
      proxy: {
        "/api": {
          target: backendTarget,
          changeOrigin: true,
          ws: true,
        },
      },
    },
  },
  integrations: [react()],
});

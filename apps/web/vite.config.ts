import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  // tanstackRouter має йти ПЕРЕД react: генерує routeTree.gen.ts з файлів у src/routes.
  plugins: [tanstackRouter({ target: "react" }), react(), tailwindcss()],
  // Єдиний .env лежить у корені монорепо.
  envDir: fileURLToPath(new URL("../../", import.meta.url)),
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    port: 5173,
  },
});

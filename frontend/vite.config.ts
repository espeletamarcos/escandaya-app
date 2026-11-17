import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'
import { VitePWA } from 'vite-plugin-pwa';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      manifest: {
        name: "Escandaya",
        short_name: "Escandaya",
        lang: "es",
        description: "Escandallos por voz con coste por ración",
        display: "standalone",
        start_url: "/",
        // The steel ground of index.css (--ground).
        theme_color: "#edf0f1",
        background_color: "#edf0f1",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png" },
        ],
      },
    }),
  ],
  test: {
    environment: "jsdom",
  },
  server: {
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8000",
      }
    }
  }
})

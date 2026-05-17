import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // 'prompt' means the new SW installs but waits — we control when it activates.
      // 'autoUpdate' was silently swapping assets under users mid-session.
      registerType: 'prompt',
      includeAssets: ['favicon.ico', 'Metro_Transit.png', 'bus.png'],
      manifest: {
        name: 'Metro Transit Dashboard',
        short_name: 'Metro Transit',
        description: 'Real-time bus tracker for the Twin Cities metro area',
        theme_color: '#0053A0',
        background_color: '#0d1b2e',
        display: 'standalone',
        scope: '/',
        start_url: '/',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
        cleanupOutdatedCaches: true,
        // Take control of all clients as soon as the new SW activates.
        clientsClaim: true,
        // Do NOT skip waiting automatically — the user (or close+reopen) triggers activation.
        skipWaiting: false,
      },
    }),
  ],
})

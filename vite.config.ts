import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  const port = parseInt(env.VITE_PORT || '5173', 10)
  const isDev = mode === 'development'

  return {
    plugins: [
      tailwindcss(),
      react(),
      // PWA: brauzerda "O'rnatish" belgisi chiqadi, alohida oynada native
      // ilovadek ochiladi. Yangi deploy chiqsa service worker avtomatik
      // yangilanadi (autoUpdate) — foydalanuvchi doim so'nggi versiyani oladi.
      VitePWA({
        registerType: 'autoUpdate',
        manifest: {
          name: 'GoHotel — Mehmonxona boshqaruvi',
          short_name: 'GoHotel',
          description: 'Mehmonxonani boshqarish tizimi',
          lang: 'uz',
          start_url: '/',
          scope: '/',
          display: 'standalone',
          theme_color: '#2563eb',
          background_color: '#ffffff',
          icons: [
            { src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
            { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png' },
            { src: '/pwa-maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
        },
        workbox: {
          // API so'rovlari hech qachon kesh/fallback ga tushmasligi kerak —
          // ular doim to'g'ridan-to'g'ri serverga boradi.
          navigateFallbackDenylist: [/^\/api/],
          globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
          // Katta chunk'lar (tesseract, recharts) ham precache ga sig'ishi uchun
          maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
        },
      })
    ],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    server: {
      port,
      proxy: isDev ? {
        '/api': {
          target: env.VITE_API_BASE || 'https://gohotel-gohotel-backend-lhyen5-ecceab-13-140-185-49.sslip.io',
          changeOrigin: true,
        },
      } : undefined,
    },
    preview: {
      port: parseInt(env.VITE_PORT || '5173', 10),
      host: true,
      allowedHosts: true,
    },
  }
})

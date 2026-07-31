import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const BACKEND_URL = process.env.VITE_SERVER_URL || 'http://localhost:3000'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    proxy: {
      // Proxy all API calls (including NextAuth REST callbacks) to the
      // Next.js backend so the SPA can use relative /api/... URLs and
      // NextAuth's httpOnly cookie behaves like a same-origin cookie.
      '/api': {
        target: BACKEND_URL,
        changeOrigin: true,
        secure: false,
      },
    },
  },
})
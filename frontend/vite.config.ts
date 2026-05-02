import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/ui-assets/',
  server: {
    proxy: {
      '/api': {
        target: process.env.OCTOPUS_BACKEND_URL ?? 'http://127.0.0.1:8001',
        changeOrigin: true,
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
})
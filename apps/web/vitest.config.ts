import react from '@vitejs/plugin-react'
import path from 'path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    // Disable Node.js 26 experimental localStorage to avoid warnings
    // jsdom provides its own Storage implementation which is more battle-tested
    env: {
      NODE_OPTIONS: '--no-webstorage',
      // Define the API base URL for tests so MSW handlers and the axios client
      // always agree, independent of the gitignored apps/web/.env (absent in CI).
      VITE_API_URL: 'https://localhost',
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})

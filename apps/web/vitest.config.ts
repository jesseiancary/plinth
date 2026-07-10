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
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})

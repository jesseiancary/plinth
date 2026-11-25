import react from '@vitejs/plugin-react'
import path from 'path'
import { defineConfig } from 'vite'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    host: true,
    // The browser reaches this dev server through the Caddy HTTPS proxy on
    // :443 — the Vite port (5173) is internal to the Docker network and not
    // published to the host. Point the HMR websocket at the proxy so Vite can
    // push live updates to the browser; otherwise it defaults to wss://localhost:5173
    // (unreachable) and HMR silently fails, forcing a manual refresh.
    hmr: {
      clientPort: 443,
    },
  },
})

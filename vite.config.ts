import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { serverApiPlugin } from './src/server/apiPlugin'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), serverApiPlugin()],
  server: {
    port: 5173,
    host: true,
    allowedHosts: true,
    proxy: {
      '/phpmyadmin': {
        target: 'http://127.0.0.1:8080',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/phpmyadmin/, '')
      }
    }
  }
})

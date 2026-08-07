import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api-codice': {
        target: 'https://codicetcg.org',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api-codice/, '/api')
      }
    }
  }
})
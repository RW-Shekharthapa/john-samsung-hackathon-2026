import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  server: {
    allowedHosts: true,
    // The app is served under /proxy/5173/; forward its /api calls to the backend.
    proxy: {
      '/proxy/5173/api': {
        target: 'http://localhost:8080',
        rewrite: (path) => path.replace(/^\/proxy\/5173/, ''),
      },
    },
  },
  plugins: [vue()],
})

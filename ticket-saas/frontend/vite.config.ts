import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:5000', // Replace with your backend URL/port
        changeOrigin: true,
        secure: false, // If using self-signed certs or HTTP; set to true for HTTPS
      },
    },
  },
})
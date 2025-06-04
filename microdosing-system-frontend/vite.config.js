import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    tailwindcss(),
  ],
  server: {
   proxy: {
  '/api': {
    target: 'http://localhost:5000', // ✅ CORRECT for local Flask
    changeOrigin: true,
    secure: false,
  },
},
  },
})

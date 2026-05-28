import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { newsletterPlugin } from './server/plugin.js'

export default defineConfig({
  plugins: [tailwindcss(), react(), newsletterPlugin()],
  server: {
    watch: {
      ignored: ['**/data/**'],
    },
  },
})

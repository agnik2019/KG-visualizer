import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Production is hosted at https://<user>.github.io/KG-visualizer/
// Local dev stays on "/" so the app and preset CSVs load without a prefix.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/KG-visualizer/' : '/',
  plugins: [react(), tailwindcss()],
  build: {
    chunkSizeWarningLimit: 6000,
  },
  server: {
    port: 5173,
  },
}))

import { existsSync, unlinkSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const RESEARCH_DATASETS = ['theorykg.csv', 'practicekg.csv']

/** Keep local preset files available in dev, but never copy them into a public build. */
function omitResearchDatasets(): Plugin {
  return {
    name: 'omit-research-datasets',
    apply: 'build',
    closeBundle() {
      for (const name of RESEARCH_DATASETS) {
        const file = resolve('dist/data', name)
        if (existsSync(file)) unlinkSync(file)
      }
    },
  }
}

// Production is hosted at https://<user>.github.io/KG-visualizer/
// Local dev stays on "/" so the app and preset CSVs load without a prefix.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/KG-visualizer/' : '/',
  plugins: [react(), tailwindcss(), omitResearchDatasets()],
  build: {
    chunkSizeWarningLimit: 6000,
  },
  server: {
    port: 5173,
  },
}))

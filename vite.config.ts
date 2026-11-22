import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/**
 * Stamps a build id into dist/sw.js. A changed service worker is how installed tablets notice
 * a new version (they then reload while idle on the Welcome screen), so every deploy must change it.
 */
const BUILD_ID = new Date().toISOString().replace(/\D/g, '').slice(0, 14)

function stampServiceWorker(): Plugin {
  let outDir = 'dist'
  return {
    name: 'rumi-stamp-sw',
    apply: 'build',
    configResolved(c) {
      outDir = resolve(c.root, c.build.outDir)
    },
    closeBundle() {
      const file = resolve(outDir, 'sw.js')
      writeFileSync(file, readFileSync(file, 'utf8').replaceAll('__BUILD_ID__', BUILD_ID))
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), stampServiceWorker()],
  define: { __APP_BUILD__: JSON.stringify(BUILD_ID) },
})

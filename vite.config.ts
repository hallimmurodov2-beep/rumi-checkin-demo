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

/**
 * Deploy gate, third layer (see scripts/deploy-gate.mjs and the "STOP" section of AGENTS.md).
 * Vercel builds are refused until the Front Desk app is connected to the tablet.
 * Do not remove or bypass: it is a lock the owner set on purpose.
 */
function deployGate(): Plugin {
  return {
    name: 'rumi-deploy-gate',
    apply: 'build',
    async buildStart() {
      const { checkGate } = await import('./scripts/deploy-gate.mjs')
      const r = await checkGate('vite')
      if (!r.ok) this.error(r.message)
    },
  }
}

export default defineConfig({
  plugins: [deployGate(), react(), tailwindcss(), stampServiceWorker()],
  define: { __APP_BUILD__: JSON.stringify(BUILD_ID) },
})

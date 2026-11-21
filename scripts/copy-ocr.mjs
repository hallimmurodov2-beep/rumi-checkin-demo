// Copies the OCR engine (Tesseract worker, WebAssembly core, English model) into
// public/ocr so tablets load it from our own site instead of a third-party CDN.
import { copyFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const out = 'public/ocr'
mkdirSync(join(out, 'lang'), { recursive: true })

const tesseractDir = dirname(require.resolve('tesseract.js/package.json'))
const coreDir = dirname(require.resolve('tesseract.js-core/package.json'))
const langDir = dirname(require.resolve('@tesseract.js-data/eng/package.json'))

copyFileSync(join(tesseractDir, 'dist/worker.min.js'), join(out, 'worker.min.js'))
for (const f of ['tesseract-core-lstm.wasm.js', 'tesseract-core-simd-lstm.wasm.js', 'tesseract-core-relaxedsimd-lstm.wasm.js']) {
  copyFileSync(join(coreDir, f), join(out, f))
}
copyFileSync(join(langDir, '4.0.0_best_int/eng.traineddata.gz'), join(out, 'lang/eng.traineddata.gz'))
console.log('OCR engine copied to public/ocr')

import { useEffect, useRef, useState, type RefObject } from 'react'
import type { Worker } from 'tesseract.js'
import { mrzLines, parseMrz } from './mrz'
import type { MrzData } from './types'

// Passport reading happens entirely on the tablet: camera frames are cropped
// to the MRZ area, cleaned up, read with Tesseract (OCR) and validated with
// the ICAO check digits. No image leaves the device.

let workerPromise: Promise<Worker> | null = null

/** Load the OCR engine once (about 5 MB, cached by the service worker afterwards). */
export function warmUpOcr(): Promise<Worker> {
  if (!workerPromise) {
    workerPromise = (async () => {
      const { createWorker, PSM } = await import('tesseract.js')
      // Engine, WebAssembly core and English model are served from our own site (public/ocr).
      const worker = await createWorker('eng', 1, {
        workerPath: '/ocr/worker.min.js',
        corePath: '/ocr',
        langPath: '/ocr/lang',
      })
      await worker.setParameters({
        tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<',
        tessedit_pageseg_mode: PSM.SINGLE_BLOCK,
        preserve_interword_spaces: '0',
      })
      return worker
    })().catch((e) => {
      workerPromise = null
      throw e
    })
  }
  return workerPromise
}

export type ScanState = 'starting' | 'scanning' | 'found' | 'unavailable'

/**
 * Crop the lower part of the on-screen guide frame (where the MRZ sits) out of
 * the current video frame, as a high-contrast greyscale canvas.
 */
function grabMrzRegion(video: HTMLVideoElement, guide: HTMLElement, mirrored: boolean, tall = false): HTMLCanvasElement | null {
  const vw = video.videoWidth
  const vh = video.videoHeight
  if (!vw || !vh) return null
  const vr = video.getBoundingClientRect()
  const gr = guide.getBoundingClientRect()
  // object-fit: cover mapping from screen to video pixels
  const scale = Math.max(vr.width / vw, vr.height / vh)
  const offX = (vr.width - vw * scale) / 2
  const offY = (vr.height - vh * scale) / 2
  let x = (gr.left - vr.left - offX) / scale
  const y = (gr.top - vr.top - offY) / scale
  const w = gr.width / scale
  const h = gr.height / scale
  if (mirrored) x = vw - x - w
  // MRZ lines occupy roughly the bottom 30% of the photo page; take 42% for tolerance,
  // and every other frame a taller band in case the passport sits high in the frame.
  const sy = y + h * (tall ? 0.4 : 0.58)
  const sh = h * (tall ? 0.6 : 0.42)
  const sx = Math.max(0, x)
  const sw = Math.min(vw - sx, w)
  if (sw <= 0 || sh <= 0) return null

  const target = 1400
  const k = target / sw
  const c = document.createElement('canvas')
  c.width = Math.round(sw * k)
  c.height = Math.round(sh * k)
  const ctx = c.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(video, sx, Math.max(0, sy), sw, Math.min(vh - sy, sh), 0, 0, c.width, c.height)

  // Greyscale + contrast stretch (MRZ is dark ink on a light background).
  const img = ctx.getImageData(0, 0, c.width, c.height)
  const d = img.data
  let min = 255
  let max = 0
  for (let i = 0; i < d.length; i += 4) {
    const g = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]
    d[i] = g
    if (g < min) min = g
    if (g > max) max = g
  }
  const range = Math.max(1, max - min)
  for (let i = 0; i < d.length; i += 4) {
    let v = ((d[i] - min) / range) * 255
    v = v < 110 ? v * 0.5 : Math.min(255, v * 1.15)
    d[i] = d[i + 1] = d[i + 2] = v
  }
  ctx.putImageData(img, 0, 0)
  return c
}

export function usePassportScanner(
  videoRef: RefObject<HTMLVideoElement | null>,
  guideRef: RefObject<HTMLElement | null>,
  facing: 'user' | 'environment',
  active: boolean,
) {
  const [state, setState] = useState<ScanState>('starting')
  const [result, setResult] = useState<MrzData | null>(null)
  const [almost, setAlmost] = useState(false)
  const stopped = useRef(false)

  useEffect(() => {
    if (!active) return
    stopped.current = false
    let stream: MediaStream | null = null
    setState('starting')
    setResult(null)

    const start = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setState('unavailable')
        return
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: { ideal: facing }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        })
      } catch {
        setState('unavailable')
        return
      }
      if (stopped.current) return
      const video = videoRef.current
      if (!video) return
      video.srcObject = stream
      await video.play().catch(() => {})
      const worker = await warmUpOcr().catch(() => null)
      if (stopped.current) return
      if (!worker) {
        setState('unavailable')
        return
      }
      setState('scanning')

      let frame = 0
      while (!stopped.current) {
        const guide = guideRef.current
        const canvas = guide && video.readyState >= 2 ? grabMrzRegion(video, guide, facing === 'user', frame++ % 2 === 1) : null
        if (canvas) {
          try {
            const { data } = await worker.recognize(canvas)
            const mrz = parseMrz(data.text)
            if (mrz && !stopped.current) {
              setResult(mrz)
              setState('found')
              break
            }
            // Two MRZ-looking lines but the check digits do not add up yet: the passport is
            // in view, so encourage the guest and keep the kiosk from timing out.
            const seen = mrzLines(data.text).filter((l) => l.length >= 28).length >= 2
            setAlmost(seen)
            if (seen) window.dispatchEvent(new Event('rumi-activity'))
          } catch {
            /* keep trying */
          }
        }
        await new Promise((r) => setTimeout(r, 200))
      }
    }
    start()

    return () => {
      stopped.current = true
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [active, facing, videoRef, guideRef])

  return { state, result, almost }
}

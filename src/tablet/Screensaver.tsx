import { useEffect, useRef, useState } from 'react'
import { Brand } from '../ui'
import { SLIDES } from './gallery'

const SLIDE_MS = 7500
const PROMPTS = [
  { lang: 'en', text: 'Touch the screen to check in' },
  { lang: 'ru', text: 'Коснитесь экрана, чтобы заселиться' },
  { lang: 'tg', text: 'Барои сабти ном ба экран даст расонед' },
]

/**
 * Full-screen photo slideshow shown when the welcome screen has been idle.
 * Slow zoom-and-drift on each photo, cross-fades between them, a trilingual
 * caption, and a "touch to check in" prompt. Any tap returns to Welcome.
 */
export function Screensaver({ onWake }: { onWake: () => void }) {
  const [index, setIndex] = useState(0)
  const [prev, setPrev] = useState<number | null>(null)
  const [prompt, setPrompt] = useState(0)
  const [leaving, setLeaving] = useState(false)
  const [now, setNow] = useState(() => new Date())
  const woke = useRef(false)

  useEffect(() => {
    const id = window.setInterval(() => {
      setIndex((i) => {
        setPrev(i)
        return (i + 1) % SLIDES.length
      })
    }, SLIDE_MS)
    const p = window.setInterval(() => setPrompt((x) => (x + 1) % PROMPTS.length), 3500)
    const c = window.setInterval(() => setNow(new Date()), 15_000)
    return () => {
      window.clearInterval(id)
      window.clearInterval(p)
      window.clearInterval(c)
    }
  }, [])

  // Warm the cache for the next photo so cross-fades never show a half-loaded image.
  useEffect(() => {
    const img = new Image()
    img.src = SLIDES[(index + 1) % SLIDES.length].src
  }, [index])

  const wake = () => {
    if (woke.current) return
    woke.current = true
    setLeaving(true)
    window.setTimeout(onWake, 450)
  }

  const slide = SLIDES[index]
  return (
    <div
      className={`ss-root fixed inset-0 z-[55] cursor-pointer select-none overflow-hidden bg-forest-deep ${leaving ? 'ss-out' : 'ss-in'}`}
      role="button"
      tabIndex={0}
      aria-label="Touch the screen to check in"
      onClick={wake}
      onKeyDown={wake}
    >
      {SLIDES.map((s, i) => {
        const state = i === index ? 'active' : i === prev ? 'prev' : ''
        return (
          <div key={s.src} className={`ss-slide ${state}`} aria-hidden="true">
            {(state || i === (index + 1) % SLIDES.length) && (
              <img src={s.src} alt="" decoding="async" draggable={false} className={`ss-photo ss-kb-${i % 4}`} />
            )}
          </div>
        )
      })}

      {/* Top bar */}
      <div className="absolute inset-x-0 top-0 z-10 flex items-start justify-between p-10">
        <div className="rounded-2xl bg-forest-deep/55 px-5 py-3.5 backdrop-blur-md">
          <Brand tone="light" />
        </div>
        <div className="rounded-2xl bg-forest-deep/55 px-5 py-3 text-right text-cream backdrop-blur-md">
          <div className="font-serif text-5xl font-semibold leading-none tabular-nums">
            {now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
          </div>
          <div className="mt-1 text-sm text-gold-light">{now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
        </div>
      </div>

      {/* Caption */}
      <div className="absolute bottom-10 left-10 z-10 max-w-[46%]">
        <div key={index} className="ss-caption rounded-2xl bg-forest-deep/60 px-6 py-5 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <span className="h-px w-10 bg-gold-light" aria-hidden="true" />
            <span className="text-xs font-semibold tracking-[0.25em] text-gold-light">THE RUMI · DUSHANBE</span>
          </div>
          <p className="mt-2 font-serif text-4xl font-semibold leading-tight text-cream">{slide.en}</p>
          <p className="mt-1 text-base text-cream/85">
            <span lang="ru">{slide.ru}</span>
            <span className="mx-2 text-gold-light" aria-hidden="true">·</span>
            <span lang="tg">{slide.tg}</span>
          </p>
          <div className="mt-4 h-0.5 overflow-hidden rounded-full bg-cream/20" aria-hidden="true">
            <div className="ss-progress h-full bg-gold-light" style={{ animationDuration: `${SLIDE_MS}ms` }} />
          </div>
        </div>
      </div>

      {/* Touch prompt */}
      <div className="absolute bottom-10 right-10 z-10">
        <div className="flex items-center gap-4 rounded-full bg-cream/95 py-3 pl-3 pr-7 shadow-[0_20px_50px_-20px_rgb(0_0_0/0.6)]">
          <span className="relative flex h-12 w-12 items-center justify-center" aria-hidden="true">
            <span className="ss-ping absolute inset-0 rounded-full bg-gold/40" />
            <span className="relative flex h-12 w-12 items-center justify-center rounded-full bg-forest text-gold-light">
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 11V5.5a1.5 1.5 0 013 0V10m0-1.5a1.5 1.5 0 013 0V11m0-1a1.5 1.5 0 013 0v4a6 6 0 01-6 6h-1a6 6 0 01-4.8-2.4L4.6 15a1.5 1.5 0 012.3-1.9L9 15" />
              </svg>
            </span>
          </span>
          <span key={prompt} lang={PROMPTS[prompt].lang} className="ss-prompt min-w-[300px] text-lg font-semibold text-forest">
            {PROMPTS[prompt].text}
          </span>
        </div>
      </div>
    </div>
  )
}

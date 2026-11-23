import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react'
import { useLang, useT } from '../i18n'
import type { Key } from '../translations'
import { ArrowLeft, ArrowRight, Brand } from '../ui'
import { SLIDES, type Category, type Slide } from './gallery'
import { SlideImage } from './SlideImage'
import { LangSwitch } from './Shell'
import './gallery.css'

type Filter = 'all' | Category
const FILTERS: { id: Filter; label: Key }[] = [
  { id: 'all', label: 'galleryAll' },
  { id: 'rooms', label: 'galleryRooms' },
  { id: 'dining', label: 'galleryDining' },
  { id: 'spaces', label: 'gallerySpaces' },
  { id: 'wellness', label: 'galleryWellness' },
]
const AUTOPLAY_MS = 5000
const SHIFT_MS = 350
const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
const mod = (n: number, m: number) => ((n % m) + m) % m

function CloseIcon({ className = 'h-6 w-6' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" className={className} aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  )
}

function PlayPauseIcon({ playing }: { playing: boolean }) {
  return playing ? (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5" aria-hidden="true">
      <rect x="6" y="5" width="4" height="14" rx="1" />
      <rect x="14" y="5" width="4" height="14" rx="1" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5" aria-hidden="true">
      <path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z" />
    </svg>
  )
}

/**
 * Full-screen hotel photo gallery guests can open from the Welcome screen or the screensaver:
 * swipe or tap the arrows, filter by rooms / dining / lobby, jump with the filmstrip, or start a slideshow.
 * It sits on top of Welcome, so a check-in sent by reception still opens straight away.
 */
export function Gallery({
  start = 0,
  onClose,
  onIdle,
  idleMs = 120_000,
}: {
  /** Index into SLIDES to open at. */
  start?: number
  onClose: () => void
  /** Called after idleMs without a touch (the kiosk goes back to the screensaver). */
  onIdle?: () => void
  idleMs?: number
}) {
  const t = useT()
  const lang = useLang()
  const [indexOpen, setIndexOpen] = useState(false)
  const [filter, setFilter] = useState<Filter>('all')
  const list = useMemo<Slide[]>(() => (filter === 'all' ? SLIDES : SLIDES.filter((s) => s.cat === filter)), [filter])
  const [i, setI] = useState(() => Number.isFinite(start) ? mod(Math.trunc(start), SLIDES.length) : 0)
  const [shift, setShift] = useState(0) // px offset of the photo strip while dragging or animating
  const [animating, setAnimating] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [playing, setPlaying] = useState(false)
  const stage = useRef<HTMLDivElement>(null)
  const strip = useRef<HTMLDivElement>(null)
  const drag = useRef<{ x: number; t: number; id: number } | null>(null)
  const pending = useRef(0)
  const indexBtn = useRef<HTMLButtonElement>(null)
  const indexGrid = useRef<HTMLDivElement>(null)
  const closeBtn = useRef<HTMLButtonElement>(null)
  const n = list.length
  const slide = list[i]

  useEffect(() => {
    const opener = document.activeElement
    closeBtn.current?.focus({ preventScroll: true })
    return () => {
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus({ preventScroll: true })
    }
  }, [])
  useEffect(() => {
    if (indexOpen) indexGrid.current?.querySelector<HTMLElement>('[aria-current="true"]')?.focus()
  }, [indexOpen])

  // Slide one photo left or right with an animation, then re-centre the strip.
  const step = useCallback(
    (dir: 1 | -1) => {
      if (n < 2 || pending.current) return
      if (reducedMotion()) {
        setShift(0)
        setI((x) => mod(x + dir, n))
        return
      }
      const w = stage.current?.clientWidth ?? window.innerWidth
      pending.current = dir
      setAnimating(true)
      setShift(-dir * w)
    },
    [n],
  )
  const settle = useCallback(() => {
    if (!pending.current) return
    const dir = pending.current
    pending.current = 0
    setAnimating(false)
    setShift(0)
    setI((x) => mod(x + dir, n))
  }, [n])

  // A fully dragged page or a hidden WebView may not emit transitionend.
  useEffect(() => {
    if (!animating) return
    const timer = window.setTimeout(settle, SHIFT_MS + 60)
    return () => window.clearTimeout(timer)
  }, [animating, settle])

  const jump = (to: number) => {
    pending.current = 0
    setAnimating(false)
    setShift(0)
    setI(to)
  }

  const user = () => setPlaying(false)

  // Slideshow.
  useEffect(() => {
    if (!playing) return
    const id = window.setTimeout(() => step(1), AUTOPLAY_MS)
    return () => window.clearTimeout(id)
  }, [playing, i, step])

  // Close by itself when nobody has touched it for a while. (Callbacks via refs: the kiosk re-renders
  // every minute, and re-subscribing would restart the timer.)
  const onIdleRef = useRef(onIdle)
  useEffect(() => {
    onIdleRef.current = onIdle
  })
  const hasIdle = !!onIdle
  useEffect(() => {
    if (!hasIdle) return
    let last = Date.now()
    const touch = () => (last = Date.now())
    const evts = ['pointerdown', 'keydown', 'touchstart']
    evts.forEach((e) => window.addEventListener(e, touch, { passive: true }))
    const id = window.setInterval(() => {
      if (Date.now() - last >= idleMs) onIdleRef.current?.()
    }, 1000)
    return () => {
      evts.forEach((e) => window.removeEventListener(e, touch))
      window.clearInterval(id)
    }
  }, [hasIdle, idleMs])

  const showIndex = () => {
    user()
    jump(i)
    setIndexOpen(true)
  }

  const leaveIndex = (photo: number) => {
    jump(photo)
    setIndexOpen(false)
    requestAnimationFrame(() => indexBtn.current?.focus({ preventScroll: true }))
  }

  const onKey = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Tab') {
      const controls = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not([disabled])')]
        .filter((button) => button.tabIndex >= 0 && button.getClientRects().length)
      const first = controls[0]
      const last = controls[controls.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last?.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first?.focus()
      }
    } else if (event.key === 'Escape') {
      event.preventDefault()
      if (indexOpen) leaveIndex(i)
      else onClose()
    } else if (!indexOpen && (event.key === 'ArrowRight' || event.key === 'ArrowLeft')) {
      event.preventDefault()
      user()
      step(event.key === 'ArrowRight' ? 1 : -1)
    }
  }

  // Keep the active thumbnail in view.
  useEffect(() => {
    const el = strip.current?.querySelector<HTMLElement>(`[data-thumb="${i}"]`)
    const box = strip.current
    if (!el || !box) return
    box.scrollTo({ left: el.offsetLeft - box.clientWidth / 2 + el.clientWidth / 2, behavior: reducedMotion() ? 'instant' : 'smooth' })
  }, [i, filter, indexOpen])

  const chooseFilter = (f: Filter) => {
    if (f === filter) return
    user()
    const next = f === 'all' ? SLIDES : SLIDES.filter((s) => s.cat === f)
    const keep = next.findIndex((s) => s.src === slide?.src)
    pending.current = 0
    setAnimating(false)
    setShift(0)
    setFilter(f)
    setI(keep >= 0 ? keep : 0)
  }

  // Swipe with one finger: the photo follows the finger, then snaps to the next one.
  const onDown = (e: ReactPointerEvent) => {
    if (pending.current || !e.isPrimary) return
    drag.current = { x: e.clientX, t: performance.now(), id: e.pointerId }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    setDragging(true)
    user()
  }
  const onMove = (e: ReactPointerEvent) => {
    const d = drag.current
    if (!d || d.id !== e.pointerId) return
    const dx = e.clientX - d.x
    setShift(n < 2 ? dx * 0.25 : dx)
  }
  const onUp = (e: ReactPointerEvent) => {
    const d = drag.current
    if (!d || d.id !== e.pointerId) return
    drag.current = null
    setDragging(false)
    const dx = e.clientX - d.x
    const w = stage.current?.clientWidth ?? window.innerWidth
    const speed = Math.abs(dx) / Math.max(1, performance.now() - d.t) // px per ms
    if (n > 1 && (Math.abs(dx) > w * 0.18 || (Math.abs(dx) > 30 && speed > 0.45))) {
      step(dx < 0 ? 1 : -1)
    } else {
      setAnimating(!reducedMotion())
      setShift(0)
    }
  }

  const panels = n === 0 ? [] : n === 1 ? [0] : [-1, 0, 1]

  return (
    <div onKeyDown={onKey} className={`gl-root ${indexOpen ? 'gl-index-open' : ''} fixed [&_button]:pointer-events-auto inset-0 z-[54] select-none overflow-hidden bg-forest-deep text-cream`} role="dialog" aria-modal="true" aria-label={t('galleryTitle')}>
      {/* Photos */}
      {!indexOpen && <>
        <div
          ref={stage}
          className="absolute inset-0 touch-none"
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={() => {
            drag.current = null
            setDragging(false)
            setShift(0)
          }}
        >
          <div
            className="absolute inset-0"
            style={{
              transform: `translate3d(${shift}px,0,0)`,
              transition: animating && !dragging ? `transform ${SHIFT_MS}ms cubic-bezier(0.2, 0.8, 0.2, 1)` : 'none',
            }}
            onTransitionEnd={(e) => {
              if (e.target !== e.currentTarget) return
              setAnimating(false)
              settle()
            }}
          >
            {panels.map((k) => {
              const idx = mod(i + k, n)
              const s = list[idx]
              return (
                <div key={n > 2 ? s.src : `${k}:${s.src}`} className="absolute inset-0" style={{ transform: `translate3d(${k * 100}%,0,0)` }} aria-hidden={k !== 0}>
                  <SlideImage slide={s} alt={k === 0 ? s[lang] : ''} />
                </div>
              )
            })}
          </div>
        </div>
        <div className="gl-scrim pointer-events-none absolute inset-0" aria-hidden="true" />
      </>}

      {/* Top bar */}
      <header className="gl-head gl-fade-down pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between gap-6 px-8 pt-6 xl:px-10">
        <div className="gl-brand">
          <Brand tone="light" />
        </div>
        <div className="gl-filters pointer-events-auto flex gap-1 rounded-2xl bg-forest-deep/55 p-1 backdrop-blur-md" role="group" aria-label={t('galleryTitle')}>
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              aria-pressed={filter === f.id}
              onClick={() => chooseFilter(f.id)}
              className={`min-h-14 cursor-pointer whitespace-nowrap rounded-xl px-5 text-base font-medium transition ${
                filter === f.id ? 'bg-cream text-forest' : 'text-cream/85 hover:bg-cream/10'
              }`}
            >
              {t(f.label)}
            </button>
          ))}
        </div>
        <div className="gl-ctl flex items-center gap-3">
          <LangSwitch tone="dark" />
          <button
            ref={closeBtn}
            type="button"
            onClick={onClose}
            className="flex min-h-14 cursor-pointer items-center gap-2 rounded-xl bg-cream px-5 text-base font-semibold text-forest shadow-lg transition active:scale-[0.97]"
          >
            <CloseIcon className="h-5 w-5" /> {t('galleryClose')}
          </button>
        </div>
      </header>

      {indexOpen ? (
        <section className="gl-index" aria-labelledby="photo-index-title">
          <h2 id="photo-index-title" className="gl-index-heading">{t('galleryIndex')} <span>{n}</span></h2>
          <div key={filter} ref={indexGrid} className="gl-index-grid">
            {list.map((photo, position) => (
              <button type="button" key={photo.src} aria-current={position === i} onClick={() => leaveIndex(position)}>
                <img src={photo.thumb} alt="" loading="lazy" decoding="async" draggable={false} />
                <span className="gl-index-label"><span>{photo[lang]}</span><small>{position + 1}</small></span>
              </button>
            ))}
          </div>
        </section>
      ) : <>
        {/* Arrows */}
        {n > 1 && (
          <>
            <button
              type="button"
              aria-label={t('galleryPrev')}
              onClick={() => (user(), step(-1))}
              className="gl-arrow left-6 xl:left-8"
            >
              <ArrowLeft className="h-7 w-7" />
            </button>
            <button
              type="button"
              aria-label={t('galleryNext')}
              onClick={() => (user(), step(1))}
              className="gl-arrow right-6 xl:right-8"
            >
              <ArrowRight className="h-7 w-7" />
            </button>
          </>
        )}

        {/* Caption, counter, slideshow and filmstrip */}
        <footer className="gl-foot gl-fade-up pointer-events-none absolute inset-x-0 bottom-0 px-8 pb-6 xl:px-10">
          {slide && (
            <div className="gl-foot-row flex items-end justify-between gap-6">
              <div key={`${filter}:${i}`} className="gl-caption min-w-0">
                <p className="gl-title font-serif text-5xl font-semibold leading-tight text-cream">{slide[lang]}</p>
              </div>
              <div className="gl-tools flex shrink-0 items-center gap-4">
                <button ref={indexBtn} type="button" className="gl-index-button" onClick={showIndex}>
                  <svg viewBox="0 0 20 20" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                    <rect x="2" y="2" width="6" height="6" rx="1" /><rect x="12" y="2" width="6" height="6" rx="1" />
                    <rect x="2" y="12" width="6" height="6" rx="1" /><rect x="12" y="12" width="6" height="6" rx="1" />
                  </svg>
                  {t('galleryIndex')}
                </button>
                <span className="font-serif text-3xl font-semibold tabular-nums text-cream gl-count" aria-hidden="true">
                  {i + 1}
                  <span className="mx-1.5 text-gold-light">/</span>
                  {n}
                </span>
                {n > 1 && (
                  <button
                    type="button"
                    onClick={() => setPlaying((p) => !p)}
                    aria-pressed={playing}
                    className="relative flex min-h-14 cursor-pointer items-center gap-2 overflow-hidden rounded-xl border border-cream/30 bg-forest-deep/55 px-5 text-base font-medium text-cream backdrop-blur-md transition active:scale-[0.97]"
                  >
                    <PlayPauseIcon playing={playing} />
                    {playing ? t('galleryPause') : t('galleryPlay')}
                    {playing && (
                      <span key={i} className="gl-progress absolute inset-x-0 bottom-0 h-0.5 bg-gold-light" style={{ animationDuration: `${AUTOPLAY_MS}ms` }} aria-hidden="true" />
                    )}
                  </button>
                )}
              </div>
            </div>
          )}
          <p aria-live={playing ? 'off' : 'polite'} aria-atomic="true" className="sr-only">{slide[lang]}. {t('galleryPosition', { i: i + 1, n })}</p>
          <div ref={strip} className="gl-strip pointer-events-auto mt-5 flex gap-2.5 overflow-x-auto pb-1">
            {list.map((s, k) => (
              <button
                key={s.src}
                type="button"
                data-thumb={k}
                onClick={() => (user(), jump(k))}
                aria-label={`${s[lang]}. ${t('galleryPosition', { i: k + 1, n })}`}
                aria-current={k === i}
                className={`gl-thumb relative h-[68px] w-[102px] shrink-0 cursor-pointer overflow-hidden rounded-lg ${k === i ? 'is-active' : ''}`}
              >
                <img src={s.thumb} alt="" loading="lazy" decoding="async" draggable={false} className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        </footer>
      </>}
    </div>
  )
}

export function GalleryTile({ onOpen, className = '', style }: { onOpen: () => void; className?: string; style?: CSSProperties }) {
  const t = useT()
  return (
    <button type="button" onClick={onOpen} style={style} className={`gl-tile ${className}`}>
      <img className="gl-tile-photo" src="/gallery/thumbs/deluxe-king-room.webp" alt="" draggable={false} />
      <span className="gl-tile-content">
        <span className="gl-tile-title">{t('galleryTitle')}</span>
        <span className="gl-tile-sub">{t('gallerySub', { n: SLIDES.length })}</span>
      </span>
      <span className="gl-tile-arrow" aria-hidden="true"><ArrowRight className="h-5 w-5" /></span>
    </button>
  )
}

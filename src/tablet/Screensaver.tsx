import { useEffect, useRef, useState } from 'react'
import { Brand } from '../ui'
import { SLIDES } from './gallery'

const SLIDE_MS = 7500

const HOME_TZ = 'Asia/Dushanbe'

/** Cities guests most often travel from or connect through; edit to change what the screensaver shows. */
const WORLD_CLOCKS = [
  { tz: 'Europe/Moscow', en: 'Moscow', ru: 'Москва' },
  { tz: 'Asia/Dubai', en: 'Dubai', ru: 'Дубай' },
  { tz: 'Asia/Shanghai', en: 'Beijing', ru: 'Пекин' },
] as const

const hm = (d: Date, tz: string) => d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: tz })

/** The calendar day and UTC offset (in minutes) of a moment in a time zone. */
function zoneInfo(d: Date, tz: string) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric' })
      .formatToParts(d)
      .map((p) => [p.type, Number(p.value)]),
  )
  const wall = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute)
  return { day: Math.floor(wall / 86_400_000), offset: Math.round((wall - Math.floor(d.getTime() / 60_000) * 60_000) / 60_000) }
}

function offsetLabel(minutes: number) {
  if (minutes === 0) return 'same time'
  const h = Math.abs(minutes) / 60
  return `${minutes < 0 ? '\u2212' : '+'}${Number.isInteger(h) ? h : h.toFixed(1)} h`
}

function WorldClocks({ now }: { now: Date }) {
  const home = zoneInfo(now, HOME_TZ)
  return (
    <div className="rounded-2xl bg-forest-deep/55 px-3 py-4 text-cream backdrop-blur-md" role="group" aria-label="World clocks">
      <ul className="flex items-stretch">
        {WORLD_CLOCKS.map((c, i) => {
          const z = zoneInfo(now, c.tz)
          const dayShift = z.day - home.day
          return (
            <li key={c.tz} className={`flex min-w-[148px] flex-col items-center px-5 ${i > 0 ? 'border-l border-gold-light/25' : ''}`}>
              <span className="text-[11px] font-semibold tracking-[0.22em] text-gold-light">{c.en.toUpperCase()}</span>
              <span className="mt-0.5 text-sm text-cream/70" lang="ru">{c.ru}</span>
              <span className="mt-2 font-serif text-4xl font-semibold leading-none tabular-nums">
                {hm(now, c.tz)}
                {dayShift !== 0 && <sup className="ml-1 align-super font-sans text-xs font-semibold text-gold-light">{dayShift > 0 ? '+1' : '\u22121'}</sup>}
              </span>
              <span className="mt-2 text-xs tabular-nums text-cream/65">{offsetLabel(z.offset - home.offset)}</span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

/**
 * Full-screen photo slideshow shown when the welcome screen has been idle.
 * Slow zoom-and-drift on each photo, cross-fades between them, a trilingual
 * caption and the clock. Any tap returns to Welcome.
 */
export function Screensaver({ onWake }: { onWake: () => void }) {
  const [index, setIndex] = useState(0)
  const [prev, setPrev] = useState<number | null>(null)
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
    const c = window.setInterval(() => setNow(new Date()), 5_000)
    return () => {
      window.clearInterval(id)
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
          <div className="text-[11px] font-semibold tracking-[0.25em] text-gold-light">DUSHANBE</div>
          <div className="mt-1 font-serif text-5xl font-semibold leading-none tabular-nums">{hm(now, HOME_TZ)}</div>
          <div className="mt-1 text-sm text-gold-light">{now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: HOME_TZ })}</div>
        </div>
      </div>

      {/* World clocks */}
      <div className="absolute bottom-10 right-10 z-10">
        <WorldClocks now={now} />
      </div>

      {/* Caption */}
      <div className="absolute bottom-10 left-10 z-10 max-w-[40%]">
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

    </div>
  )
}

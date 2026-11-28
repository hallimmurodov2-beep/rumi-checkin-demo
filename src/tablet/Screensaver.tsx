import { useEffect, useRef, useState } from 'react'
import { useLang, useT } from '../i18n'
import type { Lang } from '../translations'
import { Brand } from '../ui'
import { SLIDES } from './gallery'
import { SlideImage } from './SlideImage'
import { HOTEL_ZONE, hotelDate, isDay, useMinute, versusHotel, wallClock } from './clock'
import './screensaver.css'

const SLIDE_MS = 7500

/** World clocks shown under the photos. Edit this list to change the cities. */
const WORLD_CLOCKS = [
  { zone: 'America/New_York', en: 'New York', ru: 'Нью-Йорк', tg: 'Ню-Йорк' },
  { zone: 'Europe/London', en: 'London', ru: 'Лондон', tg: 'Лондон' },
  { zone: 'Asia/Dubai', en: 'Dubai', ru: 'Дубай', tg: 'Дубай' },
  { zone: 'Asia/Tokyo', en: 'Tokyo', ru: 'Токио', tg: 'Токио' },
] as const
const HOME_CITY: Record<Lang, string> = { en: 'Dushanbe', ru: 'Душанбе', tg: 'Душанбе' }



/** An analog dial with hour marks: a light face by day, a dark one by night. */
function Dial({ h, m }: { h: number; m: number }) {
  return (
    <span className={`ss-dial ${isDay(h) ? 'ss-day' : 'ss-night'}`} aria-hidden="true">
      {Array.from({ length: 12 }, (_, i) => (
        <b key={i} className={i % 3 === 0 ? 'ss-mark ss-mark-q' : 'ss-mark'} style={{ transform: `rotate(${i * 30}deg)` }} />
      ))}
      <i className="ss-hour-hand" style={{ transform: `rotate(${(h % 12) * 30 + m / 2}deg)` }} />
      <i className="ss-minute-hand" style={{ transform: `rotate(${m * 6}deg)` }} />
    </span>
  )
}

/** A small sun by day, a crescent moon by night. */
function DayNight({ h }: { h: number }) {
  return isDay(h) ? (
    <svg viewBox="0 0 16 16" className="ss-sky" aria-hidden="true">
      <circle cx="8" cy="8" r="3.2" fill="currentColor" />
      <g stroke="currentColor" strokeWidth="1.3" strokeLinecap="round">
        <path d="M8 1.2v1.6M8 13.2v1.6M1.2 8h1.6M13.2 8h1.6M3.2 3.2l1.1 1.1M11.7 11.7l1.1 1.1M3.2 12.8l1.1-1.1M11.7 4.3l1.1-1.1" />
      </g>
    </svg>
  ) : (
    <svg viewBox="0 0 16 16" className="ss-sky" aria-hidden="true">
      <path d="M13.6 10.2A6 6 0 015.8 2.4a6 6 0 107.8 7.8z" fill="currentColor" />
    </svg>
  )
}

/** "4 h ahead · Tomorrow" compared with Dushanbe. */
function useVersus() {
  const t = useT()
  return (d: Date, zone: string) => {
    const { hours, days } = versusHotel(d, zone)
    const n = String(Math.abs(hours)).replace('.5', '½')
    const diff = hours === 0 ? t('clockSame') : t(hours > 0 ? 'clockAhead' : 'clockBehind', { n })
    return { diff, day: days > 0 ? t('clockTomorrow') : days < 0 ? t('clockYesterday') : null }
  }
}

/**
 * Full-screen photo slideshow shown when the welcome screen has been idle: slow zoom-and-drift,
 * cross-fades, a trilingual caption, the Dushanbe time and four world clocks. Any tap returns to Welcome.
 */
export function Screensaver({ onWake }: { onWake: () => void }) {
  const [index, setIndex] = useState(0)
  const [prev, setPrev] = useState<number | null>(null)
  const [leaving, setLeaving] = useState(false)
  const now = useMinute()
  const lang = useLang()
  const versus = useVersus()
  const woke = useRef(false)

  useEffect(() => {
    const id = window.setInterval(() => {
      setIndex((i) => {
        setPrev(i)
        return (i + 1) % SLIDES.length
      })
    }, SLIDE_MS)
    return () => window.clearInterval(id)
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

  // One tap anywhere brings Welcome back. The last tap of the 3-tap that STARTS the screensaver
  // must not count, so a tap in the first moments is ignored.
  const shownAt = useRef(performance.now())
  const tapWake = () => {
    if (performance.now() - shownAt.current < 700) return
    wake()
  }

  const slide = SLIDES[index]
  const home = wallClock(now, HOTEL_ZONE)
  return (
    <div
      className={`ss-root fixed inset-0 z-[55] cursor-pointer select-none overflow-hidden bg-forest-deep ${leaving ? 'ss-out' : 'ss-in'}`}
      role="button"
      tabIndex={0}
      aria-label="Touch the screen"
      onClick={tapWake}
      onKeyDown={wake}
    >
      {SLIDES.map((s, i) => {
        const state = i === index ? 'active' : i === prev ? 'prev' : ''
        return (
          <div key={s.src} className={`ss-slide ${state}`} aria-hidden="true">
            {(state || i === (index + 1) % SLIDES.length) && (
              <SlideImage slide={s} className={`ss-kb-${i % 4}`} />
            )}
          </div>
        )
      })}

      <div className="ss-masthead">
        <div className="rounded-2xl bg-forest-deep/55 px-5 py-3.5 backdrop-blur-md">
          <Brand tone="light" />
        </div>
        <div className="ss-home-clock">
          <Dial h={home.h} m={home.m} />
          <div>
            <div className="ss-home-city">
              <DayNight h={home.h} />
              {HOME_CITY[lang]}
            </div>
            <time className="ss-home-time">{home.text}</time>
            <div className="ss-home-date">{hotelDate(now, lang)}</div>
          </div>
        </div>
      </div>

      <div className="ss-lower">
        <div className="ss-caption-wrap">
          <div key={index} className="ss-caption rounded-2xl bg-forest-deep/60 px-6 py-4 backdrop-blur-md">
            <div className="flex items-center gap-3">
              <span className="h-px w-10 bg-gold-light" aria-hidden="true" />
              <span className="text-xs font-semibold tracking-[0.25em] text-gold-light">THE RUMI · DUSHANBE</span>
            </div>
            <p lang="en" className="mt-2 font-serif text-4xl font-semibold leading-tight text-cream">{slide.en}</p>
            <div className="mt-3 h-0.5 overflow-hidden rounded-full bg-cream/20" aria-hidden="true">
              <div className="ss-progress h-full bg-gold-light" style={{ animationDuration: `${SLIDE_MS}ms` }} />
            </div>
          </div>
        </div>
        <div className="ss-clock-rail">
          {WORLD_CLOCKS.map((c) => {
            const w = wallClock(now, c.zone)
            const v = versus(now, c.zone)
            return (
              <div key={c.zone} className="ss-world-clock">
                <Dial h={w.h} m={w.m} />
                <div className="min-w-0">
                  <div className="ss-city">
                    <DayNight h={w.h} />
                    {c[lang]}
                  </div>
                  <time className="ss-time">{w.text}</time>
                  <div className="ss-diff">
                    {v.diff}
                    {v.day && <span className="ss-day-tag">{v.day}</span>}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

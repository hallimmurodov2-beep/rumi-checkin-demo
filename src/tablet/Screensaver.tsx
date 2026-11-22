import { useEffect, useRef, useState } from 'react'
import { useLang } from '../i18n'
import type { Lang } from '../translations'
import { Brand } from '../ui'
import { SLIDES } from './gallery'
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
const LOCALE: Record<Lang, string> = { en: 'en-GB', ru: 'ru-RU', tg: 'tg-TJ' }

const timeIn = (zone: string) => new Intl.DateTimeFormat('en-GB', { timeZone: zone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
const HOME_TIME = timeIn('Asia/Dushanbe')
const CLOCKS = WORLD_CLOCKS.map((c) => ({ ...c, format: timeIn(c.zone) }))

function homeDate(d: Date, lang: Lang) {
  return d.toLocaleDateString(LOCALE[lang], { timeZone: 'Asia/Dushanbe', weekday: 'long', day: 'numeric', month: 'long' })
}

/** A small analog dial for "HH:MM". */
function Dial({ time }: { time: string }) {
  const [h, m] = time.split(':').map(Number)
  return (
    <span className="ss-dial" aria-hidden="true">
      <i className="ss-hour-hand" style={{ transform: `rotate(${(h % 12) * 30 + m / 2}deg)` }} />
      <i className="ss-minute-hand" style={{ transform: `rotate(${m * 6}deg)` }} />
    </span>
  )
}

/**
 * Full-screen photo slideshow shown when the welcome screen has been idle: slow zoom-and-drift,
 * cross-fades, a trilingual caption, the Dushanbe time and four world clocks. Any tap returns to Welcome.
 */
export function Screensaver({ onWake }: { onWake: () => void }) {
  const [index, setIndex] = useState(0)
  const [prev, setPrev] = useState<number | null>(null)
  const [leaving, setLeaving] = useState(false)
  const [now, setNow] = useState(() => new Date())
  const lang = useLang()
  const woke = useRef(false)

  useEffect(() => {
    const id = window.setInterval(() => {
      setIndex((i) => {
        setPrev(i)
        return (i + 1) % SLIDES.length
      })
    }, SLIDE_MS)
    // Tick exactly on the minute.
    let t: number | undefined
    const tick = () => {
      window.clearTimeout(t)
      setNow(new Date())
      t = window.setTimeout(tick, 60_000 - (Date.now() % 60_000))
    }
    tick()
    document.addEventListener('visibilitychange', tick)
    return () => {
      window.clearInterval(id)
      window.clearTimeout(t)
      document.removeEventListener('visibilitychange', tick)
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
      aria-label="Touch the screen"
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

      <div className="ss-masthead">
        <div className="rounded-2xl bg-forest-deep/55 px-5 py-3.5 backdrop-blur-md">
          <Brand tone="light" />
        </div>
        <div className="ss-home-clock">
          <div className="ss-home-city">{HOME_CITY[lang]}</div>
          <time className="ss-home-time">{HOME_TIME.format(now)}</time>
          <div className="ss-home-date">{homeDate(now, lang)}</div>
        </div>
      </div>

      <div className="ss-lower">
        <div className="ss-caption-wrap">
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
        <div className="ss-clock-rail">
          {CLOCKS.map((c) => {
            const time = c.format.format(now)
            return (
              <div key={c.zone} className="ss-world-clock">
                <Dial time={time} />
                <div>
                  <div className="ss-city">{c[lang]}</div>
                  <time className="ss-time">{time}</time>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

import { useEffect, useState } from 'react'
import { LOCALE, type Lang } from '../translations'

export const HOTEL_ZONE = 'Asia/Dushanbe'

/** The current time, updated exactly on each new minute (and when the tablet wakes). */
export function useMinute(): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    let t: number | undefined
    const tick = () => {
      window.clearTimeout(t)
      setNow(new Date())
      t = window.setTimeout(tick, 60_000 - (Date.now() % 60_000) + 50)
    }
    tick()
    document.addEventListener('visibilitychange', tick)
    return () => {
      window.clearTimeout(t)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [])
  return now
}

const partsCache = new Map<string, Intl.DateTimeFormat>()
function parts(zone: string) {
  let f = partsCache.get(zone)
  if (!f) {
    f = new Intl.DateTimeFormat('en-GB', { timeZone: zone, year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', hourCycle: 'h23' })
    partsCache.set(zone, f)
  }
  return f
}

/** Wall-clock time in a zone: hours, minutes, and the local date as a UTC midnight timestamp. */
export function wallClock(d: Date, zone: string) {
  const p = Object.fromEntries(parts(zone).formatToParts(d).map((x) => [x.type, x.value]))
  const h = Number(p.hour) % 24
  const m = Number(p.minute)
  const day = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day))
  return { h, m, day, text: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}` }
}

/** How a city's clock compares with the hotel's: whole hours (may be fractional) and calendar days. */
export function versusHotel(d: Date, zone: string) {
  const a = wallClock(d, zone)
  const b = wallClock(d, HOTEL_ZONE)
  const mins = (a.day - b.day) / 60_000 + (a.h * 60 + a.m) - (b.h * 60 + b.m)
  return { hours: Math.round((mins / 60) * 2) / 2, days: Math.round((a.day - b.day) / 86_400_000) }
}

/** Daytime between 06:00 and 18:59 local time. */
export const isDay = (h: number) => h >= 6 && h < 19

const TG_WEEKDAYS = ['Якшанбе', 'Душанбе', 'Сешанбе', 'Чоршанбе', 'Панҷшанбе', 'Ҷумъа', 'Шанбе']
const TG_MONTHS = ['январ', 'феврал', 'март', 'апрел', 'май', 'июн', 'июл', 'август', 'сентябр', 'октябр', 'ноябр', 'декабр']

/** "Saturday 28 November" in the hotel's time zone. Tajik is written out by hand: browsers often lack its date names. */
export function hotelDate(d: Date, lang: Lang): string {
  if (lang === 'tg') {
    const day = new Date(wallClock(d, HOTEL_ZONE).day)
    return `${TG_WEEKDAYS[day.getUTCDay()]}, ${day.getUTCDate()} ${TG_MONTHS[day.getUTCMonth()]}`
  }
  return d.toLocaleDateString(LOCALE[lang], { timeZone: HOTEL_ZONE, weekday: 'long', day: 'numeric', month: 'long' })
}

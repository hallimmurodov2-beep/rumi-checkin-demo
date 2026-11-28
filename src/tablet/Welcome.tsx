import { useEffect, useRef, useState } from 'react'
import { useLang, useT } from '../i18n'
import { LANGS, type Lang } from '../translations'
import { inKioskApp } from '../lib/kiosk'
import { VisitorWifi } from './frontdesk'
import { HOTEL_ZONE, hotelDate, useMinute, wallClock } from './clock'
import { GalleryTile } from './PhotoGallery'
import './welcome.css'
import { CheckIcon, COLORS, Emblem, ExpandIcon } from '../ui'

function useFullscreenAvailable() {
  const check = () => {
    const d = document as Document & { webkitFullscreenElement?: Element }
    const standalone =
      window.matchMedia('(display-mode: fullscreen)').matches || window.matchMedia('(display-mode: standalone)').matches
    const el = document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => void }
    const can = !!(el.requestFullscreen || el.webkitRequestFullscreen)
    // The kiosk app is already full screen.
    return can && !standalone && !inKioskApp && !(document.fullscreenElement || d.webkitFullscreenElement)
  }
  const [show, setShow] = useState(check)
  useEffect(() => {
    const on = () => setShow(check())
    document.addEventListener('fullscreenchange', on)
    document.addEventListener('webkitfullscreenchange', on)
    return () => {
      document.removeEventListener('fullscreenchange', on)
      document.removeEventListener('webkitfullscreenchange', on)
    }
  }, [])
  return show
}

function enterFullscreen() {
  const el = document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => void }
  if (el.requestFullscreen) el.requestFullscreen().catch(() => {})
  else el.webkitRequestFullscreen?.()
}

/** Hotel time in the photo's top-right corner: city, a large gold time and today's date in the guest's language. */
function HotelTime() {
  const now = useMinute()
  const t = useT()
  const lang = useLang()
  const w = wallClock(now, HOTEL_ZONE)
  const date = hotelDate(now, lang)
  return (
    <div className="wl-local">
      <span className="wl-local-city">{t('hotelCity')}</span>
      <time className="wl-local-time" dateTime={now.toISOString()}>
        {w.text.slice(0, 2)}
        <span className="wl-local-colon">:</span>
        {w.text.slice(3)}
      </time>
      <span className="wl-local-date">{date}</span>
    </div>
  )
}

export function Welcome({
  lang,
  setLang,
  onSettings,
  onGallery,
  hotelName,
}: {
  lang: Lang
  setLang: (l: Lang) => void
  onSettings: () => void
  /** Opens the hotel photo gallery. */
  onGallery?: () => void
  hotelName: string
}) {
  const t = useT()
  const canFullscreen = useFullscreenAvailable()
  // Staff: press and hold the emblem for 3 seconds to open tablet settings.
  const hold = useRef<number | undefined>(undefined)
  const startHold = () => {
    window.clearTimeout(hold.current)
    hold.current = window.setTimeout(onSettings, 3000)
  }
  const endHold = () => window.clearTimeout(hold.current)
  useEffect(() => () => window.clearTimeout(hold.current), [])
  return (
    <main className="wl-root" lang={lang}>
      <section className="wl-brand" aria-label={hotelName}>
        <img src="/gallery/lobby-atrium.webp" alt="" className="wl-photo" fetchPriority="high" draggable={false} />
        <div className="wl-topbar">
          <div className="wl-brandbar">
            <div
              data-no-tap
              onPointerDown={startHold}
              onPointerUp={endHold}
              onPointerLeave={endHold}
              onPointerCancel={endHold}
            >
              <Emblem color={COLORS.goldLight} className="wl-emblem" />
            </div>
            <div className="wl-wordmark" lang="en">
              <p>THE RUMI</p>
              <p>HOTEL AND RESIDENCES</p>
            </div>
          </div>
          <HotelTime />
        </div>
        <div className="wl-hello">
          <span className="wl-ornament" aria-hidden="true">
            <i />
            <b />
            <i />
          </span>
          <h1>{t('hotelWelcome')}</h1>
          <p className="wl-tagline">{t('hotelTagline')}</p>
        </div>
      </section>

      <section className="wl-main" aria-labelledby="wl-checkin-title">
        <div className="wl-content">
          <div className="wl-language-area">
            <div className="wl-utilities">
              <p id="wl-language-label">{t('chooseLanguage')}</p>
              {canFullscreen && (
                <button type="button" onClick={enterFullscreen} className="wl-fs" aria-label={t('fullscreen')} title={t('fullscreen')}>
                  <ExpandIcon className="h-5 w-5" />
                </button>
              )}
            </div>
            <div className="wl-languages" role="group" aria-labelledby="wl-language-label">
              {LANGS.map((l) => (
                <button key={l.code} type="button" lang={l.code} aria-pressed={lang === l.code} onClick={() => setLang(l.code)}>
                  {l.label}
                  {lang === l.code && <CheckIcon className="wl-language-check" />}
                </button>
              ))}
            </div>
          </div>
          <div className="wl-checkin">
            <span className="wl-passport" aria-hidden="true">
              <Emblem color="currentColor" className="wl-passport-emblem" />
            </span>
            <h2 id="wl-checkin-title">{t('checkinAtDesk')}</h2>
            <p>{t('checkinAtDeskSub')}</p>
          </div>
          <div className="wl-services">
            {onGallery && <GalleryTile onOpen={onGallery} className="wl-gallery" />}
            <VisitorWifi />
          </div>
        </div>
      </section>
    </main>
  )
}

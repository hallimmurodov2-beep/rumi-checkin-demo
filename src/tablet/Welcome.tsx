import { useEffect, useRef, useState } from 'react'
import { useT } from '../i18n'
import { LANGS, type Lang } from '../translations'
import { inKioskApp } from '../lib/kiosk'
import { VisitorWifi } from './frontdesk'
import { GalleryTile } from './PhotoGallery'
import './welcome.css'
import { COLORS, Emblem, ExpandIcon } from '../ui'

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
    <div className="wl-root">
      <section className="wl-brand text-cream" aria-label={hotelName}>
        <img
          src="/gallery/lobby-atrium.webp"
          alt=""
          className="wl-photo"
          fetchPriority="high"
          draggable={false}
        />
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
          <div className="wl-wordmark">
            <p className="font-serif text-2xl font-semibold tracking-[0.24em] text-cream">THE RUMI</p>
            <p className="mt-1 text-[0.6rem] font-semibold tracking-[0.15em] text-gold-light">HOTEL AND RESIDENCES</p>
          </div>
        </div>
        <div className="wl-hello">
          <span className="wl-rule" aria-hidden="true" />
          <h1 lang="en">Welcome</h1>
          <p lang="ru">Добро пожаловать</p>
          <p lang="tg">Хуш омадед</p>
        </div>
      </section>

      <section className="wl-main">
        <div className="wl-content">
          <div className="flex min-h-7 items-center justify-between gap-2">
            <p className="eyebrow">{t('chooseLanguage')}</p>
            {canFullscreen && (
              <button
                type="button"
                onClick={enterFullscreen}
                className="wl-fs inline-flex min-h-11 shrink-0 cursor-pointer items-center gap-2 rounded-lg px-2.5 text-sm font-medium text-forest hover:bg-forest/5"
              >
                <ExpandIcon className="h-4 w-4" /> {t('fullscreen')}
              </button>
            )}
          </div>
          <div className="wl-languages" role="group" aria-label={t('chooseLanguage')}>
            {LANGS.map((l) => (
              <button
                key={l.code}
                type="button"
                lang={l.code}
                aria-pressed={lang === l.code}
                onClick={() => setLang(l.code)}
                className={`cursor-pointer rounded-xl border px-1.5 font-semibold transition-colors ${
                  lang === l.code ? 'border-forest bg-forest text-cream' : 'border-line bg-paper text-forest hover:border-forest/45'
                }`}
              >
                {l.label}
              </button>
            ))}
          </div>

          {/* Reception opens the guest’s check-in after scanning the passport. */}
          <div className="wl-checkin">
            <p className="font-serif text-3xl font-semibold leading-none text-forest">{t('checkinAtDesk')}</p>
            <p className="mt-2 text-base leading-snug text-muted">{t('checkinAtDeskSub')}</p>
          </div>
          {onGallery && <GalleryTile onOpen={onGallery} className="wl-gallery" />}
          <VisitorWifi />
        </div>
      </section>
    </div>
  )
}

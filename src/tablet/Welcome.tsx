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
      <section className="wl-brand relative flex flex-col items-center justify-center overflow-hidden bg-forest px-10 text-center text-cream">
        <Emblem
          color={COLORS.goldLight}
          className="pointer-events-none absolute -bottom-28 -left-28 h-[480px] w-[480px] opacity-[0.07]"
        />
        <span className="wl-frame pointer-events-none absolute inset-6 rounded-[28px] border border-gold-light/15" aria-hidden="true" />
        <div
          className="rise relative"
          onPointerDown={startHold}
          onPointerUp={endHold}
          onPointerLeave={endHold}
          onPointerCancel={endHold}
        >
          <Emblem color={COLORS.goldLight} label={hotelName} className="wl-emblem h-40 w-40 xl:h-44 xl:w-44" />
        </div>
        <div className="wl-name relative mt-5">
          <p className="rise font-serif text-xl font-semibold tracking-[0.4em] text-gold-light" style={{ animationDelay: '80ms' }}>THE RUMI</p>
          <p className="rise mt-1 text-[11px] font-medium tracking-[0.24em] text-gold-light" style={{ animationDelay: '120ms' }}>HOTEL AND RESIDENCES</p>
        </div>
        <div className="wl-hello relative mt-9 space-y-1.5" aria-label="Welcome">
          <h1 className="rise text-6xl leading-none text-cream" style={{ animationDelay: '200ms' }}>Welcome</h1>
          <p lang="ru" className="rise font-serif text-4xl font-semibold text-gold-light" style={{ animationDelay: '300ms' }}>Добро пожаловать</p>
          <p lang="tg" className="rise font-serif text-4xl font-semibold text-gold-light" style={{ animationDelay: '400ms' }}>Хуш омадед</p>
        </div>
        <span className="wl-extra rise relative mt-8 h-px w-24 bg-gold-light/50" style={{ animationDelay: '480ms' }} aria-hidden="true" />
        <p className="wl-extra rise relative mt-4 text-sm tracking-[0.2em] text-gold-light" style={{ animationDelay: '520ms' }}>DUSHANBE</p>
      </section>

      <section className="wl-main relative flex min-h-0 flex-1 flex-col px-12 py-9 xl:px-14">
        <p className="eyebrow rise" style={{ animationDelay: '150ms' }}>{t('chooseLanguage')}</p>
        <div className="rise mt-4 grid grid-cols-3 gap-3" style={{ animationDelay: '220ms' }} role="group" aria-label={t('chooseLanguage')}>
          {LANGS.map((l) => (
            <button
              key={l.code}
              type="button"
              lang={l.code}
              aria-pressed={lang === l.code}
              onClick={() => setLang(l.code)}
              className={`flex min-h-16 cursor-pointer items-center justify-center gap-2 rounded-xl border-2 px-3 text-lg font-medium transition-all duration-200 active:scale-[0.98] ${
                lang === l.code ? 'border-forest bg-forest text-cream shadow-[0_8px_20px_-12px_rgb(14_59_46/0.8)]' : 'border-line bg-white text-ink hover:border-forest/50'
              }`}
            >
              {lang === l.code && <span className="h-2 w-2 rounded-full bg-gold-light" aria-hidden="true" />}
              {l.label}
            </button>
          ))}
        </div>

        {/* Check-in starts at reception: the front desk app scans the passport and opens it on this screen. */}
        <div className="rise mt-5 flex shrink-0 items-center gap-6 rounded-2xl bg-forest px-8 py-5 text-cream shadow-[0_16px_40px_-20px_rgb(14_59_46/0.9)]" style={{ animationDelay: '300ms' }}>
          <span className="handoff-card flex h-20 w-14 shrink-0 flex-col items-center justify-center gap-1.5 rounded-lg bg-gold-light/15 text-gold-light" aria-hidden="true">
            <span className="emblem h-7 w-7" style={{ backgroundColor: 'currentColor' }} />
            <span className="h-0.5 w-7 rounded-full bg-gold-light/50" />
          </span>
          <span>
            <span className="block font-serif text-3xl font-semibold leading-tight">{t('checkinAtDesk')}</span>
            <span className="mt-1 block text-base text-gold-light">{t('checkinAtDeskSub')}</span>
          </span>
        </div>
        {onGallery && <GalleryTile onOpen={onGallery} className="rise mt-4 min-h-0 flex-1" style={{ animationDelay: '380ms' }} />}

        <VisitorWifi />

        {canFullscreen && (
          <button
            type="button"
            onClick={enterFullscreen}
            className="wl-fs absolute right-6 top-2 flex min-h-11 cursor-pointer items-center gap-2 rounded-xl px-4 text-sm font-medium text-muted hover:bg-forest/5 hover:text-forest"
          >
            <ExpandIcon /> Full screen
          </button>
        )}
      </section>
    </div>
  )
}

import { useCallback, useEffect, useRef, useState } from 'react'
import { LangContext, SetLangContext } from '../i18n'
import { getDevice, tablet, type Handoff, type StoredDevice } from '../lib/device'
import { ApiError } from '../lib/supabase'
import { transition } from '../lib/transition'
import { useTripleTap } from '../lib/tripleTap'
import type { MrzData, PublicReservation, TabletConfig } from '../lib/types'
import { translations, type Lang } from '../translations'
import { PairTablet, TabletSettings } from '../tablet/Setup'
import { DetailsStep, Done, NeedHelp, SignatureStep, emptyDetails, type Details } from '../tablet/Steps'
import { Welcome } from '../tablet/Welcome'
import { Screensaver } from '../tablet/Screensaver'
import { SLIDES } from '../tablet/gallery'
import { Gallery } from '../tablet/PhotoGallery'
import { DeskModeContext } from '../tablet/Shell'
import { COLORS, Emblem } from '../ui'

// Check-in is started by reception (front desk app -> POST /v1/handoffs), never from the tablet.
// Check-out happens in eZee: reception pushes the bill to this screen (FolioOverlay in frontdesk.tsx).
type Step = 'welcome' | 'help' | 'details' | 'signature' | 'done'

const IDLE_WARN = 10
/** While the Visitors Wi-Fi QR code is open, the screensaver waits this long (seconds without a touch). */
const WIFI_QR_OPEN_SECONDS = 300

function titleCase(s: string) {
  return s.toLowerCase().replace(/(^|[\s-])(\p{L})/gu, (m) => m.toUpperCase())
}

/** Keep the tablet screen awake while the check-in page is open (where supported). */
function useWakeLock() {
  useEffect(() => {
    type Sentinel = { release: () => Promise<void> }
    const nav = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<Sentinel> } }
    if (!nav.wakeLock) return
    let lock: Sentinel | null = null
    const acquire = () => {
      if (document.visibilityState === 'visible')
        nav.wakeLock!.request('screen').then((l) => (lock = l)).catch(() => {})
    }
    acquire()
    document.addEventListener('visibilitychange', acquire)
    return () => {
      document.removeEventListener('visibilitychange', acquire)
      lock?.release().catch(() => {})
    }
  }, [])
}

/** Kiosk niceties: no long-press menu, no pinch zoom, no drag ghosts. */
function useKioskGuards() {
  useEffect(() => {
    const block = (e: Event) => e.preventDefault()
    const pinch = (e: TouchEvent) => {
      if (e.touches.length > 1) e.preventDefault()
    }
    document.addEventListener('contextmenu', block)
    document.addEventListener('dragstart', block)
    document.addEventListener('gesturestart', block)
    document.addEventListener('touchmove', pinch, { passive: false })
    return () => {
      document.removeEventListener('contextmenu', block)
      document.removeEventListener('dragstart', block)
      document.removeEventListener('gesturestart', block)
      document.removeEventListener('touchmove', pinch)
    }
  }, [])
}

function useOnline() {
  const [online, setOnline] = useState(() => navigator.onLine)
  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])
  return online
}

export default function TabletPage() {
  const [device, setDevice] = useState<StoredDevice | null>(getDevice)
  useEffect(() => {
    const on = () => setDevice(getDevice())
    window.addEventListener('rumi-device', on)
    window.addEventListener('storage', on)
    return () => {
      window.removeEventListener('rumi-device', on)
      window.removeEventListener('storage', on)
    }
  }, [])
  useEffect(() => {
    document.title = 'The Rumi - Check-in'
  }, [])
  useKioskGuards()
  useWakeLock()

  return (
    <div className="kiosk h-dvh w-full overflow-hidden bg-cream">
      {device ? <Kiosk device={device} /> : <PairTablet />}
      <div className="rotate-hint fixed inset-0 z-[60] flex-col items-center justify-center gap-6 bg-forest px-10 text-center text-cream">
        <Emblem color={COLORS.goldLight} className="h-24 w-24" />
        <p className="font-serif text-4xl font-semibold">Please turn the tablet sideways</p>
        <p lang="ru" className="text-lg text-gold-light">Пожалуйста, поверните планшет горизонтально</p>
        <p lang="tg" className="text-lg text-gold-light">Лутфан планшетро уфуқӣ гардонед</p>
      </div>
    </div>
  )
}

function Kiosk({ device }: { device: StoredDevice }) {
  const [step, setStep] = useState<Step>('welcome')
  const [lang, setLang] = useState<Lang>('en')
  const [config, setConfig] = useState<TabletConfig | null>(null)
  const [mrz, setMrz] = useState<MrzData | null>(null)
  const [reservation, setReservation] = useState<PublicReservation | null>(null)
  const [details, setDetails] = useState<Details>(emptyDetails)
  const [checkinId, setCheckinId] = useState<string | null>(null)
  const [handoff, setHandoff] = useState<Handoff | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [saver, setSaver] = useState(false)
  // Hotel photo gallery open on top of Welcome (index of the first photo), or null.
  const [gallery, setGallery] = useState<number | null>(null)
  // Reception scans passports with its own scanner; the tablet never reads them.
  const deskMode = true
  const saverAfter = config?.screensaver_seconds ?? 45
  const idleLimit = config?.idle_seconds ?? 60
  const [idleLeft, setIdleLeft] = useState(idleLimit)
  const online = useOnline()

  // Load hotel settings; repeating it every minute also tells the front desk this tablet is online.
  useEffect(() => {
    let alive = true
    let warmed = false
    const load = () =>
      tablet
        .config()
        .then((c) => {
          if (!alive) return
          setConfig(c)
          if (!warmed) {
            warmed = true
            // Load the screensaver photos in the background so the first slideshow is smooth.
            SLIDES.forEach((sl) => {
              const img = new Image()
              img.src = sl.src
            })
          }
        })
        .catch(() => {})
    load()
    const id = window.setInterval(load, 60_000)
    return () => {
      alive = false
      window.clearInterval(id)
    }
  }, [])

  // Lets the stylesheet know which screen is showing (the "turn sideways" notice skips Welcome).
  useEffect(() => {
    document.documentElement.dataset.kioskStep = step
    return () => {
      delete document.documentElement.dataset.kioskStep
    }
  }, [step])

  // A transition may apply a frame later. Ignore it if a guest reset happened in between.
  const session = useRef(0)
  const go = useCallback((next: Step, dir: 'fwd' | 'back' = 'fwd') => {
    const mine = session.current
    transition(() => { if (session.current === mine) setStep(next) }, dir)
  }, [])

  const clearGuest = useCallback(() => {
    setHandoff(null)
    setCheckinId(null)
    setMrz(null)
    setReservation(null)
    setDetails(emptyDetails)
    setIdleLeft(idleLimit)
  }, [idleLimit])

  // Back to Welcome in English with everything the guest entered cleared.
  const reset = useCallback(() => {
    session.current++
    transition(() => {
      clearGuest()
      setStep('welcome')
      setLang('en')
    }, 'back')
    ;(document.activeElement as HTMLElement | null)?.blur?.()
  }, [clearGuest])

  // Reception scanned a passport and sent the booking to this tablet: open it for the guest.
  const idleForHandoff = step === 'welcome'
  const settingsVisible = useRef(settingsOpen)
  settingsVisible.current = settingsOpen
  useEffect(() => {
    if (!idleForHandoff) return
    let alive = true
    let busy = false
    let claimed = false
    let lastActivity = Date.now()
    const touch = () => { lastActivity = Date.now() }
    window.addEventListener('pointerdown', touch)
    window.addEventListener('keydown', touch)
    const check = async () => {
      if (busy || claimed || settingsVisible.current || document.hidden || document.querySelector('[data-kiosk-invoice][open]')) return
      busy = true
      try {
        const h = await tablet.poll()
        if (!alive) return
        if (!h) {
          // Reload only between handoffs, after a full idle minute. A guest may be browsing
          // photos or scanning a QR code with the Welcome screen still mounted underneath.
          const updateReady = (window as Window & { __rumiUpdateReady?: boolean }).__rumiUpdateReady
          const now = Date.now()
          const nightlyRefresh = now - performance.timeOrigin > 20 * 3600_000 && new Date(now).getHours() === 4
          if ((updateReady || nightlyRefresh) && now - lastActivity >= 60_000 &&
              !document.hidden && !settingsVisible.current &&
              !document.querySelector('dialog[open], [aria-modal="true"], [data-kiosk-invoice][open]')) {
            window.location.reload()
          }
          return
        }
        claimed = true
        setSettingsOpen(false)
        const p = h.passport
        setSaver(false)
        setGallery(null)
        if (h.language) setLang(h.language)
        setHandoff(h)
        setReservation(h.reservation)
        setMrz(
          p && p.surname
            ? {
                docType: p.doc_type ?? 'P',
                issuingCountry: p.issuing_country ?? '',
                surname: p.surname,
                givenNames: p.given_names ?? '',
                documentNumber: p.document_number ?? '',
                nationality: p.nationality ?? '',
                birthDate: p.birth_date ?? '',
                sex: (p.sex as 'M' | 'F' | 'X') ?? 'X',
                expiryDate: p.expiry_date ?? '',
                valid: true,
              }
            : null,
        )
        go('details')
      } catch {
        /* offline: try again on the next tick */
      } finally {
        busy = false
      }
    }
    const first = window.setTimeout(check, 0)
    const id = window.setInterval(check, 2500)
    return () => {
      alive = false
      window.clearTimeout(first)
      window.clearInterval(id)
      window.removeEventListener('pointerdown', touch)
      window.removeEventListener('keydown', touch)
    }
  }, [idleForHandoff, go])

  // Start the screensaver (after a quiet spell, or when the Welcome screen is tapped 3 times).
  const startSaver = useCallback(() => {
    // A native <dialog> (Visitors Wi-Fi) would stay on top of the screensaver.
    if (document.querySelector('[data-kiosk-invoice][open]')) return
    document.querySelector<HTMLDialogElement>('dialog[data-kiosk-wifi][open]')?.close()
    setLang('en')
    setSaver(true)
  }, [])

  // Tap the Welcome screen 3 times anywhere (not on a button, not in the admin corner) to start the screensaver.
  useTripleTap({
    enabled: step === 'welcome' && !saver && !settingsOpen && gallery === null,
    blocked: () => !!document.querySelector('dialog[open]'),
    onTriple: startSaver,
  })

  // Screensaver: hotel photos after a quiet spell on the Welcome screen. One tap brings Welcome back.
  useEffect(() => {
    if (step !== 'welcome' || saver || settingsOpen || gallery !== null || saverAfter <= 0) return
    let last = Date.now()
    const touch = () => (last = Date.now())
    const evts = ['pointerdown', 'keydown', 'touchstart']
    evts.forEach((e) => window.addEventListener(e, touch, { passive: true }))
    const id = window.setInterval(() => {
      // Someone is scanning the Visitors Wi-Fi code: give them time (any touch starts the wait again).
      const wifiOpen = !!document.querySelector('dialog[data-kiosk-wifi][open]')
      const limit = wifiOpen ? Math.max(saverAfter, WIFI_QR_OPEN_SECONDS) : saverAfter
      if (Date.now() - last >= limit * 1000) startSaver()
    }, 1000)
    return () => {
      evts.forEach((e) => window.removeEventListener(e, touch))
      window.clearInterval(id)
    }
  }, [step, saver, settingsOpen, gallery, saverAfter, startSaver])

  // Done has its own visible return timer so guests can extend the time to scan Wi-Fi.
  useEffect(() => {
    if (step === 'welcome' || step === 'done') return
    let last = Date.now()
    const touch = () => {
      last = Date.now()
      setIdleLeft(idleLimit)
    }
    const evts = ['pointerdown', 'pointermove', 'keydown', 'touchstart', 'input', 'rumi-activity']
    evts.forEach((e) => window.addEventListener(e, touch, { passive: true }))
    setIdleLeft(idleLimit)
    const id = window.setInterval(() => {
      const left = idleLimit - Math.floor((Date.now() - last) / 1000)
      if (left <= 0) reset()
      else setIdleLeft(left)
    }, 250)
    return () => {
      evts.forEach((e) => window.removeEventListener(e, touch))
      window.clearInterval(id)
    }
  }, [step, reset, idleLimit])

  const submitCheckin = async (signature: string, policyId: string | null) => {
    if (!reservation) return
    const mine = session.current
    try {
      const res = await tablet.submitCheckin(reservation.id, {
        language: lang,
        phone: '',
        email: '',
        shuttle: details.shuttle === 'yes',
        signature_png: signature,
        handoff_id: handoff?.id,
        policy_id: policyId ?? undefined,
      } as Parameters<typeof tablet.submitCheckin>[1])
      if (session.current !== mine) return
      setCheckinId(res?.id ?? null)
      go('done')
    } catch (e) {
      if (session.current !== mine) return
      if (e instanceof ApiError && e.code === 'reservation_unavailable') go('help')
      throw e
    }
  }

  const tr = (k: keyof typeof translations.en, n = 0) => translations[lang][k].replace('{n}', String(n))
  const warn = step !== 'welcome' && step !== 'done' && idleLeft <= IDLE_WARN && !settingsOpen

  return (
    <LangContext.Provider value={lang}>
      <SetLangContext.Provider value={setLang}>
      <DeskModeContext.Provider value={deskMode}>
      <div className="h-full" lang={lang}>
        {step === 'welcome' && (
          <Welcome
            lang={lang}
            setLang={setLang}
            hotelName={config?.hotel_name ?? 'The Rumi Hotel & Residences'}
            onSettings={() => setSettingsOpen(true)}
            onGallery={() => setGallery(0)}
          />
        )}
        {step === 'help' && <NeedHelp onStart={reset} />}
        {step === 'details' && reservation && (
          <DetailsStep
            value={details}
            onChange={setDetails}
            reservation={reservation!}
            breakfastHours={config?.breakfast_hours}
            greetName={titleCase(mrz?.surname || (reservation?.guest_name ?? '').split(' ').slice(-1)[0] || '')}
            onNotMe={() => {
              if (handoff) tablet.declineHandoff(handoff.id).catch(() => {})
              go('help')
            }}
            onNext={() => go('signature')}
          />
        )}
        {step === 'signature' && (
          <SignatureStep
            onBack={() => go('details', 'back')}
            onSubmit={submitCheckin}
            signerName={mrz ? titleCase(`${mrz.givenNames} ${mrz.surname}`) : reservation?.guest_name ?? ''}
          />
        )}
        {step === 'done' && (
          <Done
            onFinish={reset}
            breakfast={!!reservation?.breakfast}
            config={config}
            room={reservation?.room_number ?? null}
            roomType={reservation?.room_type ?? null}
            checkinId={checkinId}
          />
        )}

        {!online && (
          <div role="alert" className="slide-down fixed left-1/2 top-3 z-40 -translate-x-1/2 rounded-full bg-ink px-5 py-2 text-sm font-medium text-cream shadow-lg">
            {tr('offline')}
          </div>
        )}

        {settingsOpen && <TabletSettings device={device} hotel={config?.hotel_name} online={online} onClose={() => setSettingsOpen(false)} />}

        {gallery !== null && step === 'welcome' && (
          <Gallery
            start={gallery}
            onClose={() => setGallery(null)}
            onIdle={() => {
              setGallery(null)
              setLang('en')
              setSaver(true)
            }}
            idleMs={Math.max(idleLimit, 90) * 1000}
          />
        )}

        {saver && step === 'welcome' && <Screensaver onWake={() => setSaver(false)} />}

        {warn && (
          <div className="fade-in fixed inset-0 z-50 flex items-center justify-center bg-ink/55" role="dialog" aria-modal="true" aria-labelledby="idle-title">
            <div className="pop-in card w-[440px] p-8 text-center">
              <div className="relative mx-auto h-28 w-28">
                <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90" aria-hidden="true">
                  <circle cx="50" cy="50" r="44" fill="none" stroke="#E8DFC9" strokeWidth="7" />
                  <circle
                    cx="50" cy="50" r="44" fill="none" stroke={COLORS.forest} strokeWidth="7" strokeLinecap="round"
                    strokeDasharray={2 * Math.PI * 44}
                    strokeDashoffset={2 * Math.PI * 44 * (1 - idleLeft / IDLE_WARN)}
                    style={{ transition: 'stroke-dashoffset 0.25s linear' }}
                  />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center font-serif text-5xl font-semibold text-forest">
                  {idleLeft}
                </span>
              </div>
              <p id="idle-title" className="mt-5 text-xl font-semibold text-ink">{tr('idleWarn', idleLeft)}</p>
              <p className="mt-1 text-muted">{tr('idleTouch')}</p>
              <button
                type="button"
                autoFocus
                onClick={() => window.dispatchEvent(new Event('rumi-activity'))}
                className="mt-6 min-h-16 w-full cursor-pointer rounded-xl bg-forest px-6 text-lg font-medium text-cream hover:bg-forest-deep"
              >
                {tr('stillHere')}
              </button>
            </div>
          </div>
        )}
      </div>
      </DeskModeContext.Provider>
      </SetLangContext.Provider>
    </LangContext.Provider>
  )
}

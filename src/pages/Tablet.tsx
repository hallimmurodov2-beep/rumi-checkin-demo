import { useCallback, useEffect, useRef, useState } from 'react'
import { LangContext, SetLangContext } from '../i18n'
import { getDevice, tablet, type Handoff, type StoredDevice } from '../lib/device'
import { ApiError } from '../lib/supabase'
import { transition } from '../lib/transition'
import type { MrzData, PublicReservation, TabletConfig } from '../lib/types'
import { translations, type Lang } from '../translations'
import { Checkout, CheckoutDone, CheckoutFind, type Due } from '../tablet/Checkout'
import { PairTablet, TabletSettings } from '../tablet/Setup'
import { DetailsStep, Done, NeedHelp, SignatureStep, emptyDetails, type Details } from '../tablet/Steps'
import { Welcome } from '../tablet/Welcome'
import { Screensaver } from '../tablet/Screensaver'
import { SLIDES } from '../tablet/gallery'
import { Gallery } from '../tablet/PhotoGallery'
import { DeskModeContext } from '../tablet/Shell'
import { COLORS, Emblem } from '../ui'

// Check-in is started by reception (front desk app -> POST /v1/handoffs), never from the tablet.
type Step = 'welcome' | 'help' | 'details' | 'signature' | 'done' | 'coFind' | 'checkout' | 'coDone'

const IDLE_WARN = 10

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
  const [stay, setStay] = useState<PublicReservation | null>(null)
  const [due, setDue] = useState<Due | null>(null)
  const [stayShuttle, setStayShuttle] = useState(false)
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

  const go = useCallback((next: Step, dir: 'fwd' | 'back' = 'fwd') => transition(() => setStep(next), dir), [])

  // Kiosks run for weeks: pick up new app versions, and refresh once a night,
  // but only while nobody is using the tablet.
  useEffect(() => {
    if (step !== 'welcome') return
    const started = performance.now()
    const id = window.setInterval(() => {
      const w = window as Window & { __rumiUpdateReady?: boolean }
      const hour = new Date().getHours()
      const longRunning = performance.now() - started > 20 * 3600_000 || performance.timeOrigin < Date.now() - 20 * 3600_000
      if (w.__rumiUpdateReady || (longRunning && hour === 4)) window.location.reload()
    }, 60_000)
    return () => window.clearInterval(id)
  }, [step])

  // Bumped on every reset: a check-in or check-out that finishes after the guest walked away
  // must not open its Done screen for the next person.
  const session = useRef(0)
  const clearGuest = useCallback(() => {
    session.current++
    setHandoff(null)
    setCheckinId(null)
    setMrz(null)
    setReservation(null)
    setDetails(emptyDetails)
    setStay(null)
    setDue(null)
    setStayShuttle(false)
    setIdleLeft(idleLimit)
  }, [idleLimit])

  // Back to Welcome in English with everything the guest entered cleared.
  const reset = useCallback(() => {
    transition(() => {
      clearGuest()
      setStep('welcome')
      setLang('en')
    }, 'back')
    ;(document.activeElement as HTMLElement | null)?.blur?.()
  }, [clearGuest])

  const toWelcome = () =>
    transition(() => {
      clearGuest()
      setStep('welcome')
    }, 'back')

  // Reception scanned a passport and sent the booking to this tablet: open it for the guest.
  const idleForHandoff = step === 'welcome'
  useEffect(() => {
    if (!idleForHandoff || settingsOpen) return
    let alive = true
    let busy = false
    const check = async () => {
      if (busy) return
      busy = true
      try {
        const h = await tablet.poll()
        if (!alive || !h) return
        const p = h.passport
        setSaver(false)
        setGallery(null)
        setLang(h.language ?? 'en')
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
    check()
    const id = window.setInterval(check, 2500)
    return () => {
      alive = false
      window.clearInterval(id)
    }
  }, [idleForHandoff, settingsOpen, go])

  // Screensaver: hotel photos after a quiet spell on the Welcome screen. A tap brings Welcome back.
  useEffect(() => {
    if (step !== 'welcome' || saver || settingsOpen || gallery !== null || saverAfter <= 0) return
    let last = Date.now()
    const touch = () => (last = Date.now())
    const evts = ['pointerdown', 'keydown', 'touchstart']
    evts.forEach((e) => window.addEventListener(e, touch, { passive: true }))
    const id = window.setInterval(() => {
      if (Date.now() - last >= saverAfter * 1000) {
        // A native <dialog> (Visitors Wi-Fi) would stay on top of the screensaver.
        document.querySelectorAll<HTMLDialogElement>('dialog[open]').forEach((d) => d.close())
        setLang('en')
        setSaver(true)
      }
    }, 1000)
    return () => {
      evts.forEach((e) => window.removeEventListener(e, touch))
      window.clearInterval(id)
    }
  }, [step, saver, settingsOpen, gallery, saverAfter])

  // Idle reset: any step except Welcome returns to Welcome after the idle limit without touch.
  useEffect(() => {
    if (step === 'welcome') return
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
        phone: details.phone.trim(),
        email: details.email.trim(),
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
  const warn = step !== 'welcome' && idleLeft <= IDLE_WARN && !settingsOpen

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
            onCheckout={() => go('coFind')}
            onSettings={() => setSettingsOpen(true)}
            onGallery={() => setGallery(0)}
          />
        )}
        {step === 'help' && <NeedHelp onStart={reset} title={stay ? tr('coTitle') : undefined} />}
        {step === 'details' && (
          <DetailsStep
            value={details}
            onChange={setDetails}
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
        {step === 'coFind' && (
          <CheckoutFind
            onBack={toWelcome}
            onFound={(r, shuttle) => {
              setStay(r)
              setStayShuttle(shuttle)
              go('checkout')
            }}
          />
        )}
        {step === 'checkout' && stay && (
          <Checkout
            stay={stay}
            reviewUrl={config?.review_url ?? ''}
            shuttle={stayShuttle}
            onBack={() => go('coFind', 'back')}
            onComplete={async (rating, feedback, owed) => {
              const mine = session.current
              try {
                await tablet.submitCheckout(stay.id, rating, feedback)
                if (session.current !== mine) return
                setDue(owed)
                go('coDone')
              } catch (e) {
                if (session.current !== mine) return
                // Reception checked the guest out at the desk in the meantime.
                if (e instanceof ApiError && e.code === 'reservation_unavailable') go('help')
                else throw e
              }
            }}
          />
        )}
        {step === 'coDone' && <CheckoutDone onFinish={reset} due={due} />}

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

        {saver && step === 'welcome' && (
          <Screensaver
            onWake={() => setSaver(false)}
            onBrowse={(i) => {
              setGallery(i)
              setSaver(false)
            }}
          />
        )}

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
                onClick={() => setIdleLeft(idleLimit)}
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

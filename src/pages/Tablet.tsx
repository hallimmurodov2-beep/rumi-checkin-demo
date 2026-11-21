import { useCallback, useEffect, useState } from 'react'
import { LangContext } from '../i18n'
import { getDevice, mrzPayload, tablet, type StoredDevice } from '../lib/device'
import { reconcileNames } from '../lib/mrz'
import { warmUpOcr } from '../lib/scanner'
import { ApiError } from '../lib/supabase'
import { transition } from '../lib/transition'
import type { MrzData, PublicReservation, TabletConfig } from '../lib/types'
import { translations, type Lang } from '../translations'
import { Checkout, CheckoutDone, CheckoutFind } from '../tablet/Checkout'
import { PairTablet, TabletSettings } from '../tablet/Setup'
import { Confirm, DetailsStep, Done, FindBooking, NeedHelp, Scan, SignatureStep, emptyDetails, type Details } from '../tablet/Steps'
import { Welcome } from '../tablet/Welcome'
import { COLORS, Emblem } from '../ui'

type Step =
  | 'welcome'
  | 'scan'
  | 'find'
  | 'confirm'
  | 'help'
  | 'details'
  | 'signature'
  | 'done'
  | 'coFind'
  | 'checkout'
  | 'coDone'

const IDLE_WARN = 10

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
  const [findMultiple, setFindMultiple] = useState(false)
  const [details, setDetails] = useState<Details>(emptyDetails)
  const [stay, setStay] = useState<PublicReservation | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const idleLimit = config?.idle_seconds ?? 60
  const [idleLeft, setIdleLeft] = useState(idleLimit)
  const online = useOnline()

  // Load hotel settings; repeating it every minute also tells the front desk this tablet is online.
  useEffect(() => {
    let alive = true
    const load = () =>
      tablet
        .config()
        .then((c) => alive && setConfig(c))
        .catch(() => {})
    load()
    const id = window.setInterval(load, 60_000)
    // Warm up the passport reader in the background so the first scan starts fast.
    const warm = window.setTimeout(() => warmUpOcr().catch(() => {}), 1500)
    return () => {
      alive = false
      window.clearInterval(id)
      window.clearTimeout(warm)
    }
  }, [])

  const go = useCallback((next: Step, dir: 'fwd' | 'back' = 'fwd') => transition(() => setStep(next), dir), [])

  const clearGuest = () => {
    setMrz(null)
    setReservation(null)
    setFindMultiple(false)
    setDetails(emptyDetails)
    setStay(null)
  }

  const reset = useCallback(() => {
    transition(() => {
      setStep('welcome')
      setLang('en')
      setMrz(null)
      setReservation(null)
      setFindMultiple(false)
      setDetails(emptyDetails)
      setStay(null)
    }, 'back')
    ;(document.activeElement as HTMLElement | null)?.blur?.()
  }, [])

  const toWelcome = () =>
    transition(() => {
      clearGuest()
      setStep('welcome')
    }, 'back')

  // Idle reset: any step except Welcome returns to Welcome after the idle limit without touch.
  useEffect(() => {
    if (step === 'welcome') return
    let last = Date.now()
    const touch = () => {
      last = Date.now()
      setIdleLeft(idleLimit)
    }
    const evts = ['pointerdown', 'pointermove', 'keydown', 'touchstart', 'input']
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

  const onPassportRead = useCallback(
    async (m: MrzData) => {
      setMrz(m)
      try {
        const res = await tablet.findByName(m.surname, m.givenNames)
        if (res.status === 'found') {
          setReservation(res.reservation)
          setMrz(reconcileNames(m, res.reservation.guest_name))
          go('confirm')
          return
        }
        setFindMultiple(true)
      } catch {
        setFindMultiple(true)
      }
      go('find')
    },
    [go],
  )

  const submitCheckin = async (signature: string) => {
    if (!reservation) return
    try {
      await tablet.submitCheckin(reservation.id, {
        language: lang,
        ...mrzPayload(mrz),
        phone: details.phone.trim(),
        email: details.email.trim(),
        shuttle: details.shuttle === 'yes',
        consent: details.consent,
        signature_png: signature,
      } as Parameters<typeof tablet.submitCheckin>[1])
      go('done')
    } catch (e) {
      if (e instanceof ApiError && e.code === 'reservation_unavailable') go('help')
      throw e
    }
  }

  const tr = (k: keyof typeof translations.en, n = 0) => translations[lang][k].replace('{n}', String(n))
  const warn = step !== 'welcome' && idleLeft <= IDLE_WARN && !settingsOpen

  return (
    <LangContext.Provider value={lang}>
      <div className="h-full" lang={lang}>
        {step === 'welcome' && (
          <Welcome
            lang={lang}
            setLang={setLang}
            hotelName={config?.hotel_name ?? 'The Rumi Hotel & Residences'}
            onStart={() => go('scan')}
            onCheckout={() => go('coFind')}
            onSettings={() => setSettingsOpen(true)}
          />
        )}
        {step === 'scan' && (
          <Scan
            facing={device.camera}
            onBack={toWelcome}
            onRead={onPassportRead}
            onNoPassport={() => {
              setMrz(null)
              setFindMultiple(false)
              go('find')
            }}
          />
        )}
        {step === 'find' && (
          <FindBooking
            initialSurname={mrz?.surname ?? ''}
            multiple={findMultiple}
            onBack={() => go('scan', 'back')}
            onScan={() => go('scan', 'back')}
            onHelp={() => go('help')}
            onFound={(r) => {
              setReservation(r)
              setMrz((m) => (m ? reconcileNames(m, r.guest_name) : m))
              go('confirm')
            }}
          />
        )}
        {step === 'confirm' && reservation && (
          <Confirm
            reservation={reservation}
            mrz={mrz}
            onBack={() => go(mrz && !findMultiple ? 'scan' : 'find', 'back')}
            onYes={() => go('details')}
            onNo={() => go('help')}
          />
        )}
        {step === 'help' && <NeedHelp onStart={reset} />}
        {step === 'details' && (
          <DetailsStep value={details} onChange={setDetails} onBack={() => go('confirm', 'back')} onNext={() => go('signature')} />
        )}
        {step === 'signature' && <SignatureStep onBack={() => go('details', 'back')} onSubmit={submitCheckin} />}
        {step === 'done' && (
          <Done onFinish={reset} shuttle={details.shuttle === 'yes'} breakfast={!!reservation?.breakfast} config={config} />
        )}
        {step === 'coFind' && (
          <CheckoutFind
            onBack={toWelcome}
            onFound={(r) => {
              setStay(r)
              go('checkout')
            }}
          />
        )}
        {step === 'checkout' && stay && (
          <Checkout
            stay={stay}
            reviewUrl={config?.review_url ?? ''}
            onBack={() => go('coFind', 'back')}
            onComplete={async (rating, feedback) => {
              await tablet.submitCheckout(stay.id, rating, feedback)
              go('coDone')
            }}
          />
        )}
        {step === 'coDone' && <CheckoutDone onFinish={reset} />}

        {!online && (
          <div className="slide-down fixed left-1/2 top-3 z-40 -translate-x-1/2 rounded-full bg-ink px-5 py-2 text-sm font-medium text-cream shadow-lg">
            No internet connection - please ask at the front desk
          </div>
        )}

        {settingsOpen && <TabletSettings device={device} onClose={() => setSettingsOpen(false)} />}

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
                className="mt-6 min-h-16 w-full cursor-pointer rounded-xl bg-forest px-6 text-lg font-medium text-cream hover:bg-forest-deep"
              >
                {tr('stillHere')}
              </button>
            </div>
          </div>
        )}
      </div>
    </LangContext.Provider>
  )
}

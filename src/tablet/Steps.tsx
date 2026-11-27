import { visitorQr, type VisitorPath, type VisitorVoucher } from '../lib/visitorVoucher'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useLang, useT } from '../i18n'
import { tablet } from '../lib/device'
import { ApiError } from '../lib/supabase'
import type { Policy, PublicReservation, TabletConfig, WifiInfo } from '../lib/types'
import { Markdown } from '../lib/markdown'
import { wifiQrText } from '../lib/wifi'
import { fmtDay, LANGS, LOCALE, type Lang } from '../translations'
import { dushanbeTime, hasLobbyWifiPairing, useWifiVoucher, VisitorPathPicker, wifiVoucherText } from './frontdesk'
import { AnimatedCheck, ArrowRight, Button, CarIcon, CheckIcon, CupIcon, ErrorNote, PhoneIcon, QrCode, ReceiptIcon, Spinner, WifiIcon } from '../ui'
import { Shell } from './Shell'
import { roomTypePhoto } from './gallery'
import './gallery.css'
import './steps.css'

export function NeedHelp({ onBack, onStart, step, title }: { onBack?: () => void; onStart: () => void; step?: number; title?: string }) {
  const t = useT()
  return (
    <Shell step={step} title={title} onBack={onBack} hideBack={!onBack}>
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <span className="ring-grow flex h-20 w-20 items-center justify-center rounded-full bg-gold-light/60 font-serif text-4xl font-semibold text-forest" aria-hidden="true">
          ?
        </span>
        <h2 className="mt-6 text-6xl text-forest">{t('teamHelp')}</h2>
        <p className="mt-4 max-w-xl text-xl text-muted">{t('teamHelpSub')}</p>
        <Button className="mt-10" onClick={onStart}>
          {t('backToStart')}
        </Button>
      </div>
    </Shell>
  )
}

/* ------------------------------ 3. Your stay ------------------------------ */

/** The one answer asked on the "Your stay" screen. Contact details are no longer collected on the tablet. */
export interface Details {
  shuttle: 'yes' | 'no' | null
}
export const emptyDetails: Details = { shuttle: null }

function MoonIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M20 14.5A8.5 8.5 0 019.5 4a8.5 8.5 0 1010.5 10.5z" />
    </svg>
  )
}

function DateBlock({ label, iso, align }: { label: string; iso: string; align: 'left' | 'right' }) {
  const lang = useLang()
  const d = new Date(`${iso}T12:00:00`)
  const weekday = lang === 'tg' ? '' : d.toLocaleDateString(LOCALE[lang], { weekday: 'long' })
  return (
    <div className={`min-w-0 ${align === 'right' ? 'text-right' : ''}`}>
      <p className="eyebrow">{label}</p>
      <time className="stay-date mt-1 block font-serif text-4xl font-semibold leading-none text-forest" dateTime={iso}>
        {fmtDay(iso, lang)}
      </time>
      {weekday && <p className="mt-1 text-sm capitalize text-muted">{weekday}</p>}
    </div>
  )
}

export function DetailsStep({
  value,
  onChange,
  reservation,
  breakfastHours,
  greetName,
  onNotMe,
  onNext,
}: {
  value: Details
  onChange: (d: Details) => void
  /** The booking reception sent to this tablet. */
  reservation: PublicReservation
  /** Breakfast opening hours from the hotel settings; the card shows only when the stay includes breakfast. */
  breakfastHours?: string | null
  /** The guest's surname from the passport reception scanned. */
  greetName: string
  /** Shown as "Not you?": the booking reception sent is someone else's. */
  onNotMe: () => void
  onNext: () => void
}) {
  const t = useT()
  const lang = useLang()
  const photo = roomTypePhoto(reservation.room_type)
  const roomName = photo ? photo[lang] : reservation.room_type
  const showBreakfast = reservation.breakfast && !!breakfastHours
  const nights = reservation.nights > 0 ? reservation.nights : 1
  return (
    <Shell
      step={2}
      hideBack
      action={
        <div className="stay-actions flex w-full items-center justify-between gap-3">
          <button type="button" onClick={onNotMe} className="min-h-12 cursor-pointer rounded-lg px-2 text-left text-base text-muted underline underline-offset-4 hover:text-forest">
            {t('notMine')}
          </button>
          <Button onClick={onNext}>{t('stayConfirm')} <ArrowRight className="h-5 w-5 shrink-0" /></Button>
        </div>
      }
    >
      <div className="stay-screen mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center gap-5">
        <div>
          {greetName && <p className="stay-greeting rise text-lg font-medium text-label">{t('welcomeName', { name: greetName })}</p>}
          <h2 className="stay-title text-6xl leading-tight text-forest">{t('detailsTitle')}</h2>
        </div>
        <div className="stay-columns grid gap-5">
          {/* Left: the room, then the dates. */}
          <div className="stay-stack flex min-w-0 flex-col gap-4">
            <figure className="stay-photo rise relative overflow-hidden rounded-3xl bg-forest shadow-[0_24px_60px_-28px_rgb(14_59_46/0.9)]">
              {photo && <img src={photo.src} alt="" decoding="async" draggable={false} className="absolute inset-0 h-full w-full object-cover" />}
              <span className="absolute inset-0 bg-gradient-to-t from-forest-deep/95 via-forest-deep/35 to-transparent" aria-hidden="true" />
              <figcaption className="stay-caption absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 px-6 pb-5 text-cream">
                <span className="min-w-0">
                  <span className="block text-xs font-semibold tracking-[0.18em] text-gold-light">{t('yourRoom').toUpperCase()}</span>
                  <span className="stay-room-name mt-1 block font-serif text-4xl font-semibold leading-tight">{roomName || t('room')}</span>
                </span>
                <span className="shrink-0 rounded-full border border-cream/30 bg-forest-deep/50 px-3 py-1.5 text-sm backdrop-blur-md">
                  {t('guests')}: {reservation.adults}
                </span>
              </figcaption>
            </figure>
            <div className="stay-dates rise card flex items-center justify-between gap-3 px-5 py-4" style={{ animationDelay: '100ms' }}>
              <DateBlock label={t('stayArrival')} iso={reservation.arrival_date} align="left" />
              <div className="flex min-w-0 flex-1 flex-col items-center gap-1.5 text-muted">
                <span className="flex w-full items-center gap-2" aria-hidden="true">
                  <span className="h-px flex-1 bg-gold/60" />
                  <MoonIcon className="h-5 w-5 text-gold" />
                  <span className="h-px flex-1 bg-gold/60" />
                </span>
                <span className="text-center text-sm font-medium text-forest">{nights === 1 ? t('oneNight') : t('nights', { n: nights })}</span>
              </div>
              <DateBlock label={t('stayDeparture')} iso={reservation.departure_date} align="right" />
            </div>
          </div>

          {/* Right: breakfast reminder and the shuttle question. */}
          <div className="stay-stack flex min-w-0 flex-col gap-4">
            {showBreakfast && (
              <div className="stay-service rise card flex items-start gap-3 p-5" style={{ animationDelay: '160ms' }}>
                <span aria-hidden="true" className="stay-service-icon flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gold-light/45 text-forest">
                  <CupIcon />
                </span>
                <div className="min-w-0">
                  <h3 className="stay-service-title text-2xl leading-tight text-forest">{t('breakfastIncluded')}</h3>
                  <p className="mt-1 text-muted">{t('breakfastInfo', { hours: breakfastHours! })}</p>
                </div>
              </div>
            )}
            <fieldset className="stay-service rise card flex min-w-0 flex-1 flex-col p-5" aria-describedby="shuttle-question" style={{ animationDelay: '220ms' }}>
              <legend className="sr-only">{t('shuttleTitle')}</legend>
              <div className="flex items-start gap-3">
                <span aria-hidden="true" className="stay-service-icon flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gold-light/45 text-forest">
                  <CarIcon />
                </span>
                <div className="min-w-0">
                  <h3 className="stay-service-title text-2xl leading-tight text-forest">{t('shuttleTitle')}</h3>
                  <p className="mt-1 text-muted" id="shuttle-question">{t('shuttleQ')}</p>
                </div>
              </div>
              <div className="stay-shuttle-options mt-auto grid grid-cols-2 gap-3 pt-4">
                {(['yes', 'no'] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    aria-pressed={value.shuttle === v}
                    onClick={() => onChange({ ...value, shuttle: value.shuttle === v ? null : v })}
                    className={`flex min-h-14 cursor-pointer items-center justify-center gap-2 rounded-xl border-2 text-lg font-medium transition-colors duration-200 ${
                      value.shuttle === v ? 'border-forest bg-forest text-cream' : 'border-line bg-white text-ink hover:border-forest/50'
                    }`}
                  >
                    {value.shuttle === v && <CheckIcon className="h-4 w-4 text-gold-light" />}
                    {t(v)}
                  </button>
                ))}
              </div>
              {value.shuttle === 'yes' && <p className="stay-shuttle-note fade-in mt-2 text-sm text-muted" role="status">{t('shuttleNote')}</p>}
            </fieldset>
          </div>
        </div>
      </div>
    </Shell>
  )
}

/* ------------------------------ 4. Signature ----------------------------- */

type Pt = { x: number; y: number }

/** Export the drawn signature at a modest size for storage. */
function exportSignature(c: HTMLCanvasElement): string {
  const maxW = 900
  const k = Math.min(1, maxW / c.width)
  const out = document.createElement('canvas')
  out.width = Math.round(c.width * k)
  out.height = Math.round(c.height * k)
  const ctx = out.getContext('2d')!
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, out.width, out.height)
  ctx.drawImage(c, 0, 0, out.width, out.height)
  return out.toDataURL('image/png')
}

type PolicyState = Policy | null | 'loading' | 'error'

/** The server falls back to English and returns null when no policy is published. */
function usePolicy(lang: Lang, attempt: number): PolicyState {
  const [result, setResult] = useState<{ lang: Lang; attempt: number; policy: PolicyState }>()
  useEffect(() => {
    let alive = true
    tablet
      .policy(lang)
      .then((policy) => { if (alive) setResult({ lang, attempt, policy }) })
      .catch(() => { if (alive) setResult({ lang, attempt, policy: 'error' }) })
    return () => {
      alive = false
    }
  }, [lang, attempt])
  return result?.lang === lang && result.attempt === attempt ? result.policy : 'loading'
}

const signatureDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dushanbe' })

export function SignatureStep({
  onBack,
  onSubmit,
  signerName,
}: {
  onBack: () => void
  /** policyId: the hotel policy version shown on this screen (null when none is published). */
  onSubmit: (signaturePng: string, policyId: string | null) => Promise<void>
  signerName: string
}) {
  const t = useT()
  const lang = useLang()
  const [policyAttempt, setPolicyAttempt] = useState(0)
  const policy = usePolicy(lang, policyAttempt)
  const canvas = useRef<HTMLCanvasElement>(null)
  const activePointer = useRef<number | null>(null)
  const pts = useRef<Pt[]>([])
  const length = useRef(0)
  const [ink, setInk] = useState<'empty' | 'started' | 'ready'>('empty')
  const signed = ink === 'ready'
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const c = canvas.current!
    let lastSize: { width: number; height: number; dpr: number } | null = null
    const setup = () => {
      const dpr = window.devicePixelRatio || 1
      const r = c.getBoundingClientRect()
      const width = Math.round(r.width * dpr)
      const height = Math.round(r.height * dpr)
      if (!width || !height || (lastSize?.dpr === dpr && width === c.width && height === c.height)) return
      // Scale the bitmap and the last sampled points to the new pad size.
      let prev: HTMLCanvasElement | null = null
      if (lastSize) {
        prev = document.createElement('canvas')
        prev.width = c.width
        prev.height = c.height
        prev.getContext('2d')!.drawImage(c, 0, 0)
        const scaleX = r.width / lastSize.width
        const scaleY = r.height / lastSize.height
        pts.current = pts.current.map(({ x, y }) => ({ x: x * scaleX, y: y * scaleY }))
      }
      c.width = width
      c.height = height
      const ctx = c.getContext('2d')!
      if (prev) ctx.drawImage(prev, 0, 0, width, height)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.lineWidth = 3.2
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.strokeStyle = '#17221D'
      lastSize = { width: r.width, height: r.height, dpr }
    }
    setup()
    const ro = new ResizeObserver(setup)
    ro.observe(c)
    return () => ro.disconnect()
  }, [])

  const down = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (busy || e.button !== 0 || activePointer.current !== null) return
    e.currentTarget.setPointerCapture?.(e.pointerId)
    activePointer.current = e.pointerId
    const r = canvas.current!.getBoundingClientRect()
    const p = { x: e.clientX - r.left, y: e.clientY - r.top }
    pts.current = [p]
    const ctx = canvas.current!.getContext('2d')!
    ctx.beginPath()
    ctx.arc(p.x, p.y, 1.6, 0, Math.PI * 2)
    ctx.fillStyle = '#17221D'
    ctx.fill()
    if (ink === 'empty') setInk('started')
  }
  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (activePointer.current !== e.pointerId || busy) return
    const ctx = canvas.current!.getContext('2d')!
    const coalesced = e.nativeEvent.getCoalescedEvents?.()
    const events = coalesced && coalesced.length ? coalesced : [e.nativeEvent]
    const r = canvas.current!.getBoundingClientRect()
    for (const ev of events) {
      const p = { x: ev.clientX - r.left, y: ev.clientY - r.top }
      const arr = pts.current
      const last = arr[arr.length - 1]
      if (!last) continue
      length.current += Math.hypot(p.x - last.x, p.y - last.y)
      arr.push(p)
      ctx.beginPath()
      if (arr.length >= 3) {
        const a = arr[arr.length - 3], b = arr[arr.length - 2], c = arr[arr.length - 1]
        ctx.moveTo((a.x + b.x) / 2, (a.y + b.y) / 2)
        ctx.quadraticCurveTo(b.x, b.y, (b.x + c.x) / 2, (b.y + c.y) / 2)
      } else {
        ctx.moveTo(last.x, last.y)
        ctx.lineTo(p.x, p.y)
      }
      ctx.stroke()
      if (arr.length > 2) arr.shift()
    }
    if (length.current > 40 && !signed) setInk('ready')
  }
  const up = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (activePointer.current !== e.pointerId) return
    activePointer.current = null
    pts.current = []
  }
  const clear = () => {
    const c = canvas.current!
    const ctx = c.getContext('2d')!
    ctx.save()
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, c.width, c.height)
    ctx.restore()
    length.current = 0
    setInk('empty')
    setFailed(false)
  }
  const policyReady = policy !== 'loading' && policy !== 'error'
  const finish = async () => {
    if (!signed || busy || !policyReady) return
    setBusy(true)
    setFailed(false)
    try {
      await onSubmit(exportSignature(canvas.current!), policy ? policy.id : null)
    } catch (e) {
      if (!(e instanceof ApiError && e.code === 'reservation_unavailable')) setFailed(true)
      setBusy(false)
    }
  }

  return (
    <Shell
      step={3}
      onBack={busy ? undefined : onBack}
      action={
        <Button disabled={!signed || busy || !policyReady} onClick={finish}>
          {busy && <Spinner />}
          {busy ? t('sending') : t('finish')}
        </Button>
      }
    >
      <div className={`signature-screen mx-auto grid w-full flex-1 gap-5 ${policy === null ? 'signature-without-policy max-w-4xl' : 'max-w-6xl'}`}>
        {policy !== null && (
          <section className="signature-policy card flex min-w-0 flex-col overflow-hidden" aria-labelledby="policy-title">
            <div className="signature-policy-heading border-b border-line bg-forest/[0.035] px-6 py-4">
              <h2 id="policy-title" className="text-3xl text-forest">{t('policyTitle')}</h2>
              {policyReady && <p className="mt-0.5 text-sm text-muted">{t('sigAgree')}</p>}
            </div>
            <div className="signature-policy-content min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-4 text-ink" tabIndex={policyReady ? 0 : undefined} role="region" aria-labelledby="policy-title">
              {policy === 'loading' ? (
                <div className="space-y-3">
                  <p className="text-sm text-muted" role="status">{t('policyLoading')}</p>
                  {[90, 70, 84, 60, 76].map((w, i) => <span key={i} className="shimmer h-4 rounded-full" style={{ width: `${w}%` }} aria-hidden="true" />)}
                </div>
              ) : policy === 'error' ? (
                <div className="space-y-3">
                  <ErrorNote>{t('policyLoadFailed')}</ErrorNote>
                  <Button variant="secondary" className="min-h-12 px-4 text-base" onClick={() => setPolicyAttempt((n) => n + 1)}>
                    {t('tryAgain')}
                  </Button>
                </div>
              ) : (
                <div lang={policy.lang}><Markdown source={policy.body_md} /></div>
              )}
            </div>
          </section>
        )}
        <section className="signature-panel card flex min-w-0 flex-col p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="signature-title text-5xl leading-tight text-forest">{t('sigTitle')}</h2>
              <p id="signature-hint" className="mt-1 text-muted">{t('sigHint')}</p>
            </div>
            <button type="button" className="min-h-11 cursor-pointer rounded-lg border border-line bg-white px-3 text-sm font-medium text-forest hover:border-forest/50 disabled:cursor-default disabled:opacity-45" onClick={clear} disabled={ink === 'empty' || busy}>
              {t('clear')}
            </button>
          </div>
          <div className="signature-pad relative mt-4 flex-1 overflow-hidden rounded-2xl border border-dashed border-forest/25 bg-white">
            <canvas
              ref={canvas}
              aria-label={t('signHere')}
              aria-describedby="signature-hint"
              className="absolute inset-0 z-10 h-full w-full cursor-crosshair touch-none"
              onPointerDown={down}
              onPointerMove={move}
              onPointerUp={up}
              onPointerCancel={up}
              onLostPointerCapture={up}
            />
            <div aria-hidden="true" className="pointer-events-none absolute inset-x-5 bottom-6 flex items-center gap-3 text-muted">
              <span className="font-serif text-3xl">×</span>
              <span className="h-px flex-1 bg-line" />
              <span className="text-sm">{t('signHere')}</span>
            </div>
          </div>
          <div className="signature-status mt-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5 text-sm">
            <p className="text-muted">
              {t('signedBy', { name: signerName, date: fmtDay(signatureDate.format(new Date()), lang, true) })}
            </p>
            <p className={`flex items-center gap-1.5 ${signed ? 'font-medium text-forest' : 'text-muted'}`} role="status">
              {signed && <CheckIcon className="h-4 w-4" />}
              {t(signed ? 'signatureAdded' : 'sigNeeded')}
            </p>
          </div>
          {failed && (
            <div className="mt-3">
              <ErrorNote><strong className="font-semibold">{t('errorTitle')}.</strong> {t('errorText')}</ErrorNote>
            </div>
          )}
        </section>
      </div>
    </Shell>
  )
}

/* -------------------------------- 5. Done -------------------------------- */

/** Use a deadline so a sleeping tablet clears the guest screen as soon as it wakes. */
function useReturnTimer(seconds: number, onFinish: () => void) {
  const deadline = useRef(0)
  const finish = useRef(onFinish)
  finish.current = onFinish
  const [remaining, setRemaining] = useState(seconds)
  const extend = useCallback(() => {
    deadline.current = Date.now() + seconds * 1000
    setRemaining(seconds)
  }, [seconds])

  useEffect(() => {
    extend()
    const tick = () => {
      const left = Math.max(0, Math.ceil((deadline.current - Date.now()) / 1000))
      setRemaining(left)
      if (left === 0 && deadline.current !== 0) {
        deadline.current = 0
        finish.current()
      }
    }
    const timer = window.setInterval(tick, 250)
    document.addEventListener('visibilitychange', tick)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [extend])
  return { remaining, extend }
}

/** Reception can assign the room or issue personal Wi-Fi any time this screen is open. */
function useDoneInfo(config: TabletConfig | null, checkinId: string | null | undefined, initialRoom: string | null) {
  const [info, setInfo] = useState<Awaited<ReturnType<typeof tablet.checkinInfo>>>(null)
  useEffect(() => {
    if (!checkinId) return
    let alive = true
    let timer: number | undefined
    const load = async () => {
      try {
        const latest = await tablet.checkinInfo(checkinId)
        if (!alive) return
        if (latest) {
          setInfo(latest)
          if (latest.status === 'rejected' ||
              (latest.status === 'approved' && latest.room_number && latest.wifi?.per_stay)) return
        }
      } catch {
        // Keep the last known result through a brief connection loss.
      }
      if (alive) timer = window.setTimeout(load, 3500)
    }
    void load()
    return () => {
      alive = false
      window.clearTimeout(timer)
    }
  }, [checkinId])
  const hotelWifi: WifiInfo | null = config?.wifi_name
    ? { ssid: config.wifi_name, password: config.wifi_password || null, security: config.wifi_security ?? 'WPA', hidden: config.wifi_hidden, qr_payload: config.wifi_qr }
    : null
  const serverWifi = info?.wifi
  return {
    status: info?.status ?? 'waiting',
    room: info ? info.room_number : initialRoom,
    perStay: serverWifi?.per_stay ? serverWifi : null,
    fallback: serverWifi ?? hotelWifi,
  }
}

function WifiCard({ wifi }: { wifi: WifiInfo }) {
  const t = useT()
  return (
    <div className="card flex h-full items-center gap-6 p-6">
      <QrCode key={wifiQrText(wifi)} text={wifiQrText(wifi)} label={t('wifiScan')} className="h-44 w-44 xl:h-48 xl:w-48" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-forest">
          <WifiIcon />
          <h3 className="text-3xl">{t('wifiTitle')}</h3>
          {wifi.per_stay && <span className="fade-in rounded-full bg-gold-light/50 px-3 py-1 text-xs font-semibold tracking-wide text-label">{t('wifiPerStay')}</span>}
        </div>
        <dl className="mt-3 space-y-2 text-lg">
          <div>
            <dt className="eyebrow">{t('wifiNetwork')}</dt>
            <dd className="break-all font-medium">{wifi.ssid}</dd>
          </div>
          {wifi.password && (
            <div>
              <dt className="eyebrow">{t('wifiPassword')}</dt>
              <dd className="break-all font-mono text-xl font-medium tracking-wide">{wifi.password}</dd>
            </div>
          )}
        </dl>
        <p className="mt-3 flex items-center gap-2 text-sm text-muted">
          <PhoneIcon className="h-4 w-4 shrink-0" />
          {t('wifiScan')}
        </p>
        {wifi.note && <p className="mt-1 text-sm text-muted">{wifi.note}</p>}
      </div>
    </div>
  )
}

/** The hotel's Wi-Fi login link (from the front desk server) as a QR code. */
function VoucherCard({ voucher }: { voucher: VisitorVoucher }) {
  const [path, setPath] = useState<VisitorPath>('mobile')
  const t = useT()
  const lang = useLang()
  const v = wifiVoucherText[lang]
  const url = visitorQr(voucher, path, lang)
  return (
    <div className="card flex h-full items-center gap-6 p-6">
      <QrCode key={url} text={url} label={t('wifiTitle')} className="h-44 w-44 xl:h-48 xl:w-48" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-3 text-forest">
          <WifiIcon />
          <h3 className="text-3xl">{t('wifiTitle')}</h3>
        </div>
        <VisitorPathPicker path={path} onChange={setPath} />
        <p className="mt-3 flex items-center gap-2 text-sm text-muted">
          <PhoneIcon className="h-4 w-4 shrink-0" />
          {t('wifiScan')}
        </p>
        <p className="mt-1 text-sm text-muted">
          {v[2]} {dushanbeTime.format(voucher.expiresAt)}
        </p>
      </div>
    </div>
  )
}

export function Done({
  onFinish,
  breakfast,
  config,
  room: initialRoom,
  roomType,
  checkinId,
}: {
  onFinish: () => void
  breakfast: boolean
  config: TabletConfig | null
  room: string | null
  /** eZee room type ("Deluxe Double"...): shows a photo of that kind of room. */
  roomType?: string | null
  /** The check-in just created: used to fetch the room and the stay's Wi-Fi. */
  checkinId?: string | null
}) {
  const t = useT()
  const { status, room, perStay, fallback } = useDoneInfo(config, checkinId, initialRoom)
  const approved = status === 'approved'
  const declined = status === 'rejected'
  const paired = !declined && hasLobbyWifiPairing()
  const { voucher, state: voucherState } = useWifiVoucher(paired && !perStay)
  // The lobby voucher server is down or the pairing was revoked: show the hotel Wi-Fi from Settings instead of nothing.
  const voucherFailed = voucherState === 'error' || voucherState === 'unpaired'
  const wifi = perStay ?? (paired && !voucherFailed ? null : fallback)
  const showWifi = !declined && (!!wifi || !!voucher)
  // Give guests time to scan the Wi-Fi code before the screen resets.
  const { remaining, extend } = useReturnTimer(Math.min(config?.idle_seconds ?? 45, 45), onFinish)
  const showBreakfast = !declined && breakfast && !!config?.breakfast_hours
  const photo = roomTypePhoto(roomType)
  const lang = useLang()

  return (
    <Shell
      step={4}
      hideBack
      action={
        <div className="receipt-actions flex w-full items-center gap-4">
          <p className="mr-auto text-sm tabular-nums text-muted">{t('returning', { n: remaining })}</p>
          <Button variant="ghost" onClick={extend}>{t('moreTime')}</Button>
          <Button onClick={onFinish}>{t('startNew')}</Button>
        </div>
      }
    >
      <div className="receipt mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center">
        <div className="receipt-head flex items-center gap-6" role="status">
          {approved ? <AnimatedCheck size="receipt-mark h-24 w-24" /> : (
            <span aria-hidden="true" className="receipt-mark flex h-24 w-24 shrink-0 items-center justify-center rounded-full bg-gold-light/40 text-forest">
              {declined ? <span className="font-serif text-5xl">?</span> : <ReceiptIcon className="h-10 w-10" />}
            </span>
          )}
          <div className="rise min-w-0" style={{ animationDelay: '120ms' }}>
            <h2 className="receipt-title font-serif leading-none text-forest">{t(approved ? 'doneTitle' : declined ? 'receiptDeclined' : 'receiptSent')}</h2>
            <p className="receipt-sub mt-2 text-xl text-muted">{t(approved ? 'handoffDoneSub' : declined ? 'receiptDeclinedSub' : 'receiptPendingSub')}</p>
          </div>
          {!declined && room && photo && (
            <figure
              className="room-photo ring-grow relative ml-auto h-[176px] w-[300px] shrink-0 overflow-hidden rounded-3xl bg-forest shadow-[0_20px_50px_-24px_rgb(14_59_46/0.9)]"
              style={{ animationDelay: '200ms' }}
            >
              <img src={photo.src} alt="" decoding="async" draggable={false} className="absolute inset-0 h-full w-full object-cover" />
              <span className="absolute inset-0 bg-gradient-to-t from-forest-deep/95 via-forest-deep/40 to-transparent" aria-hidden="true" />
              <figcaption className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 px-6 pb-4 text-cream">
                <span className="min-w-0">
                  <span className="block text-xs font-semibold tracking-[0.18em] text-gold-light">{t('yourRoom').toUpperCase()}</span>
                  <span className="block text-sm leading-tight text-cream/90" title={t('roomTypeShown')}>{photo[lang]}</span>
                </span>
                <span className="font-serif text-6xl font-semibold leading-none">{room}</span>
              </figcaption>
            </figure>
          )}
          {!declined && room && !photo && (
            <div className="ring-grow ml-auto shrink-0 rounded-3xl bg-forest px-9 py-5 text-center text-cream shadow-[0_20px_50px_-24px_rgb(14_59_46/0.9)]" style={{ animationDelay: '200ms' }}>
              <p className="text-xs font-semibold tracking-[0.18em] text-gold-light">{t('yourRoom').toUpperCase()}</p>
              <p className="font-serif text-6xl font-semibold">{room}</p>
            </div>
          )}
        </div>
        {!declined && (
          <div className="receipt-cards mt-6 grid gap-4 sm:grid-cols-2">
            {showWifi && (
              <div className="rise min-w-0">
                {wifi ? <WifiCard wifi={wifi} /> : <VoucherCard voucher={voucher!} />}
              </div>
            )}
            <div className="card flex min-w-0 items-center gap-5 p-6">
              <QrCode text={`https://rumi-checkin.vercel.app/guide?lang=${lang}`} label={t('guideScan')} className="guide-code h-40 w-40 !p-4" />
              <div>
                <h3 className="text-3xl leading-tight text-forest">{t('guideTitle')}</h3>
                <p className="mt-2 text-muted">{t('guideScan')}</p>
              </div>
            </div>
          </div>
        )}
        {showBreakfast && (
          <p className="mt-4 flex items-center gap-3 text-forest">
            <CupIcon /><span><strong>{t('breakfastTitle')}</strong> · {t('breakfastInfo', { hours: config!.breakfast_hours })}</span>
          </p>
        )}
      </div>
    </Shell>
  )
}

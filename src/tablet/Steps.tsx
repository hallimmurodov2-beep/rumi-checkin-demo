import { useEffect, useRef, useState } from 'react'
import { useLang, useT } from '../i18n'
import { tablet } from '../lib/device'
import { ApiError } from '../lib/supabase'
import type { Policy, PublicReservation, TabletConfig, WifiInfo } from '../lib/types'
import { Markdown } from '../lib/markdown'
import { wifiQrText } from '../lib/wifi'
import { fmtDay, LANGS, LOCALE, type Lang } from '../translations'
import { dushanbeTime, hasLobbyWifiPairing, useWifiVoucher, wifiVoucherText } from './frontdesk'
import { AnimatedCheck, Button, CarIcon, CheckIcon, CupIcon, ErrorNote, PhoneIcon, QrCode, Spinner, WifiIcon } from '../ui'
import { Shell } from './Shell'
import { roomTypePhoto } from './gallery'
import './gallery.css'

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
      <p className="mt-1 font-serif text-4xl font-semibold leading-none text-forest">{fmtDay(iso, lang)}</p>
      {weekday && <p className="mt-1.5 text-base capitalize text-muted">{weekday}</p>}
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
        <div className="flex w-full items-center justify-between gap-4">
          <button type="button" onClick={onNotMe} className="min-h-12 cursor-pointer rounded-lg px-3 text-base text-muted underline underline-offset-4 hover:text-forest">
            {t('notMe')}
          </button>
          <Button onClick={onNext}>{t('stayConfirm')}</Button>
        </div>
      }
    >
      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center gap-5">
        <div>
          {greetName && <p className="rise font-serif text-3xl font-semibold text-label">{t('welcomeName', { name: greetName })}</p>}
          <h2 className="text-5xl text-forest">{t('detailsTitle')}</h2>
        </div>
        <div className="grid grid-cols-[1.25fr_1fr] gap-6 max-[900px]:grid-cols-1">
          {/* Left: the room, then the dates. */}
          <div className="flex min-w-0 flex-col gap-4">
            <figure className="rise relative h-[260px] overflow-hidden rounded-3xl bg-forest shadow-[0_24px_60px_-28px_rgb(14_59_46/0.9)] max-[900px]:h-[200px]">
              {photo && <img src={photo.src} alt="" decoding="async" draggable={false} className="absolute inset-0 h-full w-full object-cover" />}
              <span className="absolute inset-0 bg-gradient-to-t from-forest-deep/95 via-forest-deep/35 to-transparent" aria-hidden="true" />
              <figcaption className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 px-7 pb-5 text-cream">
                <span className="min-w-0">
                  <span className="block text-xs font-semibold tracking-[0.18em] text-gold-light">{t('yourRoom').toUpperCase()}</span>
                  <span className="mt-1 block truncate font-serif text-4xl font-semibold leading-tight">{roomName}</span>
                </span>
                <span className="shrink-0 rounded-full border border-cream/30 bg-forest-deep/50 px-4 py-1.5 text-base backdrop-blur-md">
                  {t('guests')}: {reservation.adults}
                </span>
              </figcaption>
            </figure>
            <div className="rise card flex items-center justify-between gap-5 px-7 py-5" style={{ animationDelay: '100ms' }}>
              <DateBlock label={t('stayArrival')} iso={reservation.arrival_date} align="left" />
              <div className="flex min-w-0 flex-1 flex-col items-center gap-1.5 text-muted" aria-hidden="true">
                <span className="flex w-full items-center gap-3">
                  <span className="h-px flex-1 bg-gold/60" />
                  <MoonIcon className="h-5 w-5 text-gold" />
                  <span className="h-px flex-1 bg-gold/60" />
                </span>
                <span className="text-sm font-medium text-forest">{nights === 1 ? t('oneNight') : t('nights', { n: nights })}</span>
              </div>
              <DateBlock label={t('stayDeparture')} iso={reservation.departure_date} align="right" />
            </div>
          </div>

          {/* Right: breakfast reminder and the shuttle question. */}
          <div className="flex min-w-0 flex-col gap-4">
            {showBreakfast && (
              <div className="rise card flex items-start gap-4 p-6" style={{ animationDelay: '160ms' }}>
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gold-light/60 text-forest">
                  <CupIcon />
                </span>
                <div className="min-w-0">
                  <h3 className="text-2xl text-forest">{t('breakfastIncluded')}</h3>
                  <p className="mt-1 text-lg text-muted">{t('breakfastInfo', { hours: breakfastHours! })}</p>
                </div>
              </div>
            )}
            <fieldset className="rise card flex flex-1 flex-col p-6" style={{ animationDelay: '220ms' }}>
              <legend className="sr-only">{t('shuttleTitle')}</legend>
              <div className="flex items-start gap-4">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gold-light/60 text-forest">
                  <CarIcon />
                </span>
                <div className="min-w-0">
                  <h3 className="text-2xl text-forest">{t('shuttleTitle')}</h3>
                  <p className="mt-1 text-lg text-muted">{t('shuttleQ')}</p>
                </div>
              </div>
              <div className="mt-auto grid grid-cols-2 gap-3 pt-5">
                {(['yes', 'no'] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    aria-pressed={value.shuttle === v}
                    onClick={() => onChange({ ...value, shuttle: value.shuttle === v ? null : v })}
                    className={`flex min-h-16 cursor-pointer items-center justify-center gap-2 rounded-xl border-2 text-lg font-medium transition-all duration-200 active:scale-[0.98] ${
                      value.shuttle === v ? 'border-forest bg-forest text-cream' : 'border-line bg-white text-ink hover:border-forest/50'
                    }`}
                  >
                    {value.shuttle === v && <CheckIcon className="h-4 w-4 text-gold-light" />}
                    {t(v)}
                  </button>
                ))}
              </div>
              <p className={`mt-3 min-h-6 text-base text-muted transition-opacity ${value.shuttle === 'yes' ? 'fade-in opacity-100' : 'opacity-0'}`}>{t('shuttleNote')}</p>
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

/** The hotel policy in the guest's language (English fallback); null when none is published. */
function usePolicy(lang: Lang): Policy | null | 'loading' {
  const [p, setP] = useState<Policy | null | 'loading'>('loading')
  useEffect(() => {
    let alive = true
    setP((cur) => (cur && cur !== 'loading' && cur.lang === lang ? cur : 'loading'))
    tablet
      .policy(lang)
      .then((r) => alive && setP(r))
      .catch(() => alive && setP(null))
    return () => {
      alive = false
    }
  }, [lang])
  return p
}

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
  const policy = usePolicy(lang)
  const canvas = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const pts = useRef<Pt[]>([])
  const length = useRef(0)
  const [signed, setSigned] = useState(false)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const c = canvas.current!
    const setup = () => {
      const dpr = window.devicePixelRatio || 1
      const r = c.getBoundingClientRect()
      // Keep what the guest already drew when the box changes size (the policy loading, a language switch).
      let prev: HTMLCanvasElement | null = null
      if (length.current > 0 && c.width && c.height) {
        prev = document.createElement('canvas')
        prev.width = c.width
        prev.height = c.height
        prev.getContext('2d')!.drawImage(c, 0, 0)
      }
      c.width = Math.round(r.width * dpr)
      c.height = Math.round(r.height * dpr)
      const ctx = c.getContext('2d')!
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.lineWidth = 3.2
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.strokeStyle = '#17221D'
      if (prev) {
        ctx.save()
        ctx.setTransform(1, 0, 0, 1, 0, 0)
        ctx.drawImage(prev, 0, 0)
        ctx.restore()
        return
      }
      length.current = 0
      setSigned(false)
    }
    setup()
    let w = c.getBoundingClientRect().width
    const ro = new ResizeObserver(() => {
      const nw = c.getBoundingClientRect().width
      if (Math.abs(nw - w) > 2) {
        w = nw
        setup()
      }
    })
    ro.observe(c)
    return () => ro.disconnect()
  }, [])

  const down = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture?.(e.pointerId)
    drawing.current = true
    const r = canvas.current!.getBoundingClientRect()
    const p = { x: e.clientX - r.left, y: e.clientY - r.top }
    pts.current = [p]
    const ctx = canvas.current!.getContext('2d')!
    ctx.beginPath()
    ctx.arc(p.x, p.y, 1.6, 0, Math.PI * 2)
    ctx.fillStyle = '#17221D'
    ctx.fill()
  }
  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return
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
    }
    if (length.current > 40 && !signed) setSigned(true)
  }
  const up = () => {
    drawing.current = false
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
    setSigned(false)
  }
  const finish = async () => {
    if (!signed || busy || policy === 'loading') return
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
        <Button disabled={!signed || busy || policy === 'loading'} onClick={finish}>
          {busy && <Spinner />}
          {busy ? t('sending') : t('finish')}
        </Button>
      }
    >
      <div className={`mx-auto grid min-h-0 w-full flex-1 gap-6 ${policy === null ? 'max-w-4xl grid-cols-1' : 'max-w-6xl grid-cols-[1.05fr_1fr]'}`}>
        {policy !== null && (
          <section className="card flex min-h-0 flex-col overflow-hidden" aria-labelledby="policy-title">
            <h3 id="policy-title" className="border-b border-line px-6 py-4 text-2xl text-forest">{t('policyTitle')}</h3>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-4 text-[17px] text-ink">
              {policy === 'loading' ? (
                <div className="space-y-3" aria-hidden="true">
                  {[90, 70, 84, 60, 76].map((w, i) => <span key={i} className="shimmer h-4 rounded-full" style={{ width: `${w}%` }} />)}
                </div>
              ) : (
                <Markdown source={policy.body_md} />
              )}
            </div>
          </section>
        )}
        <div className="flex min-h-0 flex-col">
          <div className="flex items-end justify-between gap-6">
            <div>
              <h2 className="text-5xl text-forest">{t('sigTitle')}</h2>
              <p className="mt-1 text-lg text-muted">{policy ? t('sigAgree') : t('sigHint')}</p>
            </div>
            <Button variant="secondary" onClick={clear} disabled={!signed || busy}>
              {t('clear')}
            </Button>
          </div>
          <div className="card relative mt-4 min-h-[240px] flex-1 overflow-hidden !bg-white">
            <canvas
              ref={canvas}
              aria-label={t('signHere')}
              className="relative z-10 h-full w-full cursor-crosshair touch-none"
              onPointerDown={down}
              onPointerMove={move}
              onPointerUp={up}
              onPointerCancel={up}
            />
            <div aria-hidden="true" className="pointer-events-none absolute inset-x-8 bottom-12 flex items-center gap-3 text-muted">
              <span className="font-serif text-3xl">×</span>
              <span className="h-px flex-1 bg-line" />
              <span className="text-sm">{t('signHere')}</span>
            </div>
            <p aria-hidden="true" className="pointer-events-none absolute inset-x-8 bottom-4 text-sm text-muted">
              {t('signedBy', { name: signerName, date: fmtDay(new Date().toISOString().slice(0, 10), lang, true) })}
            </p>
          </div>
          <div className="mt-2 min-h-6">
            {failed ? (
              <ErrorNote>
                <strong className="font-semibold">{t('errorTitle')}.</strong> {t('errorText')}
              </ErrorNote>
            ) : (
              <p className="text-sm text-muted">{signed ? '' : t('sigNeeded')}</p>
            )}
          </div>
        </div>
      </div>
    </Shell>
  )
}

/* -------------------------------- 5. Done -------------------------------- */

function useCountdown(seconds: number, onEnd: () => void) {
  const [n, setN] = useState(seconds)
  const fin = useRef(onEnd)
  fin.current = onEnd
  useEffect(() => {
    const id = window.setInterval(() => setN((x) => x - 1), 1000)
    return () => window.clearInterval(id)
  }, [])
  useEffect(() => {
    if (n <= 0) fin.current()
  }, [n])
  return Math.max(n, 0)
}

/**
 * Room and Wi-Fi for the Done screen. Asks the server a few times, because reception may assign the
 * room, or the front desk app may create a personal Wi-Fi voucher, just after the guest signs.
 * Wi-Fi: the stay's own network if the front desk app sent one; otherwise the hotel's Wi-Fi login
 * voucher from the front desk server (the tablet's "Visitors Wi-Fi" pairing); otherwise the network
 * set in Settings.
 */
function useDoneInfo(config: TabletConfig | null, checkinId: string | null | undefined, initialRoom: string | null) {
  const [room, setRoom] = useState(initialRoom)
  const [serverWifi, setServerWifi] = useState<WifiInfo | null | undefined>(undefined)
  useEffect(() => {
    if (!checkinId) return
    let alive = true
    let tries = 0
    let timer: number | undefined
    const load = () =>
      tablet
        .checkinInfo(checkinId)
        .then((info) => {
          if (!alive) return
          if (info?.room_number) setRoom(info.room_number)
          setServerWifi(info?.wifi ?? null)
          if ((!info?.room_number || !info?.wifi?.per_stay) && ++tries < 8) timer = window.setTimeout(load, 3500)
        })
        .catch(() => {
          if (alive && ++tries < 8) timer = window.setTimeout(load, 3500)
        })
    load()
    return () => {
      alive = false
      window.clearTimeout(timer)
    }
  }, [checkinId])
  const hotelWifi: WifiInfo | null = config?.wifi_name
    ? { ssid: config.wifi_name, password: config.wifi_password || null, security: config.wifi_security ?? 'WPA', hidden: config.wifi_hidden, qr_payload: config.wifi_qr }
    : null
  return { room, perStay: serverWifi?.per_stay ? serverWifi : null, fallback: serverWifi ?? hotelWifi }
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
function VoucherCard({ url, expiresAt }: { url: string; expiresAt: number }) {
  const t = useT()
  const lang = useLang()
  const v = wifiVoucherText[lang]
  return (
    <div className="card flex h-full items-center gap-6 p-6">
      <QrCode key={url} text={url} label={t('wifiTitle')} className="h-44 w-44 xl:h-48 xl:w-48" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-3 text-forest">
          <WifiIcon />
          <h3 className="text-3xl">{t('wifiTitle')}</h3>
        </div>
        <p className="mt-3 text-lg">{v[1]}</p>
        <p className="mt-3 flex items-center gap-2 text-sm text-muted">
          <PhoneIcon className="h-4 w-4 shrink-0" />
          {t('wifiScan')}
        </p>
        <p className="mt-1 text-sm text-muted">
          {v[2]} {dushanbeTime.format(expiresAt)}
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
  const { room, perStay, fallback } = useDoneInfo(config, checkinId, initialRoom)
  const paired = hasLobbyWifiPairing()
  const { voucher, state: voucherState } = useWifiVoucher(paired && !perStay)
  // The lobby voucher server is down or the pairing was revoked: show the hotel Wi-Fi from Settings instead of nothing.
  const voucherFailed = voucherState === 'error' || voucherState === 'unpaired'
  const wifi = perStay ?? (paired && !voucherFailed ? null : fallback)
  const showWifi = !!wifi || !!voucher
  // Give guests time to scan the Wi-Fi code before the screen resets.
  const n = useCountdown(45, onFinish)
  const showBreakfast = breakfast && !!config?.breakfast_hours
  const photo = roomTypePhoto(roomType)
  const lang = useLang()

  return (
    <Shell
      step={4}
      hideBack
      action={
        <div className="flex items-center gap-6">
          <p className="tabular-nums text-muted">{t('returning', { n })}</p>
          <Button onClick={onFinish}>{t('startNew')}</Button>
        </div>
      }
    >
      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center">
        <div className="flex items-center gap-7" role="status">
          <AnimatedCheck size="h-24 w-24" />
          <div className="rise min-w-0" style={{ animationDelay: '120ms' }}>
            <h2 className="text-6xl text-forest">{t('doneTitle')}</h2>
            <p className="mt-1 text-2xl font-medium text-ink">{t('handoffDoneSub')}</p>
          </div>
          {room && photo && (
            <figure
              className="room-photo ring-grow relative ml-auto h-[176px] w-[300px] shrink-0 overflow-hidden rounded-3xl bg-forest shadow-[0_20px_50px_-24px_rgb(14_59_46/0.9)]"
              style={{ animationDelay: '200ms' }}
            >
              <img src={photo.src} alt="" decoding="async" draggable={false} className="absolute inset-0 h-full w-full object-cover" />
              <span className="absolute inset-0 bg-gradient-to-t from-forest-deep/95 via-forest-deep/40 to-transparent" aria-hidden="true" />
              <figcaption className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 px-6 pb-4 text-cream">
                <span className="min-w-0">
                  <span className="block text-xs font-semibold tracking-[0.18em] text-gold-light">{t('yourRoom').toUpperCase()}</span>
                  <span className="block truncate text-sm text-cream/85" title={t('roomTypeShown')}>{photo[lang]}</span>
                </span>
                <span className="font-serif text-6xl font-semibold leading-none">{room}</span>
              </figcaption>
            </figure>
          )}
          {room && !photo && (
            <div className="ring-grow ml-auto shrink-0 rounded-3xl bg-forest px-9 py-5 text-center text-cream shadow-[0_20px_50px_-24px_rgb(14_59_46/0.9)]" style={{ animationDelay: '200ms' }}>
              <p className="text-xs font-semibold tracking-[0.18em] text-gold-light">{t('yourRoom').toUpperCase()}</p>
              <p className="font-serif text-6xl font-semibold">{room}</p>
            </div>
          )}
        </div>
        {(showWifi || showBreakfast) && (
          <div className={`mt-10 grid gap-5 ${showWifi && showBreakfast ? 'grid-cols-[1.6fr_1fr]' : 'max-w-3xl grid-cols-1'}`}>
            {showWifi && (
              <div className="rise" style={{ animationDelay: '260ms' }}>
                {wifi ? <WifiCard wifi={wifi} /> : <VoucherCard url={voucher!.url} expiresAt={voucher!.expiresAt} />}
              </div>
            )}
            {showBreakfast && (
              <div className="rise" style={{ animationDelay: '350ms' }}>
                <div className="card h-full p-6">
                  <div className="flex items-center gap-3 text-forest">
                    <CupIcon />
                    <h3 className="text-3xl">{t('breakfastTitle')}</h3>
                  </div>
                  <p className="mt-3 text-lg">{t('breakfastInfo', { hours: config!.breakfast_hours })}</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Shell>
  )
}

export { useCountdown }

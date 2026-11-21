import { useEffect, useRef, useState } from 'react'
import { useT } from '../i18n'
import { Button, CheckIcon } from '../ui'
import { Shell } from './Shell'

export interface Details {
  phone: string
  email: string
  shuttle: 'yes' | 'no' | null
  consent: boolean
}
export const emptyDetails: Details = { phone: '', email: '', shuttle: null, consent: false }

/* ------------------------------ 1. Passport ------------------------------ */

function Corner({ pos }: { pos: string }) {
  return <span aria-hidden="true" className={`absolute h-10 w-10 border-gold ${pos}`} />
}

export function Passport({ onBack, onFound }: { onBack: () => void; onFound: () => void }) {
  const t = useT()
  const [mode, setMode] = useState<'scan' | 'booking'>('scan')
  const [reading, setReading] = useState(false)
  const [booking, setBooking] = useState('')
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => () => window.clearTimeout(timer.current), [])

  const simulate = () => {
    setReading(true)
    timer.current = window.setTimeout(onFound, 1500)
  }

  return (
    <Shell step={0} onBack={onBack} hideBack={reading}>
      <div className="flex min-h-0 flex-1 items-center gap-12">
        <div
          role="img"
          aria-label={t('frameLabel')}
          className="relative aspect-[1.42/1] w-[52%] shrink-0 overflow-hidden rounded-2xl bg-forest-deep"
        >
          <Corner pos="left-5 top-5 rounded-tl-lg border-l-4 border-t-4" />
          <Corner pos="right-5 top-5 rounded-tr-lg border-r-4 border-t-4" />
          <Corner pos="bottom-5 left-5 rounded-bl-lg border-b-4 border-l-4" />
          <Corner pos="bottom-5 right-5 rounded-br-lg border-b-4 border-r-4" />
          <div className="absolute inset-x-14 inset-y-12 flex flex-col justify-between rounded-lg border border-cream/20 p-5 text-cream/40">
            <div className="flex gap-4">
              <div className="h-20 w-16 rounded bg-cream/10" />
              <div className="flex-1 space-y-2 pt-1">
                <div className="h-2.5 w-2/3 rounded bg-cream/10" />
                <div className="h-2.5 w-1/2 rounded bg-cream/10" />
                <div className="h-2.5 w-3/5 rounded bg-cream/10" />
              </div>
            </div>
            <div className="font-mono text-[11px] leading-4 tracking-widest" aria-hidden="true">
              <div>P&lt;[COUNTRY]&lt;&lt;[SURNAME]&lt;&lt;[GIVEN NAMES]&lt;&lt;&lt;&lt;&lt;&lt;</div>
              <div>[PASSPORT NO]&lt;[CHECK]&lt;[COUNTRY]&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;</div>
            </div>
          </div>
          {reading && (
            <div aria-hidden="true" className="scan-line absolute inset-x-8 h-0.5 bg-gold-light shadow-[0_0_14px_2px_#ECCD78]" />
          )}
          {reading && (
            <div className="absolute inset-x-0 bottom-3 text-center text-sm font-medium text-gold-light" role="status">
              {t('reading')}
            </div>
          )}
        </div>

        <div className="flex-1">
          {mode === 'scan' ? (
            <>
              <h2 className="text-5xl text-forest">{t('passportTitle')}</h2>
              <p className="mt-3 text-xl text-muted">{t('passportHint')}</p>
              <Button className="mt-8 w-full" onClick={simulate} disabled={reading}>
                {reading ? t('reading') : t('useDemoPassport')}
              </Button>
              <Button variant="ghost" className="mt-3 w-full" onClick={() => setMode('booking')} disabled={reading}>
                {t('noPassport')}
              </Button>
            </>
          ) : (
            <>
              <h2 className="text-5xl text-forest">{t('bookingNumber')}</h2>
              <label htmlFor="bk" className="mt-6 block text-sm font-semibold tracking-wide text-label">
                {t('bookingNumber')}
              </label>
              <input
                id="bk"
                value={booking}
                onChange={(e) => setBooking(e.target.value)}
                placeholder="DEMO-0001"
                className="mt-2 min-h-16 w-full rounded-xl border-2 border-line bg-white px-5 text-xl"
              />
              <p className="mt-2 text-muted">{t('bookingNumberHint')}</p>
              <Button className="mt-6 w-full" disabled={!booking.trim()} onClick={onFound}>
                {t('findBooking')}
              </Button>
              <Button variant="ghost" className="mt-3 w-full" onClick={() => setMode('scan')}>
                {t('scanInstead')}
              </Button>
            </>
          )}
          <p className="mt-6 text-sm text-muted">{t('passportNote')}</p>
        </div>
      </div>
    </Shell>
  )
}

/* ------------------------------ 2. Confirm ------------------------------- */

export function Confirm({ onBack, onYes, onNo }: { onBack: () => void; onYes: () => void; onNo: () => void }) {
  const t = useT()
  const rows: [string, string][] = [
    [t('guestName'), 'Sample Guest'],
    [t('nationality'), '[COUNTRY]'],
    [t('source'), 'Booking.com'],
    [t('dates'), t('sampleDates')],
    [t('room'), t('sampleRoom')],
    [t('meals'), t('breakfastIncluded')],
  ]
  return (
    <Shell step={1} onBack={onBack}>
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center">
        <h2 className="text-5xl text-forest">{t('confirmTitle')}</h2>
        <dl className="mt-6 divide-y divide-line rounded-2xl border border-line bg-white">
          {rows.map(([k, v]) => (
            <div key={k} className="flex items-baseline justify-between gap-6 px-6 py-3.5">
              <dt className="text-sm font-semibold tracking-wide text-label">{k.toUpperCase()}</dt>
              <dd className="text-xl text-ink">{v}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-6 grid grid-cols-2 gap-4">
          <Button onClick={onYes}>{t('yesCorrect')}</Button>
          <Button variant="secondary" onClick={onNo}>
            {t('notMine')}
          </Button>
        </div>
      </div>
    </Shell>
  )
}

export function NotMine({ onBack, onStart }: { onBack: () => void; onStart: () => void }) {
  const t = useT()
  return (
    <Shell step={1} onBack={onBack}>
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <h2 className="text-6xl text-forest">{t('teamHelp')}</h2>
        <p className="mt-4 max-w-xl text-xl text-muted">{t('teamHelpSub')}</p>
        <Button className="mt-10" onClick={onStart}>
          {t('backToStart')}
        </Button>
      </div>
    </Shell>
  )
}

/* ------------------------------ 3. Details ------------------------------- */

export function DetailsStep({
  value,
  onChange,
  onBack,
  onNext,
}: {
  value: Details
  onChange: (d: Details) => void
  onBack: () => void
  onNext: () => void
}) {
  const t = useT()
  const input = 'mt-2 min-h-16 w-full rounded-xl border-2 border-line bg-white px-5 text-xl'
  const label = 'block text-sm font-semibold tracking-wide text-label'
  return (
    <Shell
      step={2}
      onBack={onBack}
      action={
        <Button disabled={!value.consent} onClick={onNext}>
          {t('continue')}
        </Button>
      }
    >
      <div className="mx-auto grid w-full max-w-4xl flex-1 grid-cols-2 content-center gap-x-10 gap-y-5">
        <h2 className="col-span-2 text-5xl text-forest">{t('detailsTitle')}</h2>
        <div>
          <label htmlFor="phone" className={label}>{t('phone').toUpperCase()}</label>
          <input id="phone" type="tel" inputMode="tel" autoComplete="off" placeholder="+000 00 000 0000" className={input} value={value.phone} onChange={(e) => onChange({ ...value, phone: e.target.value })} />
        </div>
        <div>
          <label htmlFor="email" className={label}>{t('email').toUpperCase()}</label>
          <input id="email" type="email" inputMode="email" autoComplete="off" placeholder="name@example.com" className={input} value={value.email} onChange={(e) => onChange({ ...value, email: e.target.value })} />
        </div>
        <fieldset className="col-span-2">
          <legend className={label}>{t('shuttleTitle').toUpperCase()}</legend>
          <p className="mt-1 text-lg text-muted">{t('shuttleQ')}</p>
          <div className="mt-3 grid max-w-md grid-cols-2 gap-3">
            {(['yes', 'no'] as const).map((v) => (
              <button
                key={v}
                type="button"
                aria-pressed={value.shuttle === v}
                onClick={() => onChange({ ...value, shuttle: v })}
                className={`min-h-16 cursor-pointer rounded-xl border-2 text-lg font-medium ${
                  value.shuttle === v ? 'border-forest bg-forest text-cream' : 'border-line bg-white text-ink hover:border-forest'
                }`}
              >
                {t(v)}
              </button>
            ))}
          </div>
        </fieldset>
        <div className="col-span-2">
          <label htmlFor="consent" className="flex min-h-16 cursor-pointer items-center gap-4 rounded-xl border-2 border-line bg-white px-5 py-3">
            <input
              id="consent"
              type="checkbox"
              checked={value.consent}
              onChange={(e) => onChange({ ...value, consent: e.target.checked })}
              className="h-8 w-8 shrink-0 cursor-pointer accent-forest"
            />
            <span className="text-lg">{t('consent')}</span>
          </label>
          {!value.consent && <p className="mt-2 text-sm text-muted">{t('consentNeeded')}</p>}
        </div>
      </div>
    </Shell>
  )
}

/* ------------------------------ 4. Signature ----------------------------- */

export function SignatureStep({ onBack, onNext }: { onBack: () => void; onNext: () => void }) {
  const t = useT()
  const canvas = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const last = useRef<{ x: number; y: number } | null>(null)
  const length = useRef(0)
  const [signed, setSigned] = useState(false)

  useEffect(() => {
    const c = canvas.current!
    const dpr = window.devicePixelRatio || 1
    const r = c.getBoundingClientRect()
    c.width = Math.round(r.width * dpr)
    c.height = Math.round(r.height * dpr)
    const ctx = c.getContext('2d')!
    ctx.scale(dpr, dpr)
    ctx.lineWidth = 3.5
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = '#17221D'
  }, [])

  const pos = (e: React.PointerEvent) => {
    const r = canvas.current!.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }
  const down = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    drawing.current = true
    last.current = pos(e)
    const ctx = canvas.current!.getContext('2d')!
    ctx.beginPath()
    ctx.moveTo(last.current.x, last.current.y)
    ctx.lineTo(last.current.x + 0.01, last.current.y)
    ctx.stroke()
  }
  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current || !last.current) return
    const p = pos(e)
    const ctx = canvas.current!.getContext('2d')!
    ctx.beginPath()
    ctx.moveTo(last.current.x, last.current.y)
    ctx.lineTo(p.x, p.y)
    ctx.stroke()
    length.current += Math.hypot(p.x - last.current.x, p.y - last.current.y)
    last.current = p
    if (length.current > 40 && !signed) setSigned(true)
  }
  const up = () => {
    drawing.current = false
    last.current = null
  }
  const clear = () => {
    const c = canvas.current!
    c.getContext('2d')!.clearRect(0, 0, c.width, c.height)
    length.current = 0
    setSigned(false)
  }

  return (
    <Shell
      step={3}
      onBack={onBack}
      action={
        <Button disabled={!signed} onClick={onNext}>
          {t('finish')}
        </Button>
      }
    >
      <div className="mx-auto flex w-full max-w-4xl min-h-0 flex-1 flex-col">
        <div className="flex items-end justify-between gap-6">
          <div>
            <h2 className="text-5xl text-forest">{t('sigTitle')}</h2>
            <p className="mt-1 text-lg text-muted">{t('sigHint')}</p>
          </div>
          <Button variant="secondary" onClick={clear} aria-label={t('clear')}>
            {t('clear')}
          </Button>
        </div>
        <div className="relative mt-4 min-h-0 flex-1 overflow-hidden rounded-2xl border-2 border-line bg-white">
          <canvas
            ref={canvas}
            aria-label={t('signHere')}
            className="h-full w-full touch-none"
            onPointerDown={down}
            onPointerMove={move}
            onPointerUp={up}
            onPointerCancel={up}
          />
          <div aria-hidden="true" className="pointer-events-none absolute inset-x-8 bottom-10 flex items-center gap-3 text-muted">
            <span className="text-2xl">x</span>
            <span className="h-px flex-1 bg-line" />
            <span className="text-sm">{t('signHere')}</span>
          </div>
        </div>
        {!signed && <p className="mt-2 text-sm text-muted">{t('sigNeeded')}</p>}
      </div>
    </Shell>
  )
}

/* -------------------------------- 5. Done -------------------------------- */

export function Done({ onFinish }: { onFinish: () => void }) {
  const t = useT()
  const [n, setN] = useState(20)
  const fin = useRef(onFinish)
  fin.current = onFinish

  useEffect(() => {
    const id = window.setInterval(() => setN((x) => x - 1), 1000)
    return () => window.clearInterval(id)
  }, [])
  useEffect(() => {
    if (n <= 0) fin.current()
  }, [n])

  return (
    <Shell
      step={4}
      hideBack
      action={
        <div className="flex items-center gap-6">
          <p className="text-muted" role="status">{t('returning', { n: Math.max(n, 0) })}</p>
          <Button onClick={onFinish}>{t('startNew')}</Button>
        </div>
      }
    >
      <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col justify-center">
        <div className="flex items-center gap-6">
          <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-forest text-gold-light">
            <CheckIcon className="h-10 w-10" />
          </span>
          <div>
            <h2 className="text-6xl text-forest">{t('doneTitle')}</h2>
            <p className="mt-1 text-2xl font-medium text-ink">{t('doneSub')}</p>
          </div>
        </div>
        <div className="mt-8 grid grid-cols-2 gap-5">
          <div className="rounded-2xl border border-line bg-white p-6">
            <h3 className="text-3xl text-forest">{t('wifiTitle')}</h3>
            <dl className="mt-3 space-y-2 text-lg">
              <div className="flex justify-between"><dt className="text-muted">{t('wifiNetwork')}</dt><dd className="font-medium">Rumi-Guest</dd></div>
              <div className="flex justify-between"><dt className="text-muted">{t('wifiPassword')}</dt><dd className="font-medium">welcome-demo</dd></div>
            </dl>
          </div>
          <div className="rounded-2xl border border-line bg-white p-6">
            <h3 className="text-3xl text-forest">{t('breakfastTitle')}</h3>
            <p className="mt-3 text-lg">{t('breakfastInfo')}</p>
          </div>
        </div>
      </div>
    </Shell>
  )
}

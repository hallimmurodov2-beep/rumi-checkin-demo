import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLang, useT } from '../i18n'
import { tablet } from '../lib/device'
import { usePassportScanner } from '../lib/scanner'
import { ApiError } from '../lib/supabase'
import type { MrzData, PublicReservation, TabletConfig } from '../lib/types'
import { fmtDay } from '../translations'
import { AnimatedCheck, Button, CarIcon, CheckIcon, CupIcon, ErrorNote, Spinner, WifiIcon } from '../ui'
import { Shell } from './Shell'

export interface Details {
  phone: string
  email: string
  shuttle: 'yes' | 'no' | null
  consent: boolean
}
export const emptyDetails: Details = { phone: '', email: '', shuttle: null, consent: false }

/* ------------------------------ 1. Passport scan ------------------------- */

function Corner({ pos }: { pos: string }) {
  return <span aria-hidden="true" className={`absolute h-9 w-9 border-gold-light ${pos}`} />
}

export function Scan({
  facing,
  onBack,
  onRead,
  onNoPassport,
  companion,
}: {
  facing: 'user' | 'environment'
  onBack: () => void
  onRead: (m: MrzData) => void
  onNoPassport?: () => void
  /** Scanning an additional guest on the same booking. */
  companion?: boolean
}) {
  const t = useT()
  const video = useRef<HTMLVideoElement>(null)
  const guide = useRef<HTMLDivElement>(null)
  const { state, result, almost } = usePassportScanner(video, guide, facing, true)
  const [tip, setTip] = useState(false)

  useEffect(() => {
    if (state !== 'scanning') return
    const id = window.setTimeout(() => setTip(true), 12_000)
    return () => window.clearTimeout(id)
  }, [state])

  useEffect(() => {
    if (state === 'found' && result) {
      const id = window.setTimeout(() => onRead(result), 1100)
      return () => window.clearTimeout(id)
    }
  }, [state, result, onRead])

  return (
    <Shell step={companion ? 1 : 0} onBack={onBack}>
      <div className="flex min-h-0 flex-1 items-center gap-10">
        <div className="relative aspect-[4/3] w-[56%] shrink-0 overflow-hidden rounded-3xl bg-forest-deep shadow-[0_30px_60px_-30px_rgb(10_42_33/0.8)]">
          <video
            ref={video}
            playsInline
            muted
            className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ${state === 'scanning' || state === 'found' ? 'opacity-100' : 'opacity-0'}`}
            style={facing === 'user' ? { transform: 'scaleX(-1)' } : undefined}
          />
          {/* Dim everything outside the guide */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div
              ref={guide}
              className={`relative aspect-[1.42/1] w-[80%] rounded-2xl shadow-[0_0_0_9999px_rgb(10_42_33/0.55)] transition-[outline-color] duration-300 ${almost && state === 'scanning' ? 'outline outline-4 outline-offset-4 outline-gold-light/70' : 'outline-0 outline-transparent'}`}
            >
              <Corner pos="-left-1 -top-1 rounded-tl-2xl border-l-4 border-t-4" />
              <Corner pos="-right-1 -top-1 rounded-tr-2xl border-r-4 border-t-4" />
              <Corner pos="-bottom-1 -left-1 rounded-bl-2xl border-b-4 border-l-4" />
              <Corner pos="-bottom-1 -right-1 rounded-br-2xl border-b-4 border-r-4" />
              <div className="breathe absolute inset-x-4 bottom-4 h-[26%] rounded-lg border-2 border-dashed border-gold-light/70" aria-hidden="true">
                <div className="flex h-full flex-col justify-center gap-1 px-3 font-mono text-[11px] leading-4 tracking-[0.2em] text-gold-light/70">
                  <span>P&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;</span>
                  <span>&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;</span>
                </div>
              </div>
              {state === 'scanning' && (
                <div aria-hidden="true" className="scan-line absolute inset-x-6 h-0.5 rounded-full bg-gold-light shadow-[0_0_16px_3px_#ECCD78]" />
              )}
            </div>
          </div>
          {state === 'starting' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-gold-light">
              <Spinner className="h-8 w-8" />
              <span className="text-sm font-medium">{t('cameraStarting')}</span>
            </div>
          )}
          {state === 'found' && result && (
            <div className="pop-in absolute inset-0 flex flex-col items-center justify-center gap-4 bg-forest-deep/85 text-center">
              <AnimatedCheck size="h-20 w-20" />
              <span className="text-xl font-semibold text-cream">{t('passportRead')}</span>
              <span className="font-serif text-3xl font-semibold text-gold-light">
                {result.givenNames} {result.surname}
              </span>
            </div>
          )}
        </div>

        <div className="flex-1">
          <h2 className="text-5xl leading-tight text-forest">{companion ? t('scanGuestTitle') : t('passportTitle')}</h2>
          {state === 'unavailable' ? (
            <div className="mt-5">
              <ErrorNote>{t('cameraUnavailable')}</ErrorNote>
              {onNoPassport && (
                <Button className="mt-6 w-full" onClick={onNoPassport}>
                  {t('noPassport')}
                </Button>
              )}
            </div>
          ) : (
            <>
              <p className="mt-3 text-xl leading-relaxed text-muted">{t('passportHint')}</p>
              <p className="mt-6 flex min-h-7 items-center gap-3 font-medium text-forest" role="status">
                {state === 'scanning' && <Spinner className="h-5 w-5 text-gold" />}
                {state === 'scanning' ? (almost ? t('scanAlmost') : t('scanning')) : state === 'found' ? t('passportRead') : ''}
              </p>
              {tip && state === 'scanning' && !almost && <p className="fade-in mt-2 text-muted">{t('scanTip')}</p>}
              {onNoPassport && (
                <Button variant="ghost" className="mt-6 w-full" onClick={onNoPassport} disabled={state === 'found'}>
                  {t('noPassport')}
                </Button>
              )}
            </>
          )}
          <p className="mt-6 border-t border-line pt-4 text-sm leading-relaxed text-muted">{t('privacyNote')}</p>
        </div>
      </div>
    </Shell>
  )
}

/* ---------------------- 1b. Find the booking (name / number) ----------- */

export function FindBooking({
  deskMode,
  initialSurname,
  multiple,
  onBack,
  onFound,
  onScan,
  onHelp,
}: {
  /** Passports are scanned at reception: look the booking up by name first. */
  deskMode: boolean
  initialSurname: string
  multiple: boolean
  onBack: () => void
  onFound: (r: PublicReservation) => void
  onScan?: () => void
  onHelp: () => void
}) {
  const t = useT()
  const [by, setBy] = useState<'name' | 'ref'>(deskMode && !multiple ? 'name' : 'ref')
  const [ref, setRef] = useState('')
  const [first, setFirst] = useState('')
  const [surname, setSurname] = useState(initialSurname)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<'none' | 'failed' | null>(null)
  const [needRef, setNeedRef] = useState(multiple)
  const ready = surname.trim().length >= 2 && (by === 'name' ? first.trim().length >= 2 : ref.trim().length >= 3)

  const submit = async () => {
    if (!ready || busy) return
    setBusy(true)
    setError(null)
    try {
      const res = by === 'name' ? await tablet.findByName(surname.trim(), first.trim()) : await tablet.findByRef(ref.trim(), surname.trim())
      if (res.status === 'found') onFound(res.reservation)
      else if (res.status === 'multiple') {
        setNeedRef(true)
        setBy('ref')
      } else setError('none')
    } catch {
      setError('failed')
    } finally {
      setBusy(false)
    }
  }

  const tab = (k: 'name' | 'ref', label: string) => (
    <button
      type="button"
      role="tab"
      aria-selected={by === k}
      onClick={() => {
        setBy(k)
        setError(null)
      }}
      className={`min-h-14 flex-1 cursor-pointer rounded-xl px-5 text-lg font-medium transition-all duration-200 ${
        by === k ? 'bg-forest text-cream shadow-[0_8px_20px_-12px_rgb(14_59_46/0.8)]' : 'text-muted hover:text-forest'
      }`}
    >
      {label}
    </button>
  )

  return (
    <Shell
      step={deskMode ? 1 : 0}
      onBack={onBack}
      action={
        <Button disabled={!ready || busy} onClick={submit}>
          {busy ? <Spinner /> : null}
          {busy ? t('searching') : t('findBooking')}
        </Button>
      }
    >
      <form
        className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center"
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
      >
        <h2 className="text-5xl text-forest">{t('findTitle')}</h2>
        <p className="mt-2 text-lg text-muted">{needRef ? t('findMultiple') : by === 'name' ? t('findNameText') : t('bookingNumberHint')}</p>
        {deskMode && (
          <div className="mt-6 flex max-w-xl gap-1 rounded-2xl border border-line bg-white p-1.5" role="tablist">
            {tab('name', t('findByName'))}
            {tab('ref', t('findByRef'))}
          </div>
        )}
        <div key={by} className="fade-in mt-6 grid grid-cols-2 gap-6">
          {by === 'name' ? (
            <div>
              <label htmlFor="fn" className="eyebrow block">{t('firstName')}</label>
              <input id="fn" value={first} onChange={(e) => setFirst(e.target.value)} autoComplete="off" autoCapitalize="words" spellCheck={false} enterKeyHint="next" className="field mt-2" />
            </div>
          ) : (
            <div>
              <label htmlFor="bk" className="eyebrow block">{t('bookingNumber')}</label>
              <input id="bk" value={ref} onChange={(e) => setRef(e.target.value)} autoComplete="off" autoCapitalize="characters" spellCheck={false} enterKeyHint="next" className="field mt-2 uppercase tracking-wider" />
              <p className="mt-2 text-sm text-muted">{t('bookingNumberHint')}</p>
            </div>
          )}
          <div>
            <label htmlFor="sn" className="eyebrow block">{t('surname')}</label>
            <input id="sn" value={surname} onChange={(e) => setSurname(e.target.value)} autoComplete="off" autoCapitalize="words" spellCheck={false} enterKeyHint="search" className="field mt-2" />
            <p className="mt-2 text-sm text-muted">{t('surnameHint')}</p>
          </div>
        </div>
        <button type="submit" hidden />
        <div className="mt-6 min-h-[88px]">
          {error === 'none' && (
            <ErrorNote>
              <strong className="block font-semibold">{t('notFoundTitle')}</strong>
              {t('notFoundText')}
              <button type="button" onClick={onHelp} className="ml-2 min-h-11 cursor-pointer font-semibold underline underline-offset-4">
                {t('teamHelp')}
              </button>
            </ErrorNote>
          )}
          {error === 'failed' && (
            <ErrorNote>
              <strong className="block font-semibold">{t('errorTitle')}</strong>
              {t('errorText')}
            </ErrorNote>
          )}
        </div>
        {onScan && (
          <Button variant="ghost" className="self-start" onClick={onScan}>
            {t('scanInstead')}
          </Button>
        )}
      </form>
    </Shell>
  )
}

/* ------------------------------ 2. Confirm ------------------------------- */

function mask(doc: string) {
  return doc.length > 4 ? `•••• ${doc.slice(-4)}` : doc
}

export function Confirm({
  reservation: r,
  mrz,
  onBack,
  onYes,
  onNo,
}: {
  reservation: PublicReservation
  mrz: MrzData | null
  onBack: () => void
  onYes: () => void
  onNo: () => void
}) {
  const t = useT()
  const lang = useLang()
  const expired = mrz?.expiryDate ? mrz.expiryDate < new Date().toISOString().slice(0, 10) : false
  return (
    <Shell step={1} onBack={onBack}>
      <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col justify-center">
        <h2 className="text-5xl text-forest">{t('confirmTitle')}</h2>
        <div className="card mt-6 overflow-hidden">
          <div className="relative overflow-hidden bg-forest px-8 py-6 text-cream">
            <p className="text-xs font-semibold tracking-[0.18em] text-gold-light">
              {t('bookingRef').toUpperCase()} · {r.booking_ref} · {r.source}
            </p>
            <p className="mt-1 font-serif text-4xl font-semibold">{r.guest_name}</p>
          </div>
          <dl className="grid grid-cols-3 divide-x divide-line">
            <div className="px-8 py-5">
              <dt className="eyebrow">{t('dates')}</dt>
              <dd className="mt-1.5 text-xl font-medium">
                {fmtDay(r.arrival_date, lang)} – {fmtDay(r.departure_date, lang)}
              </dd>
              <dd className="text-muted">{r.nights === 1 ? t('oneNight') : t('nights', { n: r.nights })}</dd>
            </div>
            <div className="px-8 py-5">
              <dt className="eyebrow">{t('room')}</dt>
              <dd className="mt-1.5 text-xl font-medium">{r.room_number ? t('roomAssigned', { room: r.room_number }) : r.room_type || '—'}</dd>
              <dd className="text-muted">
                {r.room_number && r.room_type ? `${r.room_type} · ` : ''}
                {t('guests')}: {r.adults}
              </dd>
            </div>
            <div className="px-8 py-5">
              <dt className="eyebrow">{t('meals')}</dt>
              <dd className="mt-1.5 text-xl font-medium">{r.breakfast ? t('breakfastIncluded') : t('roomOnly')}</dd>
            </div>
          </dl>
          {mrz && (
            <div className="flex items-center justify-between gap-6 border-t border-line bg-cream/60 px-8 py-4">
              <div>
                <span className="eyebrow">{t('passport')}</span>
                <p className="mt-1 text-lg font-medium">
                  {mrz.surname}, {mrz.givenNames}
                  <span className="ml-3 text-muted">
                    {mrz.nationality} · {mask(mrz.documentNumber)}
                  </span>
                </p>
              </div>
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-forest text-gold-light" aria-hidden="true">
                <CheckIcon className="h-4 w-4" />
              </span>
            </div>
          )}
        </div>
        {expired && (
          <div className="mt-4">
            <ErrorNote>{t('passportExpired')}</ErrorNote>
          </div>
        )}
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

export function NeedHelp({ onBack, onStart, step = 1 }: { onBack?: () => void; onStart: () => void; step?: number }) {
  const t = useT()
  return (
    <Shell step={step} onBack={onBack} hideBack={!onBack}>
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

/* -------------------------- 2b. Other guests ----------------------------- */

export function OtherGuests({
  lead,
  companions,
  adults,
  notice,
  onScan,
  onRemove,
  onBack,
  onNext,
}: {
  lead: string
  companions: MrzData[]
  adults: number
  notice: string | null
  onScan: () => void
  onRemove: (i: number) => void
  onBack: () => void
  onNext: () => void
}) {
  const t = useT()
  const done = 1 + companions.length
  const complete = done >= adults
  return (
    <Shell step={1} onBack={onBack} action={<Button onClick={onNext}>{t('continue')}</Button>}>
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center">
        <h2 className="text-5xl text-forest">{t('guestsTitle')}</h2>
        <p className="mt-2 text-lg text-muted">{t('guestsText', { n: adults })}</p>
        <div className="mt-6 flex items-center gap-3">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-line" aria-hidden="true">
            <div className="h-full rounded-full bg-forest transition-[width] duration-500" style={{ width: `${Math.min(100, (done / adults) * 100)}%` }} />
          </div>
          <span className="text-sm font-medium text-forest">{t('guestsCount', { n: done, total: adults })}</span>
        </div>
        <ul className="card mt-5 divide-y divide-line">
          <li className="flex min-h-16 items-center gap-4 px-6 py-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-forest text-gold-light"><CheckIcon className="h-4 w-4" /></span>
            <span className="flex-1 text-lg font-medium">{lead} <span className="font-normal text-muted">({t('you')})</span></span>
          </li>
          {companions.map((c, i) => (
            <li key={c.documentNumber} className="fade-in flex min-h-16 items-center gap-4 px-6 py-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-forest text-gold-light"><CheckIcon className="h-4 w-4" /></span>
              <span className="flex-1 text-lg font-medium">
                {c.givenNames} {c.surname} <span className="font-normal text-muted">· {c.nationality}</span>
              </span>
              <Button variant="ghost" className="!min-h-14 !px-4 !text-base" onClick={() => onRemove(i)}>
                {t('remove')}
              </Button>
            </li>
          ))}
        </ul>
        {notice && <div className="mt-4"><ErrorNote>{notice}</ErrorNote></div>}
        {!complete && (
          <>
            <Button variant="secondary" className="mt-6" onClick={onScan}>
              {t('scanNext')}
            </Button>
            <p className="mt-3 text-muted">{t('guestsLater')}</p>
          </>
        )}
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
  retentionDays = 90,
  deskMode = false,
}: {
  value: Details
  onChange: (d: Details) => void
  onBack: () => void
  onNext: () => void
  retentionDays?: number
  deskMode?: boolean
}) {
  const t = useT()
  const [privacy, setPrivacy] = useState(false)
  const opt = <span className="font-normal normal-case tracking-normal text-muted"> ({t('optional')})</span>
  const emailBad = value.email.trim() !== '' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.email.trim())
  return (
    <Shell
      step={2}
      onBack={onBack}
      action={
        <Button disabled={!value.consent || emailBad} onClick={onNext}>
          {t('continue')}
        </Button>
      }
    >
      <div className="mx-auto grid w-full max-w-4xl flex-1 grid-cols-2 content-center gap-x-8 gap-y-6">
        <h2 className="col-span-2 text-5xl text-forest">{t('detailsTitle')}</h2>
        <div>
          <label htmlFor="phone" className="eyebrow block">{t('phone')}{opt}</label>
          <input id="phone" type="tel" inputMode="tel" autoComplete="off" placeholder="+992" className="field mt-2" value={value.phone} onChange={(e) => onChange({ ...value, phone: e.target.value })} />
        </div>
        <div>
          <label htmlFor="email" className="eyebrow block">{t('email')}{opt}</label>
          <input
            id="email"
            type="email"
            inputMode="email"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="name@example.com"
            aria-invalid={emailBad}
            aria-describedby={emailBad ? 'email-err' : undefined}
            className={`field mt-2 ${emailBad ? '!border-danger' : ''}`}
            value={value.email}
            onChange={(e) => onChange({ ...value, email: e.target.value })}
          />
          {emailBad && <p id="email-err" className="fade-in mt-1.5 text-sm text-danger">{t('emailInvalid')}</p>}
        </div>
        <fieldset className="col-span-2">
          <legend className="eyebrow">{t('shuttleTitle')}</legend>
          <p className="mt-1 text-lg text-muted">{t('shuttleQ')}</p>
          <div className="mt-3 flex items-center gap-6">
            <div className="grid w-full max-w-md grid-cols-2 gap-3">
              {(['yes', 'no'] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  aria-pressed={value.shuttle === v}
                  onClick={() => onChange({ ...value, shuttle: v })}
                  className={`flex min-h-16 cursor-pointer items-center justify-center gap-2 rounded-xl border-2 text-lg font-medium transition-all duration-200 active:scale-[0.98] ${
                    value.shuttle === v ? 'border-forest bg-forest text-cream' : 'border-line bg-white text-ink hover:border-forest/50'
                  }`}
                >
                  {value.shuttle === v && <CheckIcon className="h-4 w-4 text-gold-light" />}
                  {t(v)}
                </button>
              ))}
            </div>
            {value.shuttle === 'yes' && <p className="fade-in text-muted">{t('shuttleNote')}</p>}
          </div>
        </fieldset>
        <div className="col-span-2">
          <label
            htmlFor="consent"
            className={`flex min-h-16 cursor-pointer items-center gap-4 rounded-xl border-2 bg-white px-5 py-3.5 transition-colors ${value.consent ? 'border-forest' : 'border-line'}`}
          >
            <input
              id="consent"
              type="checkbox"
              checked={value.consent}
              onChange={(e) => onChange({ ...value, consent: e.target.checked })}
              className="h-8 w-8 shrink-0 cursor-pointer accent-forest"
            />
            <span className="text-lg leading-snug">{t('consent')}</span>
          </label>
          <div className="mt-2 flex min-h-5 items-center justify-between gap-4">
            <p className="text-sm text-muted">{value.consent ? '' : t('consentNeeded')}</p>
            <button type="button" onClick={() => setPrivacy(true)} className="min-h-11 cursor-pointer text-sm font-medium text-forest underline underline-offset-4">
              {t('privacyLink')}
            </button>
          </div>
        </div>
      </div>
      {privacy && <PrivacySheet days={retentionDays} desk={deskMode} onClose={() => setPrivacy(false)} />}
    </Shell>
  )
}

function PrivacySheet({ days, desk, onClose }: { days: number; desk: boolean; onClose: () => void }) {
  const t = useT()
  return createPortal(
    <div className="fade-in fixed inset-0 z-50 flex items-center justify-center bg-ink/55 p-8" role="dialog" aria-modal="true" aria-labelledby="privacy-title" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="pop-in card max-h-full w-full max-w-2xl overflow-y-auto p-8">
        <h2 id="privacy-title" className="text-4xl text-forest">{t('privacyTitle')}</h2>
        {t(desk ? 'privacyBodyDesk' : 'privacyBody', { days })
          .split('\n\n')
          .map((para, i) => (
            <p key={i} className="mt-4 text-lg leading-relaxed text-ink">{para}</p>
          ))}
        <Button className="mt-8 w-full" onClick={onClose}>
          {t('close')}
        </Button>
      </div>
    </div>,
    document.querySelector('.kiosk') ?? document.body,
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

export function SignatureStep({
  onBack,
  onSubmit,
  signerName,
}: {
  onBack: () => void
  onSubmit: (signaturePng: string) => Promise<void>
  signerName: string
}) {
  const t = useT()
  const lang = useLang()
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
      c.width = Math.round(r.width * dpr)
      c.height = Math.round(r.height * dpr)
      const ctx = c.getContext('2d')!
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.lineWidth = 3.2
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.strokeStyle = '#17221D'
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
    if (!signed || busy) return
    setBusy(true)
    setFailed(false)
    try {
      await onSubmit(exportSignature(canvas.current!))
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
        <Button disabled={!signed || busy} onClick={finish}>
          {busy && <Spinner />}
          {busy ? t('sending') : t('finish')}
        </Button>
      }
    >
      <div className="mx-auto flex min-h-0 w-full max-w-4xl flex-1 flex-col">
        <div className="flex items-end justify-between gap-6">
          <div>
            <h2 className="text-5xl text-forest">{t('sigTitle')}</h2>
            <p className="mt-1 text-lg text-muted">{t('sigHint')}</p>
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
          <div aria-hidden="true" className="pointer-events-none absolute inset-x-10 bottom-12 flex items-center gap-3 text-muted">
            <span className="font-serif text-3xl">×</span>
            <span className="h-px flex-1 bg-line" />
            <span className="text-sm">{t('signHere')}</span>
          </div>
          <p aria-hidden="true" className="pointer-events-none absolute inset-x-10 bottom-4 text-sm text-muted">
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

export function Done({
  onFinish,
  shuttle,
  breakfast,
  config,
  room,
  deskCode,
  adults = 1,
}: {
  onFinish: () => void
  shuttle: boolean
  breakfast: boolean
  config: TabletConfig | null
  room: string | null
  /** Set when passports are scanned at reception: the number the guest shows at the desk. */
  deskCode?: string | null
  adults?: number
}) {
  const t = useT()
  const n = useCountdown(20, onFinish)
  const cards: React.ReactNode[] = []
  if (config?.wifi_name)
    cards.push(
      <div key="wifi" className="card p-6">
        <div className="flex items-center gap-3 text-forest">
          <WifiIcon />
          <h3 className="text-3xl">{t('wifiTitle')}</h3>
        </div>
        <dl className="mt-3 space-y-2 text-lg">
          <div className="flex justify-between gap-3"><dt className="text-muted">{t('wifiNetwork')}</dt><dd className="font-medium">{config.wifi_name}</dd></div>
          {config.wifi_password && (
            <div className="flex justify-between gap-3"><dt className="text-muted">{t('wifiPassword')}</dt><dd className="font-medium">{config.wifi_password}</dd></div>
          )}
        </dl>
      </div>,
    )
  if (breakfast && config?.breakfast_hours)
    cards.push(
      <div key="bf" className="card p-6">
        <div className="flex items-center gap-3 text-forest">
          <CupIcon />
          <h3 className="text-3xl">{t('breakfastTitle')}</h3>
        </div>
        <p className="mt-3 text-lg">{t('breakfastInfo', { hours: config.breakfast_hours })}</p>
      </div>,
    )
  if (shuttle)
    cards.push(
      <div key="sh" className="card p-6">
        <div className="flex items-center gap-3 text-forest">
          <CarIcon />
          <h3 className="text-3xl leading-tight">{t('shuttleTitle')}</h3>
        </div>
        <p className="mt-3 text-lg">{t('shuttleBooked')}</p>
        <p className="mt-1 text-sm text-muted">{t('shuttleNote')}</p>
      </div>,
    )

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
            <p className="mt-1 text-2xl font-medium text-ink">{deskCode ? t('deskSub') : t('doneSub')}</p>
            <p className="mt-1 text-lg text-muted">{deskCode ? t('deskKey') : t('doneKey')}</p>
            {deskCode && adults > 1 && <p className="mt-1 text-lg font-medium text-label">{t('deskManyPassports', { n: adults })}</p>}
          </div>
          {deskCode ? (
            <div className="ring-grow ml-auto shrink-0 rounded-3xl bg-forest px-8 py-5 text-center text-cream shadow-[0_20px_50px_-24px_rgb(14_59_46/0.9)]" style={{ animationDelay: '180ms' }}>
              <p className="text-xs font-semibold tracking-[0.18em] text-gold-light">{t('checkinNumber').toUpperCase()}</p>
              <p className="mt-1 font-mono text-6xl font-semibold tracking-[0.12em] text-cream">{deskCode}</p>
              {room && <p className="mt-1 text-sm text-gold-light">{t('roomAssigned', { room })}</p>}
            </div>
          ) : room && (
            <div className="rise ml-auto rounded-2xl bg-forest px-7 py-4 text-center text-cream" style={{ animationDelay: '200ms' }}>
              <p className="text-xs font-semibold tracking-[0.18em] text-gold-light">{t('yourRoom').toUpperCase()}</p>
              <p className="font-serif text-5xl font-semibold">{room}</p>
            </div>
          )}
        </div>
        {cards.length > 0 && (
          <div className={`mt-10 grid gap-5 ${cards.length === 3 ? 'grid-cols-3' : cards.length === 2 ? 'grid-cols-2' : 'grid-cols-1 max-w-md'}`}>
            {cards.map((c, i) => (
              <div key={i} className="rise" style={{ animationDelay: `${260 + i * 90}ms` }}>
                {c}
              </div>
            ))}
          </div>
        )}
      </div>
    </Shell>
  )
}

export { useCountdown }

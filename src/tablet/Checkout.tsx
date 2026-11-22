import { useEffect, useMemo, useState } from 'react'
import { useLang, useT } from '../i18n'
import { tablet } from '../lib/device'
import type { Invoice, PublicReservation } from '../lib/types'
import { fmtDay, LOCALE } from '../translations'
import { AnimatedCheck, Button, CarIcon, CheckIcon, ErrorNote, QrCode, ReceiptIcon, Spinner, StarIcon } from '../ui'
import { Shell } from './Shell'
import { useCountdown } from './Steps'

export function CheckoutFind({ onBack, onFound }: { onBack: () => void; onFound: (r: PublicReservation, shuttle: boolean) => void }) {
  const t = useT()
  const [room, setRoom] = useState('')
  const [surname, setSurname] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<'none' | 'failed' | null>(null)
  const ready = room.trim().length >= 1 && surname.trim().length >= 2

  const submit = async () => {
    if (!ready || busy) return
    setBusy(true)
    setError(null)
    try {
      const res = await tablet.findStay(room.trim(), surname.trim())
      if (res.status === 'found') onFound(res.reservation, !!res.shuttle)
      else setError('none')
    } catch {
      setError('failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Shell
      title={t('coFindTitle')}
      onBack={onBack}
      action={
        <Button disabled={!ready || busy} onClick={submit}>
          {busy && <Spinner />}
          {busy ? t('searching') : t('findStay')}
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
        <h2 className="text-5xl text-forest">{t('coFindTitle')}</h2>
        <p className="mt-2 text-lg text-muted">{t('coFindText')}</p>
        <div className="mt-8 grid grid-cols-[220px_1fr] gap-6">
          <div>
            <label htmlFor="room" className="eyebrow block">{t('roomNumber')}</label>
            <input id="room" inputMode="numeric" autoComplete="off" value={room} onChange={(e) => setRoom(e.target.value)} className="field mt-2 text-center text-2xl tracking-widest" />
          </div>
          <div>
            <label htmlFor="cosn" className="eyebrow block">{t('surname')}</label>
            <input id="cosn" autoComplete="off" autoCapitalize="words" spellCheck={false} value={surname} onChange={(e) => setSurname(e.target.value)} className="field mt-2" />
          </div>
        </div>
        <button type="submit" hidden />
        <div className="mt-6 min-h-[64px]">
          {error === 'none' && <ErrorNote>{t('coNotFound')}</ErrorNote>}
          {error === 'failed' && (
            <ErrorNote>
              <strong className="font-semibold">{t('errorTitle')}.</strong> {t('errorText')}
            </ErrorNote>
          )}
        </div>
      </form>
    </Shell>
  )
}

/* ------------------------------ The bill ------------------------------- */

/** A balance the guest still has to settle at the desk. */
export type Due = { amount: number; currency: string }

type BillState = { status: 'loading' | 'ready' | 'none'; invoice: Invoice | null; updating: boolean }

/**
 * Loads the guest's bill. Asks the front desk app for an up-to-date one, shows any bill already on
 * file straight away, and waits up to about 20 seconds for the fresh one.
 */
function useInvoice(reservationId: string): BillState {
  const [state, setState] = useState<BillState>({ status: 'loading', invoice: null, updating: true })
  useEffect(() => {
    let alive = true
    let timer: number | undefined
    const started = Date.now()
    const tick = async (first: boolean) => {
      try {
        const r = await tablet.invoice(reservationId, first)
        if (!alive) return
        const fresh = !!r.invoice && !!r.received_at && (!r.requested_at || r.received_at >= r.requested_at)
        const waiting = r.can_request && !fresh && Date.now() - started < 20_000
        setState({ status: r.invoice ? 'ready' : waiting ? 'loading' : 'none', invoice: r.invoice, updating: waiting })
        if (waiting) timer = window.setTimeout(() => tick(false), 2000)
      } catch {
        if (!alive) return
        if (Date.now() - started < 20_000) timer = window.setTimeout(() => tick(false), 3000)
        else setState((s) => ({ ...s, status: s.invoice ? 'ready' : 'none', updating: false }))
      }
    }
    tick(true)
    return () => {
      alive = false
      window.clearTimeout(timer)
    }
  }, [reservationId])
  return state
}

function useMoney(currency: string) {
  const lang = useLang()
  return useMemo(() => {
    // Browsers rarely ship Tajik number formats; Russian formatting is what Tajik guests are used to.
    for (const loc of [lang === 'tg' ? 'ru-RU' : LOCALE[lang], 'en-GB']) {
      try {
        const f = new Intl.NumberFormat(loc, { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2 })
        return (n: number) => f.format(n)
      } catch {
        /* unknown currency or locale: try the next one */
      }
    }
    return (n: number) => `${n.toFixed(2)} ${currency}`
  }, [lang, currency])
}

function Bill({ invoice: inv, updating }: { invoice: Invoice; updating: boolean }) {
  const t = useT()
  const lang = useLang()
  const fmt = useMoney(inv.currency)
  const due = inv.balance > 0.004
  const refund = inv.balance < -0.004
  return (
    <div className="fade-in flex min-h-0 flex-1 flex-col">
      <div className="flex items-baseline justify-between gap-4 px-7 pt-5">
        <h3 className="flex items-center gap-2 text-3xl text-forest">
          <ReceiptIcon className="h-6 w-6 self-center" />
          {t('invoiceTitle')}
        </h3>
        <span className="flex items-center gap-2 text-sm text-muted">
          {updating && <Spinner className="h-4 w-4 text-gold" />}
          {inv.invoice_number ? t('invoiceNumber', { n: inv.invoice_number }) : null}
        </span>
      </div>
      <ul className="mt-2 min-h-[72px] flex-1 divide-y divide-line overflow-y-auto overscroll-contain px-7" aria-label={t('invoiceTitle')}>
        {inv.lines.map((l, i) => (
          <li key={i} className="flex items-start justify-between gap-4 py-2.5">
            <div className="min-w-0">
              <p className="font-medium leading-snug">{l.description}</p>
              <p className="text-sm text-muted">
                {[l.date ? fmtDay(l.date, lang) : null, l.quantity && l.quantity !== 1 && l.unit_price !== null ? `${l.quantity} × ${fmt(l.unit_price)}` : null]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            </div>
            <span className="shrink-0 font-medium tabular-nums">{fmt(l.amount)}</span>
          </li>
        ))}
      </ul>
      <dl className="mt-1 space-y-1 border-t border-line px-7 py-3 text-[15px]">
        {(inv.taxes.length > 0 || inv.subtotal !== inv.total) && (
          <div className="flex justify-between gap-4 text-muted">
            <dt>{t('subtotal')}</dt>
            <dd className="tabular-nums">{fmt(inv.subtotal)}</dd>
          </div>
        )}
        {inv.taxes.map((x, i) => (
          <div key={i} className="flex justify-between gap-4 text-muted">
            <dt>{x.name}</dt>
            <dd className="tabular-nums">{fmt(x.amount)}</dd>
          </div>
        ))}
        {inv.prices_include_tax && inv.taxes.length > 0 && <p className="text-xs text-muted">{t('taxIncluded')}</p>}
        <div className="flex justify-between gap-4 pt-1 text-xl font-semibold text-ink">
          <dt>{t('total')}</dt>
          <dd className="tabular-nums">{fmt(inv.total)}</dd>
        </div>
        {inv.payments.map((p, i) => (
          <div key={i} className="flex justify-between gap-4 text-muted">
            <dt className="min-w-0 truncate">
              {p.method}
              {p.date ? ` · ${fmtDay(p.date, lang)}` : ''}
            </dt>
            <dd className="shrink-0 tabular-nums">−{fmt(p.amount)}</dd>
          </div>
        ))}
      </dl>
      <div
        className={`flex items-center justify-between gap-4 px-7 py-4 ${due ? 'bg-gold-light/40' : 'bg-forest/[0.06]'}`}
        role="status"
      >
        <div className="min-w-0">
          <p className={`flex items-center gap-2 text-lg font-semibold ${due ? 'text-label' : 'text-forest'}`}>
            {!due && !refund && <CheckIcon className="h-5 w-5" />}
            {due ? t('balanceDue') : refund ? t('refundDue') : t('paidInFull')}
          </p>
          {due && <p className="text-sm text-ink">{t('settleAtDesk')}</p>}
          {inv.note && <p className="text-sm text-muted">{inv.note}</p>}
        </div>
        {(due || refund) && <p className="shrink-0 text-3xl font-semibold tabular-nums tracking-tight text-ink">{fmt(Math.abs(inv.balance))}</p>}
      </div>
    </div>
  )
}

function BillLoading() {
  const t = useT()
  return (
    <div className="flex flex-1 flex-col px-7 py-5" role="status">
      <p className="flex items-center gap-3 text-lg text-muted">
        <Spinner className="h-5 w-5 text-gold" />
        {t('invoiceLoading')}
      </p>
      <div className="mt-5 space-y-4" aria-hidden="true">
        {[72, 56, 64, 40].map((w, i) => (
          <div key={i} className="flex items-center justify-between gap-6">
            <span className="shimmer h-4 rounded-full" style={{ width: `${w}%` }} />
            <span className="shimmer h-4 w-20 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  )
}

export function Checkout({
  stay: r,
  reviewUrl,
  shuttle = false,
  onBack,
  onComplete,
}: {
  stay: PublicReservation
  reviewUrl: string
  /** The guest asked for the free airport shuttle at check-in. */
  shuttle?: boolean
  onBack: () => void
  /** rating is null when the guest skipped it (rating is optional). */
  onComplete: (rating: number | null, feedback: string, due: Due | null) => Promise<void>
}) {
  const t = useT()
  const lang = useLang()
  const [rating, setRating] = useState(0)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const bill = useInvoice(r.id)
  // Leaving before the booked departure date usually changes the bill; say so up front.
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Dushanbe' })
  const earlyDays = Math.round((Date.parse(r.departure_date) - Date.parse(today)) / 86_400_000)

  const complete = async () => {
    setBusy(true)
    setFailed(false)
    try {
      const inv = bill.invoice
      await onComplete(rating || null, rating > 0 && rating <= 3 ? text.trim() : '', inv && inv.balance > 0.004 ? { amount: inv.balance, currency: inv.currency } : null)
    } catch {
      setFailed(true)
      setBusy(false)
    }
  }

  return (
    <Shell
      title={t('coTitle')}
      onBack={busy ? undefined : onBack}
      action={
        <Button disabled={busy} onClick={complete}>
          {busy && <Spinner />}
          {busy ? t('sending') : t('confirmCheckout')}
        </Button>
      }
    >
      <div className="mx-auto grid min-h-0 w-full max-w-5xl flex-1 grid-cols-[1.2fr_1fr] grid-rows-[minmax(0,1fr)] gap-8">
        <section className="card flex min-h-0 flex-col overflow-hidden">
          <div className="bg-forest px-7 py-5 text-cream">
            <p className="text-xs font-semibold tracking-[0.18em] text-gold-light">
              {t('coStay').toUpperCase()} · {t('roomAssigned', { room: r.room_number ?? '' }).toUpperCase()}
            </p>
            <p className="mt-1 font-serif text-3xl font-semibold leading-tight">{r.guest_name}</p>
            <p className="mt-0.5 text-gold-light">
              {fmtDay(r.arrival_date, lang)} – {fmtDay(r.departure_date, lang)}
              {r.room_type ? ` · ${r.room_type}` : ''}
            </p>
          </div>
          {bill.status === 'loading' && <BillLoading />}
          {bill.status === 'ready' && bill.invoice && <Bill invoice={bill.invoice} updating={bill.updating} />}
          {bill.status === 'none' && (
            <div className="fade-in flex flex-1 flex-col justify-center gap-3 px-7 py-6 text-lg text-muted">
              <ReceiptIcon className="h-8 w-8 text-gold" />
              <p>{t('coBillNote')}</p>
            </div>
          )}
        </section>

        <section className="card self-start p-7">
          <h3 className="text-3xl text-forest">
            {t('rateTitle')} <span className="font-sans text-base font-normal text-muted">({t('optional')})</span>
          </h3>
          <div className="mt-3 flex gap-1" role="group" aria-label={t('rateTitle')}>
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                aria-label={t('rateLabel', { n })}
                aria-pressed={rating === n}
                onClick={() => setRating(n)}
                className="flex h-16 w-16 cursor-pointer items-center justify-center rounded-xl transition-transform duration-200 hover:bg-cream active:scale-90"
              >
                <StarIcon filled={n <= rating} className={`h-11 w-11 transition-transform duration-300 ${n <= rating ? 'scale-105' : ''}`} />
              </button>
            ))}
          </div>
          {rating >= 4 && (
            <div key="hi" className="fade-in mt-5 flex items-center gap-5">
              {reviewUrl && <QrCode text={reviewUrl} label={t('reviewHint')} />}
              <div>
                <p className="text-xl font-medium text-forest">{t('reviewTitle')}</p>
                {reviewUrl && <p className="mt-1 text-muted">{t('reviewHint')}</p>}
              </div>
            </div>
          )}
          {rating > 0 && rating <= 3 && (
            <div key="lo" className="fade-in mt-5">
              <label htmlFor="fb" className="block text-xl font-medium text-forest">{t('feedbackTitle')}</label>
              <p className="mt-1 text-muted">{t('feedbackHint')}</p>
              <textarea
                id="fb"
                rows={3}
                maxLength={2000}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={t('feedbackPlaceholder')}
                className="field mt-3 min-h-28 py-3 text-lg"
              />
            </div>
          )}
          {failed && (
            <div className="mt-4">
              <ErrorNote>
                <strong className="font-semibold">{t('errorTitle')}.</strong> {t('errorText')}
              </ErrorNote>
            </div>
          )}
          {(earlyDays > 0 || shuttle) && (
            <div className="mt-6 space-y-3 border-t border-line pt-5">
              {earlyDays > 0 && (
                <p className="flex gap-3 text-[15px] text-ink">
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-gold" aria-hidden="true" />
                  {t('earlyDeparture', { n: earlyDays, date: fmtDay(r.departure_date, lang) })}
                </p>
              )}
              {shuttle && (
                <p className="flex gap-3 text-[15px] text-ink">
                  <CarIcon className="h-5 w-5 shrink-0 text-forest" />
                  {t('shuttleReminder')}
                </p>
              )}
            </div>
          )}
        </section>
      </div>
    </Shell>
  )
}

export function CheckoutDone({ onFinish, due = null }: { onFinish: () => void; due?: Due | null }) {
  const t = useT()
  const n = useCountdown(due ? 20 : 12, onFinish)
  const fmt = useMoney(due?.currency ?? 'TJS')
  return (
    <Shell
      title={t('coTitle')}
      hideBack
      action={
        <div className="flex items-center gap-6">
          <p className="tabular-nums text-muted">{t('returning', { n })}</p>
          <Button onClick={onFinish}>{t('startNew')}</Button>
        </div>
      }
    >
      <div className="flex flex-1 flex-col items-center justify-center text-center" role="status">
        <AnimatedCheck size="h-24 w-24" />
        <h2 className="rise mt-6 text-6xl text-forest" style={{ animationDelay: '120ms' }}>{t('thanksTitle')}</h2>
        <p className="rise mt-3 max-w-xl text-xl text-muted" style={{ animationDelay: '200ms' }}>{t('thanksSub')}</p>
        {due && (
          <div className="rise mt-8 rounded-2xl bg-gold-light/40 px-8 py-5" style={{ animationDelay: '300ms' }}>
            <p className="eyebrow">{t('dueAtDesk')}</p>
            <p className="mt-1 text-4xl font-semibold tabular-nums text-ink">{fmt(due.amount)}</p>
          </div>
        )}
      </div>
    </Shell>
  )
}

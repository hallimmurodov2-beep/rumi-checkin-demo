import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { useLang, useT } from '../i18n'
import { tablet } from '../lib/device'
import type { PublicReservation } from '../lib/types'
import { fmtDay } from '../translations'
import { AnimatedCheck, Button, ErrorNote, Spinner, StarIcon } from '../ui'
import { Shell } from './Shell'
import { useCountdown } from './Steps'

export function CheckoutFind({ onBack, onFound }: { onBack: () => void; onFound: (r: PublicReservation) => void }) {
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
      if (res.status === 'found') onFound(res.reservation)
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

function ReviewQr({ url }: { url: string }) {
  const [svg, setSvg] = useState('')
  useEffect(() => {
    QRCode.toString(url, { type: 'svg', margin: 0, errorCorrectionLevel: 'M', color: { dark: '#17221D', light: '#00000000' } })
      .then(setSvg)
      .catch(() => setSvg(''))
  }, [url])
  return (
    <div
      className="h-40 w-40 shrink-0 rounded-xl border border-line bg-white p-3 [&>svg]:h-full [&>svg]:w-full"
      role="img"
      aria-label="QR code"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}

export function Checkout({
  stay: r,
  reviewUrl,
  onBack,
  onComplete,
}: {
  stay: PublicReservation
  reviewUrl: string
  onBack: () => void
  onComplete: (rating: number, feedback: string) => Promise<void>
}) {
  const t = useT()
  const lang = useLang()
  const [rating, setRating] = useState(0)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)

  const complete = async () => {
    setBusy(true)
    setFailed(false)
    try {
      await onComplete(rating, rating <= 3 ? text.trim() : '')
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
        <Button disabled={!rating || busy} onClick={complete}>
          {busy && <Spinner />}
          {busy ? t('sending') : t('confirmCheckout')}
        </Button>
      }
    >
      <div className="mx-auto grid w-full max-w-5xl flex-1 grid-cols-[1fr_1.15fr] content-center gap-8">
        <section className="card overflow-hidden">
          <div className="bg-forest px-7 py-5 text-cream">
            <p className="text-xs font-semibold tracking-[0.18em] text-gold-light">{t('coStay').toUpperCase()}</p>
            <p className="mt-1 font-serif text-3xl font-semibold">{r.guest_name}</p>
          </div>
          <dl className="divide-y divide-line px-7 text-lg">
            <div className="flex justify-between gap-4 py-3.5">
              <dt className="text-muted">{t('roomNumber')}</dt>
              <dd className="font-medium">{r.room_number}</dd>
            </div>
            <div className="flex justify-between gap-4 py-3.5">
              <dt className="text-muted">{t('room')}</dt>
              <dd className="text-right font-medium">{r.room_type || '—'}</dd>
            </div>
            <div className="flex justify-between gap-4 py-3.5">
              <dt className="text-muted">{t('dates')}</dt>
              <dd className="text-right font-medium">
                {fmtDay(r.arrival_date, lang)} – {fmtDay(r.departure_date, lang)}
              </dd>
            </div>
          </dl>
          <p className="border-t border-line bg-cream/60 px-7 py-4 text-muted">{t('coBillNote')}</p>
        </section>

        <section className="card p-7">
          <h3 className="text-3xl text-forest">{t('rateTitle')}</h3>
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
              {reviewUrl && <ReviewQr url={reviewUrl} />}
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
        </section>
      </div>
    </Shell>
  )
}

export function CheckoutDone({ onFinish }: { onFinish: () => void }) {
  const t = useT()
  const n = useCountdown(12, onFinish)
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
      </div>
    </Shell>
  )
}

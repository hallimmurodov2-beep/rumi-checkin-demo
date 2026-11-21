import { useEffect, useRef, useState } from 'react'
import { useT } from '../i18n'
import { Button, CheckIcon, StarIcon } from '../ui'
import { Shell } from './Shell'

function QrPlaceholder() {
  // Deterministic decorative pattern; not a real QR code.
  const cells = Array.from({ length: 21 * 21 }, (_, i) => {
    const x = i % 21, y = Math.floor(i / 21)
    const finder = (x < 7 && y < 7) || (x > 13 && y < 7) || (x < 7 && y > 13)
    if (finder) {
      const fx = x % 14 % 7, fy = y % 14 % 7
      return fx === 0 || fx === 6 || fy === 0 || fy === 6 || (fx > 1 && fx < 5 && fy > 1 && fy < 5)
    }
    return ((x * 7 + y * 13 + x * y) % 5) < 2
  })
  return (
    <svg viewBox="0 0 21 21" className="h-40 w-40 rounded-lg border border-line bg-white p-2" role="img" aria-label="QR placeholder">
      {cells.map((on, i) => on && <rect key={i} x={i % 21} y={Math.floor(i / 21)} width="1" height="1" fill="#17221D" />)}
    </svg>
  )
}

export function Checkout({
  onBack,
  onComplete,
}: {
  onBack: () => void
  onComplete: (rating: number, feedback: string | null) => void
}) {
  const t = useT()
  const [rating, setRating] = useState(0)
  const [text, setText] = useState('')
  const lines: [string, string][] = [
    [t('coNights'), '2,850 TJS'],
    [t('coBreakfast'), t('coBreakfastVal')],
    [t('coMinibar'), '60 TJS'],
    [t('coTax'), '45 TJS'],
  ]
  return (
    <Shell
      title={t('coTitle')}
      onBack={onBack}
      action={
        <Button disabled={!rating} onClick={() => onComplete(rating, rating <= 3 ? text.trim() : null)}>
          {t('confirmCheckout')}
        </Button>
      }
    >
      <div className="mx-auto grid w-full max-w-5xl flex-1 grid-cols-2 content-center gap-8">
        <section className="rounded-2xl border border-line bg-white p-6">
          <h3 className="text-3xl text-forest">{t('coBill')}</h3>
          <dl className="mt-4 divide-y divide-line text-lg">
            {lines.map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4 py-3">
                <dt>{k}</dt>
                <dd className="font-medium">{v}</dd>
              </div>
            ))}
            <div className="flex justify-between gap-4 pt-4 text-2xl">
              <dt className="font-serif font-semibold text-forest">{t('coTotal')}</dt>
              <dd className="font-semibold">2,955 TJS</dd>
            </div>
          </dl>
          <p className="mt-4 text-sm text-muted">{t('coSample')}</p>
        </section>

        <section className="rounded-2xl border border-line bg-white p-6">
          <h3 className="text-3xl text-forest">{t('rateTitle')}</h3>
          <div className="mt-3 flex gap-1" role="group" aria-label={t('rateTitle')}>
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                aria-label={t('rateLabel', { n })}
                aria-pressed={rating === n}
                onClick={() => setRating(n)}
                className="flex h-16 w-16 cursor-pointer items-center justify-center rounded-xl hover:bg-cream"
              >
                <StarIcon filled={n <= rating} />
              </button>
            ))}
          </div>
          {rating >= 4 && (
            <div className="fade-in mt-4 flex items-center gap-5">
              <QrPlaceholder />
              <div>
                <p className="text-xl font-medium text-forest">{t('reviewTitle')}</p>
                <p className="mt-1 text-muted">{t('reviewHint')}</p>
                <p className="mt-2 text-xs font-semibold tracking-wider text-label">{t('qrPlaceholder').toUpperCase()}</p>
              </div>
            </div>
          )}
          {rating > 0 && rating <= 3 && (
            <div className="fade-in mt-4">
              <label htmlFor="fb" className="block text-xl font-medium text-forest">{t('feedbackTitle')}</label>
              <p className="mt-1 text-muted">{t('feedbackHint')}</p>
              <textarea
                id="fb"
                rows={3}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={t('feedbackPlaceholder')}
                className="mt-2 w-full rounded-xl border-2 border-line bg-white p-4 text-lg"
              />
            </div>
          )}
        </section>
      </div>
    </Shell>
  )
}

export function CheckoutDone({ onFinish }: { onFinish: () => void }) {
  const t = useT()
  const [n, setN] = useState(12)
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
      title={t('coTitle')}
      hideBack
      action={
        <div className="flex items-center gap-6">
          <p className="text-muted" role="status">{t('returning', { n: Math.max(n, 0) })}</p>
          <Button onClick={onFinish}>{t('startNew')}</Button>
        </div>
      }
    >
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <span className="flex h-24 w-24 items-center justify-center rounded-full bg-forest text-gold-light">
          <CheckIcon className="h-12 w-12" />
        </span>
        <h2 className="mt-6 text-6xl text-forest">{t('thanksTitle')}</h2>
        <p className="mt-3 max-w-xl text-xl text-muted">{t('thanksSub')}</p>
      </div>
    </Shell>
  )
}

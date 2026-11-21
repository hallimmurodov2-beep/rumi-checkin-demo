import { useEffect, useState, type ReactNode } from 'react'
import { useT } from '../i18n'
import type { Key } from '../translations'
import { ArrowLeft, Brand, Button, CheckIcon } from '../ui'

const STEPS: Key[] = ['stepPassport', 'stepBooking', 'stepDetails', 'stepSignature', 'stepDone']

function Stepper({ current }: { current: number }) {
  const t = useT()
  return (
    <ol className="flex min-w-0 items-center" aria-label={`${current + 1} / ${STEPS.length}`}>
      {STEPS.map((k, i) => {
        const done = i < current
        const active = i === current
        return (
          <li key={k} className="flex items-center" aria-current={active ? 'step' : undefined}>
            <span className="flex items-center gap-2">
              <span
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold transition-all duration-300 ${
                  done
                    ? 'bg-forest text-gold-light'
                    : active
                      ? 'bg-forest text-gold-light ring-4 ring-gold/25'
                      : 'border-2 border-line bg-white text-muted'
                }`}
              >
                {done ? <CheckIcon className="h-4 w-4" /> : i + 1}
              </span>
              <span className={`whitespace-nowrap text-sm ${active ? 'font-semibold text-forest' : 'text-muted max-[1180px]:sr-only'}`}>
                {t(k)}
              </span>
            </span>
            {i < STEPS.length - 1 && (
              <span className={`mx-2.5 h-0.5 w-6 rounded-full ${i < current ? 'bg-forest' : 'bg-line'}`} aria-hidden="true" />
            )}
          </li>
        )
      })}
    </ol>
  )
}

function Clock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 15_000)
    return () => window.clearInterval(id)
  }, [])
  return (
    <span className="w-[120px] text-right font-serif text-2xl font-semibold tabular-nums text-forest" aria-hidden="true">
      {now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
    </span>
  )
}

/** Common frame: header, optional stepper, content, footer with Back + primary action. */
export function Shell({
  step,
  title,
  onBack,
  action,
  hideBack,
  children,
}: {
  step?: number
  title?: string
  onBack?: () => void
  action?: ReactNode
  hideBack?: boolean
  children: ReactNode
}) {
  const t = useT()
  return (
    <div className="flex h-full flex-col">
      <header className="vt-header flex items-center justify-between gap-6 border-b border-line bg-paper px-8 py-3.5 xl:px-10">
        <Brand />
        {step !== undefined ? <Stepper current={step} /> : title && <h2 className="text-3xl text-forest">{title}</h2>}
        <Clock />
      </header>
      <main className="vt-main screen-in flex min-h-0 flex-1 flex-col overflow-y-auto px-8 py-6 xl:px-10">{children}</main>
      <footer className="vt-footer flex min-h-[96px] items-center justify-between gap-4 border-t border-line bg-paper px-8 py-3.5 xl:px-10">
        {hideBack || !onBack ? (
          <span />
        ) : (
          <Button variant="secondary" onClick={onBack}>
            <ArrowLeft /> {t('back')}
          </Button>
        )}
        {action}
      </footer>
    </div>
  )
}

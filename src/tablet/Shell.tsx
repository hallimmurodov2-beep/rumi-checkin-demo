import type { ReactNode } from 'react'
import { useT } from '../i18n'
import type { Key } from '../translations'
import { ArrowLeft, Brand, Button, CheckIcon, DemoBadge } from '../ui'

const STEPS: Key[] = ['stepPassport', 'stepBooking', 'stepDetails', 'stepSignature', 'stepDone']

function Stepper({ current }: { current: number }) {
  const t = useT()
  return (
    <ol className="flex items-center gap-2" aria-label="Progress">
      {STEPS.map((k, i) => {
        const done = i < current
        const active = i === current
        return (
          <li key={k} className="flex items-center gap-2" aria-current={active ? 'step' : undefined}>
            <span
              className={`flex h-9 w-9 items-center justify-center rounded-full border-2 text-sm font-semibold ${
                done
                  ? 'border-forest bg-forest text-cream'
                  : active
                    ? 'border-gold bg-forest text-gold-light'
                    : 'border-line bg-white text-muted'
              }`}
            >
              {done ? <CheckIcon className="h-4 w-4" /> : i + 1}
            </span>
            <span className={`text-sm ${active ? 'font-semibold text-forest' : 'text-muted'}`}>{t(k)}</span>
            {i < STEPS.length - 1 && <span className="mx-1 h-px w-6 bg-line" aria-hidden="true" />}
          </li>
        )
      })}
    </ol>
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
      <header className="flex items-center justify-between gap-6 border-b border-line bg-white px-10 py-4">
        <Brand />
        {step !== undefined ? (
          <Stepper current={step} />
        ) : (
          title && <h2 className="text-3xl text-forest">{title}</h2>
        )}
        <DemoBadge />
      </header>
      <main className="fade-in flex min-h-0 flex-1 flex-col px-10 py-6">{children}</main>
      <footer className="flex items-center justify-between gap-4 border-t border-line bg-white px-10 py-4">
        {hideBack || !onBack ? (
          <span />
        ) : (
          <Button variant="secondary" onClick={onBack} aria-label={t('back')}>
            <ArrowLeft /> {t('back')}
          </Button>
        )}
        {action}
      </footer>
    </div>
  )
}

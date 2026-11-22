import { createContext, useContext, useEffect, useState, type FocusEvent, type ReactNode } from 'react'
import { SetLangContext, useLang, useT } from '../i18n'
import { LANGS, type Key } from '../translations'
import { ArrowLeft, Brand, Button, CheckIcon } from '../ui'

const STEPS: Key[] = ['stepPassport', 'stepBooking', 'stepDetails', 'stepSignature', 'stepDone']

/** True when passports are scanned at reception: the tablet flow has no passport step. */
export const DeskModeContext = createContext(false)

function Stepper({ step }: { step: number }) {
  const t = useT()
  const desk = useContext(DeskModeContext)
  // Check-in starts at reception, so the tablet shows Details, Signature and Done.
  const steps = desk ? STEPS.slice(2) : STEPS
  const current = desk ? Math.max(0, step - 2) : step
  return (
    <ol className="flex min-w-0 items-center" aria-label={`${current + 1} / ${steps.length}`}>
      {steps.map((k, i) => {
        // The last step is complete as soon as it is shown.
        const done = i < current || (i === steps.length - 1 && current === i)
        const active = i === current
        return (
          <li key={k} className="flex items-center" aria-current={active ? 'step' : undefined}>
            <span className="flex items-center gap-2">
              <span
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold transition-all duration-300 ${
                  done && active
                    ? 'bg-forest text-gold-light ring-4 ring-gold/25'
                    : done
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
            {i < steps.length - 1 && (
              <span className={`mx-2.5 h-0.5 w-6 rounded-full ${i < current ? 'bg-forest' : 'bg-line'}`} aria-hidden="true" />
            )}
          </li>
        )
      })}
    </ol>
  )
}

const SHORT: Record<string, string> = { en: 'EN', ru: 'РУ', tg: 'ТҶ' }

/** Small language switch in the header, so guests can change language on any screen. */
export function LangSwitch({ tone = 'light' }: { tone?: 'light' | 'dark' }) {
  const dark = tone === 'dark'
  const lang = useLang()
  const setLang = useContext(SetLangContext)
  const t = useT()
  if (!setLang) return null
  return (
    <div className={`flex gap-0.5 rounded-xl border p-0.5 ${dark ? 'border-cream/25 bg-forest-deep/55 backdrop-blur-md' : 'border-line bg-white'}`} role="group" aria-label={t('chooseLanguage')}>
      {LANGS.map((l) => (
        <button
          key={l.code}
          type="button"
          lang={l.code}
          title={l.label}
          aria-label={l.label}
          aria-pressed={lang === l.code}
          onClick={() => setLang(l.code)}
          className={`min-h-11 min-w-11 cursor-pointer rounded-lg px-2 text-sm font-semibold transition ${
            lang === l.code ? (dark ? 'bg-cream text-forest' : 'bg-forest text-cream') : dark ? 'text-cream/80 hover:text-cream' : 'text-muted hover:text-forest'
          }`}
        >
          {SHORT[l.code]}
        </button>
      ))}
    </div>
  )
}

function Clock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 15_000)
    return () => window.clearInterval(id)
  }, [])
  return (
    <span className="w-[76px] text-right font-serif text-2xl font-semibold tabular-nums text-forest" aria-hidden="true">
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
  noLang,
  children,
}: {
  step?: number
  title?: string
  onBack?: () => void
  action?: ReactNode
  hideBack?: boolean
  /** Hide the header language switch (a screen with its own, larger one). */
  noLang?: boolean
  children: ReactNode
}) {
  const t = useT()
  // When the keyboard opens the screen shrinks: bring the field being typed in back into view.
  const keepFieldVisible = (e: FocusEvent<HTMLElement>) => {
    const el = e.target
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) window.setTimeout(() => el.scrollIntoView({ block: 'center', behavior: 'smooth' }), 300)
  }
  return (
    <div className="flex h-full flex-col">
      <header className="vt-header flex items-center justify-between gap-6 border-b border-line bg-paper px-8 py-3.5 xl:px-10">
        <Brand />
        {step !== undefined ? <Stepper step={step} /> : title && <h2 className="text-3xl text-forest">{title}</h2>}
        <div className="flex items-center gap-4">
          {!noLang && <LangSwitch />}
          <Clock />
        </div>
      </header>
      <main onFocus={keepFieldVisible} className="vt-main screen-in flex min-h-0 flex-1 flex-col overflow-y-auto px-8 py-6 xl:px-10">{children}</main>
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

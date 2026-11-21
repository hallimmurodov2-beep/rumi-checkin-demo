import { createContext, useCallback, useContext, useEffect, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import type { StayStatus } from '../lib/types'
import { StarIcon } from '../ui'

/* Buttons ------------------------------------------------------------------ */

type Tone = 'primary' | 'secondary' | 'ghost' | 'danger' | 'gold'
const tones: Record<Tone, string> = {
  primary: 'bg-forest text-cream hover:bg-forest-deep shadow-[0_6px_16px_-10px_rgb(14_59_46/0.8)]',
  secondary: 'border border-line bg-white text-forest hover:border-forest/40 hover:bg-cream/60',
  ghost: 'text-forest hover:bg-forest/5',
  danger: 'border border-danger/30 bg-white text-danger hover:bg-[#FDF1EC]',
  gold: 'bg-gold-light text-ink hover:bg-[#e6c25f]',
}

export function Btn({ tone = 'secondary', className = '', ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { tone?: Tone }) {
  return (
    <button
      type="button"
      {...p}
      className={`inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-lg px-4 text-sm font-medium transition-all duration-150 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 ${tones[tone]} ${className}`}
    />
  )
}

/* Surfaces ----------------------------------------------------------------- */

export function Panel({ title, action, children, className = '' }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`card overflow-hidden !rounded-2xl ${className}`}>
      {(title || action) && (
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3.5">
          <h2 className="font-sans text-base font-semibold text-ink">{title}</h2>
          {action}
        </header>
      )}
      {children}
    </section>
  )
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="px-5 py-8 text-center text-muted">{children}</p>
}

export function PageHead({ title, sub, action }: { title: string; sub?: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-4xl text-forest">{title}</h1>
        {sub && <p className="mt-1 text-muted">{sub}</p>}
      </div>
      {action && <div className="flex flex-wrap gap-2">{action}</div>}
    </div>
  )
}

export function Kpi({ label, value, sub, onClick }: { label: string; value: ReactNode; sub?: string; onClick?: () => void }) {
  const Comp = onClick ? 'button' : 'div'
  return (
    <Comp
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={`card !rounded-2xl px-5 py-4 text-left ${onClick ? 'cursor-pointer transition hover:-translate-y-0.5 hover:shadow-lg' : ''}`}
    >
      <div className="eyebrow">{label}</div>
      <div className="mt-1 font-serif text-4xl font-semibold tabular-nums text-forest">{value}</div>
      {sub && <div className="text-sm text-muted">{sub}</div>}
    </Comp>
  )
}

/* Status ------------------------------------------------------------------- */

const STATUS: Record<StayStatus, { label: string; cls: string }> = {
  expected: { label: 'Expected', cls: 'border-line bg-white text-muted' },
  pending_desk: { label: 'At the desk', cls: 'border-label/40 bg-gold-light/70 text-ink' },
  in_house: { label: 'In house', cls: 'border-forest/30 bg-forest/10 text-forest' },
  checked_out: { label: 'Checked out', cls: 'border-line bg-cream text-muted' },
  cancelled: { label: 'Cancelled', cls: 'border-danger/30 bg-[#FDF1EC] text-danger' },
  no_show: { label: 'No-show', cls: 'border-danger/30 bg-[#FDF1EC] text-danger' },
}

export function StatusChip({ status }: { status: StayStatus }) {
  const s = STATUS[status]
  return <Chip className={s.cls}>{s.label}</Chip>
}

export function Chip({ children, className = 'border-line bg-white text-muted' }: { children: ReactNode; className?: string }) {
  return <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-semibold ${className}`}>{children}</span>
}

export function Stars({ n }: { n: number | null }) {
  if (!n) return <span className="text-sm text-muted">No rating</span>
  return (
    <span className="inline-flex items-center" role="img" aria-label={`${n} out of 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <StarIcon key={i} filled={i <= n} className="h-4.5 w-4.5" />
      ))}
    </span>
  )
}

/* Forms -------------------------------------------------------------------- */

export function Field({ label, hint, className = '', ...p }: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
  const id = p.id ?? `f-${label.replace(/\W+/g, '-').toLowerCase()}`
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-ink">
        {label}
      </label>
      <input
        id={id}
        {...p}
        className="min-h-11 w-full rounded-lg border border-line bg-white px-3 text-[15px] transition focus:border-forest focus:shadow-[0_0_0_3px_rgb(201_154_26/0.22)] focus:outline-none"
      />
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  )
}

/* Overlays ----------------------------------------------------------------- */

export function Modal({ title, onClose, children, footer, wide }: { title: string; onClose: () => void; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [onClose])
  return createPortal(
    <div className="fade-in fixed inset-0 z-50 flex items-end justify-center bg-ink/50 p-0 sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label={title} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`pop-in flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-2xl bg-paper shadow-2xl sm:rounded-2xl ${wide ? 'sm:max-w-3xl' : 'sm:max-w-lg'}`}>
        <header className="flex items-center justify-between gap-4 border-b border-line px-6 py-4">
          <h2 className="text-2xl text-forest">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg text-muted hover:bg-cream">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </header>
        <div className="overflow-y-auto px-6 py-5">{children}</div>
        {footer && <footer className="flex flex-wrap justify-end gap-2 border-t border-line bg-cream/40 px-6 py-4">{footer}</footer>}
      </div>
    </div>,
    document.body,
  )
}

export function Drawer({ title, onClose, children, footer }: { title: ReactNode; onClose: () => void; children: ReactNode; footer?: ReactNode }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [onClose])
  return createPortal(
    <div className="fade-in fixed inset-0 z-50 flex justify-end bg-ink/40" role="dialog" aria-modal="true" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="drawer-in flex h-full w-full max-w-xl flex-col bg-paper shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-line px-6 py-4">
          <div className="min-w-0">{title}</div>
          <button type="button" onClick={onClose} aria-label="Close" className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-lg text-muted hover:bg-cream">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">{children}</div>
        {footer && <footer className="border-t border-line bg-cream/40 px-6 py-4">{footer}</footer>}
      </div>
    </div>,
    document.body,
  )
}

/* Toasts ------------------------------------------------------------------- */

type ToastItem = { id: number; text: string; tone: 'ok' | 'error' }
const ToastCtx = createContext<(text: string, tone?: 'ok' | 'error') => void>(() => {})
export const useToast = () => useContext(ToastCtx)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const push = useCallback((text: string, tone: 'ok' | 'error' = 'ok') => {
    const id = Date.now() + Math.random()
    setItems((x) => [...x.slice(-2), { id, text, tone }])
    window.setTimeout(() => setItems((x) => x.filter((i) => i.id !== id)), tone === 'error' ? 7000 : 4500)
  }, [])
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[70] flex flex-col items-center gap-2 px-4" aria-live="polite">
        {items.map((t) => (
          <div
            key={t.id}
            role={t.tone === 'error' ? 'alert' : 'status'}
            className={`slide-down rounded-xl px-5 py-3 text-sm font-medium shadow-lg ${t.tone === 'error' ? 'bg-danger text-white' : 'bg-forest text-cream'}`}
          >
            {t.text}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}

/** Friendly text for errors returned by the database functions. */
export function errorText(code: string): string {
  const map: Record<string, string> = {
    room_required: 'Enter a room number first.',
    checkin_unavailable: 'This check-in was already handled.',
    not_allowed: 'Your account is not allowed to do this.',
    last_admin: 'You cannot remove the last administrator.',
    network: 'No connection. Check the internet and try again.',
    invalid_login: 'Wrong email or password.',
    email_not_confirmed: 'Please confirm your email address first (check your inbox).',
    duplicate: 'A booking with this booking number already exists.',
  }
  return map[code] ?? 'Something went wrong. Please try again.'
}

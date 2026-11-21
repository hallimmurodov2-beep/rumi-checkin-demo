import type { ButtonHTMLAttributes } from 'react'

export function Brand({ tone = 'dark', size = 'md' }: { tone?: 'dark' | 'light'; size?: 'sm' | 'md' | 'lg' }) {
  const light = tone === 'light'
  return (
    <div className="flex items-center gap-3">
      <img
        src={light ? '/emblem-light.png' : '/emblem-gold.png'}
        alt=""
        className={size === 'lg' ? 'h-16 w-16' : size === 'sm' ? 'h-10 w-10' : 'h-11 w-11'}
      />
      <div className="leading-tight">
        <div
          className={`font-serif font-semibold ${size === 'lg' ? 'text-3xl tracking-[0.32em]' : size === 'sm' ? 'text-xl tracking-[0.24em]' : 'text-2xl tracking-[0.32em]'} ${light ? 'text-cream' : 'text-forest'}`}
        >
          THE RUMI
        </div>
        <div className={`whitespace-nowrap text-[10px] font-medium ${size === 'sm' ? 'tracking-[0.14em]' : 'tracking-[0.22em]'} ${light ? 'text-gold-light' : 'text-label'}`}>
          HOTEL AND RESIDENCES
        </div>
      </div>
    </div>
  )
}

export function DemoBadge({ className = '' }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border border-label/40 bg-gold-light px-3 py-1 text-xs font-semibold tracking-wide text-ink ${className}`}
    >
      DEMO - sample data
    </span>
  )
}

type Variant = 'primary' | 'secondary' | 'ghost' | 'light'
const variants: Record<Variant, string> = {
  primary: 'bg-forest text-cream hover:bg-forest-deep',
  secondary: 'bg-white text-forest border-2 border-forest hover:bg-cream',
  ghost: 'bg-transparent text-forest underline underline-offset-4 hover:bg-forest/5',
  light: 'bg-cream text-forest hover:bg-white',
}

export function Button({
  variant = 'primary',
  className = '',
  ...p
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      type="button"
      {...p}
      className={`inline-flex min-h-16 cursor-pointer items-center justify-center gap-2 rounded-xl px-8 text-lg font-medium transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45 ${variants[variant]} ${className}`}
    />
  )
}

export function CheckIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  )
}

export function ArrowLeft({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M19 12H5M11 6l-6 6 6 6" />
    </svg>
  )
}

export function StarIcon({ filled, className = 'h-10 w-10' }: { filled: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" fill={filled ? '#C99A1A' : 'none'} stroke={filled ? '#7A5A0C' : '#56615B'} strokeWidth="1.6" strokeLinejoin="round">
      <path d="M12 3.2l2.7 5.6 6.1.8-4.5 4.2 1.1 6.1L12 17l-5.4 2.9 1.1-6.1L3.2 9.6l6.1-.8z" />
    </svg>
  )
}

export function fmtTimeShort(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

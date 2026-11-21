import type { ButtonHTMLAttributes, CSSProperties } from 'react'
import type React from 'react'

export const COLORS = {
  forest: '#0E3B2E',
  gold: '#C99A1A',
  goldLight: '#ECCD78',
}

/**
 * The Rumi emblem, drawn from a vector trace of assets/rumi-gold.png so it stays
 * sharp at any size. Gold on light backgrounds, light gold on green.
 */
export function Emblem({
  className = '',
  color = COLORS.gold,
  label,
  style,
}: {
  className?: string
  color?: string
  label?: string
  style?: CSSProperties
}) {
  return (
    <span
      className={`emblem shrink-0 ${className}`}
      style={{ backgroundColor: color, ...style }}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    />
  )
}

export function Brand({ tone = 'dark', size = 'md' }: { tone?: 'dark' | 'light'; size?: 'sm' | 'md' | 'lg' }) {
  const light = tone === 'light'
  return (
    <div className="flex items-center gap-3">
      <Emblem
        color={light ? COLORS.goldLight : COLORS.gold}
        className={size === 'lg' ? 'h-16 w-16' : size === 'sm' ? 'h-10 w-10' : 'h-11 w-11'}
      />
      <div className="leading-tight">
        <div
          className={`whitespace-nowrap font-serif font-semibold ${
            size === 'lg' ? 'text-3xl tracking-[0.32em]' : size === 'sm' ? 'text-xl tracking-[0.24em]' : 'text-2xl tracking-[0.32em]'
          } ${light ? 'text-cream' : 'text-forest'}`}
        >
          THE RUMI
        </div>
        <div
          className={`whitespace-nowrap text-[10px] font-medium ${size === 'sm' ? 'tracking-[0.14em]' : 'tracking-[0.22em]'} ${
            light ? 'text-gold-light' : 'text-label'
          }`}
        >
          HOTEL AND RESIDENCES
        </div>
      </div>
    </div>
  )
}

export function Spinner({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={`spin ${className}`} aria-hidden="true" fill="none">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.2" strokeWidth="3" />
      <path d="M21 12a9 9 0 00-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}

/** Large success mark: a ring that grows in and a check that draws itself. */
export function AnimatedCheck({ size = 'h-20 w-20' }: { size?: string }) {
  return (
    <span className={`ring-grow relative flex shrink-0 items-center justify-center rounded-full bg-forest text-gold-light shadow-[0_10px_30px_-10px_rgb(14_59_46/0.6)] ${size}`}>
      <svg viewBox="0 0 24 24" className="h-1/2 w-1/2" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path className="draw-check" pathLength={1} d="M5 12.5l4.5 4.5L19 7.5" />
      </svg>
    </span>
  )
}

export function ErrorNote({ children }: { children: React.ReactNode }) {
  return (
    <div role="alert" className="fade-in rounded-xl border border-danger/30 bg-[#FDF1EC] px-4 py-3 text-danger">
      {children}
    </div>
  )
}

type Variant = 'primary' | 'secondary' | 'ghost' | 'light'
const variants: Record<Variant, string> = {
  primary: 'bg-forest text-cream shadow-[0_8px_20px_-10px_rgb(14_59_46/0.7)] hover:bg-forest-deep hover:shadow-[0_10px_24px_-10px_rgb(14_59_46/0.8)]',
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
      className={`inline-flex min-h-16 cursor-pointer select-none items-center justify-center gap-2 rounded-xl px-8 text-lg font-medium transition-[background-color,box-shadow,transform,opacity] duration-200 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45 disabled:active:scale-100 ${variants[variant]} ${className}`}
    />
  )
}

type IconProps = { className?: string }

export function CheckIcon({ className = 'h-5 w-5' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  )
}

export function ArrowLeft({ className = 'h-5 w-5' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M19 12H5M11 6l-6 6 6 6" />
    </svg>
  )
}

export function ArrowRight({ className = 'h-5 w-5' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  )
}

export function ExpandIcon({ className = 'h-5 w-5' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
    </svg>
  )
}

export function WifiIcon({ className = 'h-6 w-6' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M2.5 9a14 14 0 0119 0M5.5 12.5a9.5 9.5 0 0113 0M8.5 16a5 5 0 017 0" />
      <circle cx="12" cy="19.2" r="1" fill="currentColor" />
    </svg>
  )
}

export function CupIcon({ className = 'h-6 w-6' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M4 9h12v5a5 5 0 01-5 5H9a5 5 0 01-5-5V9zM16 10h1.5a2.5 2.5 0 010 5H16M7 3v3M11 3v3" />
    </svg>
  )
}

export function CarIcon({ className = 'h-6 w-6' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M5 16V11l2-5h10l2 5v5M3 16h18v2H3zM5 11h14" />
      <circle cx="7.5" cy="14" r="0.8" fill="currentColor" />
      <circle cx="16.5" cy="14" r="0.8" fill="currentColor" />
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

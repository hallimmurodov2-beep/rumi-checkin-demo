import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Brand, COLORS, Emblem } from '../ui'

const steps = [
  {
    title: 'iPad (Safari)',
    items: [
      'Open this site and tap "Open guest tablet".',
      'Tap Share, then "Add to Home Screen".',
      'Open "Rumi Check-in" from the home screen. It runs full screen.',
      'Lock it to the app: Settings > Accessibility > Guided Access, then triple-click the top button.',
    ],
  },
  {
    title: 'Android tablet (Chrome)',
    items: [
      'Open this site and tap "Open guest tablet".',
      'Tap the menu (three dots), then "Install app" or "Add to Home screen".',
      'Open "Rumi Check-in" from the home screen. It runs full screen.',
      'Lock it to the app: Settings > Security > App pinning, then pin it from Recents.',
    ],
  },
]

export default function Landing() {
  useEffect(() => {
    document.title = 'The Rumi - Self check-in'
  }, [])
  return (
    <main className="min-h-dvh bg-cream">
      <header className="flex items-center justify-between gap-4 px-5 py-5 sm:px-10">
        <Brand />
        <Link to="/staff" className="inline-flex min-h-11 items-center rounded-lg px-4 text-sm font-medium text-forest hover:bg-forest/5">
          Staff sign in
        </Link>
      </header>

      <section className="relative mx-auto flex w-full max-w-3xl flex-col items-center px-5 pb-14 pt-10 text-center sm:pt-16">
        <Emblem color={COLORS.gold} className="rise h-20 w-20" />
        <p className="eyebrow rise mt-6" style={{ animationDelay: '80ms' }}>Self check-in</p>
        <h1 className="rise mt-3 text-5xl leading-tight text-forest sm:text-6xl" style={{ animationDelay: '140ms' }}>Arrive, scan, and settle in</h1>
        <p className="rise mt-5 max-w-xl text-lg text-muted" style={{ animationDelay: '200ms' }}>
          Guests check in on the lobby tablet in English, Russian or Tajik. Reception scans the passport, the booking appears on the tablet, and the front desk sees each arrival instantly and hands over the key.
        </p>
        <div className="rise mt-10 flex w-full flex-col gap-4 sm:flex-row sm:justify-center" style={{ animationDelay: '260ms' }}>
          <Link
            to="/staff"
            className="inline-flex min-h-16 flex-1 items-center justify-center rounded-xl bg-forest px-8 text-lg font-medium text-cream shadow-sm hover:bg-forest-deep sm:max-w-xs"
          >
            Open front desk
          </Link>
          <Link
            to="/tablet"
            className="inline-flex min-h-16 flex-1 items-center justify-center rounded-xl border-2 border-forest bg-white px-8 text-lg font-medium text-forest hover:bg-cream sm:max-w-xs"
          >
            Open guest tablet
          </Link>
        </div>
        <p className="mt-8 text-sm text-muted">The guest tablet needs to be paired once with a code from the front desk (Settings → Tablets).</p>
      </section>

      <section className="relative overflow-hidden bg-forest px-5 py-14 text-cream sm:px-10">
        <Emblem color={COLORS.goldLight} className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 opacity-[0.06]" />
        <div className="relative mx-auto max-w-5xl">
          <p className="text-sm font-semibold tracking-[0.2em] text-gold-light">SET UP ON A TABLET</p>
          <h2 className="mt-2 text-4xl">Install it like an app</h2>
          <p className="mt-3 max-w-2xl text-cream/90">
            The tablet screen installs to the home screen, opens full screen in landscape, keeps the screen awake and shows each guest their booking once reception has scanned the passport.
          </p>
          <div className="mt-8 grid gap-5 md:grid-cols-2">
            {steps.map((s) => (
              <div key={s.title} className="rounded-2xl border border-white/15 bg-white/5 p-6">
                <h3 className="text-2xl text-gold-light">{s.title}</h3>
                <ol className="mt-3 space-y-2">
                  {s.items.map((it, i) => (
                    <li key={it} className="flex gap-3 text-cream/90">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gold-light text-xs font-semibold text-forest">
                        {i + 1}
                      </span>
                      <span>{it}</span>
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  )
}

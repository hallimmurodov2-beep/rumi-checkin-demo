import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Brand } from '../ui'

const install = [
  {
    title: 'iPad',
    instructions: 'Open the guest tablet in Safari. Tap Share, then Add to Home Screen. To keep the app open for guests, enable Guided Access in Settings → Accessibility.',
  },
  {
    title: 'Android',
    instructions: 'Open the guest tablet in Chrome. In the menu, tap Install app or Add to Home screen. Use App pinning in your tablet’s security settings to keep the app open for guests.',
  },
]

export default function Landing() {
  useEffect(() => {
    document.title = 'Guest check-in | The Rumi Hotel & Residences'
  }, [])

  return (
    <div className="min-h-dvh bg-cream">
      <header className="border-b border-forest/10">
        <div className="mx-auto flex max-w-[92rem] flex-wrap items-center justify-between gap-x-5 px-5 py-4 sm:px-10 lg:px-14">
          <Link to="/" aria-label="The Rumi check-in home" className="rounded-sm">
            <Brand />
          </Link>
          <a href="#tablet-setup" className="inline-flex min-h-11 items-center rounded-md px-2 text-sm font-semibold text-forest underline-offset-4 hover:underline">
            Tablet setup
          </a>
        </div>
      </header>

      <main className="mx-auto max-w-[92rem] px-5 pb-10 sm:px-10 lg:px-14">
        <section className="grid items-stretch gap-8 py-8 sm:py-12 lg:grid-cols-[0.94fr_1.06fr] lg:gap-12 xl:py-14">
          <div className="flex min-w-0 flex-col justify-center lg:py-8">
            <p className="eyebrow flex items-center gap-3">
              <span className="h-px w-8 bg-gold" aria-hidden="true" />
              Dushanbe, Tajikistan
            </p>
            <h1 className="mt-4 max-w-[12ch] text-[clamp(3.5rem,7vw,7.25rem)] leading-[0.87] tracking-[-0.04em] text-forest">
              Guest check-in
            </h1>
            <p className="mt-6 max-w-md text-base leading-relaxed text-muted sm:text-lg">
              Show your passport at reception, then complete your check-in on the lobby tablet in English, Russian or Tajik.
            </p>
            <div className="mt-8 max-w-lg divide-y divide-forest/15 border-y border-forest/15">
              <Link to="/tablet" className="group flex min-h-20 items-center justify-between gap-4 rounded-sm py-4 text-forest">
                <span>
                  <span className="block text-lg font-semibold">Open guest tablet</span>
                  <span className="mt-0.5 block text-sm text-muted">Review your stay and sign</span>
                </span>
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-forest text-cream transition-colors group-hover:bg-forest-deep">
                  <ArrowRight />
                </span>
              </Link>
              <Link to="/staff" className="group flex min-h-20 items-center justify-between gap-4 rounded-sm py-4 text-forest">
                <span>
                  <span className="block text-lg font-semibold">Open front desk</span>
                  <span className="mt-0.5 block text-sm text-muted">Manage arrivals and tablet check-ins</span>
                </span>
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-forest/25 transition-colors group-hover:bg-forest/5">
                  <ArrowRight />
                </span>
              </Link>
            </div>
          </div>

          <figure className="relative isolate min-h-64 overflow-hidden rounded-2xl bg-forest-deep sm:min-h-96 lg:min-h-[34rem]">
            <img
              src="/gallery/lobby1.webp"
              alt="The Rumi lobby with its chandelier and curved staircase"
              fetchPriority="high"
              className="absolute inset-0 -z-20 h-full w-full object-cover object-[48%_50%]"
            />
            <div className="absolute inset-x-0 bottom-0 -z-10 h-1/2 bg-gradient-to-t from-forest-deep/95 to-transparent" aria-hidden="true" />
            <figcaption className="absolute inset-x-5 bottom-5 border-t border-cream/35 pt-3 text-sm font-medium text-cream sm:inset-x-8 sm:bottom-7">
              The Rumi Hotel &amp; Residences
            </figcaption>
          </figure>
        </section>

        <section id="tablet-setup" className="scroll-mt-6 rounded-2xl bg-forest-deep p-6 text-cream sm:p-9 lg:grid lg:grid-cols-[0.85fr_1.15fr] lg:gap-12" aria-labelledby="tablet-setup-title">
          <div>
            <h2 id="tablet-setup-title" className="text-4xl leading-none sm:text-5xl">Set up a tablet</h2>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-cream/80 sm:text-base">
              In the front desk app, go to Settings → Tablets to create a pairing code. Enter it on the guest tablet, then install the app.
            </p>
          </div>
          <div className="mt-5 divide-y divide-cream/20 border-y border-cream/20 lg:mt-0">
            {install.map(({ title, instructions }) => (
              <details key={title} className="group">
                <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-4 rounded-sm py-2 font-semibold text-gold-light [&::-webkit-details-marker]:hidden">
                  {title}
                  <span className="text-2xl font-normal leading-none transition-transform group-open:rotate-45" aria-hidden="true">+</span>
                </summary>
                <p className="max-w-2xl pb-4 text-sm leading-relaxed text-cream/85">{instructions}</p>
              </details>
            ))}
          </div>
        </section>
      </main>
    </div>
  )
}

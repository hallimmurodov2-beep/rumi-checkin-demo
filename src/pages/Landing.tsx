import { Link } from 'react-router-dom'
import { Brand, DemoBadge } from '../ui'

export default function Landing() {
  return (
    <main className="flex min-h-dvh flex-col bg-cream">
      <header className="flex items-center justify-between gap-4 px-6 py-5 sm:px-10">
        <Brand />
        <DemoBadge />
      </header>
      <section className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center px-6 pb-16 text-center">
        <p className="text-sm font-semibold tracking-[0.2em] text-label">SALES DEMO</p>
        <h1 className="mt-3 text-5xl text-forest sm:text-6xl">Self check-in, at the front desk</h1>
        <p className="mt-5 max-w-xl text-lg text-muted">
          Open the staff screen in one tab and the tablet in another: when a guest checks in on the tablet, they appear live in the staff queue.
        </p>
        <div className="mt-10 flex w-full flex-col gap-4 sm:flex-row sm:justify-center">
          <Link
            to="/tablet"
            className="inline-flex min-h-16 flex-1 items-center justify-center rounded-xl bg-forest px-8 text-lg font-medium text-cream hover:bg-forest-deep sm:max-w-xs"
          >
            Open tablet demo
          </Link>
          <Link
            to="/staff"
            className="inline-flex min-h-16 flex-1 items-center justify-center rounded-xl border-2 border-forest bg-white px-8 text-lg font-medium text-forest hover:bg-cream sm:max-w-xs"
          >
            Open staff screen
          </Link>
        </div>
        <p className="mt-8 text-sm text-muted">All guests, bookings and systems shown are made up. Nothing is sent anywhere.</p>
      </section>
    </main>
  )
}

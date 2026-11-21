import { useState } from 'react'
import { actions, fmtTime, statusLabel, useDemoState, type QueueItem } from '../store'
import { Brand, DemoBadge, StarIcon } from '../ui'

type View = 'queue' | 'checkouts' | 'feedback'

function Chip({ children, tone = 'green' }: { children: React.ReactNode; tone?: 'green' | 'gold' | 'plain' }) {
  const cls =
    tone === 'green'
      ? 'border-forest/30 bg-forest/10 text-forest'
      : tone === 'gold'
        ? 'border-label/40 bg-gold-light/60 text-ink'
        : 'border-line bg-white text-muted'
  return <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${cls}`}>{children}</span>
}

function Stars({ n }: { n: number }) {
  return (
    <span className="inline-flex items-center" role="img" aria-label={`${n} out of 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <StarIcon key={i} filled={i <= n} className="h-5 w-5" />
      ))}
    </span>
  )
}

function Approve({ q }: { q: QueueItem }) {
  if (q.status === 'checked_in') return <Chip tone="green">{statusLabel(q.status)}</Chip>
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Chip tone="gold">{statusLabel(q.status)}</Chip>
      <button
        type="button"
        onClick={() => actions.approve(q.id)}
        className="min-h-11 cursor-pointer rounded-lg bg-forest px-4 text-sm font-medium text-cream hover:bg-forest-deep"
      >
        Approve &amp; check in
      </button>
    </div>
  )
}

export default function Staff() {
  const state = useDemoState()
  const [view, setView] = useState<View>('queue')

  const waiting = state.queue.filter((q) => q.status === 'waiting').length
  const nav: { id: View; label: string; count: number }[] = [
    { id: 'queue', label: 'Tablet queue', count: waiting },
    { id: 'checkouts', label: 'Check-outs today', count: state.checkouts.length },
    { id: 'feedback', label: 'Guest feedback', count: state.feedback.length },
  ]

  return (
    <div className="flex min-h-dvh flex-col bg-cream md:flex-row">
      <aside className="bg-[#0A2A21] px-4 py-4 text-cream md:sticky md:top-0 md:h-dvh md:w-64 md:shrink-0 md:px-5 md:py-6">
        <Brand tone="light" size="sm" />
        <nav aria-label="Staff sections" className="mt-4 flex flex-wrap gap-2 md:mt-10 md:flex-col">
          {nav.map((n) => (
            <button
              key={n.id}
              type="button"
              aria-current={view === n.id ? 'page' : undefined}
              onClick={() => setView(n.id)}
              className={`flex min-h-11 shrink-0 cursor-pointer items-center justify-between gap-3 rounded-lg px-4 text-left text-sm font-medium ${
                view === n.id ? 'bg-cream text-forest' : 'text-cream hover:bg-white/10'
              }`}
            >
              {n.label}
              <span className={`rounded-full px-2 py-0.5 text-xs ${view === n.id ? 'bg-forest text-cream' : 'bg-white/15 text-gold-light'}`}>
                {n.count}
              </span>
            </button>
          ))}
        </nav>
      </aside>

      <div className="min-w-0 flex-1">
        <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 border-b border-line bg-white px-4 py-3 md:px-8">
          <Chip tone="green">
            <span className="h-2 w-2 rounded-full bg-forest" aria-hidden="true" /> eZee FrontDesk: connected
          </Chip>
          <Chip tone="plain">Tablets online: 3 of 3</Chip>
          <DemoBadge />
          <button
            type="button"
            onClick={actions.reset}
            className="ml-auto min-h-11 cursor-pointer rounded-lg border-2 border-forest bg-white px-4 text-sm font-medium text-forest hover:bg-cream"
          >
            Reset demo
          </button>
        </div>

        <main className="px-4 py-6 md:px-8 md:py-8">
          {view === 'queue' && (
            <>
              <h1 className="text-4xl text-forest">Tablet queue</h1>
              <p className="mt-1 text-muted">Guests who finished self check-in on a tablet. Updates live.</p>
              {state.queue.length === 0 ? (
                <p className="mt-8 rounded-xl border border-line bg-white p-6 text-muted">No check-ins yet.</p>
              ) : (
                <>
                  <table className="mt-6 hidden w-full overflow-hidden rounded-xl border border-line bg-white text-left md:table">
                    <thead className="bg-cream text-xs tracking-wider text-label">
                      <tr>
                        {['GUEST', 'BOOKING SOURCE', 'ROOM', 'STATUS'].map((h) => (
                          <th key={h} scope="col" className="px-5 py-3 font-semibold">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {state.queue.map((q) => (
                        <tr key={q.id}>
                          <td className="px-5 py-4">
                            <div className="whitespace-nowrap font-medium">{q.guest}</div>
                            <div className="text-xs text-muted">{fmtTime(q.time)}</div>
                          </td>
                          <td className="px-5 py-4">{q.source}</td>
                          <td className="px-5 py-4">{q.room}</td>
                          <td className="px-5 py-4"><Approve q={q} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <ul className="mt-6 space-y-3 md:hidden">
                    {state.queue.map((q) => (
                      <li key={q.id} className="rounded-xl border border-line bg-white p-4">
                        <div className="flex items-baseline justify-between gap-3">
                          <span className="font-medium">{q.guest}</span>
                          <span className="text-xs text-muted">{fmtTime(q.time)}</span>
                        </div>
                        <p className="mt-1 text-sm text-muted">{q.source} · {q.room}</p>
                        <div className="mt-3"><Approve q={q} /></div>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </>
          )}

          {view === 'checkouts' && (
            <>
              <h1 className="text-4xl text-forest">Check-outs today</h1>
              <p className="mt-1 text-muted">Guests who checked out on a tablet.</p>
              <ul className="mt-6 divide-y divide-line rounded-xl border border-line bg-white">
                {state.checkouts.length === 0 && <li className="p-6 text-muted">No check-outs yet.</li>}
                {state.checkouts.map((c) => (
                  <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                    <div>
                      <div className="font-medium">{c.guest}</div>
                      <div className="text-sm text-muted">{c.room} · {fmtTime(c.time)}</div>
                    </div>
                    <Stars n={c.rating} />
                  </li>
                ))}
              </ul>
            </>
          )}

          {view === 'feedback' && (
            <>
              <h1 className="text-4xl text-forest">Guest feedback</h1>
              <p className="mt-1 text-muted">Private feedback from ratings of 1 to 3. Ratings of 4 to 5 are sent to the public review page instead.</p>
              <ul className="mt-6 space-y-3">
                {state.feedback.length === 0 && <li className="rounded-xl border border-line bg-white p-6 text-muted">No private feedback yet.</li>}
                {state.feedback.map((f) => (
                  <li key={f.id} className="rounded-xl border border-line bg-white p-5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-medium">{f.guest} <span className="font-normal text-muted">· {fmtTime(f.time)}</span></span>
                      <Stars n={f.rating} />
                    </div>
                    <p className="mt-2 text-ink">{f.text || <span className="text-muted">(no comment)</span>}</p>
                  </li>
                ))}
              </ul>
            </>
          )}
        </main>
      </div>
    </div>
  )
}

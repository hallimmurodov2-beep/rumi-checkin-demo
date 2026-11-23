import { useMemo, type ReactNode } from 'react'
import { ArrowRight } from '../../ui'
import { deviceOnline, fmtDate, hotelToday, type StaffData } from '../data'
import { Btn, Chip, Empty, Panel, StatusChip } from '../kit'
import { CheckinRow, waitingCheckins } from './Queue'
import type { View } from '../StaffApp'

function DeskMetric({ label, value, detail, action, attention, children }: {
  label: string
  value: ReactNode
  detail: string
  action: () => void
  attention?: boolean
  children?: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={action}
      className={`group flex min-w-0 cursor-pointer flex-col gap-1 rounded-2xl border p-4 text-left transition-colors sm:p-5 ${
        attention ? 'border-gold/50 bg-[#FBF3DE] hover:border-gold' : 'border-line bg-paper hover:border-forest/40'
      }`}
    >
      <span className="flex w-full items-start justify-between gap-2 text-sm font-semibold text-forest">
        {label}
        <ArrowRight className="mt-0.5 hidden h-4 w-4 shrink-0 text-muted transition-transform group-hover:translate-x-0.5 sm:block" />
      </span>
      <span className="font-serif text-4xl font-semibold leading-none tabular-nums text-forest">{value}</span>
      <span className="mt-1 text-xs leading-relaxed text-muted sm:text-sm">{detail}</span>
      {children}
    </button>
  )
}

export function TodayView({ data, now, go, openCheckin }: { data: StaffData; now: number; go: (v: View) => void; openCheckin: (id: string) => void }) {
  const today = hotelToday()
  const byId = useMemo(() => new Map(data.reservations.map((r) => [r.id, r])), [data.reservations])
  const arrivals = data.reservations.filter((r) => r.arrival_date === today && r.status !== 'cancelled')
  const expected = arrivals.filter((r) => r.status === 'expected').length
  const waiting = waitingCheckins(data.checkins)
  const inHouse = data.reservations.filter((r) => r.status === 'in_house')
  const online = data.devices.filter((d) => deviceOnline(d, now)).length
  const arrived = arrivals.filter((r) => r.status === 'in_house' || r.status === 'checked_out').length
  const departing = inHouse.filter((r) => r.departure_date === today).length
  const leaving = inHouse.filter((r) => r.departure_date <= today).sort((a, b) => a.departure_date.localeCompare(b.departure_date))
  const overdue = leaving.length - departing
  const date = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Dushanbe', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(now)

  return (
    <>
      <header className="relative isolate mb-5 overflow-hidden rounded-3xl bg-forest-deep px-6 py-8 text-cream sm:px-9 sm:py-10">
        <img src="/gallery/lobby1.webp" alt="" className="pointer-events-none absolute inset-y-0 right-0 -z-10 h-full w-3/5 object-cover object-center opacity-70" />
        <div aria-hidden="true" className="absolute inset-0 -z-10 bg-linear-to-r from-forest-deep via-forest-deep via-45% to-forest-deep/55 sm:to-forest-deep/15" />
        <time dateTime={today} className="text-sm font-medium tracking-wide text-gold-light">{date}</time>
        <h1 className="mt-2 text-4xl leading-none sm:text-6xl">Today at the front desk</h1>
      </header>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <DeskMetric label="Waiting at desk" value={waiting.length} detail={waiting.length === 1 ? 'Tablet check-in to review' : 'Tablet check-ins to review'} attention={waiting.length > 0} action={() => go('queue')} />
        <DeskMetric label="Arrivals today" value={<>{arrived} <span className="text-2xl text-muted">/ {arrivals.length}</span></>} detail={arrivals.length ? `Arrived · ${expected} still expected` : 'No arrivals booked'} action={() => go('arrivals')}>
          {arrivals.length > 0 && (
            <progress
              aria-hidden="true"
              className="mt-1 h-1.5 w-full appearance-none overflow-hidden rounded-full [&::-moz-progress-bar]:bg-forest [&::-webkit-progress-bar]:bg-cream [&::-webkit-progress-value]:bg-forest"
              value={arrived}
              max={arrivals.length}
            />
          )}
        </DeskMetric>
        <DeskMetric label="In house" value={inHouse.length} detail={`${departing} due today${overdue ? ` · ${overdue} overdue` : ''}`} action={() => go('inhouse')} />
        <DeskMetric label="Tablets online" value={<>{online} <span className="text-2xl text-muted">/ {data.devices.length}</span></>} detail="View lobby devices" action={() => go('settings')} />
      </div>

      <div className="mt-6 grid items-start gap-5 xl:grid-cols-[1.15fr_1fr]">
        <Panel
          title={<span className="flex items-center gap-2">Waiting at the desk {waiting.length > 0 && <Chip className="border-gold/40 bg-gold-light/35 text-ink">{waiting.length}</Chip>}</span>}
          action={waiting.length > 0 && <Btn tone="ghost" onClick={() => go('queue')}>Open queue <ArrowRight className="h-4 w-4" /></Btn>}
        >
          {waiting.length === 0 ? (
            <Empty>No guests are waiting for approval.</Empty>
          ) : (
            <div className="divide-y divide-line">
              {waiting.slice(0, 6).map((c) => (
                <CheckinRow key={c.id} c={c} r={byId.get(c.reservation_id)} now={now} onOpen={() => openCheckin(c.id)} />
              ))}
            </div>
          )}
        </Panel>

        <Panel title="Departures due" action={<Btn tone="ghost" onClick={() => go('inhouse')}>In house <ArrowRight className="h-4 w-4" /></Btn>}>
          {leaving.length === 0 ? (
            <Empty>No departures due.</Empty>
          ) : (
            <ul className="divide-y divide-line">
              {leaving.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <span className="min-w-0">
                    <span className="block wrap-break-word font-medium">{r.guest_name}</span>
                    <span className="text-sm text-muted">{r.room_number ? `Room ${r.room_number}` : 'No room assigned'}</span>
                  </span>
                  {r.departure_date < today ? (
                    <Chip className="border-danger/20 bg-danger/5 text-danger">Overdue · {fmtDate(r.departure_date)}</Chip>
                  ) : (
                    <Chip>Today</Chip>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Arriving today" action={<Btn tone="ghost" onClick={() => go('arrivals')}>All arrivals <ArrowRight className="h-4 w-4" /></Btn>} className="xl:col-span-2">
          {arrivals.length === 0 ? (
            <Empty>No arrivals booked for today.</Empty>
          ) : (
            <ul className="grid gap-px bg-line sm:grid-cols-2">
              {arrivals.slice(0, 8).map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 bg-paper px-5 py-3 sm:last:odd:col-span-2">
                  <span className="min-w-0">
                    <span className="block wrap-break-word font-medium">{r.guest_name}</span>
                    <span className="text-sm text-muted">{r.room_type || 'Room'} · {r.source}</span>
                  </span>
                  <StatusChip status={r.status} />
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </>
  )
}

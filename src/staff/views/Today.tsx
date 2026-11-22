import { useMemo } from 'react'
import { fmtDate, hotelToday, type StaffData } from '../data'
import { Btn, Empty, Kpi, PageHead, Panel, StatusChip } from '../kit'
import { CheckinRow } from './Queue'
import type { View } from '../StaffApp'

export function TodayView({ data, now, go, openCheckin }: { data: StaffData; now: number; go: (v: View) => void; openCheckin: (id: string) => void }) {
  const today = hotelToday()
  const byId = useMemo(() => new Map(data.reservations.map((r) => [r.id, r])), [data.reservations])
  const arrivals = data.reservations.filter((r) => r.arrival_date === today && r.status !== 'cancelled')
  const expected = arrivals.filter((r) => r.status === 'expected')
  const waiting = data.checkins.filter((c) => c.status === 'waiting')
  const inHouse = data.reservations.filter((r) => r.status === 'in_house')
  const arrived = arrivals.filter((r) => r.status === 'in_house' || r.status === 'checked_out')
  const departing = inHouse.filter((r) => r.departure_date === today)
  const overdue = inHouse.filter((r) => r.departure_date < today)
  const leaving = [...overdue, ...departing]
  const openFeedback = data.feedback.filter((f) => !f.resolved).length
  // Hotel time (Dushanbe), whatever time zone the computer is set to.
  const hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Dushanbe', hour: '2-digit', hourCycle: 'h23' }).format(now))
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'

  return (
    <>
      <PageHead title={greeting} sub={new Date(now).toLocaleDateString('en-GB', { timeZone: 'Asia/Dushanbe', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Waiting at desk" value={waiting.length} sub="Tablet check-ins" onClick={() => go('queue')} />
        <Kpi label="Arrivals today" value={`${arrived.length} of ${arrivals.length}`} sub={`arrived, ${expected.length} still expected`} onClick={() => go('arrivals')} />
        <Kpi label="In house" value={inHouse.length} sub={`${departing.length} leaving today${overdue.length ? `, ${overdue.length} overdue` : ''}`} onClick={() => go('inhouse')} />
        <Kpi label="Open feedback" value={openFeedback} sub={openFeedback === 1 ? 'Guest comment to follow up' : 'Guest comments to follow up'} onClick={() => go('feedback')} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.3fr_1fr]">
        <Panel title="Waiting at the desk" action={waiting.length > 0 && <Btn tone="ghost" onClick={() => go('queue')}>Open queue</Btn>}>
          {waiting.length === 0 ? (
            <Empty>No one is waiting. New tablet check-ins appear here instantly.</Empty>
          ) : (
            <div className="divide-y divide-line">
              {waiting.slice(0, 6).map((c) => (
                <div key={c.id} className="fade-in">
                  <CheckinRow c={c} r={byId.get(c.reservation_id)} now={now} onOpen={() => openCheckin(c.id)} />
                </div>
              ))}
            </div>
          )}
        </Panel>

        <div className="space-y-6">
          <Panel title={`Arriving today (${arrivals.length})`} action={<Btn tone="ghost" onClick={() => go('arrivals')}>All arrivals</Btn>}>
            {arrivals.length === 0 ? (
              <Empty>No arrivals booked for today. Add or import bookings under Arrivals.</Empty>
            ) : (
              <ul className="divide-y divide-line">
                {arrivals.slice(0, 8).map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-3 px-5 py-3">
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{r.guest_name}</span>
                      <span className="text-sm text-muted">{r.room_type || 'Room'} · {r.source}</span>
                    </span>
                    <StatusChip status={r.status} />
                  </li>
                ))}
              </ul>
            )}
          </Panel>
          <Panel title={`Leaving today (${leaving.length})`} action={<Btn tone="ghost" onClick={() => go('checkouts')}>Check-outs</Btn>}>
            {leaving.length === 0 ? (
              <Empty>No departures due.</Empty>
            ) : (
              <ul className="divide-y divide-line">
                {leaving.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-3 px-5 py-3">
                    <span>
                      <span className="font-medium">{r.guest_name}</span> <span className="text-muted">· room {r.room_number}</span>
                    </span>
                    {r.departure_date < today ? (
                      <span className="rounded-full bg-danger/10 px-2.5 py-0.5 text-xs font-semibold text-danger" title={`Was due out ${fmtDate(r.departure_date)}`}>
                        Overdue · {fmtDate(r.departure_date)}
                      </span>
                    ) : (
                      <span className="text-sm text-muted">{fmtDate(r.departure_date)}</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </>
  )
}

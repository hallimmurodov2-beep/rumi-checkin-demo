import { useMemo } from 'react'
import { fmtDate, hotelToday, deviceOnline, type StaffData } from '../data'
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
  const departing = inHouse.filter((r) => r.departure_date <= today)
  const online = data.devices.filter((d) => deviceOnline(d, now)).length
  const openFeedback = data.feedback.filter((f) => !f.resolved).length
  const greeting = new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 18 ? 'Good afternoon' : 'Good evening'

  return (
    <>
      <PageHead title={greeting} sub={new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Waiting at desk" value={waiting.length} sub="Tablet check-ins" onClick={() => go('queue')} />
        <Kpi label="Arrivals today" value={`${arrivals.length - expected.length}/${arrivals.length}`} sub={`${expected.length} still expected`} onClick={() => go('arrivals')} />
        <Kpi label="In house" value={inHouse.length} sub={`${departing.length} leaving today`} onClick={() => go('inhouse')} />
        <Kpi label="Open feedback" value={openFeedback} sub={`${online} of ${data.devices.length} tablets online`} onClick={() => go('feedback')} />
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
          <Panel title={`Leaving today (${departing.length})`} action={<Btn tone="ghost" onClick={() => go('checkouts')}>Check-outs</Btn>}>
            {departing.length === 0 ? (
              <Empty>No departures due.</Empty>
            ) : (
              <ul className="divide-y divide-line">
                {departing.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-3 px-5 py-3">
                    <span>
                      <span className="font-medium">{r.guest_name}</span> <span className="text-muted">· room {r.room_number}</span>
                    </span>
                    <span className="text-sm text-muted">{fmtDate(r.departure_date)}</span>
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

import { useMemo, useState } from 'react'
import type { Checkin, Reservation } from '../../lib/types'
import { CarIcon, CheckIcon } from '../../ui'
import { fmtDate, hotelToday, nightsBetween, type StaffData } from '../data'
import { Btn, Chip, Empty, PageHead, Panel } from '../kit'

function latestApproved(checkins: Checkin[]) {
  const m = new Map<string, Checkin>()
  for (const c of checkins) if (c.status === 'approved' && !m.has(c.reservation_id)) m.set(c.reservation_id, c)
  return m
}

function csvCell(v: unknown) {
  const s = v == null ? '' : String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** Guest registration list (passport details) for in-house guests, as CSV. */
function exportRegistration(rows: { r: Reservation; c?: Checkin }[]) {
  const head = ['room', 'surname', 'given_names', 'nationality', 'document_type', 'document_number', 'issuing_country', 'birth_date', 'sex', 'expiry_date', 'arrival', 'departure', 'booking_ref', 'phone', 'email']
  const lines = rows.map(({ r, c }) =>
    [r.room_number, c?.surname, c?.given_names, c?.nationality, c?.doc_type, c?.document_number, c?.issuing_country, c?.birth_date, c?.sex, c?.expiry_date, r.arrival_date, r.departure_date, r.booking_ref, c?.phone, c?.email]
      .map(csvCell)
      .join(','),
  )
  const blob = new Blob([`﻿${head.join(',')}\n${lines.join('\n')}\n`], { type: 'text/csv;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `rumi-in-house-${hotelToday()}.csv`
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}

type DepartureFilter = 'all' | 'today' | 'overdue'

export function InHouseView({ data, openCheckin }: { data: StaffData; openCheckin: (id: string) => void }) {
  const today = hotelToday()
  const [filter, setFilter] = useState<DepartureFilter>('all')
  const [query, setQuery] = useState('')
  const approved = useMemo(() => latestApproved(data.checkins), [data.checkins])
  const guests = data.reservations
    .filter((r) => r.status === 'in_house')
    .sort((a, b) => (a.room_number ?? '').localeCompare(b.room_number ?? '', undefined, { numeric: true }))
  const dueToday = guests.filter((r) => r.departure_date === today)
  const overdue = guests.filter((r) => r.departure_date < today)
  const tabs: { id: DepartureFilter; label: string; count: number }[] = [
    { id: 'all', label: 'All stays', count: guests.length },
    { id: 'today', label: 'Due today', count: dueToday.length },
    { id: 'overdue', label: 'Overdue', count: overdue.length },
  ]
  const term = query.trim().toLowerCase()
  const selected = { all: guests, today: dueToday, overdue }[filter]
  const visible = term
    ? selected.filter((r) => [r.guest_name, r.booking_ref, r.room_number].some((s) => s?.toLowerCase().includes(term)))
    : selected

  return (
    <>
      <PageHead
        title="In house"
        sub={`${guests.length} active ${guests.length === 1 ? 'stay' : 'stays'}`}
        action={
          <Btn disabled={!guests.length} onClick={() => exportRegistration(guests.map((r) => ({ r, c: approved.get(r.id) })))}>
            Export registration CSV
          </Btn>
        }
      />
      <Panel>
        <div className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3 sm:px-5">
          <div role="group" aria-label="Filter stays by departure" className="flex flex-wrap gap-1">
            {tabs.map(({ id, label, count }) => (
              <Btn
                key={id}
                tone={id === filter ? 'primary' : 'ghost'}
                aria-pressed={id === filter}
                className="gap-1.5 px-2.5! sm:px-3!"
                onClick={() => setFilter(id)}
              >
                {label}
                <span className={`text-xs tabular-nums ${id === filter ? 'text-gold-light' : id === 'overdue' && count ? 'text-danger' : 'text-muted'}`}>{count}</span>
              </Btn>
            ))}
          </div>
          <input
            type="search"
            aria-label="Search in-house stays"
            placeholder="Find guest, room or booking"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="min-h-11 w-full rounded-lg border border-line bg-white px-3 text-sm sm:ml-auto sm:w-64"
          />
        </div>
        {visible.length === 0 ? (
          <div role="status">
            <Empty>{guests.length === 0 ? 'No guests in house.' : term ? 'No stays match your search.' : filter === 'today' ? 'No departures due today.' : 'No overdue departures.'}</Empty>
          </div>
        ) : (
          <div>
            <p role="status" className="sr-only">{visible.length} {visible.length === 1 ? 'stay' : 'stays'} shown.</p>
            <table className="w-full table-fixed text-left text-sm sm:table-auto sm:text-[15px]">
              <thead className="border-b border-line bg-cream/60 text-xs tracking-wider text-label">
                <tr>
                  <th scope="col" className="hidden px-5 py-3 font-semibold sm:table-cell">ROOM</th>
                  <th scope="col" className="w-2/3 px-4 py-3 font-semibold sm:w-auto sm:px-5">GUEST</th>
                  <th scope="col" className="hidden px-5 py-3 font-semibold sm:table-cell">DEPARTURE</th>
                  <th scope="col" className="px-4 py-3 font-semibold sm:px-5">PASSPORT</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {visible.map((r) => {
                  const c = approved.get(r.id)
                  const isOverdue = r.departure_date < today
                  const leavesToday = r.departure_date === today
                  const departure = fmtDate(r.departure_date)
                  const departureLabel = isOverdue ? 'Overdue' : leavesToday ? 'Today' : departure
                  const departureTone = isOverdue ? 'font-semibold text-danger' : leavesToday ? 'font-semibold text-label' : ''
                  return (
                    <tr key={r.id} className="transition hover:bg-cream/40">
                      <td className="hidden px-5 py-3.5 font-serif text-2xl font-semibold text-forest sm:table-cell">{r.room_number ?? '—'}</td>
                      <td className="wrap-break-word px-4 py-3.5 sm:px-5">
                        <div className="flex flex-wrap items-center gap-2 font-medium">
                          {r.guest_name}
                          {c?.shuttle && <Chip><CarIcon className="h-3.5 w-3.5" /> Shuttle</Chip>}
                        </div>
                        <div className="text-sm text-muted">
                          <span className="sm:hidden">{r.room_number ? `Room ${r.room_number} · ` : ''}</span>
                          {r.room_type ? `${r.room_type} · ` : ''}{r.booking_ref}
                        </div>
                        <div className={`mt-1 text-xs sm:hidden ${departureTone || 'text-muted'}`}>
                          {isOverdue ? `Overdue · ${departure}` : `Departure · ${departureLabel}`}
                        </div>
                      </td>
                      <td className="hidden whitespace-nowrap px-5 py-3.5 sm:table-cell">
                        <span className={departureTone}>{departureLabel}</span>
                        <div className="text-sm text-muted">
                          {isOverdue && `Due ${departure} · `}{nightsBetween(r.arrival_date, r.departure_date)} nights
                        </div>
                      </td>
                      <td className="px-4 py-3.5 sm:px-5">
                        {c ? (
                          <button type="button" aria-label={`View passport for ${r.guest_name}`} onClick={() => openCheckin(c.id)} className="inline-flex min-h-11 cursor-pointer items-center gap-1.5 text-left text-sm font-medium text-forest hover:underline">
                            <CheckIcon className="hidden h-4 w-4 shrink-0 sm:block" />
                            {c.document_number ? [c.nationality, `•••• ${c.document_number.slice(-4)}`].filter(Boolean).join(' ') : 'View'}
                          </button>
                        ) : (
                          <span className="text-sm text-muted">Checked in at desk</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </>
  )
}

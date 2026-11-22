import { useMemo } from 'react'
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

export function InHouseView({ data, openCheckin }: { data: StaffData; openCheckin: (id: string) => void }) {
  const today = hotelToday()
  const approved = useMemo(() => latestApproved(data.checkins), [data.checkins])
  const guests = data.reservations
    .filter((r) => r.status === 'in_house')
    .sort((a, b) => (a.room_number ?? '').localeCompare(b.room_number ?? '', undefined, { numeric: true }))

  return (
    <>
      <PageHead
        title="In house"
        sub={`${guests.length} ${guests.length === 1 ? 'guest' : 'guests'} staying tonight.`}
        action={
          <Btn disabled={!guests.length} onClick={() => exportRegistration(guests.map((r) => ({ r, c: approved.get(r.id) })))}>
            Export registration CSV
          </Btn>
        }
      />
      <Panel>
        {guests.length === 0 ? (
          <Empty>No guests in house.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-left text-[15px]">
              <thead className="border-b border-line bg-cream/60 text-xs tracking-wider text-label">
                <tr>
                  {['ROOM', 'GUEST', 'DEPARTURE', 'PASSPORT'].map((h) => (
                    <th key={h} scope="col" className="px-5 py-3 font-semibold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {guests.map((r) => {
                  const c = approved.get(r.id)
                  const leaving = r.departure_date <= today
                  return (
                    <tr key={r.id} className="transition hover:bg-cream/40">
                      <td className="px-5 py-3.5 font-serif text-2xl font-semibold text-forest">{r.room_number ?? '—'}</td>
                      <td className="px-5 py-3.5">
                        <div className="flex flex-wrap items-center gap-2 font-medium">
                          {r.guest_name}
                          {c?.shuttle && <Chip><CarIcon className="h-3.5 w-3.5" /> Shuttle</Chip>}
                        </div>
                        <div className="text-sm text-muted">{r.room_type} · {r.booking_ref}</div>
                      </td>
                      <td className="whitespace-nowrap px-5 py-3.5">
                        <span className={leaving ? 'font-semibold text-label' : ''}>{leaving ? 'Today' : fmtDate(r.departure_date)}</span>
                        <div className="text-sm text-muted">{nightsBetween(r.arrival_date, r.departure_date)} nights</div>
                      </td>
                      <td className="px-5 py-3.5">
                        {c ? (
                          <button type="button" onClick={() => openCheckin(c.id)} className="inline-flex min-h-11 cursor-pointer items-center gap-1.5 text-sm font-medium text-forest hover:underline">
                            <CheckIcon className="h-4 w-4" /> {c.nationality ?? ''} {c.document_number ? `•••• ${c.document_number.slice(-4)}` : 'View'}
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

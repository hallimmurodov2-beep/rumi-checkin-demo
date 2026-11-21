import { useMemo, useState } from 'react'
import { errorCode, supabase } from '../../lib/supabase'
import type { Checkin, Reservation } from '../../lib/types'
import { CarIcon, CheckIcon } from '../../ui'
import { fmtDate, fmtTime, hotelToday, nightsBetween, timeAgo, type StaffData } from '../data'
import { Btn, Chip, Empty, Modal, PageHead, Panel, Stars, errorText, useToast } from '../kit'

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
  const toast = useToast()
  const [checkout, setCheckout] = useState<Reservation | null>(null)
  const today = hotelToday()
  const approved = useMemo(() => latestApproved(data.checkins), [data.checkins])
  const guests = data.reservations
    .filter((r) => r.status === 'in_house')
    .sort((a, b) => (a.room_number ?? '').localeCompare(b.room_number ?? '', undefined, { numeric: true }))

  const doCheckout = async (r: Reservation) => {
    const { error } = await supabase.from('reservations').update({ status: 'checked_out' }).eq('id', r.id)
    if (error) return toast(errorText(errorCode(error)), 'error')
    await supabase.from('checkouts').insert({ reservation_id: r.id, rating: null, key_returned: true })
    toast(`${r.guest_name} checked out`)
    data.reload('reservations')
    data.reload('checkouts')
    setCheckout(null)
  }

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
                  {['ROOM', 'GUEST', 'DEPARTURE', 'PASSPORT', ''].map((h) => (
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
                      <td className="px-5 py-3.5 text-right">
                        <Btn onClick={() => setCheckout(r)}>Check out</Btn>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
      {checkout && (
        <Modal
          title="Check out at the desk"
          onClose={() => setCheckout(null)}
          footer={
            <>
              <Btn onClick={() => setCheckout(null)}>Cancel</Btn>
              <Btn tone="primary" onClick={() => doCheckout(checkout)}>Check out and take key</Btn>
            </>
          }
        >
          <p>
            Check out <span className="font-semibold">{checkout.guest_name}</span> from room {checkout.room_number}? Settle the bill in eZee as usual.
          </p>
        </Modal>
      )}
    </>
  )
}

export function CheckoutsView({ data }: { data: StaffData }) {
  const toast = useToast()
  const byId = useMemo(() => new Map(data.reservations.map((r) => [r.id, r])), [data.reservations])
  const today = hotelToday()
  const departing = data.reservations.filter((r) => r.status === 'in_house' && r.departure_date <= today)

  const toggleKey = async (id: string, v: boolean) => {
    const { error } = await supabase.from('checkouts').update({ key_returned: v }).eq('id', id)
    if (error) return toast(errorText(errorCode(error)), 'error')
    data.reload('checkouts')
  }

  return (
    <>
      <PageHead title="Check-outs" sub="Tablet and desk check-outs from the last 30 days." />
      {departing.length > 0 && (
        <Panel title={`Still to check out today (${departing.length})`} className="mb-6">
          <ul className="divide-y divide-line">
            {departing.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 px-5 py-3">
                <span>
                  <span className="font-medium">{r.guest_name}</span> <span className="text-muted">· room {r.room_number}</span>
                </span>
                <span className="text-sm text-muted">Due {fmtDate(r.departure_date)}</span>
              </li>
            ))}
          </ul>
        </Panel>
      )}
      <Panel>
        {data.checkouts.length === 0 ? (
          <Empty>No check-outs yet.</Empty>
        ) : (
          <ul className="divide-y divide-line">
            {data.checkouts.map((c) => {
              const r = byId.get(c.reservation_id)
              return (
                <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
                  <div>
                    <div className="font-medium">{r?.guest_name ?? 'Guest'}</div>
                    <div className="text-sm text-muted">
                      Room {r?.room_number ?? '—'} · {fmtDate(c.created_at)} {fmtTime(c.created_at)} · {c.device_id ? 'Tablet' : 'Desk'}
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <Stars n={c.rating} />
                    <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm">
                      <input type="checkbox" checked={c.key_returned} onChange={(e) => toggleKey(c.id, e.target.checked)} className="h-5 w-5 accent-forest" />
                      Key returned
                    </label>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </Panel>
    </>
  )
}

export function FeedbackView({ data, now }: { data: StaffData; now: number }) {
  const toast = useToast()
  const byId = useMemo(() => new Map(data.reservations.map((r) => [r.id, r])), [data.reservations])
  const [showResolved, setShowResolved] = useState(false)
  const list = data.feedback.filter((f) => showResolved || !f.resolved)
  const toggle = async (id: string, resolved: boolean) => {
    const { data: u } = await supabase.auth.getUser()
    const { error } = await supabase.from('feedback').update({ resolved, resolved_by: resolved ? u.user?.id ?? null : null }).eq('id', id)
    if (error) return toast(errorText(errorCode(error)), 'error')
    data.reload('feedback')
  }
  return (
    <>
      <PageHead
        title="Guest feedback"
        sub="Private feedback from check-out ratings of 1 to 3. Guests who rate 4 or 5 see the public review QR code."
        action={
          <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm">
            <input type="checkbox" checked={showResolved} onChange={(e) => setShowResolved(e.target.checked)} className="h-5 w-5 accent-forest" />
            Show resolved
          </label>
        }
      />
      {list.length === 0 ? (
        <Panel>
          <Empty>No open feedback. Well done.</Empty>
        </Panel>
      ) : (
        <ul className="space-y-3">
          {list.map((f) => {
            const r = f.reservation_id ? byId.get(f.reservation_id) : undefined
            return (
              <li key={f.id} className={`card fade-in !rounded-2xl p-5 transition ${f.resolved ? 'opacity-60' : ''}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">
                    {r?.guest_name ?? 'Guest'} <span className="font-normal text-muted">· room {r?.room_number ?? '—'} · {timeAgo(f.created_at, now)}</span>
                  </span>
                  <Stars n={f.rating} />
                </div>
                <p className="mt-2 whitespace-pre-wrap text-ink">{f.comment || <span className="text-muted">(no comment)</span>}</p>
                <Btn className="mt-3" tone={f.resolved ? 'ghost' : 'secondary'} onClick={() => toggle(f.id, !f.resolved)}>
                  {f.resolved ? 'Reopen' : 'Mark as resolved'}
                </Btn>
              </li>
            )
          })}
        </ul>
      )}
    </>
  )
}

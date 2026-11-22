import { useMemo, useState } from 'react'
import { ApiError, errorCode, rpc, supabase } from '../../lib/supabase'
import type { Reservation, StayStatus } from '../../lib/types'
import { fmtDate, hotelToday, nightsBetween, type StaffData } from '../data'
import { Btn, Empty, Field, Modal, PageHead, Panel, StatusChip, errorText, useToast } from '../kit'

const SOURCES = ['Direct', 'Booking.com', 'Expedia', 'Agoda', 'Airbnb', 'Trip.com', 'Phone', 'Walk-in', 'Travel agent', 'Other']
const ROOM_TYPES = ['Standard Double', 'Deluxe Double', 'Twin Room', 'Junior Suite', 'Residence Suite', 'Family Room']

type Draft = {
  booking_ref: string
  guest_name: string
  source: string
  room_type: string
  room_number: string
  arrival_date: string
  departure_date: string
  adults: number
  breakfast: boolean
  notes: string
  status: StayStatus
}

function toDraft(r?: Reservation): Draft {
  return {
    booking_ref: r?.booking_ref ?? '',
    guest_name: r?.guest_name ?? '',
    source: r?.source ?? 'Direct',
    room_type: r?.room_type ?? '',
    room_number: r?.room_number ?? '',
    arrival_date: r?.arrival_date ?? hotelToday(),
    departure_date: r?.departure_date ?? hotelToday(1),
    adults: r?.adults ?? 1,
    breakfast: r?.breakfast ?? true,
    notes: r?.notes ?? '',
    status: r?.status ?? 'expected',
  }
}

export function ReservationModal({ r, onClose, reload }: { r?: Reservation; onClose: () => void; reload: StaffData['reload'] }) {
  const toast = useToast()
  const [d, setD] = useState<Draft>(toDraft(r))
  const [busy, setBusy] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const valid = d.booking_ref.trim() && d.guest_name.trim() && d.arrival_date && d.departure_date > d.arrival_date

  const save = async () => {
    setBusy(true)
    const row = {
      ...d,
      room_number: d.room_number.trim() || null,
      notes: d.notes.trim() || null,
      adults: Math.max(1, Math.min(20, Number(d.adults) || 1)),
    }
    const { error } = r ? await supabase.from('reservations').update(row).eq('id', r.id) : await supabase.from('reservations').insert(row)
    setBusy(false)
    if (error) return toast(error.code === '23505' ? errorText('duplicate') : errorText(errorCode(error)), 'error')
    toast(r ? 'Booking updated' : 'Booking added')
    reload('reservations')
    onClose()
  }
  const remove = async () => {
    if (!r) return
    if (!confirmDelete) return setConfirmDelete(true)
    const { error } = await supabase.from('reservations').delete().eq('id', r.id)
    if (error) return toast(errorText(errorCode(error)), 'error')
    toast('Booking deleted')
    reload()
    onClose()
  }

  return (
    <Modal
      title={r ? 'Edit booking' : 'Add booking'}
      onClose={onClose}
      wide
      footer={
        <>
          {r && (
            <Btn tone="danger" className="mr-auto" onClick={remove}>
              {confirmDelete ? 'Tap again to delete' : 'Delete'}
            </Btn>
          )}
          <Btn onClick={onClose}>Cancel</Btn>
          <Btn tone="primary" disabled={!valid || busy} onClick={save}>
            {r ? 'Save changes' : 'Add booking'}
          </Btn>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Booking number" value={d.booking_ref} onChange={(e) => setD({ ...d, booking_ref: e.target.value })} required autoFocus={!r} />
        <Field label="Guest name (as on the booking)" value={d.guest_name} onChange={(e) => setD({ ...d, guest_name: e.target.value })} required hint="Latin letters help the passport match." />
        <div>
          <label htmlFor="src" className="mb-1.5 block text-sm font-medium">Source</label>
          <select id="src" value={d.source} onChange={(e) => setD({ ...d, source: e.target.value })} className="min-h-11 w-full rounded-lg border border-line bg-white px-3">
            {SOURCES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </div>
        <div>
          <Field label="Room type" list="room-types" value={d.room_type} onChange={(e) => setD({ ...d, room_type: e.target.value })} />
          <datalist id="room-types">
            {ROOM_TYPES.map((t) => (
              <option key={t} value={t} />
            ))}
          </datalist>
        </div>
        <Field label="Arrival" type="date" value={d.arrival_date} onChange={(e) => setD({ ...d, arrival_date: e.target.value })} />
        <Field
          label="Departure"
          type="date"
          value={d.departure_date}
          min={d.arrival_date}
          onChange={(e) => setD({ ...d, departure_date: e.target.value })}
          hint={d.departure_date > d.arrival_date ? `${nightsBetween(d.arrival_date, d.departure_date)} nights` : 'Must be after arrival'}
        />
        <Field label="Guests" type="number" min={1} max={20} value={d.adults} onChange={(e) => setD({ ...d, adults: Number(e.target.value) })} />
        <Field label="Room number (optional)" value={d.room_number} onChange={(e) => setD({ ...d, room_number: e.target.value })} hint="Can also be set when giving the key." />
        <label className="flex min-h-11 cursor-pointer items-center gap-3 sm:col-span-2">
          <input type="checkbox" checked={d.breakfast} onChange={(e) => setD({ ...d, breakfast: e.target.checked })} className="h-5 w-5 accent-forest" />
          <span className="text-sm font-medium">Breakfast included</span>
        </label>
        {r && (
          <div>
            <label htmlFor="st" className="mb-1.5 block text-sm font-medium">Status</label>
            <select id="st" value={d.status} onChange={(e) => setD({ ...d, status: e.target.value as StayStatus })} className="min-h-11 w-full rounded-lg border border-line bg-white px-3">
              <option value="expected">Expected</option>
              <option value="pending_desk">At the desk</option>
              <option value="in_house">In house</option>
              <option value="checked_out">Checked out</option>
              <option value="cancelled">Cancelled</option>
              <option value="no_show">No-show</option>
            </select>
          </div>
        )}
        <div className={r ? '' : 'sm:col-span-2'}>
          <Field label="Notes (optional)" value={d.notes} maxLength={500} onChange={(e) => setD({ ...d, notes: e.target.value })} />
        </div>
      </div>
    </Modal>
  )
}

/* CSV import ---------------------------------------------------------------- */

const TEMPLATE =
  'booking_ref,guest_name,source,room_type,arrival_date,departure_date,adults,breakfast,room_number,notes\n' +
  `BK-10001,Anna Example,Booking.com,Deluxe Double,${hotelToday()},${hotelToday(3)},2,yes,,\n`

function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let q = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (q) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"'
        i++
      } else if (ch === '"') q = false
      else cell += ch
    } else if (ch === '"') q = true
    else if (ch === ',' || ch === ';' || ch === '\t') {
      row.push(cell)
      cell = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
    } else cell += ch
  }
  if (cell || row.length) {
    row.push(cell)
    rows.push(row)
  }
  return rows.filter((r) => r.some((c) => c.trim()))
}

function normDate(s: string): string | null {
  const t = s.trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t
  const m = t.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/)
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
  return null
}

export function ImportModal({ onClose, reload }: { onClose: () => void; reload: StaffData['reload'] }) {
  const toast = useToast()
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)

  const parsed = useMemo(() => {
    const rows = parseCsv(text)
    if (rows.length < 2) return { ok: [], bad: 0 }
    const head = rows[0].map((h) => h.trim().toLowerCase())
    const idx = (k: string) => head.indexOf(k)
    const ok: Record<string, unknown>[] = []
    let bad = 0
    for (const r of rows.slice(1)) {
      const get = (k: string) => (idx(k) >= 0 ? (r[idx(k)] ?? '').trim() : '')
      const a = normDate(get('arrival_date'))
      const d = normDate(get('departure_date'))
      if (!get('booking_ref') || !get('guest_name') || !a || !d || d <= a) {
        bad++
        continue
      }
      ok.push({
        booking_ref: get('booking_ref'),
        guest_name: get('guest_name'),
        source: get('source') || 'Direct',
        room_type: get('room_type'),
        arrival_date: a,
        departure_date: d,
        adults: Math.max(1, Math.min(20, Number(get('adults')) || 1)),
        breakfast: /^(y|yes|true|1|да|ҳа)$/i.test(get('breakfast')),
        room_number: get('room_number') || null,
        notes: get('notes') || null,
      })
    }
    return { ok, bad }
  }, [text])

  const run = async () => {
    setBusy(true)
    const { error } = await supabase.from('reservations').upsert(parsed.ok, { onConflict: 'booking_ref' })
    setBusy(false)
    if (error) return toast(errorText(errorCode(error)), 'error')
    toast(`Imported ${parsed.ok.length} bookings`)
    reload('reservations')
    onClose()
  }

  return (
    <Modal
      title="Import bookings"
      onClose={onClose}
      wide
      footer={
        <>
          <a
            className="mr-auto inline-flex min-h-11 items-center text-sm font-medium text-forest underline-offset-4 hover:underline"
            href={`data:text/csv;charset=utf-8,${encodeURIComponent(TEMPLATE)}`}
            download="rumi-bookings-template.csv"
          >
            Download template
          </a>
          <Btn onClick={onClose}>Cancel</Btn>
          <Btn tone="primary" disabled={!parsed.ok.length || busy} onClick={run}>
            Import {parsed.ok.length || ''} bookings
          </Btn>
        </>
      }
    >
      <p className="text-sm text-muted">
        Paste a CSV export (for example from eZee or a channel manager) or choose a file. Columns: booking_ref, guest_name, source, room_type,
        arrival_date, departure_date, adults, breakfast, room_number, notes. Existing booking numbers are updated.
      </p>
      <input
        type="file"
        accept=".csv,text/csv"
        className="mt-4 block text-sm file:mr-3 file:min-h-11 file:cursor-pointer file:rounded-lg file:border file:border-line file:bg-white file:px-4 file:font-medium file:text-forest"
        onChange={async (e) => {
          const f = e.target.files?.[0]
          if (f) setText(await f.text())
        }}
      />
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={8}
        placeholder={TEMPLATE}
        aria-label="CSV content"
        className="mt-3 w-full rounded-lg border border-line bg-white p-3 font-mono text-xs focus:border-forest focus:outline-none"
      />
      {text && (
        <p className="mt-2 text-sm">
          <span className="font-medium text-forest">{parsed.ok.length} ready to import</span>
          {parsed.bad > 0 && <span className="text-danger"> · {parsed.bad} rows skipped (missing booking number, name or valid dates)</span>}
        </p>
      )}
    </Modal>
  )
}

/* Desk check-in (guest checks in with staff, not the tablet) ---------------- */

export function DeskCheckinModal({ r, onClose, reload }: { r: Reservation; onClose: () => void; reload: StaffData['reload'] }) {
  const toast = useToast()
  const [room, setRoom] = useState(r.room_number ?? '')
  const save = async () => {
    const { error } = await supabase.from('reservations').update({ status: 'in_house', room_number: room.trim() }).eq('id', r.id)
    if (error) return toast(errorText(errorCode(error)), 'error')
    toast(`${r.guest_name} checked in to room ${room.trim()}`)
    reload('reservations')
    onClose()
  }
  return (
    <Modal
      title="Check in at the desk"
      onClose={onClose}
      footer={
        <>
          <Btn onClick={onClose}>Cancel</Btn>
          <Btn tone="primary" disabled={!room.trim()} onClick={save}>
            Check in
          </Btn>
        </>
      }
    >
      <p className="text-muted">
        <span className="font-medium text-ink">{r.guest_name}</span> · {r.booking_ref} · {fmtDate(r.arrival_date)} – {fmtDate(r.departure_date)}
      </p>
      <Field label="Room number" value={room} onChange={(e) => setRoom(e.target.value)} className="mt-4" autoFocus inputMode="numeric" />
    </Modal>
  )
}

/* View ------------------------------------------------------------------------ */

type Range = 'today' | 'tomorrow' | 'week' | 'all'

export function ArrivalsView({ data }: { data: StaffData }) {
  const [range, setRange] = useState<Range>('today')
  const [q, setQ] = useState('')
  const [edit, setEdit] = useState<Reservation | 'new' | null>(null)
  const [importing, setImporting] = useState(false)
  const [desk, setDesk] = useState<Reservation | null>(null)
  const toast = useToast()
  const today = hotelToday()
  const tablets = data.devices.filter((d) => d.paired_at && !d.revoked)
  const [sending, setSending] = useState<string | null>(null)
  const sendToTablet = async (r: Reservation, deviceId?: string) => {
    if (sending) return
    const dev = deviceId ?? (tablets.length === 1 ? tablets[0].id : undefined)
    if (!dev) return toast(tablets.length ? 'Choose a tablet.' : 'No paired tablet.', 'error')
    setSending(r.id)
    try {
      await rpc('staff_send_to_tablet', { p_reservation_id: r.id, p_device_id: dev })
      toast(`${r.guest_name} sent to ${tablets.find((t) => t.id === dev)?.name ?? 'tablet'}`)
    } catch (e) {
      toast(errorText(e instanceof ApiError ? e.code : 'unknown_error'), 'error')
    } finally {
      setSending(null)
    }
  }

  const list = useMemo(() => {
    const term = q.trim().toLowerCase()
    return data.reservations.filter((r) => {
      if (term) return r.guest_name.toLowerCase().includes(term) || r.booking_ref.toLowerCase().includes(term) || (r.room_number ?? '').includes(term)
      if (range === 'today') return r.arrival_date === today
      if (range === 'tomorrow') return r.arrival_date === hotelToday(1)
      if (range === 'week') return r.arrival_date >= today && r.arrival_date <= hotelToday(7)
      return r.arrival_date >= today
    })
  }, [data.reservations, q, range, today])

  const ranges: [Range, string][] = [
    ['today', 'Today'],
    ['tomorrow', 'Tomorrow'],
    ['week', 'Next 7 days'],
    ['all', 'All upcoming'],
  ]

  return (
    <>
      <PageHead
        title="Arrivals"
        sub="Bookings guests can find on the tablet. Add them by hand or import a CSV."
        action={
          <>
            <Btn onClick={() => setImporting(true)}>Import CSV</Btn>
            <Btn tone="primary" onClick={() => setEdit('new')}>Add booking</Btn>
          </>
        }
      />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex rounded-xl border border-line bg-white p-1" role="tablist" aria-label="Date range">
          {ranges.map(([k, label]) => (
            <button
              key={k}
              role="tab"
              aria-selected={range === k && !q}
              onClick={() => {
                setRange(k)
                setQ('')
              }}
              className={`min-h-10 cursor-pointer rounded-lg px-3.5 text-sm font-medium transition ${range === k && !q ? 'bg-forest text-cream' : 'text-muted hover:text-forest'}`}
            >
              {label}
            </button>
          ))}
        </div>
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name, booking number or room"
          aria-label="Search bookings"
          className="min-h-11 min-w-0 flex-1 rounded-xl border border-line bg-white px-4 text-sm focus:border-forest focus:outline-none sm:max-w-xs"
        />
      </div>
      <Panel>
        {list.length === 0 ? (
          <Empty>{q ? 'No bookings match your search.' : 'No arrivals in this period.'}</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-[15px]">
              <thead className="border-b border-line bg-cream/60 text-xs tracking-wider text-label">
                <tr>
                  {['GUEST', 'BOOKING', 'STAY', 'ROOM', 'STATUS', ''].map((h) => (
                    <th key={h} scope="col" className="px-5 py-3 font-semibold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {list.map((r) => (
                  <tr key={r.id} className="transition hover:bg-cream/40">
                    <td className="px-5 py-3.5">
                      <div className="font-medium">{r.guest_name}</div>
                      <div className="text-sm text-muted">{r.adults} {r.adults === 1 ? 'guest' : 'guests'}{r.breakfast ? ' · breakfast' : ''}</div>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="font-mono text-sm">{r.booking_ref}</div>
                      <div className="text-sm text-muted">{r.source}</div>
                    </td>
                    <td className="whitespace-nowrap px-5 py-3.5">
                      <div>{fmtDate(r.arrival_date)} – {fmtDate(r.departure_date)}</div>
                      <div className="text-sm text-muted">{nightsBetween(r.arrival_date, r.departure_date)} nights</div>
                    </td>
                    <td className="px-5 py-3.5">
                      <div>{r.room_type || '—'}</div>
                      <div className="text-sm text-muted">{r.room_number ? `No. ${r.room_number}` : 'Not assigned'}</div>
                    </td>
                    <td className="px-5 py-3.5"><StatusChip status={r.status} /></td>
                    <td className="px-5 py-3.5">
                      <div className="flex justify-end gap-2">
                        {r.status === 'expected' && r.arrival_date <= today && tablets.length > 0 && (
                          tablets.length === 1 ? (
                            <Btn tone="gold" disabled={sending === r.id} onClick={() => sendToTablet(r)} title="Shows this booking on the tablet for the guest to confirm and sign">{sending === r.id ? 'Sending…' : 'Send to tablet'}</Btn>
                          ) : (
                            <select
                              aria-label={`Send ${r.guest_name} to a tablet`}
                              value=""
                              disabled={sending === r.id}
                              onChange={(e) => e.target.value && sendToTablet(r, e.target.value)}
                              className="min-h-11 rounded-lg border border-line bg-gold-light px-2 text-sm font-medium"
                            >
                              <option value="">Send to tablet…</option>
                              {tablets.map((t) => (
                                <option key={t.id} value={t.id}>{t.name}</option>
                              ))}
                            </select>
                          )
                        )}
                        {r.status === 'expected' && r.arrival_date <= today && (
                          <Btn tone="ghost" onClick={() => setDesk(r)}>Check in</Btn>
                        )}
                        <Btn onClick={() => setEdit(r)}>Edit</Btn>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
      {edit && <ReservationModal r={edit === 'new' ? undefined : edit} onClose={() => setEdit(null)} reload={data.reload} />}
      {importing && <ImportModal onClose={() => setImporting(false)} reload={data.reload} />}
      {desk && <DeskCheckinModal r={desk} onClose={() => setDesk(null)} reload={data.reload} />}
    </>
  )
}

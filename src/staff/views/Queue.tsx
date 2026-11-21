import { useEffect, useMemo, useState } from 'react'
import { ApiError, rpc, supabase, errorCode } from '../../lib/supabase'
import type { Checkin, CheckinGuest, Reservation } from '../../lib/types'
import { CarIcon, CheckIcon, Spinner } from '../../ui'
import { fmtDate, fmtTime, nightsBetween, timeAgo, type StaffData } from '../data'
import { Btn, Chip, Drawer, Empty, Field, PageHead, Panel, errorText, useToast } from '../kit'

const LANG_LABEL: Record<string, string> = { en: 'English', ru: 'Russian', tg: 'Tajik' }

export function isExpired(c: Checkin) {
  return !!c.expiry_date && c.expiry_date < new Date().toISOString().slice(0, 10)
}

export function CheckinRow({ c, r, onOpen, now }: { c: Checkin; r?: Reservation; onOpen: () => void; now: number }) {
  return (
    <button type="button" onClick={onOpen} className="flex w-full cursor-pointer items-center gap-4 px-5 py-4 text-left transition hover:bg-cream/60">
      <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${c.status === 'waiting' ? 'bg-gold' : c.status === 'approved' ? 'bg-forest' : 'bg-danger'}`} aria-hidden="true" />
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          {c.desk_code && <span className="rounded-md bg-forest px-2 py-0.5 font-mono text-sm font-semibold tracking-wider text-gold-light">{c.desk_code}</span>}
          <span className="font-semibold">{r?.guest_name ?? 'Unknown booking'}</span>
          {c.doc_source === 'mrz' && c.mrz_valid && <Chip className="border-forest/30 bg-forest/10 text-forest"><CheckIcon className="h-3 w-3" /> Passport read</Chip>}
          {c.doc_source === 'none' && <Chip className="border-label/40 bg-gold-light/50 text-ink">No passport scan</Chip>}
          {isExpired(c) && <Chip className="border-danger/30 bg-[#FDF1EC] text-danger">Passport expired</Chip>}
          {c.shuttle && <Chip><CarIcon className="h-3.5 w-3.5" /> Shuttle</Chip>}
        </span>
        <span className="mt-0.5 block text-sm text-muted">
          {r ? `${r.booking_ref} · ${r.source} · ${r.room_type || 'Room'} · ${nightsBetween(r.arrival_date, r.departure_date)} nights` : ''}
        </span>
      </span>
      <span className="shrink-0 text-right text-sm">
        <span className="block font-medium text-ink">{c.status === 'waiting' ? 'Waiting' : c.status === 'approved' ? 'Key given' : 'Sent back'}</span>
        <span className="text-muted">{timeAgo(c.created_at, now)}</span>
      </span>
    </button>
  )
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-2">
      <dt className="text-muted">{k}</dt>
      <dd className="text-right font-medium">{v ?? <span className="font-normal text-muted">—</span>}</dd>
    </div>
  )
}

export function CheckinDrawer({ c, r, guests = [], onClose, reload }: { c: Checkin; r?: Reservation; guests?: CheckinGuest[]; onClose: () => void; reload: StaffData['reload'] }) {
  const toast = useToast()
  const [signature, setSignature] = useState<string | null | undefined>(undefined)
  const [room, setRoom] = useState(r?.room_number ?? '')
  const [busy, setBusy] = useState<'approve' | 'reject' | 'save' | null>(null)
  const [confirmReject, setConfirmReject] = useState(false)
  const [editing, setEditing] = useState(false)
  const [doc, setDoc] = useState({
    surname: c.surname ?? '',
    given_names: c.given_names ?? '',
    nationality: c.nationality ?? '',
    document_number: c.document_number ?? '',
    birth_date: c.birth_date ?? '',
    expiry_date: c.expiry_date ?? '',
    sex: c.sex ?? '',
  })

  useEffect(() => {
    supabase
      .from('checkins')
      .select('signature_png')
      .eq('id', c.id)
      .maybeSingle()
      .then(({ data }) => setSignature((data?.signature_png as string | null) ?? null))
  }, [c.id])

  const approve = async () => {
    setBusy('approve')
    try {
      await rpc('approve_checkin', { p_checkin_id: c.id, p_room_number: room.trim() })
      toast(`${r?.guest_name ?? 'Guest'} checked in to room ${room.trim()}`)
      reload('checkins')
      reload('reservations')
      onClose()
    } catch (e) {
      toast(errorText(e instanceof ApiError ? e.code : 'unknown_error'), 'error')
      setBusy(null)
    }
  }
  const reject = async () => {
    if (!confirmReject) return setConfirmReject(true)
    setBusy('reject')
    try {
      await rpc('reject_checkin', { p_checkin_id: c.id })
      toast('Check-in sent back. The booking is expected again.')
      reload('checkins')
      reload('reservations')
      onClose()
    } catch (e) {
      toast(errorText(e instanceof ApiError ? e.code : 'unknown_error'), 'error')
      setBusy(null)
    }
  }
  const saveDoc = async () => {
    setBusy('save')
    const patch = {
      surname: doc.surname.trim().toUpperCase() || null,
      given_names: doc.given_names.trim().toUpperCase() || null,
      nationality: doc.nationality.trim().toUpperCase().slice(0, 3) || null,
      document_number: doc.document_number.trim().toUpperCase() || null,
      birth_date: doc.birth_date || null,
      expiry_date: doc.expiry_date || null,
      sex: (doc.sex || null) as Checkin['sex'],
      doc_source: 'manual' as const,
      doc_type: c.doc_type ?? 'P',
    }
    const { error } = await supabase.from('checkins').update(patch).eq('id', c.id)
    setBusy(null)
    if (error) return toast(errorText(errorCode(error)), 'error')
    toast('Passport details saved')
    setEditing(false)
    reload('checkins')
  }

  const purged = !!c.data_purged_at
  return (
    <Drawer
      onClose={onClose}
      title={
        <>
          <p className="eyebrow">Tablet check-in{c.desk_code ? ` ${c.desk_code}` : ''} · {fmtTime(c.created_at)}</p>
          <h2 className="mt-1 truncate text-3xl text-forest">{r?.guest_name ?? 'Unknown booking'}</h2>
        </>
      }
      footer={
        c.status === 'waiting' ? (
          <div className="flex flex-wrap items-end gap-3">
            <Field label="Room number" value={room} onChange={(e) => setRoom(e.target.value)} className="w-36" inputMode="numeric" />
            <Btn tone="primary" className="flex-1 !min-h-11" disabled={!room.trim() || !!busy} onClick={approve}>
              {busy === 'approve' && <Spinner className="h-4 w-4" />} Approve &amp; give key
            </Btn>
            <Btn tone="danger" disabled={!!busy} onClick={reject}>
              {confirmReject ? 'Confirm send back' : 'Send back'}
            </Btn>
          </div>
        ) : (
          <p className="text-sm text-muted">
            {c.status === 'approved' ? `Approved ${c.approved_at ? `at ${fmtTime(c.approved_at)}` : ''} · room ${r?.room_number ?? '—'}` : 'Sent back to expected.'}
          </p>
        )
      }
    >
      <div className="space-y-6">
        {c.status === 'waiting' && (
          <div className="rounded-xl bg-gold-light/40 px-4 py-3 text-sm text-ink">
            Check the guest's passport against the details below, then give the key.
          </div>
        )}

        <section>
          <h3 className="eyebrow">Booking</h3>
          {r ? (
            <dl className="mt-2 divide-y divide-line text-[15px]">
              <Row k="Booking number" v={r.booking_ref} />
              <Row k="Source" v={r.source} />
              <Row k="Room type" v={r.room_type} />
              <Row k="Stay" v={`${fmtDate(r.arrival_date)} – ${fmtDate(r.departure_date)} · ${nightsBetween(r.arrival_date, r.departure_date)} nights`} />
              <Row k="Guests" v={r.adults} />
              <Row k="Breakfast" v={r.breakfast ? 'Included' : 'Not included'} />
              {r.notes && <Row k="Notes" v={r.notes} />}
            </dl>
          ) : (
            <p className="mt-2 text-muted">Booking not found.</p>
          )}
        </section>

        <section>
          <div className="flex items-center justify-between gap-3">
            <h3 className="eyebrow">Passport</h3>
            {!purged && !editing && (
              <Btn tone="ghost" className="!min-h-9" onClick={() => setEditing(true)}>
                {c.doc_source === 'none' ? 'Enter details' : 'Edit'}
              </Btn>
            )}
          </div>
          {purged ? (
            <p className="mt-2 text-muted">Guest data was deleted after the retention period.</p>
          ) : editing ? (
            <div className="mt-3 grid grid-cols-2 gap-3">
              <Field label="Surname" value={doc.surname} onChange={(e) => setDoc({ ...doc, surname: e.target.value })} />
              <Field label="Given names" value={doc.given_names} onChange={(e) => setDoc({ ...doc, given_names: e.target.value })} />
              <Field label="Nationality (3 letters)" value={doc.nationality} maxLength={3} onChange={(e) => setDoc({ ...doc, nationality: e.target.value })} />
              <Field label="Document number" value={doc.document_number} onChange={(e) => setDoc({ ...doc, document_number: e.target.value })} />
              <Field label="Date of birth" type="date" value={doc.birth_date} onChange={(e) => setDoc({ ...doc, birth_date: e.target.value })} />
              <Field label="Expiry date" type="date" value={doc.expiry_date} onChange={(e) => setDoc({ ...doc, expiry_date: e.target.value })} />
              <div>
                <label htmlFor="sex" className="mb-1.5 block text-sm font-medium">Sex</label>
                <select id="sex" value={doc.sex} onChange={(e) => setDoc({ ...doc, sex: e.target.value })} className="min-h-11 w-full rounded-lg border border-line bg-white px-3">
                  <option value="">—</option>
                  <option value="F">F</option>
                  <option value="M">M</option>
                  <option value="X">X</option>
                </select>
              </div>
              <div className="col-span-2 flex justify-end gap-2">
                <Btn onClick={() => setEditing(false)}>Cancel</Btn>
                <Btn tone="primary" onClick={saveDoc} disabled={busy === 'save'}>Save</Btn>
              </div>
            </div>
          ) : c.doc_source === 'none' ? (
            <p className="mt-2 rounded-lg border border-dashed border-line px-4 py-3 text-muted">
              Passport not scanned on the tablet. Scan it at reception{c.desk_code ? ` (guest shows number ${c.desk_code})` : ''}, or enter the details here.
            </p>
          ) : (
            <>
              <dl className="mt-2 divide-y divide-line text-[15px]">
                <Row k="Name" v={`${c.surname ?? ''}, ${c.given_names ?? ''}`} />
                <Row k="Nationality" v={c.nationality} />
                <Row k="Document" v={`${c.doc_type ?? ''} ${c.document_number ?? ''}`} />
                <Row k="Issued by" v={c.issuing_country} />
                <Row k="Date of birth" v={c.birth_date ? fmtDate(c.birth_date, { day: 'numeric', month: 'short', year: 'numeric' }) : null} />
                <Row k="Sex" v={c.sex} />
                <Row
                  k="Expiry"
                  v={
                    c.expiry_date ? (
                      <span className={isExpired(c) ? 'text-danger' : ''}>
                        {fmtDate(c.expiry_date, { day: 'numeric', month: 'short', year: 'numeric' })}
                        {isExpired(c) && ' (expired)'}
                      </span>
                    ) : null
                  }
                />
              </dl>
              <p className="mt-2 text-xs text-muted">
                {c.doc_source === 'mrz'
                  ? c.mrz_valid
                    ? 'Read from the passport MRZ on the tablet. Document number, birth date and expiry check digits passed.'
                    : 'Read from the passport MRZ; some check digits did not pass. Please verify.'
                  : 'Entered by staff.'}
              </p>
            </>
          )}
        </section>

        {guests.length > 0 && (
          <section>
            <h3 className="eyebrow">Additional guests ({guests.length})</h3>
            <ul className="mt-2 divide-y divide-line text-[15px]">
              {guests.map((g) => (
                <li key={g.id} className="py-2">
                  <div className="font-medium">{g.surname}, {g.given_names}</div>
                  <div className="text-sm text-muted">
                    {g.nationality} · {g.document_number} · born {g.birth_date ? fmtDate(g.birth_date, { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                    {g.ezee_error && <span className="text-danger"> · eZee: {g.ezee_error}</span>}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {r?.ezee_booking_id && (
          <section>
            <h3 className="eyebrow">eZee FrontDesk</h3>
            <p className={`mt-2 text-[15px] ${c.ezee_error ? 'text-danger' : ''}`}>
              {c.ezee_synced_at ? `Sent to eZee booking ${r.ezee_booking_id} at ${fmtTime(c.ezee_synced_at)}.` : c.ezee_error ? c.ezee_error : 'Waiting to be sent to eZee.'}
              {r.ezee_status && <span className="text-muted"> eZee status: {r.ezee_status}.</span>}
            </p>
          </section>
        )}

        <section>
          <h3 className="eyebrow">Guest details</h3>
          <dl className="mt-2 divide-y divide-line text-[15px]">
            <Row k="Phone" v={c.phone} />
            <Row k="Email" v={c.email} />
            <Row k="Language" v={LANG_LABEL[c.language] ?? c.language} />
            <Row k="Airport shuttle" v={c.shuttle ? 'Requested' : 'No'} />
            <Row k="Consent" v={`Given ${fmtDate(c.consent_at)} ${fmtTime(c.consent_at)}`} />
          </dl>
        </section>

        <section>
          <h3 className="eyebrow">Signature</h3>
          <div className="mt-2 flex h-40 items-center justify-center overflow-hidden rounded-xl border border-line bg-white">
            {signature === undefined ? (
              <Spinner className="h-5 w-5 text-muted" />
            ) : signature ? (
              <img src={signature} alt="Guest signature" className="max-h-full max-w-full object-contain" />
            ) : (
              <span className="text-sm text-muted">No signature stored</span>
            )}
          </div>
        </section>
      </div>
    </Drawer>
  )
}

export function QueueView({ data, now, openId, setOpenId }: { data: StaffData; now: number; openId: string | null; setOpenId: (id: string | null) => void }) {
  const byId = useMemo(() => new Map(data.reservations.map((r) => [r.id, r])), [data.reservations])
  const waiting = data.checkins.filter((c) => c.status === 'waiting')
  const recent = data.checkins.filter((c) => c.status !== 'waiting').slice(0, 30)
  const open = data.checkins.find((c) => c.id === openId)
  return (
    <>
      <PageHead title="Tablet check-ins" sub="Guests who checked in on a tablet. Check the passport, then approve and give the key." />
      <Panel title={`Waiting at the desk (${waiting.length})`}>
        {waiting.length === 0 ? (
          <Empty>No one is waiting. New tablet check-ins appear here instantly.</Empty>
        ) : (
          <div className="divide-y divide-line">
            {waiting.map((c) => (
              <div key={c.id} className="fade-in">
                <CheckinRow c={c} r={byId.get(c.reservation_id)} now={now} onOpen={() => setOpenId(c.id)} />
              </div>
            ))}
          </div>
        )}
      </Panel>
      <Panel title="Recently handled" className="mt-6">
        {recent.length === 0 ? (
          <Empty>Nothing yet.</Empty>
        ) : (
          <div className="divide-y divide-line">
            {recent.map((c) => (
              <CheckinRow key={c.id} c={c} r={byId.get(c.reservation_id)} now={now} onOpen={() => setOpenId(c.id)} />
            ))}
          </div>
        )}
      </Panel>
      {open && <CheckinDrawer key={open.id} c={open} r={byId.get(open.reservation_id)} guests={data.guests.filter((g) => g.checkin_id === open.id)} onClose={() => setOpenId(null)} reload={data.reload} />}
    </>
  )
}

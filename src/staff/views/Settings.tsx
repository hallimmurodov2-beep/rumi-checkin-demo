import { useEffect, useState } from 'react'
import { ApiError, errorCode, rpc, supabase } from '../../lib/supabase'
import type { Device, HotelSettings, Profile, Role } from '../../lib/types'
import { deviceOnline, timeAgo, type StaffData } from '../data'
import { Btn, Chip, Empty, Field, Modal, PageHead, Panel, errorText, useToast } from '../kit'

function HotelPanel({ settings, isAdmin, reload }: { settings: HotelSettings | null; isAdmin: boolean; reload: StaffData['reload'] }) {
  const toast = useToast()
  const [s, setS] = useState<HotelSettings | null>(settings)
  const [busy, setBusy] = useState(false)
  useEffect(() => setS(settings), [settings])
  if (!s) return null
  const save = async () => {
    setBusy(true)
    const { id: _id, updated_at: _u, ...patch } = s
    const { error } = await supabase.from('hotel_settings').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', 1)
    setBusy(false)
    if (error) return toast(errorText(errorCode(error)), 'error')
    toast('Settings saved')
    reload('settings')
  }
  const f = (k: keyof HotelSettings) => ({
    value: String(s[k] ?? ''),
    disabled: !isAdmin,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      setS({ ...s, [k]: typeof s[k] === 'number' ? Number(e.target.value) : e.target.value } as HotelSettings),
  })
  return (
    <Panel
      title="Hotel information shown on the tablets"
      action={isAdmin && <Btn tone="primary" disabled={busy} onClick={save}>Save</Btn>}
    >
      <div className="grid gap-4 p-5 sm:grid-cols-2">
        <Field label="Hotel name" {...f('hotel_name')} />
        <Field label="Breakfast hours" {...f('breakfast_hours')} hint='Shown as "Served daily 07:00 - 10:30 in the restaurant."' />
        <Field label="Guest Wi-Fi network" {...f('wifi_name')} />
        <Field label="Guest Wi-Fi password" {...f('wifi_password')} />
        <Field label="Public review link" type="url" {...f('review_url')} hint="Google or TripAdvisor review page. Shown as a QR code to guests who rate 4-5." className="sm:col-span-2" />
        <Field label="Idle reset (seconds)" type="number" min={30} max={300} {...f('idle_seconds')} hint="Tablet returns to the start after this long without a touch." />
        <Field label="Keep guest data (days after departure)" type="number" min={1} max={3650} {...f('retention_days')} hint="Passport details, contacts and signatures are deleted automatically after this." />
      </div>
      {!isAdmin && <p className="px-5 pb-5 text-sm text-muted">Only administrators can change these settings.</p>}
    </Panel>
  )
}

function PairingModal({ code, expires, name, onClose }: { code: string; expires: string; name: string; onClose: () => void }) {
  const [left, setLeft] = useState(() => Math.max(0, Math.round((new Date(expires).getTime() - Date.now()) / 1000)))
  useEffect(() => {
    const id = window.setInterval(() => setLeft(Math.max(0, Math.round((new Date(expires).getTime() - Date.now()) / 1000))), 1000)
    return () => window.clearInterval(id)
  }, [expires])
  return (
    <Modal title={`Pair "${name}"`} onClose={onClose} footer={<Btn tone="primary" onClick={onClose}>Done</Btn>}>
      <ol className="list-decimal space-y-1.5 pl-5 text-[15px]">
        <li>
          On the tablet, open <span className="font-mono font-medium">{window.location.host}/tablet</span>
        </li>
        <li>Enter this pairing code:</li>
      </ol>
      <p className="my-5 rounded-2xl bg-forest py-6 text-center font-mono text-5xl font-semibold tracking-[0.2em] text-gold-light">
        {code.slice(0, 4)}-{code.slice(4)}
      </p>
      <p className="text-center text-sm text-muted">
        {left > 0 ? `Valid for ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}` : 'Expired - create a new code.'}
      </p>
    </Modal>
  )
}

function TabletsPanel({ devices, isAdmin, reload, now }: { devices: Device[]; isAdmin: boolean; reload: StaffData['reload']; now: number }) {
  const toast = useToast()
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [pairing, setPairing] = useState<{ code: string; expires: string; name: string } | null>(null)
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null)

  const add = async () => {
    try {
      const res = await rpc<{ pairing_code: string; expires_at: string; name: string }>('create_device', { p_name: name.trim() })
      setAdding(false)
      setName('')
      setPairing({ code: res.pairing_code, expires: res.expires_at, name: res.name })
      reload('devices')
    } catch (e) {
      toast(errorText(e instanceof ApiError ? e.code : 'unknown_error'), 'error')
    }
  }
  const repair = async (d: Device) => {
    try {
      const res = await rpc<{ pairing_code: string; expires_at: string }>('reset_device_pairing', { p_device_id: d.id })
      setPairing({ code: res.pairing_code, expires: res.expires_at, name: d.name })
      reload('devices')
    } catch (e) {
      toast(errorText(e instanceof ApiError ? e.code : 'unknown_error'), 'error')
    }
  }
  const remove = async (d: Device) => {
    if (confirmRemove !== d.id) return setConfirmRemove(d.id)
    const { error } = await supabase.from('devices').delete().eq('id', d.id)
    if (error) return toast(errorText(errorCode(error)), 'error')
    toast(`${d.name} removed`)
    reload('devices')
  }

  return (
    <Panel title="Tablets" action={isAdmin && <Btn tone="primary" onClick={() => setAdding(true)}>Add tablet</Btn>}>
      {devices.length === 0 ? (
        <Empty>No tablets yet. Add one to get a pairing code.</Empty>
      ) : (
        <ul className="divide-y divide-line">
          {devices.map((d) => {
            const online = deviceOnline(d, now)
            const waitingPair = !d.paired_at
            return (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
                <div className="flex items-center gap-3">
                  <span className={`h-2.5 w-2.5 rounded-full ${online ? 'bg-forest shadow-[0_0_0_4px_rgb(14_59_46/0.15)]' : 'bg-line'}`} aria-hidden="true" />
                  <div>
                    <div className="font-medium">{d.name}</div>
                    <div className="text-sm text-muted">
                      {waitingPair ? 'Waiting to be paired' : online ? 'Online' : d.last_seen_at ? `Last seen ${timeAgo(d.last_seen_at, now)}` : 'Offline'}
                    </div>
                  </div>
                </div>
                {isAdmin && (
                  <div className="flex gap-2">
                    <Btn onClick={() => repair(d)}>{waitingPair ? 'New code' : 'Re-pair'}</Btn>
                    <Btn tone="danger" onClick={() => remove(d)}>{confirmRemove === d.id ? 'Confirm' : 'Remove'}</Btn>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
      {adding && (
        <Modal
          title="Add tablet"
          onClose={() => setAdding(false)}
          footer={
            <>
              <Btn onClick={() => setAdding(false)}>Cancel</Btn>
              <Btn tone="primary" disabled={!name.trim()} onClick={add}>Create pairing code</Btn>
            </>
          }
        >
          <Field label="Tablet name" placeholder="Lobby tablet 1" value={name} onChange={(e) => setName(e.target.value)} autoFocus maxLength={60} />
        </Modal>
      )}
      {pairing && <PairingModal {...pairing} onClose={() => setPairing(null)} />}
    </Panel>
  )
}

function TeamPanel({ profiles, me, reload }: { profiles: Profile[]; me: string; reload: StaffData['reload'] }) {
  const toast = useToast()
  const setRole = async (p: Profile, role: Role) => {
    try {
      await rpc('set_member_role', { p_user_id: p.user_id, p_role: role })
      toast(`${p.full_name || p.email} is now ${role === 'pending' ? 'without access' : role}`)
      reload('profiles')
    } catch (e) {
      toast(errorText(e instanceof ApiError ? e.code : 'unknown_error'), 'error')
    }
  }
  return (
    <Panel title="Team">
      <p className="border-b border-line px-5 py-3 text-sm text-muted">
        New staff create an account on the sign-in page, then appear here as "Pending". Give them Staff access, or Admin to manage settings, tablets and the team.
      </p>
      <ul className="divide-y divide-line">
        {profiles.map((p) => (
          <li key={p.user_id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
            <div>
              <div className="flex items-center gap-2 font-medium">
                {p.full_name || p.email}
                {p.user_id === me && <Chip>You</Chip>}
                {p.role === 'pending' && <Chip className="border-label/40 bg-gold-light/60 text-ink">Pending</Chip>}
              </div>
              <div className="text-sm text-muted">{p.email}</div>
            </div>
            <select
              aria-label={`Role for ${p.email}`}
              value={p.role}
              onChange={(e) => setRole(p, e.target.value as Role)}
              className="min-h-11 rounded-lg border border-line bg-white px-3 text-sm"
            >
              <option value="pending">No access</option>
              <option value="staff">Staff</option>
              <option value="admin">Admin</option>
            </select>
          </li>
        ))}
      </ul>
    </Panel>
  )
}

export function SettingsView({ data, isAdmin, profile, now }: { data: StaffData; isAdmin: boolean; profile: Profile; now: number }) {
  return (
    <>
      <PageHead title="Settings" sub={`Signed in as ${profile.full_name || profile.email} (${profile.role}).`} />
      <div className="space-y-6">
        <HotelPanel settings={data.settings} isAdmin={isAdmin} reload={data.reload} />
        <TabletsPanel devices={data.devices} isAdmin={isAdmin} reload={data.reload} now={now} />
        {isAdmin && <TeamPanel profiles={data.profiles} me={profile.user_id} reload={data.reload} />}
      </div>
    </>
  )
}

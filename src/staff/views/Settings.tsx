import { useEffect, useState } from 'react'
import { ApiError, errorCode, rpc, supabase } from '../../lib/supabase'
import type { Device, HotelSettings, IntegrationSettings, PartnerSettings, Profile, Role, SyncLogEntry } from '../../lib/types'
import { SUPABASE_URL } from '../../lib/supabase'
import { deviceOnline, fmtDate, fmtTime, timeAgo, type StaffData } from '../data'
import { Btn, Chip, Empty, Field, Modal, PageHead, Panel, errorText, useToast } from '../kit'
import { Markdown } from '../../lib/markdown'

function HotelPanel({ settings, isAdmin, reload }: { settings: HotelSettings | null; isAdmin: boolean; reload: StaffData['reload'] }) {
  const toast = useToast()
  const [s, setS] = useState<HotelSettings | null>(settings)
  const [busy, setBusy] = useState(false)
  useEffect(() => setS(settings), [settings])
  if (!s) return null
  const save = async () => {
    setBusy(true)
    const { id: _id, updated_at: _u, ...patch } = s
    const wifiChanged =
      !!settings &&
      (['wifi_name', 'wifi_password', 'wifi_security', 'wifi_hidden'] as const).some((k) => settings[k] !== s[k])
    if (wifiChanged) {
      patch.wifi_updated_by = 'admin'
      patch.wifi_qr = null // a QR text from the front desk app no longer matches a network typed here
    }
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
        <Field
          label="Guest Wi-Fi network"
          {...f('wifi_name')}
          hint={s.wifi_updated_by === 'partner' ? 'Set by the front desk app. Saving a change here replaces it.' : 'Shown with a QR code on the Done screen, so guests can join by scanning it.'}
        />
        <Field label="Guest Wi-Fi password" {...f('wifi_password')} />
        <div>
          <label htmlFor="wifi-sec" className="mb-1.5 block text-sm font-medium text-ink">Guest Wi-Fi security</label>
          <select
            id="wifi-sec"
            disabled={!isAdmin}
            value={s.wifi_security}
            onChange={(e) => setS({ ...s, wifi_security: e.target.value as HotelSettings['wifi_security'] })}
            className="min-h-11 w-full rounded-lg border border-line bg-white px-3 text-[15px] transition focus:border-forest focus:shadow-[0_0_0_3px_rgb(201_154_26/0.22)] focus:outline-none"
          >
            <option value="WPA">WPA / WPA2 / WPA3 (most networks)</option>
            <option value="WEP">WEP (old routers)</option>
            <option value="nopass">Open network, no password</option>
          </select>
          <p className="mt-1 text-xs text-muted">Must match the router, or the QR code won't connect.</p>
        </div>
        <label className="flex items-center gap-2 self-center text-sm text-ink">
          <input
            type="checkbox"
            disabled={!isAdmin}
            checked={s.wifi_hidden}
            onChange={(e) => setS({ ...s, wifi_hidden: e.target.checked })}
            className="h-4 w-4 accent-[#0E3B2E]"
          />
          The network name is hidden
        </label>
        <Field label="Public review link" type="url" {...f('review_url')} hint="Google or TripAdvisor review page. Shown as a QR code to guests who rate 4-5." className="sm:col-span-2" />
        <Field label="Photo screensaver after (seconds)" type="number" min={0} max={600} {...f('screensaver_seconds')} hint="Hotel photos appear on the Welcome screen after this long without a touch. 0 turns it off." />
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

function EzeePanel({ integration: s, log, isAdmin, reload, now }: { integration: IntegrationSettings | null; log: SyncLogEntry[]; isAdmin: boolean; reload: StaffData['reload']; now: number }) {
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  if (!s) return null
  const set = async (patch: Partial<IntegrationSettings>) => {
    const { error } = await supabase.from('integration_settings').update(patch).eq('id', 1)
    if (error) return toast(errorText(errorCode(error)), 'error')
    reload('integration')
  }
  const syncNow = async () => {
    setBusy(true)
    const { data: session } = await supabase.auth.getSession()
    const { data, error } = await supabase.functions.invoke('ezee-sync', {
      body: { action: 'run' },
      headers: session.session ? { Authorization: `Bearer ${session.session.access_token}` } : undefined,
    })
    setBusy(false)
    reload('integration')
    reload('reservations')
    if (error) return toast('Could not reach the sync service.', 'error')
    if (!data?.ok) return toast(data?.error ?? 'Sync failed', 'error')
    toast(`Synced with eZee: ${data.pulled} bookings in, ${data.pushed} updates out`)
  }
  const toggle = (k: keyof IntegrationSettings, label: string, hint: string) => (
    <label className="flex min-h-11 cursor-pointer items-start gap-3">
      <input type="checkbox" className="mt-1 h-5 w-5 accent-forest" checked={!!s[k]} disabled={!isAdmin} onChange={(e) => set({ [k]: e.target.checked })} />
      <span>
        <span className="block text-sm font-medium">{label}</span>
        <span className="block text-xs text-muted">{hint}</span>
      </span>
    </label>
  )
  return (
    <Panel
      title={
        <span className="flex items-center gap-2">
          eZee FrontDesk sync
          <Chip className={s.ezee_enabled && !s.last_error ? 'border-forest/30 bg-forest/10 text-forest' : 'border-line bg-white text-muted'}>
            {s.ezee_enabled ? (s.last_error ? 'Needs attention' : 'On') : 'Off'}
          </Chip>
        </span>
      }
      action={<Btn tone="primary" disabled={busy} onClick={syncNow}>{busy ? 'Syncing...' : 'Sync now'}</Btn>}
    >
      <div className="grid gap-5 p-5 md:grid-cols-2">
        <div className="space-y-3">
          {toggle('ezee_enabled', 'Sync automatically', 'Every 3 minutes and right after each tablet check-in or check-out.')}
          {toggle('push_guest_data', 'Send tablet check-ins to eZee', 'Guest details, passport number, signature and extra guests are added to the eZee booking.')}
          {toggle('auto_checkin', 'Also check the guest in on eZee', 'Only when eZee already has a clean room assigned. Off: reception checks the guest in on eZee after seeing the passport.')}
          {toggle('push_checkout', 'Send tablet check-outs to eZee', 'If the bill is not settled, eZee refuses and reception finishes it at the desk.')}
        </div>
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between gap-3"><dt className="text-muted">Bookings received</dt><dd>{s.last_pull_at ? timeAgo(s.last_pull_at, now) : 'Never'}</dd></div>
          <div className="flex justify-between gap-3"><dt className="text-muted">Updates sent</dt><dd>{s.last_push_at ? timeAgo(s.last_push_at, now) : 'Never'}</dd></div>
          {s.last_error && <div className="rounded-lg bg-[#FDF1EC] px-3 py-2 text-danger">{s.last_error}</div>}
          <p className="text-xs text-muted">
            Needs eZee's kiosk and PMS connectivity enabled for the hotel, and the secrets EZEE_HOTEL_CODE and EZEE_AUTH_CODE set in Supabase (Edge Functions → Secrets).
          </p>
        </dl>
      </div>
      {log.length > 0 && (
        <details className="border-t border-line px-5 py-3">
          <summary className="min-h-11 cursor-pointer py-2.5 text-sm font-medium text-forest">Recent sync activity</summary>
          <ul className="mt-2 max-h-64 space-y-1 overflow-y-auto text-xs">
            {log.map((l) => (
              <li key={l.id} className="flex gap-3">
                <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${l.ok ? 'bg-forest' : 'bg-danger'}`} aria-hidden="true" />
                <span className="w-24 shrink-0 text-muted">{fmtDate(l.created_at)} {fmtTime(l.created_at)}</span>
                <span>
                  <span className="font-medium">{l.action}</span>
                  {l.booking_ref && <span className="text-muted"> · {l.booking_ref}</span>} — {l.message}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </Panel>
  )
}

function SecretModal({ title, value, note, onClose }: { title: string; value: string; note: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false)
  return (
    <Modal title={title} onClose={onClose} footer={<Btn tone="primary" onClick={onClose}>I've saved it</Btn>}>
      <p className="text-sm text-muted">{note}</p>
      <div className="mt-4 flex items-center gap-2">
        <code className="min-w-0 flex-1 break-all rounded-lg border border-line bg-white px-3 py-2.5 font-mono text-sm">{value}</code>
        <Btn
          onClick={() => {
            navigator.clipboard?.writeText(value).then(() => setCopied(true)).catch(() => {})
          }}
        >
          {copied ? 'Copied' : 'Copy'}
        </Btn>
      </div>
      <p className="mt-3 text-xs text-danger">This is shown only once. Send it to your dad privately, not by email or chat.</p>
    </Modal>
  )
}

function PartnerPanel({ partner: p, isAdmin, reload, now }: { partner: PartnerSettings | null; isAdmin: boolean; reload: StaffData['reload']; now: number }) {
  const toast = useToast()
  const [url, setUrl] = useState(p?.webhook_url ?? '')
  const [secret, setSecret] = useState<{ title: string; value: string; note: string } | null>(null)
  const [confirmKey, setConfirmKey] = useState(false)
  useEffect(() => setUrl(p?.webhook_url ?? ''), [p?.webhook_url])
  if (!p) return null
  const apiBase = `${SUPABASE_URL}/functions/v1/partner-api`
  const save = async (patch: Partial<PartnerSettings>) => {
    const { error } = await supabase.from('partner_settings').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', 1)
    if (error) return toast(error.message.includes('check') ? 'The address must start with https://' : errorText(errorCode(error)), 'error')
    reload('integration')
    toast('Saved')
  }
  const newKey = async () => {
    if (p.api_key_prefix && !confirmKey) return setConfirmKey(true)
    try {
      const key = await rpc<string>('create_partner_api_key')
      setConfirmKey(false)
      setSecret({ title: 'API key for the front desk app', value: key, note: `Your dad's app sends this as "Authorization: Bearer <key>" when calling ${apiBase}. Creating a new key stops the old one working.` })
      reload('integration')
    } catch (e) {
      toast(errorText(e instanceof ApiError ? e.code : 'unknown_error'), 'error')
    }
  }
  const newSecret = async () => {
    try {
      const value = await rpc<string>('create_partner_webhook_secret')
      setSecret({ title: 'Webhook signing secret', value, note: "Your dad's app uses this to check that webhooks really come from the tablet (X-Rumi-Signature header)." })
      reload('integration')
    } catch (e) {
      toast(errorText(e instanceof ApiError ? e.code : 'unknown_error'), 'error')
    }
  }
  const test = async () => {
    try {
      await rpc('send_partner_test_event')
      toast('Test event sent. Check that it arrived in the front desk app.')
      window.setTimeout(() => reload('integration'), 4000)
    } catch (e) {
      toast(errorText(e instanceof ApiError ? e.code : 'unknown_error'), 'error')
    }
  }
  return (
    <Panel
      title={
        <span className="flex items-center gap-2">
          Front desk app connection
          <Chip className={p.webhook_enabled && !p.last_error ? 'border-forest/30 bg-forest/10 text-forest' : 'border-line bg-white text-muted'}>
            {p.webhook_enabled ? (p.last_error ? 'Needs attention' : 'On') : 'Off'}
          </Chip>
        </span>
      }
    >
      <div className="space-y-5 p-5">
        <p className="text-sm text-muted">
          Connects the tablet to the owner's own front desk app: every tablet check-in, check-out and feedback is sent to it instantly, and it can send bookings
          and room assignments back. The full guide for the app's developer is in <span className="font-mono">docs/partner-api.md</span>.
        </p>
        <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
          <Field label="Webhook address of the front desk app" type="url" placeholder="https://..." value={url} disabled={!isAdmin} onChange={(e) => setUrl(e.target.value)} />
          {isAdmin && <Btn onClick={() => save({ webhook_url: url.trim() || null })} disabled={url.trim() === (p.webhook_url ?? '')}>Save address</Btn>}
        </div>
        <label className="flex min-h-11 cursor-pointer items-center gap-3">
          <input type="checkbox" className="h-5 w-5 accent-forest" checked={p.webhook_enabled} disabled={!isAdmin || !p.webhook_url} onChange={(e) => save({ webhook_enabled: e.target.checked })} />
          <span className="text-sm font-medium">Send tablet events to the front desk app</span>
        </label>
        <dl className="grid gap-2 text-sm md:grid-cols-2">
          <div className="flex justify-between gap-3 rounded-lg border border-line px-3 py-2"><dt className="text-muted">API key</dt><dd className="font-mono">{p.api_key_prefix ? `${p.api_key_prefix}••••` : 'Not created'}</dd></div>
          <div className="flex justify-between gap-3 rounded-lg border border-line px-3 py-2"><dt className="text-muted">Signing secret</dt><dd>{p.webhook_secret_created_at ? `Created ${timeAgo(p.webhook_secret_created_at, now)}` : 'Not created'}</dd></div>
          <div className="flex justify-between gap-3 rounded-lg border border-line px-3 py-2 md:col-span-2"><dt className="text-muted">Last delivery</dt><dd>{p.last_delivery_at ? timeAgo(p.last_delivery_at, now) : 'Never'}</dd></div>
          {p.last_error && <div className="rounded-lg bg-[#FDF1EC] px-3 py-2 text-danger md:col-span-2">{p.last_error}</div>}
        </dl>
        <div className="rounded-lg bg-cream/70 px-3 py-2 text-xs text-muted">
          API address: <span className="break-all font-mono text-ink">{apiBase}</span>
        </div>
        {isAdmin && (
          <div className="flex flex-wrap gap-2">
            <Btn onClick={newKey}>{p.api_key_prefix ? (confirmKey ? 'Tap again: old key stops working' : 'Replace API key') : 'Create API key'}</Btn>
            <Btn onClick={newSecret}>{p.webhook_secret_created_at ? 'Replace signing secret' : 'Create signing secret'}</Btn>
            <Btn tone="primary" onClick={test} disabled={!p.webhook_enabled}>Send test event</Btn>
          </div>
        )}
      </div>
      {secret && <SecretModal {...secret} onClose={() => setSecret(null)} />}
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


const POLICY_LANGS = [
  { code: 'en', label: 'English' },
  { code: 'ru', label: 'Russian' },
  { code: 'tg', label: 'Tajik' },
] as const
type PolicyRow = { id: string; lang: string; version: number; body_md: string; created_at: string; created_by: string | null }

/** Hotel policy (rulebook) shown to guests above the signature, one Markdown file per language. */
function PolicyPanel({ isAdmin }: { isAdmin: boolean }) {
  const toast = useToast()
  const [lang, setLang] = useState<'en' | 'ru' | 'tg'>('en')
  const [rows, setRows] = useState<PolicyRow[]>([])
  const [draft, setDraft] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const load = () =>
    supabase
      .from('hotel_policies')
      .select('id, lang, version, body_md, created_at, created_by')
      .order('version', { ascending: false })
      .then(({ data }) => setRows((data as PolicyRow[]) ?? []))
  useEffect(() => {
    load()
  }, [])
  const current = rows.find((r) => r.lang === lang)
  const text = draft ?? current?.body_md ?? ''
  const onFile = async (f: File | undefined) => {
    if (!f) return
    if (f.size > 120_000) return toast('That file is too large (max about 60,000 characters).', 'error')
    setDraft(await f.text())
  }
  const publish = async () => {
    if (!draft?.trim()) return
    setBusy(true)
    try {
      const res = await rpc<{ version: number }>('publish_policy', { p_lang: lang, p_body: draft })
      toast(`Published ${POLICY_LANGS.find((l) => l.code === lang)!.label} policy, version ${res.version}`)
      setDraft(null)
      load()
    } catch (e) {
      toast(errorText(e instanceof ApiError ? e.code : 'unknown_error'), 'error')
    } finally {
      setBusy(false)
    }
  }
  return (
    <Panel
      title="Hotel policy (shown before the guest signs)"
      action={
        isAdmin && (
          <div className="flex gap-2">
            <label className="inline-flex min-h-11 cursor-pointer items-center rounded-lg border border-line bg-white px-4 text-sm font-medium text-forest hover:bg-cream">
              Upload .md file
              <input type="file" accept=".md,.markdown,.txt,text/markdown,text/plain" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} />
            </label>
            <Btn tone="primary" disabled={busy || !draft?.trim()} onClick={publish}>Publish</Btn>
          </div>
        )
      }
    >
      <div className="p-5">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex gap-1 rounded-lg border border-line bg-white p-1" role="tablist">
            {POLICY_LANGS.map((l) => {
              const has = rows.some((r) => r.lang === l.code)
              return (
                <button
                  key={l.code}
                  type="button"
                  role="tab"
                  aria-selected={lang === l.code}
                  onClick={() => {
                    setLang(l.code)
                    setDraft(null)
                  }}
                  className={`min-h-9 cursor-pointer rounded-md px-3 text-sm font-medium ${lang === l.code ? 'bg-forest text-cream' : 'text-muted hover:text-forest'}`}
                >
                  {l.label}
                  {!has && <span className="ml-1 text-xs opacity-70">(none)</span>}
                </button>
              )
            })}
          </div>
          <p className="text-sm text-muted">
            {draft !== null
              ? 'Unpublished changes. Guests keep seeing the published version until you press Publish.'
              : current
                ? `Version ${current.version}, published ${fmtDate(current.created_at)} ${fmtTime(current.created_at)}${current.created_by ? ` by ${current.created_by}` : ''}.`
                : lang === 'en'
                  ? 'No policy yet. Guests sign without a policy text.'
                  : 'No policy in this language yet. Guests who chose it see the English one.'}
          </p>
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div>
            <label htmlFor="policy-md" className="mb-1.5 block text-sm font-medium text-ink">Markdown</label>
            <textarea
              id="policy-md"
              value={text}
              disabled={!isAdmin}
              onChange={(e) => setDraft(e.target.value)}
              rows={16}
              placeholder={'# House rules\n\n- Check-out is at 12:00.\n- No smoking in rooms.'}
              className="w-full rounded-lg border border-line bg-white p-3 font-mono text-sm focus:border-forest focus:outline-none"
            />
            <p className="mt-1 text-xs text-muted">Headings (#), lists (- or 1.), **bold** and *italic* are shown. Every publish is kept as a new version; each check-in records the version the guest signed.</p>
          </div>
          <div>
            <p className="mb-1.5 text-sm font-medium text-ink">How guests see it</p>
            <div className="max-h-[420px] overflow-y-auto rounded-lg border border-line bg-paper p-4 text-[15px] text-ink">
              {text.trim() ? <Markdown source={text} /> : <p className="text-muted">Nothing to show yet.</p>}
            </div>
          </div>
        </div>
      </div>
    </Panel>
  )
}

export function SettingsView({ data, isAdmin, profile, now }: { data: StaffData; isAdmin: boolean; profile: Profile; now: number }) {
  return (
    <>
      <PageHead title="Settings" sub={`Signed in as ${profile.full_name || profile.email} (${profile.role}).`} />
      <div className="space-y-6">
        <HotelPanel settings={data.settings} isAdmin={isAdmin} reload={data.reload} />
        <PolicyPanel isAdmin={isAdmin} />
        <PartnerPanel partner={data.partner} isAdmin={isAdmin} reload={data.reload} now={now} />
        <EzeePanel integration={data.integration} log={data.syncLog} isAdmin={isAdmin} reload={data.reload} now={now} />
        <TabletsPanel devices={data.devices} isAdmin={isAdmin} reload={data.reload} now={now} />
        {isAdmin && <TeamPanel profiles={data.profiles} me={profile.user_id} reload={data.reload} />}
      </div>
    </>
  )
}

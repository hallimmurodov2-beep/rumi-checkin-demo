// Supabase Edge Function: keeps the tablet app and eZee FrontDesk in step.
//
//   pull: today's arrivals and in-house stays from eZee -> reservations
//   push: tablet check-ins (guest details, passport, signature, extra guests)
//         and tablet check-outs -> eZee
//
// Secrets (Supabase dashboard -> Edge Functions -> Secrets):
//   EZEE_HOTEL_CODE, EZEE_AUTH_CODE   (from eZee, with kiosk + PMS connectivity enabled)
//
// Called every 3 minutes by pg_cron, right after each tablet check-in/out (DB trigger),
// and from the front desk ("Sync now" / "Test connection").

import { createClient } from 'npm:@supabase/supabase-js@2'
import * as E from './ezee.ts'

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false },
})

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-sync-secret, apikey, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

function hotelDate(offsetDays = 0) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dushanbe' }).format(new Date(Date.now() + offsetDays * 86_400_000))
}

async function authorised(req: Request): Promise<boolean> {
  const secret = req.headers.get('x-sync-secret')
  if (secret) {
    const { data } = await db.from('private_config').select('value').eq('key', 'sync_secret').maybeSingle()
    return !!data && data.value === secret
  }
  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '')
  if (!token) return false
  const { data: u } = await db.auth.getUser(token)
  if (!u.user) return false
  const { data: p } = await db.from('profiles').select('role').eq('user_id', u.user.id).maybeSingle()
  return p?.role === 'staff' || p?.role === 'admin'
}

async function log(direction: 'pull' | 'push' | 'system', action: string, ok: boolean, message: string, booking_ref?: string) {
  await db.from('sync_log').insert({ direction, action, ok, message: message.slice(0, 500), booking_ref: booking_ref ?? null })
}

async function setStatus(patch: Record<string, unknown>) {
  await db.from('integration_settings').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', 1)
}

// deno-lint-ignore no-explicit-any
async function call(url: string, body: unknown): Promise<any> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(25_000),
  })
  const text = await res.text()
  try {
    return JSON.parse(text)
  } catch {
    return { Errors: { ErrorCode: `http_${res.status}`, ErrorMessage: text.slice(0, 200) || `HTTP ${res.status}` } }
  }
}

const NO_DATA = ['303', '503']

async function pull(creds: E.Creds) {
  const lists = [
    E.dateRange('ArrivalList', creds, hotelDate(-1), hotelDate(1)),
    E.dateRange('DepartureList', creds, hotelDate(0), hotelDate(30)),
  ]
  const byId = new Map<string, E.MergedBooking>()
  for (const body of lists) {
    const res = await call(E.PMS_URL, body)
    const err = E.errorOf(res)
    if (err && !(NO_DATA.includes(err.code) && /no data/i.test(err.message))) {
      throw new Error(E.explain(body.RES_Request.Request_Type, err.code, err.message))
    }
    for (const b of E.bookingsFrom(res)) byId.set(b.ezee_booking_id, b)
  }
  const rows = [...byId.values()]
  if (rows.length) {
    const { error } = await db.rpc('ezee_merge_reservations', { p: rows })
    if (error) throw new Error(`Saving bookings failed: ${error.message}`)
  }
  await setStatus({ last_pull_at: new Date().toISOString() })
  await log('pull', 'Arrivals and in-house', true, `${rows.length} bookings from eZee`)
  return rows.length
}

let identityTypeCache: string | null | undefined
async function identityType(creds: E.Creds) {
  if (identityTypeCache !== undefined) return identityTypeCache
  try {
    identityTypeCache = E.passportIdentityType(await call(E.KIOSK_URL, E.request('RetrieveIdentityType', creds)))
  } catch {
    identityTypeCache = null
  }
  return identityTypeCache
}

async function push(creds: E.Creds) {
  const { data: settings } = await db.from('integration_settings').select('*').eq('id', 1).single()
  let pushed = 0

  if (settings.push_guest_data) {
    const { data: checkins } = await db
      .from('checkins')
      .select(
        'id, phone, email, surname, given_names, document_number, birth_date, sex, expiry_date, signature_png, ezee_attempts, reservations!inner(ezee_booking_id, ezee_guest, guest_name, room_number, booking_ref), checkin_guests(id, surname, given_names, document_number, birth_date, sex, expiry_date, ezee_synced_at)',
      )
      .is('ezee_synced_at', null)
      .lt('ezee_attempts', 5)
      .not('reservations.ezee_booking_id', 'is', null)
      .order('created_at')
      .limit(10)

    for (const c of checkins ?? []) {
      // deno-lint-ignore no-explicit-any
      const r = (c as any).reservations
      const guest = r.ezee_guest ?? { first_name: '', last_name: r.guest_name, email: '' }
      const idType = await identityType(creds)
      const fail = async (action: string, err: { code: string; message: string }) => {
        const msg = E.explain(action, err.code, err.message)
        await db
          .from('checkins')
          .update({ ezee_error: msg, ezee_attempts: E.isFinal(action, err.code) ? 5 : c.ezee_attempts + 1 })
          .eq('id', c.id)
        await log('push', action, false, msg, r.booking_ref)
      }

      const up = await call(E.KIOSK_URL, E.uploadDocumentRequest(creds, r.ezee_booking_id, guest, c, idType))
      const upErr = E.errorOf(up)
      if (upErr) {
        await fail('UploadDocument', upErr)
        continue
      }
      await log('push', 'Guest details and signature', true, 'Sent to eZee', r.booking_ref)

      // deno-lint-ignore no-explicit-any
      const extra = ((c as any).checkin_guests ?? []).filter((g: { ezee_synced_at: string | null }) => !g.ezee_synced_at)
      if (extra.length) {
        const sh = await call(E.KIOSK_URL, E.addSharerRequest(creds, r.ezee_booking_id, extra, idType, c.email || guest.email))
        const shErr = E.errorOf(sh)
        const ids = extra.map((g: { id: string }) => g.id)
        if (shErr) {
          const msg = E.explain('AddSharer', shErr.code, shErr.message)
          await db.from('checkin_guests').update({ ezee_error: msg }).in('id', ids)
          await log('push', 'Additional guests', false, msg, r.booking_ref)
        } else {
          await db.from('checkin_guests').update({ ezee_synced_at: new Date().toISOString(), ezee_error: null }).in('id', ids)
          await log('push', 'Additional guests', true, `${extra.length} added in eZee`, r.booking_ref)
        }
      }

      if (settings.auto_checkin && r.room_number) {
        const ci = await call(
          E.KIOSK_URL,
          E.checkInRequest(creds, r.ezee_booking_id, `${guest.first_name} ${guest.last_name}`.trim() || r.guest_name, c, idType, guest.email),
        )
        const ciErr = E.errorOf(ci)
        if (ciErr && ciErr.code !== '128') {
          // Details are already in eZee; reception finishes the check-in there.
          await log('push', 'GuestCheckIn', false, E.explain('GuestCheckIn', ciErr.code, ciErr.message), r.booking_ref)
        } else {
          await log('push', 'GuestCheckIn', true, 'Checked in on eZee', r.booking_ref)
        }
      }

      await db.from('checkins').update({ ezee_synced_at: new Date().toISOString(), ezee_error: null }).eq('id', c.id)
      pushed++
    }
  }

  if (settings.push_checkout) {
    const { data: checkouts } = await db
      .from('checkouts')
      .select('id, ezee_attempts, device_id, reservations!inner(ezee_booking_id, booking_ref)')
      .is('ezee_synced_at', null)
      .not('device_id', 'is', null)
      .lt('ezee_attempts', 5)
      .not('reservations.ezee_booking_id', 'is', null)
      .order('created_at')
      .limit(10)
    for (const o of checkouts ?? []) {
      // deno-lint-ignore no-explicit-any
      const r = (o as any).reservations
      const res = await call(E.KIOSK_URL, E.checkOutRequest(creds, r.ezee_booking_id))
      const err = E.errorOf(res)
      if (err && err.code !== '118') {
        const msg = E.explain('GuestCheckOut', err.code, err.message)
        await db
          .from('checkouts')
          .update({ ezee_error: msg, ezee_attempts: E.isFinal('GuestCheckOut', err.code) ? 5 : o.ezee_attempts + 1 })
          .eq('id', o.id)
        await log('push', 'GuestCheckOut', false, msg, r.booking_ref)
        continue
      }
      await db.from('checkouts').update({ ezee_synced_at: new Date().toISOString(), ezee_error: null }).eq('id', o.id)
      await log('push', 'GuestCheckOut', true, 'Checked out on eZee', r.booking_ref)
      pushed++
    }
  }

  await setStatus({ last_push_at: new Date().toISOString() })
  return pushed
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)
  if (!(await authorised(req))) return json({ error: 'unauthorised' }, 401)

  const { action = 'run' } = await req.json().catch(() => ({}))
  const hotelCode = Deno.env.get('EZEE_HOTEL_CODE') ?? ''
  const authCode = Deno.env.get('EZEE_AUTH_CODE') ?? ''
  const configured = !!hotelCode && !!authCode
  if (action === 'status') return json({ configured })
  if (!configured) {
    const msg = 'eZee credentials are not set. Add EZEE_HOTEL_CODE and EZEE_AUTH_CODE as Edge Function secrets.'
    await setStatus({ last_error: msg, last_error_at: new Date().toISOString() })
    return json({ ok: false, configured: false, error: msg })
  }
  const creds = { hotelCode, authCode }

  try {
    let pulled = 0
    let pushed = 0
    if (action === 'run' || action === 'pull' || action === 'test') pulled = await pull(creds)
    if (action === 'run' || action === 'push') pushed = await push(creds)
    await setStatus({ last_error: null, last_error_at: null })
    return json({ ok: true, configured: true, pulled, pushed })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    await setStatus({ last_error: msg, last_error_at: new Date().toISOString() })
    await log('system', action, false, msg)
    return json({ ok: false, configured: true, error: msg }, 200)
  }
})

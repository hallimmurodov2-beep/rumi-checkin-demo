// Partner API: connects the tablet to the hotel's own front desk app.
//
//   Partner app -> us   REST API, authenticated with "Authorization: Bearer <api key>"
//   us -> partner app   signed webhooks for every tablet event
//
// See docs/partner-api.md for the full guide.

import { createClient } from 'npm:@supabase/supabase-js@2'

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false },
})

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-sync-secret, apikey, x-client-info',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body, null, 2), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })
const fail = (status: number, error: string, detail?: string) => json({ error, ...(detail ? { detail } : {}) }, status)

async function sha256Hex(s: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

async function hmacHex(secret: string, message: string) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message))
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

async function config(key: string) {
  const { data } = await db.from('private_config').select('value').eq('key', key).maybeSingle()
  return data?.value as string | undefined
}

async function log(action: string, ok: boolean, message: string, booking_ref?: string | null) {
  await db.from('sync_log').insert({ direction: 'push', action: `Partner: ${action}`, ok, message: message.slice(0, 500), booking_ref: booking_ref ?? null })
}

/* ---------------------------------------------------------------- data shapes */

const RES_FIELDS =
  'id, booking_ref, alt_refs, partner_ref, ezee_booking_id, guest_name, source, room_type, room_number, arrival_date, departure_date, adults, breakfast, status'
const CHECKIN_FIELDS =
  'id, created_at, status, language, doc_source, doc_type, issuing_country, nationality, surname, given_names, document_number, birth_date, sex, expiry_date, mrz_valid, phone, email, shuttle, consent_at, approved_at, data_purged_at, desk_code'

// deno-lint-ignore no-explicit-any
function shapeCheckin(c: any) {
  return {
    id: c.id,
    created_at: c.created_at,
    status: c.status,
    // Short number the guest shows at reception, e.g. "P17" (when passports are scanned at the desk).
    desk_code: c.desk_code,
    passport_scanned_on_tablet: c.doc_source === 'mrz',
    language: c.language,
    reservation: c.reservations,
    guest: {
      surname: c.surname,
      given_names: c.given_names,
      nationality: c.nationality,
      sex: c.sex,
      birth_date: c.birth_date,
      phone: c.phone,
      email: c.email,
      document: {
        source: c.doc_source,
        type: c.doc_type,
        number: c.document_number,
        issuing_country: c.issuing_country,
        expiry_date: c.expiry_date,
        check_digits_valid: c.mrz_valid,
      },
    },
    additional_guests: (c.checkin_guests ?? []).map(
      // deno-lint-ignore no-explicit-any
      (g: any) => ({
        surname: g.surname,
        given_names: g.given_names,
        nationality: g.nationality,
        sex: g.sex,
        birth_date: g.birth_date,
        document: { type: g.doc_type, number: g.document_number, issuing_country: g.issuing_country, expiry_date: g.expiry_date, check_digits_valid: g.mrz_valid },
      }),
    ),
    airport_shuttle: c.shuttle,
    consent_at: c.consent_at,
    approved_at: c.approved_at,
    ...(c.signature_png !== undefined ? { signature_png: c.signature_png } : {}),
    data_deleted: !!c.data_purged_at,
  }
}

async function loadCheckin(id: string, withSignature: boolean) {
  const { data } = await db
    .from('checkins')
    .select(`${CHECKIN_FIELDS}${withSignature ? ', signature_png' : ''}, reservations!inner(${RES_FIELDS}), checkin_guests(*)`)
    .eq('id', id)
    .maybeSingle()
  return data ? shapeCheckin(data) : null
}

/* ---------------------------------------------------------------- webhooks */

async function eventData(event: string, subjectId: string) {
  if (event.startsWith('checkin.')) return { checkin: await loadCheckin(subjectId, true) }
  if (event === 'checkout.created') {
    const { data } = await db.from('checkouts').select(`id, created_at, rating, key_returned, device_id, reservations!inner(${RES_FIELDS})`).eq('id', subjectId).maybeSingle()
    return data ? { checkout: { id: data.id, created_at: data.created_at, rating: data.rating, key_returned: data.key_returned, from_tablet: !!data.device_id, reservation: data.reservations } } : null
  }
  if (event === 'feedback.created') {
    const { data } = await db.from('feedback').select(`id, created_at, rating, comment, reservations(${RES_FIELDS})`).eq('id', subjectId).maybeSingle()
    return data ? { feedback: { id: data.id, created_at: data.created_at, rating: data.rating, comment: data.comment, reservation: data.reservations } } : null
  }
  if (event === 'ping') return { message: 'Test event from The Rumi tablet app' }
  return null
}

async function deliver() {
  const { data: s } = await db.from('partner_settings').select('*').eq('id', 1).single()
  if (!s.webhook_enabled || !s.webhook_url) return { delivered: 0, skipped: 'webhook off' }
  const secret = await config('partner_webhook_secret')
  if (!secret) {
    await db.from('partner_settings').update({ last_error: 'No signing secret. Create one in Settings.', last_error_at: new Date().toISOString() }).eq('id', 1)
    return { delivered: 0, skipped: 'no secret' }
  }
  const { data: pending } = await db
    .from('webhook_outbox')
    .select('*')
    .is('delivered_at', null)
    .lte('next_attempt_at', new Date().toISOString())
    .lt('attempts', 12)
    .order('created_at')
    .limit(20)

  let delivered = 0
  for (const ev of pending ?? []) {
    const data = await eventData(ev.event, ev.subject_id)
    if (!data) {
      await db.from('webhook_outbox').update({ delivered_at: new Date().toISOString(), last_error: 'Record no longer exists' }).eq('id', ev.id)
      continue
    }
    const body = JSON.stringify({ id: ev.id, event: ev.event, created_at: ev.created_at, data })
    const ts = Math.floor(Date.now() / 1000).toString()
    const signature = await hmacHex(secret, `${ts}.${body}`)
    let error: string | null = null
    try {
      const res = await fetch(s.webhook_url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Rumi-Event': ev.event,
          'X-Rumi-Delivery': ev.id,
          'X-Rumi-Timestamp': ts,
          'X-Rumi-Signature': `sha256=${signature}`,
          'User-Agent': 'RumiCheckin-Webhook/1',
        },
        body,
        signal: AbortSignal.timeout(15_000),
      })
      if (!res.ok) error = `HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`
    } catch (e) {
      error = e instanceof Error ? e.message : String(e)
    }
    const ref = (data as { checkin?: { reservation?: { booking_ref?: string } } }).checkin?.reservation?.booking_ref ?? null
    if (error) {
      const attempts = ev.attempts + 1
      const wait = Math.min(60, 2 ** attempts) // minutes: 2, 4, 8 ... capped at 1 hour
      await db
        .from('webhook_outbox')
        .update({ attempts, last_error: error, next_attempt_at: new Date(Date.now() + wait * 60_000).toISOString() })
        .eq('id', ev.id)
      await db.from('partner_settings').update({ last_error: `${ev.event}: ${error}`, last_error_at: new Date().toISOString() }).eq('id', 1)
      await log(ev.event, false, error, ref)
    } else {
      await db.from('webhook_outbox').update({ delivered_at: new Date().toISOString(), attempts: ev.attempts + 1, last_error: null }).eq('id', ev.id)
      await db.from('partner_settings').update({ last_delivery_at: new Date().toISOString(), last_error: null, last_error_at: null }).eq('id', 1)
      await log(ev.event, true, 'Delivered to partner app', ref)
      delivered++
    }
  }
  return { delivered }
}

/* ---------------------------------------------------------------- REST API */

const STATUSES = ['expected', 'pending_desk', 'in_house', 'checked_out', 'cancelled', 'no_show']
const isDate = (s: unknown) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s)

// deno-lint-ignore no-explicit-any
function cleanReservation(b: any, i: number): { row?: Record<string, unknown>; error?: string } {
  const ref = typeof b?.booking_ref === 'string' ? b.booking_ref.trim() : ''
  if (!ref) return { error: `[${i}] booking_ref is required` }
  if (typeof b.guest_name !== 'string' || !b.guest_name.trim()) return { error: `[${i}] guest_name is required` }
  if (!isDate(b.arrival_date) || !isDate(b.departure_date) || b.departure_date <= b.arrival_date)
    return { error: `[${i}] arrival_date and departure_date must be YYYY-MM-DD, departure after arrival` }
  if (b.status !== undefined && !STATUSES.includes(b.status)) return { error: `[${i}] status must be one of ${STATUSES.join(', ')}` }
  const row: Record<string, unknown> = {
    booking_ref: ref,
    guest_name: b.guest_name.trim().slice(0, 120),
    arrival_date: b.arrival_date,
    departure_date: b.departure_date,
  }
  if (b.source !== undefined) row.source = String(b.source).slice(0, 40)
  if (b.room_type !== undefined) row.room_type = String(b.room_type).slice(0, 60)
  if (b.room_number !== undefined) row.room_number = b.room_number === null ? null : String(b.room_number).slice(0, 10)
  if (b.adults !== undefined) row.adults = Math.max(1, Math.min(20, Number(b.adults) || 1))
  if (b.breakfast !== undefined) row.breakfast = !!b.breakfast
  if (b.notes !== undefined) row.notes = b.notes === null ? null : String(b.notes).slice(0, 500)
  if (Array.isArray(b.other_refs)) row.alt_refs = b.other_refs.map((x: unknown) => String(x).slice(0, 40)).slice(0, 5)
  if (b.partner_ref !== undefined) row.partner_ref = String(b.partner_ref).slice(0, 60)
  if (b.ezee_booking_id !== undefined) row.ezee_booking_id = b.ezee_booking_id === null ? null : String(b.ezee_booking_id).slice(0, 40)
  if (b.status !== undefined) row.status = b.status
  return { row }
}

async function setStatus(ref: string, status: string, room?: string | null) {
  const { data: r } = await db.from('reservations').select('id, booking_ref').eq('booking_ref', ref.toUpperCase().replace(/\s+/g, '')).maybeSingle()
  if (!r) return null
  const patch: Record<string, unknown> = { status }
  if (room) patch.room_number = room
  await db.from('reservations').update(patch).eq('id', r.id)
  if (status === 'in_house') {
    await db.from('checkins').update({ status: 'approved', approved_at: new Date().toISOString() }).eq('reservation_id', r.id).eq('status', 'waiting')
  }
  if (status === 'expected') {
    await db.from('checkins').update({ status: 'rejected' }).eq('reservation_id', r.id).eq('status', 'waiting')
  }
  return r.id
}

async function api(req: Request, path: string, url: URL) {
  const key = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '').trim()
  const stored = await config('partner_api_key_hash')
  if (!key || !stored || (await sha256Hex(key)) !== stored) return fail(401, 'unauthorised', 'Send the API key as "Authorization: Bearer <key>".')

  const since = url.searchParams.get('since')
  if (since && Number.isNaN(Date.parse(since))) return fail(400, 'bad_since', 'since must be an ISO date-time')
  const limit = Math.min(200, Math.max(1, Number(url.searchParams.get('limit') ?? 100) || 100))

  // GET /v1/ping
  if (req.method === 'GET' && path === '/v1/ping') {
    const { data: h } = await db.from('hotel_settings').select('hotel_name').eq('id', 1).single()
    return json({ ok: true, hotel: h?.hotel_name, time: new Date().toISOString() })
  }

  // GET /v1/checkins?status=waiting&since=...&include_signature=true
  if (req.method === 'GET' && path === '/v1/checkins') {
    const withSig = ['1', 'true'].includes(url.searchParams.get('include_signature') ?? '')
    let q = db
      .from('checkins')
      .select(`${CHECKIN_FIELDS}${withSig ? ', signature_png' : ''}, reservations!inner(${RES_FIELDS}), checkin_guests(*)`)
      .order('created_at', { ascending: false })
      .limit(limit)
    const status = url.searchParams.get('status')
    if (status) q = q.eq('status', status)
    if (since) q = q.gte('created_at', since)
    const { data, error } = await q
    if (error) return fail(500, 'query_failed', error.message)
    return json({ checkins: (data ?? []).map(shapeCheckin) })
  }

  // GET /v1/checkins/:id
  let m = path.match(/^\/v1\/checkins\/([0-9a-f-]{36})$/)
  if (req.method === 'GET' && m) {
    const c = await loadCheckin(m[1], true)
    return c ? json({ checkin: c }) : fail(404, 'not_found')
  }

  // POST /v1/checkins/:id/approve  { "room_number": "305" }
  m = path.match(/^\/v1\/checkins\/([0-9a-f-]{36})\/(approve|reject)$/)
  if (req.method === 'POST' && m) {
    const body = await req.json().catch(() => ({}))
    const { data: c } = await db.from('checkins').select('id, status, reservation_id').eq('id', m[1]).maybeSingle()
    if (!c) return fail(404, 'not_found')
    if (c.status !== 'waiting') return fail(409, 'already_handled', `Check-in is ${c.status}`)
    if (m[2] === 'approve') {
      const room = typeof body.room_number === 'string' ? body.room_number.trim() : ''
      if (!room) return fail(400, 'room_required', 'room_number is required')
      await db.from('checkins').update({ status: 'approved', approved_at: new Date().toISOString() }).eq('id', c.id)
      await db.from('reservations').update({ status: 'in_house', room_number: room.slice(0, 10) }).eq('id', c.reservation_id)
    } else {
      await db.from('checkins').update({ status: 'rejected' }).eq('id', c.id)
      await db.from('reservations').update({ status: 'expected' }).eq('id', c.reservation_id).eq('status', 'pending_desk')
    }
    return json({ checkin: await loadCheckin(c.id, false) })
  }

  // PUT /v1/reservations  [ {...}, ... ]   (upsert by booking_ref)
  if (req.method === 'PUT' && path === '/v1/reservations') {
    const body = await req.json().catch(() => null)
    const list = Array.isArray(body) ? body : Array.isArray(body?.reservations) ? body.reservations : null
    if (!list) return fail(400, 'bad_body', 'Send a JSON array of reservations (or { "reservations": [...] }).')
    if (list.length > 500) return fail(400, 'too_many', 'At most 500 reservations per request.')
    const rows: Record<string, unknown>[] = []
    const errors: string[] = []
    list.forEach((b: unknown, i: number) => {
      const r = cleanReservation(b, i)
      if (r.error) errors.push(r.error)
      else rows.push(r.row!)
    })
    if (errors.length) return fail(400, 'invalid_reservations', errors.slice(0, 20).join('; '))
    // Never move a stay backwards: keep a tablet check-in that is waiting at the desk.
    const refs = rows.map((r) => String(r.booking_ref).toUpperCase().replace(/\s+/g, ''))
    const { data: existing } = await db.from('reservations').select('booking_ref, status').in('booking_ref', refs)
    const current = new Map((existing ?? []).map((e) => [e.booking_ref, e.status]))
    for (const r of rows) {
      const now = current.get(String(r.booking_ref).toUpperCase().replace(/\s+/g, ''))
      if (r.status === 'expected' && (now === 'pending_desk' || now === 'in_house')) delete r.status
    }
    const { error } = await db.from('reservations').upsert(rows, { onConflict: 'booking_ref' })
    if (error) return fail(400, 'save_failed', error.message)
    return json({ ok: true, saved: rows.length })
  }

  // POST /v1/reservations/:booking_ref/status  { "status": "in_house", "room_number": "305" }
  m = path.match(/^\/v1\/reservations\/([^/]+)\/status$/)
  if (req.method === 'POST' && m) {
    const body = await req.json().catch(() => ({}))
    if (!STATUSES.includes(body.status)) return fail(400, 'bad_status', `status must be one of ${STATUSES.join(', ')}`)
    const id = await setStatus(decodeURIComponent(m[1]), body.status, body.room_number ? String(body.room_number).slice(0, 10) : null)
    return id ? json({ ok: true }) : fail(404, 'not_found', 'No reservation with that booking_ref')
  }

  // GET /v1/checkouts?since=   and   GET /v1/feedback?since=
  if (req.method === 'GET' && (path === '/v1/checkouts' || path === '/v1/feedback')) {
    const table = path === '/v1/checkouts' ? 'checkouts' : 'feedback'
    const cols = table === 'checkouts' ? `id, created_at, rating, key_returned, device_id, reservations!inner(${RES_FIELDS})` : `id, created_at, rating, comment, resolved, reservations(${RES_FIELDS})`
    let q = db.from(table).select(cols).order('created_at', { ascending: false }).limit(limit)
    if (since) q = q.gte('created_at', since)
    const { data, error } = await q
    if (error) return fail(500, 'query_failed', error.message)
    // deno-lint-ignore no-explicit-any
    const items = (data ?? []).map((x: any) => {
      const { reservations, device_id, ...rest } = x
      return { ...rest, ...(table === 'checkouts' ? { from_tablet: !!device_id } : {}), reservation: reservations }
    })
    return json({ [table]: items })
  }

  return fail(404, 'unknown_endpoint', `${req.method} ${path}`)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  const url = new URL(req.url)
  const path = url.pathname.replace(/^\/(functions\/v1\/)?partner-api/, '') || '/'

  // Self-check receiver: verifies a webhook exactly as the partner app should, and logs the result.
  // Point the webhook URL here to test delivery and signatures end to end.
  if (path === '/internal/selftest' && req.method === 'POST') {
    const body = await req.text()
    const ts = req.headers.get('x-rumi-timestamp') ?? ''
    const sig = (req.headers.get('x-rumi-signature') ?? '').replace(/^sha256=/, '')
    const secret = await config('partner_webhook_secret')
    const fresh = Math.abs(Date.now() / 1000 - Number(ts)) < 300
    const ok = !!secret && fresh && sig === (await hmacHex(secret, `${ts}.${body}`))
    await log(`self-test ${req.headers.get('x-rumi-event')}`, ok, ok ? `Signature valid, ${body.length} bytes` : 'Signature check failed')
    return ok ? json({ received: true }) : fail(401, 'bad_signature')
  }

  if (path === '/internal/deliver') {
    const secret = req.headers.get('x-sync-secret')
    if (!secret || secret !== (await config('sync_secret'))) return fail(401, 'unauthorised')
    return json(await deliver())
  }
  try {
    return await api(req, path, url)
  } catch (e) {
    return fail(500, 'server_error', e instanceof Error ? e.message : String(e))
  }
})

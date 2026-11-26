// Partner API: connects the tablet to the hotel's own front desk app.
//
//   Partner app -> us   REST API, authenticated with "Authorization: Bearer <api key>"
//   us -> partner app   signed webhooks for every tablet event
//
// See docs/partner-api.md for the full guide.

import { createClient } from 'npm:@supabase/supabase-js@2'
import { STATUSES, cleanInvoice, cleanWifi, isDate, normRef } from './validate.ts'

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false },
})

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-sync-secret, apikey, x-client-info',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
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
  'id, created_at, status, language, doc_source, doc_type, issuing_country, nationality, surname, given_names, document_number, birth_date, sex, expiry_date, mrz_valid, phone, email, shuttle, consent_at, approved_at, data_purged_at, desk_code, handoff_id, policy_id, hotel_policies(id, lang, version)'

// deno-lint-ignore no-explicit-any
function shapeCheckin(c: any) {
  return {
    id: c.id,
    created_at: c.created_at,
    status: c.status,
    // Short number the guest shows at reception, e.g. "P17" (when passports are scanned at the desk).
    desk_code: c.desk_code,
    passport_scanned_on_tablet: c.doc_source === 'mrz',
    // Set when your app sent this booking to the tablet (POST /v1/handoffs).
    handoff_id: c.handoff_id ?? null,
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
    // The hotel policy version the guest read and signed (null if none was published).
    policy_signed: c.hotel_policies ? { id: c.hotel_policies.id, lang: c.hotel_policies.lang, version: c.hotel_policies.version } : null,
    approved_at: c.approved_at,
    ...(c.signature_png !== undefined ? { signature_png: c.signature_png } : {}),
    data_deleted: !!c.data_purged_at,
  }
}

/** Throws on a failed query, so a database hiccup is never mistaken for "record deleted". */
function must<T>(r: { data: T; error: { message: string } | null }): T {
  if (r.error) throw new Error(r.error.message)
  return r.data
}

async function loadCheckin(id: string, withSignature: boolean) {
  const data = must(await db
    .from('checkins')
    .select(`${CHECKIN_FIELDS}${withSignature ? ', signature_png' : ''}, reservations!inner(${RES_FIELDS}), checkin_guests(*)`)
    .eq('id', id)
    .maybeSingle())
  return data ? shapeCheckin(data) : null
}

async function loadHandoff(id: string) {
  const data = must(await db
    .from('tablet_handoffs')
    .select(`id, status, created_at, expires_at, language, checkin_id, devices(id, name), reservations(${RES_FIELDS})`)
    .eq('id', id)
    .maybeSingle())
  if (!data) return null
  // deno-lint-ignore no-explicit-any
  const d = data as any
  return { id: d.id, status: d.status, created_at: d.created_at, expires_at: d.expires_at, language: d.language, checkin_id: d.checkin_id, tablet: d.devices, reservation: d.reservations }
}

/* ---------------------------------------------------------------- webhooks */

async function eventData(event: string, subjectId: string) {
  if (event.startsWith('checkin.')) {
    const checkin = await loadCheckin(subjectId, true)
    return checkin ? { checkin } : null
  }
  if (event === 'checkout.created') {
    const data = must(await db.from('checkouts').select(`id, created_at, rating, key_returned, device_id, reservations!inner(${RES_FIELDS})`).eq('id', subjectId).maybeSingle())
    return data ? { checkout: { id: data.id, created_at: data.created_at, rating: data.rating, key_returned: data.key_returned, from_tablet: !!data.device_id, reservation: data.reservations } } : null
  }
  if (event === 'feedback.created') {
    const data = must(await db.from('feedback').select(`id, created_at, rating, comment, reservations(${RES_FIELDS})`).eq('id', subjectId).maybeSingle())
    return data ? { feedback: { id: data.id, created_at: data.created_at, rating: data.rating, comment: data.comment, reservation: data.reservations } } : null
  }
  if (event === 'handoff.declined') {
    const h = await loadHandoff(subjectId)
    return h ? { handoff: h } : null
  }
  if (event === 'invoice.requested') {
    const data = must(await db.from('reservations').select(`${RES_FIELDS}, invoice_requested_at`).eq('id', subjectId).maybeSingle())
    if (!data) return null
    const { invoice_requested_at, ...reservation } = data
    return { invoice_request: { requested_at: invoice_requested_at, reservation } }
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
    let data: Awaited<ReturnType<typeof eventData>>
    try {
      data = await eventData(ev.event, ev.subject_id)
    } catch (e) {
      // Database error while reading the event: try again later rather than dropping it.
      const msg = `Could not read event data: ${e instanceof Error ? e.message : String(e)}`
      await db.from('webhook_outbox').update({ last_error: msg, next_attempt_at: new Date(Date.now() + 2 * 60_000).toISOString() }).eq('id', ev.id)
      await log(ev.event, false, msg)
      continue
    }
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
    const d = data as { [k: string]: { reservation?: { booking_ref?: string } } | undefined }
    const ref = (d.checkin ?? d.checkout ?? d.feedback ?? d.invoice_request ?? d.handoff)?.reservation?.booking_ref ?? null
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

async function reservationByRef(ref: string) {
  const { data } = await db.from('reservations').select('id, booking_ref, status, wifi').eq('booking_ref', normRef(ref)).maybeSingle()
  return data
}

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
  if (b.wifi !== undefined) {
    if (b.wifi === null) row.wifi = null
    else {
      const w = cleanWifi(b.wifi)
      if (w.error) return { error: `[${i}] ${w.error}` }
      row.wifi = w.wifi
    }
  }
  return { row }
}

async function setStatus(ref: string, status: string, room?: string | null) {
  const r = must(await db.from('reservations').select('id, booking_ref').eq('booking_ref', normRef(ref)).maybeSingle())
  if (!r) return null
  const patch: Record<string, unknown> = { status }
  if (room) patch.room_number = room
  must(await db.from('reservations').update(patch).eq('id', r.id))
  if (status === 'in_house') {
    must(await db.from('checkins').update({ status: 'approved', approved_at: new Date().toISOString() }).eq('reservation_id', r.id).eq('status', 'waiting'))
  }
  if (status === 'expected') {
    must(await db.from('checkins').update({ status: 'rejected' }).eq('reservation_id', r.id).eq('status', 'waiting'))
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
    const result = must(await db.rpc('decide_checkin', {
      p_id: m[1], p_approve: m[2] === 'approve',
      p_room: typeof body.room_number === 'string' ? body.room_number : null, p_actor: null,
    }))
    if (result === 'not_found') return fail(404, 'not_found')
    if (result === 'room_required') return fail(400, 'room_required')
    if (result !== 'ok') return fail(409, String(result))
    return json({ checkin: await loadCheckin(m[1], false) })
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
    // A bulk upsert sends every column any row has, and sets it to NULL on rows that left it out.
    // So save rows that carry the same fields together: a field a booking omits is left as it is.
    const groups = new Map<string, Record<string, unknown>[]>()
    for (const r of rows) {
      const k = Object.keys(r).sort().join(',')
      groups.set(k, [...(groups.get(k) ?? []), r])
    }
    for (const g of groups.values()) {
      const { error } = await db.from('reservations').upsert(g, { onConflict: 'booking_ref' })
      if (error) return fail(400, 'save_failed', error.message)
    }
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

  // GET /v1/wifi   and   PUT /v1/wifi  { ssid, password, security, hidden, qr_payload }
  // The hotel's guest network, shown with a QR code on the tablet's Done screen.
  if (path === '/v1/wifi' && (req.method === 'GET' || req.method === 'PUT')) {
    if (req.method === 'PUT') {
      const w = cleanWifi(await req.json().catch(() => null))
      if (w.error) return fail(400, 'invalid_wifi', w.error)
      const { error } = await db
        .from('hotel_settings')
        .update({
          wifi_name: w.wifi!.ssid,
          wifi_password: w.wifi!.password ?? '',
          wifi_security: w.wifi!.security,
          wifi_hidden: w.wifi!.hidden,
          wifi_qr: w.wifi!.qr_payload,
          wifi_updated_by: 'partner',
          updated_at: new Date().toISOString(),
        })
        .eq('id', 1)
      if (error) return fail(400, 'save_failed', error.message)
      await log('Wi-Fi updated', true, `Guest network ${w.wifi!.ssid}`)
    }
    const { data: s } = await db.from('hotel_settings').select('wifi_name, wifi_password, wifi_security, wifi_hidden, wifi_qr, wifi_updated_by, updated_at').eq('id', 1).single()
    return json({
      wifi: s?.wifi_name
        ? { ssid: s.wifi_name, password: s.wifi_password || null, security: s.wifi_security, hidden: s.wifi_hidden, qr_payload: s.wifi_qr, updated_by: s.wifi_updated_by }
        : null,
    })
  }

  // PUT|GET|DELETE /v1/reservations/:booking_ref/wifi   Wi-Fi for one stay (overrides the hotel network)
  m = path.match(/^\/v1\/reservations\/([^/]+)\/wifi$/)
  if (m && ['GET', 'PUT', 'DELETE'].includes(req.method)) {
    const r = await reservationByRef(decodeURIComponent(m[1]))
    if (!r) return fail(404, 'not_found', 'No reservation with that booking_ref')
    if (req.method === 'GET') return json({ wifi: r.wifi ?? null })
    let wifi: Record<string, unknown> | null = null
    if (req.method === 'PUT') {
      const w = cleanWifi(await req.json().catch(() => null))
      if (w.error) return fail(400, 'invalid_wifi', w.error)
      wifi = w.wifi!
    }
    await db.from('reservations').update({ wifi }).eq('id', r.id)
    return json({ wifi })
  }

  // PUT|GET|DELETE /v1/reservations/:booking_ref/invoice   The guest's bill, shown at check-out.
  m = path.match(/^\/v1\/reservations\/([^/]+)\/invoice$/)
  if (m && ['GET', 'PUT', 'DELETE'].includes(req.method)) {
    const r = await reservationByRef(decodeURIComponent(m[1]))
    if (!r) return fail(404, 'not_found', 'No reservation with that booking_ref')
    if (req.method === 'DELETE') {
      await db.from('invoices').delete().eq('reservation_id', r.id)
      return json({ invoice: null })
    }
    if (req.method === 'PUT') {
      const body = await req.json().catch(() => null)
      const inv = cleanInvoice(body)
      if (inv.error) return fail(400, 'invalid_invoice', inv.error)
      const i = inv.invoice!
      const { error } = await db.from('invoices').upsert(
        { reservation_id: r.id, data: i, currency: i.currency, total: i.total, balance: i.balance, received_at: new Date().toISOString() },
        { onConflict: 'reservation_id' },
      )
      if (error) return fail(400, 'save_failed', error.message)
      await log('invoice received', true, `${i.currency} ${i.total}, balance ${i.balance}`, r.booking_ref)
    }
    const { data: row } = await db.from('invoices').select('data, received_at').eq('reservation_id', r.id).maybeSingle()
    return row ? json({ invoice: row.data, received_at: row.received_at }) : fail(404, 'no_invoice', 'No invoice has been sent for this booking')
  }

  // GET /v1/policy[?lang=ru]   and   PUT /v1/policy/:lang  { "body_md": "..." }
  // The hotel rulebook shown above the signature on the tablet. Every PUT is a new version.
  if (req.method === 'GET' && path === '/v1/policy') {
    const langs = url.searchParams.get('lang') ? [url.searchParams.get('lang')!] : ['en', 'ru', 'tg']
    const out: Record<string, unknown> = {}
    for (const l of langs) {
      const { data } = await db.from('hotel_policies').select('id, lang, version, body_md, created_at').eq('lang', l).order('version', { ascending: false }).limit(1).maybeSingle()
      out[l] = data ?? null
    }
    return json({ policies: out })
  }
  m = path.match(/^\/v1\/policy\/(en|ru|tg)$/)
  if (req.method === 'PUT' && m) {
    const body = await req.json().catch(() => null)
    const md = typeof body?.body_md === 'string' ? body.body_md.trim() : ''
    if (!md) return fail(400, 'body_required', 'Send { "body_md": "<markdown>" }')
    if (md.length > 60000) return fail(400, 'too_long', 'At most 60,000 characters')
    const { data: last } = await db.from('hotel_policies').select('version').eq('lang', m[1]).order('version', { ascending: false }).limit(1).maybeSingle()
    const { data, error } = await db
      .from('hotel_policies')
      .insert({ lang: m[1], version: (last?.version ?? 0) + 1, body_md: md, created_by: 'front desk app' })
      .select('id, lang, version, created_at')
      .single()
    if (error) return fail(400, 'save_failed', error.message)
    await log('policy published', true, `${m[1]} v${data.version}`)
    return json({ policy: data })
  }

  // GET /v1/tablets
  if (req.method === 'GET' && path === '/v1/tablets') {
    const { data } = await db.from('devices').select('id, name, paired_at, last_seen_at, revoked').order('created_at')
    const now = Date.now()
    return json({
      tablets: (data ?? [])
        .filter((d) => d.paired_at && !d.revoked)
        .map((d) => ({ id: d.id, name: d.name, online: !!d.last_seen_at && now - new Date(d.last_seen_at).getTime() < 180_000, last_seen_at: d.last_seen_at })),
    })
  }

  // POST /v1/handoffs  { booking_ref, tablet?, passport?, language?, reservation? }
  // Reception scanned the passport: show this booking on a tablet so the guest can confirm and sign.
  if (req.method === 'POST' && path === '/v1/handoffs') {
    const body = await req.json().catch(() => null)
    if (!body || typeof body !== 'object') return fail(400, 'bad_body', 'Send a JSON object.')
    if (body.reservation) {
      const r = cleanReservation({ booking_ref: body.booking_ref, ...body.reservation }, 0)
      if (r.error) return fail(400, 'invalid_reservation', r.error)
      if (r.row!.status && !['expected', 'in_house'].includes(String(r.row!.status))) return fail(409, 'reservation_not_expected')
      if (normRef(String(r.row!.booking_ref)) !== normRef(String(body.booking_ref ?? ''))) return fail(400, 'invalid_reservation')
      // An old handoff must never overwrite a stay that reception has closed.
      must(await db.from('reservations').upsert(r.row!, { onConflict: 'booking_ref', ignoreDuplicates: true }))
      const { booking_ref, status, ...fields } = r.row!
      if (status === 'in_house') fields.status = status
      must(await db.from('reservations').update(fields).eq('booking_ref', normRef(String(booking_ref))).in('status', ['expected', 'in_house']))
    }
    const ref = typeof body.booking_ref === 'string' ? body.booking_ref.trim().toUpperCase().replace(/\s+/g, '') : ''
    if (!ref) return fail(400, 'booking_ref_required')
    const { data: res } = await db.from('reservations').select('id, status').eq('booking_ref', ref).maybeSingle()
    if (!res) return fail(404, 'reservation_not_found', 'Send the booking first (PUT /v1/reservations), or include "reservation" in this request.')
    if (!['expected', 'in_house'].includes(res.status)) return fail(409, 'reservation_not_expected', `Booking status is ${res.status}`)
    const { data: devs } = await db.from('devices').select('id, name, last_seen_at').not('paired_at', 'is', null).eq('revoked', false)
    const list = devs ?? []
    let dev = list.find((d) => d.id === body.tablet || d.name.toLowerCase() === String(body.tablet ?? '').toLowerCase())
    if (!body.tablet) {
      if (list.length === 1) dev = list[0]
      else return fail(400, 'tablet_required', `Several tablets are paired; send "tablet" with one of: ${list.map((d) => d.name).join(', ')}`)
    }
    if (!dev) return fail(404, 'tablet_not_found', `Known tablets: ${list.map((d) => d.name).join(', ')}`)
    let passport: Record<string, string> | null = null
    if (body.passport && typeof body.passport === 'object') {
      const pp = body.passport
      passport = {}
      for (const [k, max] of [['surname', 80], ['given_names', 120], ['nationality', 3], ['document_number', 20], ['doc_type', 4], ['issuing_country', 3]] as const) {
        if (pp[k]) passport[k] = String(pp[k]).trim().toUpperCase().slice(0, max)
      }
      for (const k of ['birth_date', 'expiry_date'] as const) if (isDate(pp[k])) passport[k] = pp[k]
      if (['M', 'F', 'X'].includes(pp.sex)) passport.sex = pp.sex
    }
    const lang = ['en', 'ru', 'tg'].includes(body.language) ? body.language : null
    const { data: h, error } = await db.rpc('create_handoff', { p_reservation_id: res.id, p_device_id: dev.id, p_passport: passport, p_language: lang, p_source: 'partner' })
    if (error?.message === 'reservation_not_expected') return fail(409, 'reservation_not_expected')
    if (error) return fail(400, 'handoff_failed', error.message)
    return json({ handoff: await loadHandoff((h as { id: string }).id) }, 201)
  }

  // GET /v1/handoffs/:id   and   POST /v1/handoffs/:id/cancel
  m = path.match(/^\/v1\/handoffs\/([0-9a-f-]{36})(\/cancel)?$/)
  if (m && ((req.method === 'GET' && !m[2]) || (req.method === 'POST' && m[2]))) {
    if (m[2]) await db.from('tablet_handoffs').update({ status: 'cancelled' }).eq('id', m[1]).in('status', ['pending', 'shown'])
    const h = await loadHandoff(m[1])
    return h ? json({ handoff: h }) : fail(404, 'not_found')
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

# Codex prompt: connect the Front Desk app to The Rumi check-in tablet

> **Update 2026-11-23:** the tablet no longer has a check-out screen. Anything below about tablet check-out, `invoice.requested`, `checkout.created`, `feedback.created` or the tablet showing a bill no longer happens, so don't build it. Invoices reach the tablet through the owner's eZee button (folio station), and feedback through his mobile app. After a check-out in eZee, still send `status: checked_out`.

**How to use this file:** open the Front Desk app's repository in Codex and paste everything below the line as the task. Codex will look through the app first, then build the connection. Before it runs, have the tablet admin create the **API key** and **signing secret** (tablet admin → Settings → Front desk app connection) and put them in the Front Desk app's server environment yourself. Never paste them into the chat.

---

## Task

You are working in the codebase of the Front Desk app for **The Rumi Hotel & Residences** (Dushanbe). This app already talks to **eZee FrontDesk** (reservations, rooms, folios) and reception uses it with a passport scanner.

The hotel also has guest **check-in tablets** at reception (a separate web app). Connect this app to the tablet through the tablet's **Partner API** (REST, JSON) and **webhooks** (signed HTTP POSTs to this app), so that:

1. Reception scans a passport here and checks the guest in on eZee. The tablet then opens on its own at the Details step, greets the guest by surname in their language, shows the hotel policy and takes the signature. The tablet has no Check-in button: every check-in starts here.
2. Tablet check-ins arrive here instantly. Reception approves them with a room number.
3. The tablet always has today's bookings and in-house guests, with room numbers.
4. The tablet shows the **guest Wi-Fi as a QR code** when check-in is done. This app sets that Wi-Fi.
5. When a guest checks out on the tablet, the tablet shows their **full bill**. This app sends it from the eZee folio.
6. Tablet check-outs and private guest feedback arrive here.

eZee stays the system of record. This app remains the only thing that talks to eZee. The tablet never talks to eZee when this connection is on.

### Before you write code

Explore the repository and write a short plan (as a comment in your first message, or a `docs/rumi-tablet-plan.md`) that names, in this codebase:

- the language, framework, HTTP server and how routes are added
- the eZee client: how reservations, rooms, guests and **folios / bills / transactions** are read
- where the passport scanner result arrives (the data object and the screen or handler)
- the reservation model and statuses, and how they map to the tablet's statuses (table below)
- background jobs or schedulers (for the periodic sync), and any queue
- configuration and secrets handling, and the database (for webhook de-duplication and the reception queue)
- the existing test setup

Follow the patterns the codebase already uses. Don't add a new framework when one is already there. Don't change existing eZee behaviour except where this task needs it.

### Configuration

Read these from the environment, server side only. Never ship them to a browser or mobile client, and never log them.

| Variable | Example | Purpose |
|---|---|---|
| `RUMI_API_URL` | `https://qlvlmgrslqexmqmzpuko.supabase.co/functions/v1/partner-api` | Base URL of the tablet API |
| `RUMI_API_KEY` | `rumi_…` | Sent as `Authorization: Bearer <key>` |
| `RUMI_WEBHOOK_SECRET` | `whsec_…` | Verifies webhook signatures |
| `RUMI_TABLET_NAME` | `Lobby Tablet 1` | Default tablet for handoffs (optional when only one tablet is paired) |
| `RUMI_SYNC_ENABLED` | `true` | Master switch, so the connection can be turned off without a deploy |

If `RUMI_API_KEY` is missing, the app must keep working exactly as before. Log one warning and skip all tablet calls.

---

## What to build

### 1. API client (`rumiClient` or the codebase's equivalent)

A small typed client for every endpoint in the reference below.

- Base URL and key from config. `Content-Type: application/json`.
- Timeout 10 seconds per call.
- Retry on network errors and HTTP 5xx: up to 3 attempts with 1 s, 3 s, 9 s back-off. Never retry 4xx; log the `error` and `detail` from the body.
- Errors come back as `{ "error": "code", "detail": "human text" }`. Surface the code to callers.
- Log method, path, status and duration. Never log request bodies that contain passport data, signatures or the key.

### 2. Webhook receiver: `POST /integrations/rumi/webhook`

Use whatever route prefix the app already uses.

1. Read the **raw** body as bytes or text before any JSON parsing.
2. Verify the signature: `expected = hex(HMAC_SHA256(RUMI_WEBHOOK_SECRET, "<X-Rumi-Timestamp>.<raw body>"))`. Compare with the hex after `sha256=` in `X-Rumi-Signature` using a constant-time comparison. Reject with `401` if it doesn't match, or if the timestamp is more than 300 seconds from now.
3. De-duplicate on `X-Rumi-Delivery` (same as `id` in the body; it stays the same on retries). Store delivery ids with a unique constraint. If it was already seen, answer `200` and stop.
4. Answer `200 {"received": true}` within 15 seconds. Do slow work (eZee calls) in a background job or queue, not in the request.
5. Dispatch on `event` (see the webhook reference): `checkin.created`, `checkin.updated`, `checkout.created`, `feedback.created`, `handoff.declined`, `invoice.requested`, `ping`. Unknown events: log and answer `200`.

Failed deliveries are retried by the tablet for about 12 hours (2, 4, 8 … 60 minutes apart), so a short outage here loses nothing.

### 3. Booking sync → `PUT /v1/reservations`

- Every 3 minutes, and right after reception changes a booking here, send:
  - arrivals from **yesterday to tomorrow** (hotel time, Asia/Dushanbe), and
  - **every in-house guest**, with `room_number`.
- Up to 500 per request; batch if more. The call is an idempotent upsert on `booking_ref`, so sending the same bookings again is fine.
- Use the eZee booking id as `booking_ref` (and also as `ezee_booking_id`). Put channel confirmation numbers (Booking.com, Expedia …) in `other_refs`, so guests can type either.
- Map statuses:

| eZee / this app | tablet `status` |
|---|---|
| confirmed, not arrived | `expected` |
| checked in / in house | `in_house` (with `room_number`) |
| checked out | `checked_out` |
| cancelled | `cancelled` |
| no-show | `no_show` |

- The tablet only finds bookings that are `expected` with arrival from yesterday to tomorrow. Tablet check-out needs `in_house` with a `room_number`.
- Sending `expected` never moves a guest backwards once they have checked in on the tablet, so you don't need special handling for that.
- `adults`: the real number of adults. `breakfast`: true when the rate plan includes breakfast.

### 4. Passport scan → tablet: `POST /v1/handoffs`

In the flow where reception scans a passport and checks the guest in on eZee, send the handoff **automatically** as soon as the eZee check-in succeeds (when exactly one booking matched; otherwise let reception pick the booking first, then send). Also keep a manual **"Send to tablet"** button for retries. The tablet opens straight on the Details step ("Welcome, <Surname>"), so send the real passport `surname` and `nationality`.

- Body: `booking_ref`, `tablet` (from config, or let reception choose from `GET /v1/tablets` when there are several), `passport` (the scanner's fields), and `reservation` (the full booking, so it doesn't need to have been synced yet).
- Don't send `language`; the tablet picks it from the passport nationality. Send it only when reception chose one.
- Show reception the result: "Sent to Lobby Tablet 1", or the error in plain words:
  - `409 reservation_not_expected` → already checked in or cancelled
  - `400 tablet_required` → choose a tablet
  - `404 tablet_not_found` → tablet name wrong
- Keep the returned `handoff.id` with the booking. When `checkin.created` arrives with the same `handoff_id`, link them. On `handoff.declined` ("Not you?" on the tablet), alert reception on that booking.
- Add "Cancel" → `POST /v1/handoffs/{id}/cancel`.

### 5. Tablet check-ins → reception queue

On `checkin.created`:

- Add the guest to a **reception queue** here, showing: guest name, booking, `desk_code` (when present, the guest shows this number at the desk), passport fields, phone, email, airport shuttle request, the signature image (`signature_png`, a PNG data URL), and `additional_guests`.
- `guest.document.source` is `desk` when the passport details came from this app's scan, or `none` when the guest found the booking themselves. Then reception must scan the passport here.
- Write the contact details, shuttle request and signature to the eZee booking the same way this app already writes guest data to eZee (skip any field eZee rejects; log it).
- The guest was already checked in on eZee when you sent the handoff, so **approve automatically** with the eZee room: `POST /v1/checkins/{id}/approve` with `{ "room_number": "305" }`. The tablet's Done screen asks for the room for about 30 seconds after the guest signs, so approve straight away. **Send back** (`POST /v1/checkins/{id}/reject`) only if reception spots a problem.
- Store `policy_signed` (`{ id, lang, version }`) with the stay: it is the exact hotel policy version the guest signed.
- On `checkin.updated` (approved or rejected from elsewhere), update the queue item so two receptionists don't act on it twice. `409 already_handled` from approve or reject means someone else did it: refresh and move on.

When a check-in happens at the desk without the tablet (walk-in, or the guest skipped the tablet), call `POST /v1/reservations/{booking_ref}/status` with `in_house` and the room. That also closes any waiting tablet check-in.

### 6. Guest Wi-Fi → `PUT /v1/wifi` (and per stay)

The tablet's Done screen shows the Wi-Fi with a QR code. Phones join the network by scanning it.

- Add **Guest Wi-Fi** settings here (network name, password, security `WPA`/`WEP`/`nopass`, hidden yes/no) if the app doesn't have them already.
- Send them with `PUT /v1/wifi` when saved, and once at app start-up, so the tablet always matches. This replaces whatever the tablet admin typed.
- **Optional, if the hotel uses per-guest Wi-Fi vouchers** (for example from the router or hotspot system): on `checkin.created`, create the voucher and send `PUT /v1/reservations/{booking_ref}/wifi` with `ssid`, `password`, `security` and a short `note` such as "Valid until 25 Nov, 12:00". Do this within about 15 seconds, because the Done screen checks for a personal Wi-Fi for about 20 seconds before it settles on the hotel network. You can also include `wifi` in the reservation when you send the handoff, which is the most reliable way. If there's no voucher system, skip this part; the hotel network is shown.
- If the hotspot uses a login page instead of a password, send `qr_payload` with the login URL. The QR then opens that page.

### 6b. Hotel policy (rulebook)

The tablet shows the hotel policy above the signature box, in the guest's language. Publish it from this app with `PUT /v1/policy/{en|ru|tg}` and `{ "body_md": "<markdown>" }` (or the admin uploads a `.md` file in the tablet admin, Settings → Hotel policy). Each publish is a new version. If a language is missing, guests see English. Don't machine-translate the rules silently: have the Russian and Tajik versions checked by a person.

### 7. The guest's bill → `PUT /v1/reservations/{booking_ref}/invoice`

At check-out the tablet shows every charge, taxes, payments and the balance.

- On `invoice.requested` (a guest has just opened check-out on the tablet): read the booking's **folio from eZee** right away and send it. The guest is looking at a loading state; the tablet waits **up to 20 seconds**. Handle this event first, ahead of any other queued work.
- Also send the bill when the folio changes here (posting a charge or a payment), so a recent copy is already there.
- Mapping from the eZee folio:
  - Each charge (room night, restaurant, minibar, laundry, extras) → one `lines[]` item: `date` (`YYYY-MM-DD`), `description` (guest-readable; English is fine, keep it short), `quantity`, `unit_price`, `amount`. Leave out voided or transferred charges. Discounts and corrections are lines with a negative `amount`.
  - Taxes → `taxes[]` with `name` (such as "VAT 15%") and `amount`. If eZee's charge amounts already include tax, set `prices_include_tax: true`.
  - Deposits and payments → `payments[]` with `date`, `method` and `amount`. Card payments show only the brand and last 4 digits (`Visa •••• 4242`). **Never send a full card number, expiry or CVV.**
  - `currency`: the folio currency (ISO code, usually `TJS`).
  - Send your own `subtotal`, `tax_total`, `total`, `paid` and `balance` when eZee has them, so the tablet shows exactly the folio's figures. Otherwise the tablet works them out.
  - `invoice_number`: the eZee folio or invoice number, if there is one.
- A positive `balance` makes the tablet ask the guest to settle at the desk. `0` shows "Paid in full".
- If eZee can't be reached, don't send anything. After 20 seconds the tablet tells the guest the bill is ready at the front desk.

### 8. Check-outs and feedback

- `checkout.created`: the guest checked out on the tablet and left the key. Show it to reception, then finish the check-out on eZee once the bill is settled (this app's normal check-out flow). If eZee refuses because of an open balance, flag it for reception.
- `feedback.created`: a 1 to 3 star rating with a private comment. Show it to the manager. It never goes public.
- After a desk check-out, call `POST /v1/reservations/{booking_ref}/status` with `checked_out`.

### 9. Catch-up and status screen

- Every 10 minutes, and once at start-up, call `GET /v1/checkins?since=<last seen created_at minus 5 minutes>` and add any check-in the webhooks missed. Do the same for `/v1/checkouts` and `/v1/feedback`.
- Add a small **"Check-in tablet"** status panel to the admin or settings area: connected (via `GET /v1/ping`), last webhook received, last booking sync, tablets online (`GET /v1/tablets`), and the last error. Add a **"Test connection"** button that calls ping.

### 10. Tests

- Unit tests for: signature verification (valid, wrong secret, old timestamp, changed body), status mapping, folio → invoice mapping (including tax-inclusive, discounts, payments and card masking), and de-duplication.
- An integration test of the webhook route with a body signed in the test.
- Use the codebase's existing test framework.

### Definition of done

- With the env vars unset, the app behaves exactly as before.
- With them set: the "Test connection" button shows the hotel name; a handoff opens the booking on the tablet; a tablet check-in appears in the reception queue with its signature; approving it closes it on the tablet; the tablet's Done screen shows the Wi-Fi saved here; opening check-out on the tablet shows that guest's eZee folio within a few seconds; replaying a webhook does nothing the second time; a webhook with a bad signature gets `401`.
- No secrets, passport numbers or signatures appear in logs.

---

## API reference

- Base URL: `RUMI_API_URL`
- Auth header on every call: `Authorization: Bearer <RUMI_API_KEY>`
- JSON in and out. Dates are `YYYY-MM-DD`. Times are ISO 8601 UTC.
- Errors: `{ "error": "code", "detail": "…" }` with HTTP 400, 401, 404, 409 or 500.
- `booking_ref` is matched case-insensitively with spaces removed.

### `GET /v1/ping`

```json
{ "ok": true, "hotel": "The Rumi Hotel & Residences", "time": "2026-11-22T09:00:00Z" }
```

### `GET /v1/tablets`

```json
{ "tablets": [ { "id": "uuid", "name": "Lobby Tablet 1", "online": true, "last_seen_at": "…" } ] }
```

### `PUT /v1/reservations`

Body: an array (or `{ "reservations": [...] }`), at most 500. Upsert by `booking_ref`.

```json
[
  {
    "booking_ref": "33215-1",
    "guest_name": "Anna Maria Eriksson",
    "arrival_date": "2026-11-21",
    "departure_date": "2026-11-24",
    "source": "Booking.com",
    "room_type": "Deluxe Double",
    "room_number": "305",
    "adults": 2,
    "breakfast": true,
    "other_refs": ["4455667788"],
    "partner_ref": "your-internal-id-77",
    "ezee_booking_id": "33215-1",
    "status": "expected",
    "notes": null,
    "wifi": { "ssid": "Rumi-Room-305", "password": "K7QF-29XA", "security": "WPA", "note": "Valid until 24 Nov, 12:00" }
  }
]
```

Required: `booking_ref`, `guest_name`, `arrival_date`, `departure_date` (after arrival). `status` is one of `expected`, `pending_desk`, `in_house`, `checked_out`, `cancelled`, `no_show`. `wifi` is optional (`null` removes it). Field limits: `guest_name` 120, `source` 40, `room_type` 60, `room_number` 10, `notes` 500, `other_refs` up to 5 × 40, `partner_ref` 60.

→ `200 { "ok": true, "saved": 1 }` · `400 invalid_reservations` (detail lists the bad items by index)

### `POST /v1/reservations/{booking_ref}/status`

```json
{ "status": "in_house", "room_number": "412" }
```

`in_house` also approves any waiting tablet check-in; `expected` sends a waiting one back. → `200 { "ok": true }` · `404 not_found` · `400 bad_status`

### `POST /v1/handoffs`

```json
{
  "booking_ref": "33215-1",
  "tablet": "Lobby Tablet 1",
  "passport": {
    "surname": "ERIKSSON", "given_names": "ANNA MARIA", "nationality": "SWE",
    "document_number": "L898902C3", "birth_date": "1974-08-12", "sex": "F",
    "expiry_date": "2031-04-15", "doc_type": "P", "issuing_country": "SWE"
  },
  "language": "en",
  "reservation": { "guest_name": "Anna Maria Eriksson", "arrival_date": "2026-11-22", "departure_date": "2026-11-25", "room_type": "Deluxe Double", "adults": 2, "breakfast": true }
}
```

`tablet` (name or id) can be left out when one tablet is paired. `passport`, `language` (`en`/`ru`/`tg`) and `reservation` (same fields as `PUT /v1/reservations`) are optional. A new handoff replaces an older one on the same tablet and expires after 10 minutes if the tablet never shows it.

→ `201 { "handoff": { "id", "status": "pending", "created_at", "expires_at", "language", "checkin_id": null, "tablet": { "id", "name" }, "reservation": { … } } }`
Errors: `404 reservation_not_found`, `409 reservation_not_expected`, `400 tablet_required`, `404 tablet_not_found`, `400 invalid_reservation`.

`GET /v1/handoffs/{id}` → the same shape. `status` is `pending`, `shown`, `completed` (with `checkin_id`), `declined` or `cancelled`.
`POST /v1/handoffs/{id}/cancel` → takes it off the tablet.

### `GET /v1/checkins`

Query: `status=waiting|approved|rejected`, `since=<ISO time>`, `limit` (1 to 200, default 100), `include_signature=true`. Newest first. → `{ "checkins": [ <checkin> ] }` (shape under `checkin.created` below).

`GET /v1/checkins/{id}` → `{ "checkin": <checkin> }`, always with the signature.

### `POST /v1/checkins/{id}/approve` and `/reject`

Approve body: `{ "room_number": "305" }` (required). → `{ "checkin": <checkin> }` · `409 already_handled` · `400 room_required` · `404 not_found`

### `GET /v1/wifi` and `PUT /v1/wifi`

```json
{ "ssid": "Rumi-Guest", "password": "welcome2026", "security": "WPA", "hidden": false, "qr_payload": null }
```

`ssid` required (≤ 64). `password` required unless `security` is `nopass` (≤ 63). `security` is `WPA` (default when there's a password), `WEP` or `nopass`. `qr_payload` (≤ 500) replaces the standard Wi-Fi QR text, for example with a hotspot login URL.
→ `{ "wifi": { "ssid", "password", "security", "hidden", "qr_payload", "updated_by": "partner" } }` · `400 invalid_wifi`

### `PUT`, `GET`, `DELETE /v1/reservations/{booking_ref}/wifi`

Same body as `/v1/wifi`, plus optional `note` (≤ 140). → `{ "wifi": { … } }` (`null` after `DELETE`) · `404 not_found` · `400 invalid_wifi`

### `PUT`, `GET`, `DELETE /v1/reservations/{booking_ref}/invoice`

```json
{
  "invoice_number": "INV-2026-00123",
  "currency": "TJS",
  "issued_at": "2026-11-24T08:05:00Z",
  "guest_name": "Anna Maria Eriksson",
  "lines": [
    { "date": "2026-11-21", "description": "Deluxe Double, room and breakfast", "quantity": 1, "unit_price": 950, "amount": 950, "category": "room" },
    { "date": "2026-11-22", "description": "Minibar", "quantity": 3, "unit_price": 25, "amount": 75, "category": "minibar" },
    { "date": "2026-11-22", "description": "Loyalty discount", "amount": -50 }
  ],
  "taxes": [ { "name": "VAT 15%", "amount": 146.25 } ],
  "prices_include_tax": false,
  "payments": [ { "date": "2026-11-21", "method": "Visa •••• 4242", "amount": 500 } ],
  "subtotal": 975, "tax_total": 146.25, "total": 1121.25, "paid": 500, "balance": 621.25,
  "note": "Thank you for staying with us"
}
```

| Field | Rule |
|---|---|
| `currency` | Required, 3-letter ISO code. |
| `lines` | Required, 1 to 300. `description` required (≤ 120). `amount`, or `unit_price` × `quantity` (default 1). `date` optional `YYYY-MM-DD`. `category` optional (≤ 30). |
| `taxes` | Optional, ≤ 20, each `{ name, amount }`. |
| `payments` | Optional, ≤ 50, each `{ date, method, amount }`. |
| `prices_include_tax` | `true` → `total` = sum of lines. Otherwise `total` = lines + taxes. |
| `subtotal`, `tax_total`, `total`, `paid`, `balance` | Optional; computed when missing. `balance` = `total` − `paid`. |
| `invoice_number` (≤ 40), `issued_at` (ISO), `guest_name` (≤ 120), `note` (≤ 300) | Optional. |

Amounts are numbers (strings like `"950,00"` are accepted) rounded to 2 decimals.
→ `200 { "invoice": { …normalised… }, "received_at": "…" }` · `400 invalid_invoice` (detail names the field) · `404 not_found` · `GET` with no bill → `404 no_invoice`

### `GET /v1/policy` and `PUT /v1/policy/{lang}`

`PUT` body: `{ "body_md": "<markdown, ≤ 60,000 chars>" }` → `{ "policy": { "id", "lang", "version", "created_at" } }`. `GET /v1/policy[?lang=ru]` → `{ "policies": { "en": {…}|null, "ru": …, "tg": … } }`.

### `GET /v1/checkouts` and `GET /v1/feedback`

Query: `since`, `limit`. → `{ "checkouts": [ { "id", "created_at", "rating", "key_returned", "from_tablet", "reservation" } ] }` and `{ "feedback": [ { "id", "created_at", "rating", "comment", "resolved", "reservation" } ] }`

---

## Webhook reference

The tablet POSTs to the webhook URL the tablet admin enters in Settings → Front desk app connection.

**Headers**

```
Content-Type: application/json
User-Agent: RumiCheckin-Webhook/1
X-Rumi-Event: checkin.created
X-Rumi-Delivery: 1b7c2f0e-…        (unique per event; the same on retries)
X-Rumi-Timestamp: 1795280000       (Unix seconds)
X-Rumi-Signature: sha256=5f2c…     (hex HMAC-SHA256 of "<timestamp>.<raw body>")
```

**Envelope:** `{ "id": "<delivery id>", "event": "<event>", "created_at": "<ISO>", "data": { … } }`

`reservation` objects in events: `{ id, booking_ref, alt_refs, partner_ref, ezee_booking_id, guest_name, source, room_type, room_number, arrival_date, departure_date, adults, breakfast, status }`.

| Event | `data` |
|---|---|
| `checkin.created` | `{ checkin }`: a guest finished check-in on the tablet |
| `checkin.updated` | `{ checkin }`: a check-in was approved or sent back |
| `checkout.created` | `{ checkout: { id, created_at, rating, key_returned, from_tablet, reservation } }` |
| `feedback.created` | `{ feedback: { id, created_at, rating, comment, reservation } }` (ratings 1 to 3 only) |
| `handoff.declined` | `{ handoff: { id, status, created_at, expires_at, language, checkin_id, tablet, reservation } }` |
| `invoice.requested` | `{ invoice_request: { requested_at, reservation } }`: answer with `PUT …/invoice` within seconds. At most once per 2 minutes per stay. |
| `ping` | `{ message }`: the admin pressed Send test event |

**`checkin` shape**

```json
{
  "id": "5f1a2c6b-…",
  "created_at": "2026-11-21T09:12:44Z",
  "status": "waiting",
  "desk_code": "P17",
  "handoff_id": "8c1e…",
  "passport_scanned_on_tablet": false,
  "language": "ru",
  "reservation": { "booking_ref": "33215-1", "room_number": "305", "status": "pending_desk", "…": "…" },
  "guest": {
    "surname": "ERIKSSON", "given_names": "ANNA MARIA", "nationality": "SWE", "sex": "F",
    "birth_date": "1974-08-12", "phone": "+992 00 000 0000", "email": "guest@example.com",
    "document": { "source": "desk", "type": "P", "number": "L898902C3", "issuing_country": "SWE", "expiry_date": "2031-04-15", "check_digits_valid": null }
  },
  "additional_guests": [],
  "airport_shuttle": true,
  "consent_at": "2026-11-21T09:12:30Z",
  "policy_signed": { "id": "…", "lang": "ru", "version": 4 },
  "approved_at": null,
  "signature_png": "data:image/png;base64,iVBORw0…",
  "data_deleted": false
}
```

`status`: `waiting` → `approved` or `rejected`. After the retention period (90 days by default) the tablet erases passport, contact and signature fields and `data_deleted` becomes `true`. This app should follow the same rule for the data it received.

**Signature check (Node.js / Express)**

```js
import crypto from 'node:crypto'

app.post('/integrations/rumi/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const ts = req.get('X-Rumi-Timestamp') || ''
  const sig = (req.get('X-Rumi-Signature') || '').replace(/^sha256=/, '')
  const expected = crypto.createHmac('sha256', process.env.RUMI_WEBHOOK_SECRET).update(`${ts}.${req.body}`).digest('hex')
  const fresh = Math.abs(Date.now() / 1000 - Number(ts)) < 300
  if (!fresh || sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
    return res.status(401).end()
  }
  const event = JSON.parse(req.body)
  if (await alreadySeen(event.id)) return res.json({ received: true })
  await enqueue(event) // handle event.event / event.data in a background job
  res.json({ received: true })
})
```

**Signature check (Python / Flask)**

```python
import hmac, hashlib, os, time, json
from flask import request, abort

@app.post('/integrations/rumi/webhook')
def rumi_webhook():
    ts = request.headers.get('X-Rumi-Timestamp', '')
    sig = request.headers.get('X-Rumi-Signature', '').removeprefix('sha256=')
    raw = request.get_data()
    expected = hmac.new(os.environ['RUMI_WEBHOOK_SECRET'].encode(), f'{ts}.'.encode() + raw, hashlib.sha256).hexdigest()
    if not ts.isdigit() or abs(time.time() - int(ts)) > 300 or not hmac.compare_digest(sig, expected):
        abort(401)
    event = json.loads(raw)
    # de-duplicate on event['id'], then queue event['event'] / event['data']
    return {'received': True}
```

---

## Manual test script

```bash
export RUMI=$RUMI_API_URL
curl -H "Authorization: Bearer $RUMI_API_KEY" $RUMI/v1/ping

curl -X PUT -H "Authorization: Bearer $RUMI_API_KEY" -H "Content-Type: application/json" $RUMI/v1/wifi \
  -d '{"ssid":"Rumi-Guest","password":"welcome2026","security":"WPA"}'

curl -X PUT -H "Authorization: Bearer $RUMI_API_KEY" -H "Content-Type: application/json" $RUMI/v1/reservations \
  -d '[{"booking_ref":"TEST-1","guest_name":"Test Guest","arrival_date":"2026-11-22","departure_date":"2026-11-23","room_number":"101","status":"in_house"}]'

curl -X PUT -H "Authorization: Bearer $RUMI_API_KEY" -H "Content-Type: application/json" $RUMI/v1/reservations/TEST-1/invoice \
  -d '{"currency":"TJS","lines":[{"date":"2026-11-22","description":"Room","amount":950}],"payments":[{"method":"Cash","amount":500}]}'
```

Then on the tablet: **Check out** → room `101`, surname `Guest`. The bill shows 950.00 TJS with 450.00 TJS due. Delete the test booking afterwards in the tablet admin (Arrivals → Edit → Delete) and set the Wi-Fi back to the real network.

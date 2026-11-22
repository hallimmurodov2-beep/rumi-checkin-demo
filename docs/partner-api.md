# Connecting your front desk app to The Rumi check-in tablet

This guide is for the developer of the hotel's own front desk app. When you finish, your app will:

- **receive** every tablet check-in, check-out and guest feedback instantly (webhooks)
- **send** today's bookings to the tablet, so guests can find their reservation
- **tell** the tablet when reception has checked a guest in (room number) or out
- **set** the guest Wi-Fi the tablet shows as a QR code when check-in is done
- **send** each guest's full bill, which the tablet shows at check-out

The tablet app stays separate. Your app is still the one that talks to eZee FrontDesk.

---

## 1. What you get from the hotel admin

In the tablet admin (`https://rumi-checkin.vercel.app/staff` → **Settings → Front desk app connection**), the admin creates:

| Item | Example | Used for |
|---|---|---|
| **API key** | `rumi_3f9c…` | Your app calling the tablet API |
| **Signing secret** | `whsec_8a1d…` | Checking that webhooks really come from the tablet |
| **API address** | `https://qlvlmgrslqexmqmzpuko.supabase.co/functions/v1/partner-api` | Base URL for all API calls |

You give the admin one thing: your app's **webhook address** (an `https://` URL that accepts `POST`). The admin enters it, switches on **Send tablet events**, and presses **Send test event**.

Keep the key and the secret on your server only (environment variables). Never put them in a browser page or a mobile app.

---

## 2. Reception scans the passport, the tablet shows the booking

The tablets stand at the reception desk, so the smoothest flow starts with the passport scanner you already have:

1. The guest hands the passport to the receptionist, who scans it in your app as today. Your app finds the booking in eZee.
2. Your app calls **`POST /v1/handoffs`** with the booking number, which tablet to use, and the passport details. You can include the booking itself in the same call if you haven't sent it yet.
3. Within about 2 seconds that tablet opens the booking: "Welcome, Anna — is this your booking?" It's shown in the guest's language, picked from the passport nationality (TJK → Tajik, Russian-speaking countries → Russian, otherwise English). The guest can switch languages there.
4. The guest confirms, adds a phone number, email and shuttle choice, and signs. You receive `checkin.created` with `handoff_id`, the passport details you sent, and the signature. Give the key and call **approve**.
5. If the guest taps "Not my booking", you receive `handoff.declined`, so reception can check the booking.

If the guest walks up to the tablet first, it shows "Please hand your passport to the receptionist" and waits for your handoff. A "Find my booking myself" link lets the guest look it up by name or booking number instead. In that case the tablet gives a short `desk_code` (such as `P17`) that the guest shows at reception.

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
  "reservation": { "guest_name": "Anna Maria Eriksson", "arrival_date": "2026-11-22", "departure_date": "2026-11-25", "room_type": "Deluxe Double", "room_number": "305", "adults": 2, "breakfast": true, "source": "Booking.com" }
}
```

- `tablet`: the tablet's name or id from `GET /v1/tablets`. You can leave it out when only one tablet is paired.
- `passport` and `language` are optional. Without `language`, the passport nationality decides.
- `reservation` is optional. It takes the same fields as `PUT /v1/reservations`, and the booking is created or updated before it's shown.
- Response `201`: `{ "handoff": { "id", "status": "pending", "expires_at", "tablet", "reservation" } }`. A new handoff replaces any older one on the same tablet. It expires after 10 minutes if the tablet never shows it.
- Errors:
  - `404 reservation_not_found`
  - `409 reservation_not_expected` (already checked in, or cancelled)
  - `400 tablet_required` (several tablets are paired)
  - `404 tablet_not_found`

`GET /v1/handoffs/{id}` returns its status: `pending`, `shown`, `completed` (with `checkin_id`), `declined` or `cancelled`. `POST /v1/handoffs/{id}/cancel` takes it off the tablet.

`GET /v1/tablets` returns `{ "tablets": [ { "id", "name", "online" } ] }`.

## 3. The daily flow

```
Your app                              Tablet
────────                              ──────
PUT /v1/reservations  ─────────────►  guests can find their booking
                      ◄─────────────  webhook: checkin.created  (passport, contacts, signature)
reception checks passport,
gives key, checks in on eZee
POST /v1/checkins/{id}/approve ────►  check-in closed, room shown at check-out
                      ◄─────────────  webhook: checkout.created / feedback.created
POST /v1/reservations/{ref}/status ►  e.g. checked_out after paying at the desk
```

1. **Every few minutes, or whenever bookings change,** send arrivals for yesterday to tomorrow plus everyone in house, with room numbers when known.
2. **On `checkin.created`,** show the guest in your reception queue with the `desk_code`. Reception compares the passport details with the real passport, gives the key and does the check-in on eZee as you do today. Then call **approve** with the room number.
3. **When something happens at the desk** (walk-in check-in, early departure, no-show), call **status**.
4. **On `invoice.requested`,** a guest has just opened check-out on the tablet. Read their folio from eZee and send it with `PUT /v1/reservations/{booking_ref}/invoice` within a few seconds; the tablet waits up to 20 seconds for it.
5. **On `checkout.created`,** the guest left the key and checked out on the tablet. Settle the bill in eZee as usual. `feedback.created` carries private comments from ratings of 1 to 3.

---

## 4. API reference

All calls:

- Base URL: `https://qlvlmgrslqexmqmzpuko.supabase.co/functions/v1/partner-api`
- Header: `Authorization: Bearer <API key>`
- JSON in and out. Dates are `YYYY-MM-DD`; times are ISO 8601 UTC.
- Errors look like `{ "error": "room_required", "detail": "room_number is required" }`, with HTTP status 400, 401, 404 or 409.

### Check the connection

```
GET /v1/ping
→ 200 { "ok": true, "hotel": "The Rumi Hotel & Residences", "time": "2026-11-21T09:00:00Z" }
```

### Send bookings: `PUT /v1/reservations`

Creates or updates bookings, matched by `booking_ref`. Send up to 500 per request. It's safe to send the same bookings again and again.

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
    "status": "expected"
  }
]
```

| Field | Required | Notes |
|---|---|---|
| `booking_ref` | yes | Your main booking number (the eZee booking id works well). Case and spaces are ignored. |
| `guest_name` | yes | As on the booking. Latin letters help the passport match; Cyrillic also works. |
| `arrival_date`, `departure_date` | yes | Departure must be after arrival. |
| `other_refs` | no | Other numbers a guest might type, such as the Booking.com or Expedia confirmation number. |
| `room_number` | no | Shown to the guest when known; needed for tablet check-out. |
| `adults` | no | The tablet asks for every adult's passport. |
| `breakfast` | no | Shows breakfast hours on the tablet. |
| `status` | no | `expected`, `pending_desk`, `in_house`, `checked_out`, `cancelled` or `no_show`. If omitted, new bookings start as `expected`. Sending `expected` never moves a guest back once they have checked in on the tablet. |
| `partner_ref`, `ezee_booking_id`, `source`, `room_type`, `notes` | no | Returned to you in every webhook. |

The tablet only finds bookings that are `expected` with arrival between yesterday and tomorrow. For check-out, the booking must be `in_house` with a `room_number`.

```
→ 200 { "ok": true, "saved": 1 }
```

### List tablet check-ins: `GET /v1/checkins`

Query options: `status=waiting|approved|rejected`, `since=<ISO time>`, `limit` (up to 200), `include_signature=true`.

```
GET /v1/checkins?status=waiting
→ 200 { "checkins": [ <checkin>, ... ] }
```

Use this as a back-up if your app was offline and missed webhooks.

### One check-in: `GET /v1/checkins/{id}`

This includes the signature image.

### Approve: `POST /v1/checkins/{id}/approve`

```json
{ "room_number": "305" }
```

Marks the tablet check-in done and the guest in house. Returns `409 already_handled` if it was already approved or sent back.

### Send back: `POST /v1/checkins/{id}/reject`

Use this when it's the wrong booking or the details don't match. The booking becomes `expected` again, so the guest can redo the check-in or reception handles it.

### Change a booking's status: `POST /v1/reservations/{booking_ref}/status`

```json
{ "status": "in_house", "room_number": "412" }
```

Setting `in_house` also closes any tablet check-in that is still waiting. Use `checked_out` after a desk check-out, and `cancelled` or `no_show` as needed.

### Guest Wi-Fi: `GET /v1/wifi` and `PUT /v1/wifi`

The hotel's guest network. The tablet shows it on the Done screen with a QR code that phones join by scanning.

```json
{ "ssid": "Rumi-Guest", "password": "welcome2026", "security": "WPA", "hidden": false }
```

| Field | Required | Notes |
|---|---|---|
| `ssid` | yes | Network name, up to 64 characters. |
| `password` | unless `security` is `nopass` | Up to 63 characters. |
| `security` | no | `WPA` (WPA/WPA2/WPA3), `WEP` or `nopass`. Defaults to `WPA` when a password is given. |
| `hidden` | no | `true` if the network name is not broadcast. |
| `qr_payload` | no | Exact text to encode instead of the standard `WIFI:T:WPA;S:…;P:…;;`, for example a hotspot login link. |

This replaces what the admin typed in Settings. Response: `{ "wifi": { … } }`.

### Wi-Fi for one stay: `PUT /v1/reservations/{booking_ref}/wifi`

For a personal voucher from your hotspot system. Same body as `/v1/wifi`, plus an optional `note` (up to 140 characters, such as "Valid until 25 Nov, 12:00"). The tablet shows it instead of the hotel network, marked "Just for your stay". `GET` returns it; `DELETE` removes it. You can also send `wifi` inside a reservation in `PUT /v1/reservations` or in the `reservation` of `POST /v1/handoffs`.

The Done screen checks for a per-stay network for about 20 seconds after check-in, so you can create it on `checkin.created` and still have it shown.

### The guest's bill: `PUT /v1/reservations/{booking_ref}/invoice`

Shown in full on the tablet's check-out screen. Send it whenever the folio changes, and always in answer to the `invoice.requested` webhook.

```json
{
  "invoice_number": "INV-2026-00123",
  "currency": "TJS",
  "issued_at": "2026-11-24T08:05:00Z",
  "lines": [
    { "date": "2026-11-21", "description": "Deluxe Double, room and breakfast", "quantity": 1, "unit_price": 950, "amount": 950 },
    { "date": "2026-11-22", "description": "Minibar", "quantity": 3, "unit_price": 25, "amount": 75 }
  ],
  "taxes": [{ "name": "VAT 15%", "amount": 153.75 }],
  "prices_include_tax": false,
  "payments": [{ "date": "2026-11-21", "method": "Visa •••• 4242", "amount": 500 }],
  "note": "Thank you for staying with us"
}
```

| Field | Required | Notes |
|---|---|---|
| `currency` | yes | ISO 4217 code: `TJS`, `USD`, `EUR` … |
| `lines` | yes | 1 to 300 charges. Each needs `description` and `amount` (or `unit_price`, multiplied by `quantity`, default 1). `date` is optional, `YYYY-MM-DD`. |
| `taxes` | no | `{ name, amount }`. |
| `prices_include_tax` | no | `true` if line amounts already include the taxes listed. Then `total` = sum of lines. Otherwise `total` = lines + taxes. |
| `payments` | no | Deposits and payments already made: `{ date, method, amount }`. Never send full card numbers; `Visa •••• 4242` is fine. |
| `subtotal`, `tax_total`, `total`, `paid`, `balance` | no | Worked out from the lines, taxes and payments when left out. Send them when your figures differ (rounding, discounts), and the tablet shows yours. |
| `invoice_number`, `issued_at`, `guest_name`, `note` | no | Shown on the bill (`note` up to 300 characters). |

A positive `balance` shows "Balance due" and asks the guest to settle at the desk. `0` shows "Paid in full". Negative shows "To be refunded". Amounts are rounded to 2 decimals.

Response `200`: `{ "invoice": { … as stored … }, "received_at": "…" }`. `GET` returns the stored bill (`404 no_invoice` if none); `DELETE` removes it. Errors: `400 invalid_invoice` with a `detail` that names the field.

### Check-outs and feedback

```
GET /v1/checkouts?since=2026-11-21T00:00:00Z
GET /v1/feedback?since=2026-11-21T00:00:00Z
```

---

## 5. Webhooks

The tablet sends a `POST` to your webhook address for each event:

| Event | When |
|---|---|
| `checkin.created` | A guest finished check-in on the tablet. |
| `checkin.updated` | A tablet check-in was approved or sent back (from your app or the tablet admin). |
| `checkout.created` | A guest checked out on the tablet. |
| `feedback.created` | A guest rated the stay 1 to 3 and left private feedback. |
| `handoff.declined` | The guest tapped "Not my booking" on a booking your app sent. Contains `data.handoff`. |
| `invoice.requested` | A guest opened check-out on the tablet. Contains `data.invoice_request { requested_at, reservation }`. Answer with `PUT /v1/reservations/{booking_ref}/invoice`. Sent at most once every 2 minutes per stay. |
| `ping` | The admin pressed **Send test event**. |

**Headers:**

```
Content-Type: application/json
X-Rumi-Event: checkin.created
X-Rumi-Delivery: 1b7c...-...     (unique per event, stays the same on retries)
X-Rumi-Timestamp: 1795280000     (Unix seconds)
X-Rumi-Signature: sha256=5f2c...
```

**Body** (`checkin.created` and `checkin.updated`):

```json
{
  "id": "1b7c2f0e-…",
  "event": "checkin.created",
  "created_at": "2026-11-21T09:12:44Z",
  "data": {
    "checkin": {
      "id": "5f1a2c6b-…",
      "created_at": "2026-11-21T09:12:44Z",
      "status": "waiting",
      "desk_code": "P17",
      "handoff_id": "8c1e…",
      "passport_scanned_on_tablet": false,
      "language": "ru",
      "reservation": {
        "booking_ref": "33215-1", "partner_ref": "your-internal-id-77", "ezee_booking_id": "33215-1",
        "guest_name": "Anna Maria Eriksson", "room_number": "305", "arrival_date": "2026-11-21",
        "departure_date": "2026-11-24", "adults": 2, "status": "pending_desk"
      },
      "guest": {
        "surname": "ERIKSSON", "given_names": "ANNA MARIA", "nationality": "SWE", "sex": "F",
        "birth_date": "1974-08-12", "phone": "+992 00 000 0000", "email": "guest@example.com",
        "document": { "source": "mrz", "type": "P", "number": "L898902C3", "issuing_country": "SWE",
                      "expiry_date": "2031-04-15", "check_digits_valid": true }
      },
      "additional_guests": [
        { "surname": "ERIKSSON", "given_names": "LARS", "nationality": "SWE", "sex": "M", "birth_date": "1972-01-02",
          "document": { "type": "P", "number": "X7654321", "issuing_country": "SWE", "expiry_date": "2030-05-01", "check_digits_valid": true } }
      ],
      "airport_shuttle": true,
      "consent_at": "2026-11-21T09:12:30Z",
      "approved_at": null,
      "signature_png": "data:image/png;base64,iVBORw0…",
      "data_deleted": false
    }
  }
}
```

- `document.source` is `desk` when your app sent the passport details with the handoff, or `none` when the guest found the booking on the tablet. In that case reception must scan the passport and fill in the details.
- `checkout.created` contains `data.checkout { id, created_at, rating, key_returned, from_tablet, reservation }`.
- `feedback.created` contains `data.feedback { id, created_at, rating, comment, reservation }`.

### Verify every webhook

Compute an HMAC-SHA256 of `<timestamp>.<raw body>` with the signing secret, and compare it with the signature header. Reject the request if the signature doesn't match or the timestamp is more than 5 minutes old. Use the **raw** body exactly as received, before any JSON parsing.

**Node.js (Express):**

```js
import crypto from 'node:crypto'
import express from 'express'

const app = express()
app.post('/rumi-webhook', express.raw({ type: 'application/json' }), (req, res) => {
  const ts = req.get('X-Rumi-Timestamp')
  const sig = (req.get('X-Rumi-Signature') || '').replace('sha256=', '')
  const expected = crypto.createHmac('sha256', process.env.RUMI_WEBHOOK_SECRET).update(`${ts}.${req.body}`).digest('hex')
  const fresh = Math.abs(Date.now() / 1000 - Number(ts)) < 300
  if (!fresh || sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
    return res.status(401).end()
  }
  const event = JSON.parse(req.body)
  // Save event.id first; if you have seen it before, just answer 200 (retries reuse the same id).
  // ...handle event.event / event.data...
  res.status(200).json({ received: true })
})
```

**Python (Flask):**

```python
import hmac, hashlib, os, time, json
from flask import Flask, request, abort

app = Flask(__name__)

@app.post('/rumi-webhook')
def rumi_webhook():
    ts = request.headers.get('X-Rumi-Timestamp', '')
    sig = request.headers.get('X-Rumi-Signature', '').removeprefix('sha256=')
    raw = request.get_data()
    expected = hmac.new(os.environ['RUMI_WEBHOOK_SECRET'].encode(), f'{ts}.'.encode() + raw, hashlib.sha256).hexdigest()
    if abs(time.time() - int(ts or 0)) > 300 or not hmac.compare_digest(sig, expected):
        abort(401)
    event = json.loads(raw)
    # ...handle event['event'] / event['data']...
    return {'received': True}
```

### Delivery and retries

- Answer with any `2xx` status within 15 seconds; do heavy work afterwards.
- If your app is down or answers with an error, the tablet retries after 2, 4, 8 … up to 60 minutes, for about 12 attempts.
- An event can arrive more than once. Use `X-Rumi-Delivery` (or `id` in the body) to skip duplicates.
- Delivery problems are shown to the admin in Settings, so they know when your app isn't answering.

---

## 6. Privacy

The webhooks and the API carry passport data and signatures, so:

- Store them as carefully as your eZee data, on a server you control, over HTTPS only.
- The tablet deletes passport details, contacts and signatures automatically after the retention period set in its Settings (90 days by default). Your app should follow the same rule. After deletion, the API returns `data_deleted: true` with empty fields.
- If the API key leaks, the admin presses **Replace API key** and the old one stops working at once. The same goes for **Replace signing secret**.

---

## 7. Quick test with curl

```bash
export RUMI=https://qlvlmgrslqexmqmzpuko.supabase.co/functions/v1/partner-api
export KEY=rumi_...   # from the admin

curl -H "Authorization: Bearer $KEY" $RUMI/v1/ping

curl -X PUT -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" \
  $RUMI/v1/reservations \
  -d '[{"booking_ref":"TEST-1","guest_name":"Test Guest","arrival_date":"2026-11-21","departure_date":"2026-11-22"}]'

curl -H "Authorization: Bearer $KEY" "$RUMI/v1/checkins?status=waiting"

curl -X PUT -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" \
  $RUMI/v1/wifi -d '{"ssid":"Rumi-Guest","password":"welcome2026"}'
```

On the tablet, tap **Check in → Find my booking myself → Booking number** and enter `TEST-1` and the surname `Guest`. Your webhook receives `checkin.created`. Then approve it:

```bash
curl -X POST -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" \
  $RUMI/v1/checkins/<id>/approve -d '{"room_number":"101"}'
```

Delete the test booking from the tablet admin afterwards (Arrivals → Edit → Delete).

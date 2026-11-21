# Connecting your front desk app to The Rumi check-in tablet

This guide is for the developer of the hotel's own front desk app. When you finish, your app will:

- **receive** every tablet check-in, check-out and guest feedback instantly (webhooks)
- **send** today's bookings to the tablet, so guests can find their reservation
- **tell** the tablet when reception has checked a guest in (room number) or out

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

## 2. Passports and the check-in number

By default (tablet Settings → **Passport scanning: At reception**), the tablet does **not** scan passports, because reception already scans them into eZee with its own scanner through your app.

- The guest finds the booking by name or booking number, confirms it, adds contact details and signs.
- The tablet then shows a short **check-in number**, such as `P17`. The guest brings it to reception with their passport, and with every other adult's passport.
- `desk_code` is in every `checkin.*` webhook and in `GET /v1/checkins`. Show it in large type in your reception queue, so the receptionist can find the guest at once ("P17, please").
- `passport_scanned_on_tablet` is `false` in this mode and the `guest.document` fields are empty. Scan the passport as you do today, then call **approve** with the room number.

If the hotel ever switches the setting to **On the tablet camera**, the tablet reads the passport MRZ itself and fills `guest.document` and `additional_guests`.

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
4. **On `checkout.created`,** the guest left the key and checked out on the tablet. Settle the bill in eZee as usual. `feedback.created` carries private comments from ratings of 1 to 3.

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
      "passport_scanned_on_tablet": true,
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

- `document.source` is `mrz` when the passport was read by the camera (with `check_digits_valid`), or `none` when the guest used the booking number. In that case reception must enter the passport details.
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
```

On the tablet, tap **Check in → No passport? Use your booking number** and enter `TEST-1` and the surname `Guest`. Your webhook receives `checkin.created`. Then approve it:

```bash
curl -X POST -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" \
  $RUMI/v1/checkins/<id>/approve -d '{"room_number":"101"}'
```

Delete the test booking from the tablet admin afterwards (Arrivals → Edit → Delete).

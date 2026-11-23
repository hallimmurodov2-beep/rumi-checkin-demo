# For Codex (Front Desk app): connect the Front Desk app to the check-in tablet

**Who this is for:** the Codex agent that built and maintains The Rumi **Front Desk app**, which already scans passports, checks guests in on eZee and runs the server at `menu.therumihotel.com:8844`.

**Deploying the tablet app is not locked any more** (the lock was removed on 2026-11-23). Deploy from `main` only; see the top of `AGENTS.md` for the rules.

**This folder** is the **check-in tablet** web app (`rumi-checkin`). Your job is to connect the two apps end to end, automatically, so reception never types anything twice.

Read this whole file first, then `docs/frontdesk-app-codex-prompt.md`, the full task and API reference.

---

## 0. Ground rules

1. **Work from the latest code.** This folder is a git repository (GitHub: `hallimmurodov2-beep/rumi-checkin-demo`, branch `main`). Run `git pull` before you change anything here, and commit and push what you change.
2. **Never deploy the tablet app from an old copy.**
   - On 2026-11-22 a `vercel deploy --prebuilt` from a separate copy replaced production. The tablet changes made in this repository after that copy was taken were lost until they were rebuilt here.
   - If you change the tablet app, push to `main`, then deploy production from `main`.
3. **Your earlier tablet changes are already merged here.** Edit them in place instead of re-adding them:
   - **Visitors Wi-Fi** button and pairing (`/wifi/lobby-tablet`): `src/tablet/frontdesk.tsx` → `VisitorWifi`
   - **Folio station** pairing and full-screen invoice overlay (`/wifi/folio/`): `src/tablet/frontdesk.tsx` → `FolioPairing`, `FolioOverlay`
   - **Screensaver** with analog world clocks: `src/tablet/Screensaver.tsx` and `src/tablet/screensaver.css`
4. **The tablet app's database and API** live in Supabase (project `qlvlmgrslqexmqmzpuko`, Edge Function `partner-api`). Talk to them only through the **Partner API** below; don't change them from the Front Desk app.
5. **Secrets** stay in the Front Desk server's environment, never in code, git, a browser or this folder.
   - `RUMI_API_URL` = `https://qlvlmgrslqexmqmzpuko.supabase.co/functions/v1/partner-api`
   - `RUMI_API_KEY`: the hotel admin creates it in the tablet admin, Settings → Front desk app connection.
   - `RUMI_WEBHOOK_SECRET`: created in the same place.

---

## 1. How check-in works now

```
Reception                    Front Desk app (yours)                       Check-in tablet
─────────                    ──────────────────────                       ───────────────
scans the passport  ───────► find booking in eZee, check the guest in
                             POST /v1/handoffs (booking + passport) ───► opens straight on "Details":
                                                                          "Welcome, Eriksson" in the guest's
                                                                          language (from nationality)
                                                                          phone, email (optional), shuttle?
                                                                          hotel policy + signature
                             webhook checkin.created  ◄────────────────── (contacts, shuttle, signature,
                             write contacts/shuttle/signature to eZee      policy_signed)
                             POST /v1/checkins/{id}/approve {room}  ────► Done: room number, Wi-Fi QR,
                                                                          breakfast hours
```

**The tablet has no Check-in button any more.** A guest standing at it is told to hand their passport to reception. So every check-in depends on your handoff.

---

## 2. What to build in the Front Desk app

Do these in order. Section numbers refer to `docs/frontdesk-app-codex-prompt.md`.

1. **Partner API client** (§1): bearer key, 10-second timeout, retries on 5xx only.
2. **Webhook receiver** (§2), for example `POST /integrations/rumi/webhook` on your server:
   - Verify the HMAC signature on the raw body.
   - Reject anything older than 5 minutes.
   - Skip duplicates by `X-Rumi-Delivery`.
   - Answer within 15 seconds and do the work in the background.
   - Give the admin the URL to enter in the tablet admin.
3. **Booking sync** (§3): every 3 minutes, `PUT /v1/reservations` with arrivals from yesterday to tomorrow plus everyone in house, including room numbers.
4. **Automatic handoff** (§4): the moment reception's passport scan has checked the guest in on eZee, call `POST /v1/handoffs`. Send the `booking_ref`, the `tablet` name, the scanned `passport` (at least `surname` and `nationality`), and the `reservation`. Show reception "Sent to Lobby Tablet 1" or the error in plain words.
5. **On `checkin.created`** (§5):
   - Write the phone, email, shuttle request and signature to the eZee booking.
   - Store `policy_signed` with the stay.
   - Then **approve immediately** with the eZee room number. The tablet's Done screen waits about 30 seconds for the room.
6. **On `handoff.declined`** ("Not you?" on the tablet): alert reception on that booking.
7. **Guest Wi-Fi:**
   - The tablet already gets the Wi-Fi login QR from your `/wifi/lobby-tablet` endpoint (the "Visitors Wi-Fi" pairing). The check-in Done screen reuses that same voucher, so nothing more is needed if the lobby pairing is done.
   - For a personal Wi-Fi per guest, send `wifi` with the reservation or handoff (§6). That one wins.
8. **Hotel policy** (§6b): publish the rulebook per language with `PUT /v1/policy/{en|ru|tg}` and `{ "body_md": "…" }`, or let the admin upload the `.md` file in the tablet admin.
9. **Bills and feedback are not part of this connection.** The tablet no longer has a check-out screen (removed 2026-11-23). Your eZee button keeps pushing invoices to the folio station, and your mobile app keeps collecting feedback. Skip §7 and §8 of the guides, except: after a guest checks out in eZee, send `status: checked_out`.
10. **Catch-up and status screen** (§9) and **tests** (§10).

---

## 3. How to check it works

1. In the tablet admin, create the API key and signing secret, enter your webhook URL, and press **Send test event**. Your receiver must log a valid `ping`.
2. `GET /v1/ping` with the key returns the hotel name.
3. Scan a test passport for a test booking.
   - The tablet should switch from the Welcome screen to "Welcome, <Surname>" within about 2 seconds, in the guest's language.
   - Fill in the details and sign. Your app receives `checkin.created` and approves it.
   - The Done screen shows the room number and the Wi-Fi QR.
4. Delete the test booking afterwards (tablet admin, Arrivals → Edit → Delete).

The full request and response shapes, error codes and webhook payloads are in `docs/partner-api.md` and `docs/frontdesk-app-codex-prompt.md`.

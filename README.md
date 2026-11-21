# The Rumi - Self check-in demo

A clickable **sales mockup** of a hotel self check-in tablet app for The Rumi Hotel & Residences (Dushanbe). It is not a production system. Every guest, booking and system status in it is made up, and a "DEMO - sample data" badge is shown on every screen.

Stack: Vite + React + TypeScript + Tailwind CSS (v4). Static site, no backend, no database.

## Routes

| Route     | What it is |
|-----------|------------|
| `/`       | Landing page with two buttons and a one-line explanation |
| `/tablet` | Guest flow, designed for an 11" landscape tablet (1194x834) |
| `/staff`  | Front-desk screen (desktop, responsive down to phone width) |

Tip: open `/staff` in one browser tab and `/tablet` in another. Checking in or out on the tablet appears live on the staff screen.

## Run it

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # type-check + production build into dist/
npm run preview   # serve the production build locally
```

## Deploy (Vercel)

`vercel.json` already rewrites all paths to `index.html` so `/tablet` and `/staff` work on refresh.

```bash
npx vercel          # preview deployment
npx vercel --prod   # production deployment
```

Or import the folder as a project in the Vercel dashboard (framework preset: Vite).

## What is real vs simulated

**Real (in the browser):**
- The full guest flow, stepper, Back buttons and touch-sized controls
- Signature canvas that records finger/mouse drawing, with Clear (a signature is required to continue)
- Idle reset: 60 s without touch returns to Welcome and clears entered data, with a visible countdown in the last 10 s; the Done screen auto-returns after 20 s
- English, Russian and Tajik UI strings (`src/translations.ts`)
- Live sync between `/tablet` and `/staff` through `localStorage` and the `storage` event (works across tabs of the same browser only)
- Approve & check in, private feedback (ratings 1-3), check-outs list, Reset demo (restores the three seed rows)

**Simulated / fake:**
- Passport scan: the camera is never accessed. "Use demo passport" waits 1.5 s and moves on. No passport data is read, asked for or stored; placeholders such as `[COUNTRY]` stay as placeholders.
- Booking data (Sample Guest, Booking.com, 21-24 Nov, Deluxe Double Room), the bill, Wi-Fi details and breakfast times
- "eZee FrontDesk: connected" and "Tablets online: 3 of 3" are static labels
- The review QR code is a placeholder pattern, not a real code
- Phone and email typed on the tablet are not saved anywhere
- The staff screen is English only

**Language note:** the Tajik strings are a best-effort draft and are marked `TODO: review by a native Tajik speaker` in `src/translations.ts`.

## What the production version would add

- Real **eZee FrontDesk kiosk API** integration (look up bookings, push check-in status, assign rooms and keys)
- **Passport MRZ OCR** with check-digit validation
- **Encrypted storage** of guest data, with retention rules and a proper privacy/consent record
- **Kiosk-mode tablet lockdown** (single-app mode, no browser chrome, managed updates, remote monitoring of "tablets online")
- A real backend and staff authentication in place of browser `localStorage`
- Review of the Tajik (and Russian) copy by native speakers, and an accessibility pass on the real hardware

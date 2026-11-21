# The Rumi – Self check-in

Self check-in for The Rumi Hotel & Residences, Dushanbe.

- **Guest tablet** (`/tablet`): guests check in or out in English, Russian or Tajik. The passport is read with the tablet camera.
- **Front desk** (`/staff`): staff see each tablet check-in live, check the passport, assign the room and hand over the key. They also manage arrivals, in-house guests, check-outs, feedback, tablets and the team.

Stack: Vite, React, TypeScript, Tailwind CSS v4 and Supabase (Postgres, Auth, Realtime), hosted on Vercel. The tablet is an installable web app (PWA): it runs full screen in landscape and keeps the screen awake.

## How it works

1. Front desk adds the day's bookings under **Arrivals**, by hand or by importing a CSV.
2. A guest taps **Check in** on the tablet and holds the passport photo page up to the camera. The tablet reads the MRZ (the two lines of `<<<` text) on the device and validates the ICAO check digits. The photo never leaves the tablet; only the parsed fields are sent.
3. The passport name is matched to an expected booking for today. If there's no single match, the guest enters the booking number and surname instead, which also works for guests without a passport. Cyrillic surnames are transliterated, so Петрова matches a booking for Petrova.
4. The guest confirms the booking and adds a phone number, email and airport-shuttle choice. They tick the consent box and sign on screen.
5. The check-in appears instantly in **Tablet check-ins** at the desk. Staff check the passport against the details, enter the room number and tap **Approve & give key**. The guest is now **In house**.
6. To check out, the guest enters their room number and surname on the tablet and rates the stay. A rating of 4–5 shows a QR code for the public review link. A rating of 1–3 opens a private feedback box that only staff see.

The tablet returns to the welcome screen after 60 seconds without a touch, with a visible countdown for the last 10 seconds, and clears everything entered. The idle time can be changed in Settings.

## First-time setup

1. **Supabase Auth URLs (required once).** In the Supabase dashboard, open project `rumi-checkin` → Authentication → URL Configuration:
   - Site URL: your live address, `https://rumi-checkin.vercel.app`
   - Redirect URLs: add `https://rumi-checkin.vercel.app/staff`

   Without this, sign-up confirmation and password-reset emails link to `localhost`.
2. **Create the first account.** Open `/staff` → **Create an account**. The first account becomes the **administrator**. Later accounts wait as **Pending** until an admin gives them access under Settings → Team.
3. **Hotel information.** In Settings, enter the guest Wi-Fi, breakfast hours and your Google or TripAdvisor review link.
4. **Pair each tablet.** In Settings → Tablets → **Add tablet**, you get an 8-character code that is valid for 15 minutes. On the tablet, open `/tablet`, enter the code, then install it to the home screen (see below).
5. **Add arrivals.** Use Arrivals → **Add booking**, or **Import CSV**. Download the template from the import window. Existing booking numbers are updated rather than duplicated.

### Installing on the tablet

- **iPad (Safari):** open `/tablet` → Share → **Add to Home Screen**. Lock the iPad to the app with Guided Access (Settings → Accessibility → Guided Access, then triple-click the top button).
- **Android (Chrome):** open `/tablet` → ⋮ → **Install app**. Lock it with screen pinning (Settings → Security → App pinning).
- **Hidden tablet settings:** press and hold the emblem on the welcome screen for 3 seconds. From there you can switch between the front and back camera (use the one facing the guest) or unpair the tablet.

## Security and privacy

- Staff sign in with Supabase Auth (email and password). Every table has row-level security: only `staff` and `admin` accounts can read guest data, and pending accounts see nothing.
- Tablets have **no direct table access**. A paired tablet holds a random 256-bit secret, and the database stores only its SHA-256 hash. Every tablet action is a database function that checks the secret first. Tablets can look up a single booking by booking number and surname, or by passport name, and only for arrivals from yesterday to tomorrow. They cannot list bookings or read past check-ins.
- **Passport images are never stored or uploaded.** OCR runs on the tablet. Stored fields: name, nationality, document number and type, date of birth, sex, expiry, phone, email, shuttle choice, consent time and the signature image.
- **Retention:** a scheduled job (`pg_cron`, daily at 03:15) erases passport details, contacts and signatures once a stay ended more than *N* days ago. The default is 90 days; change it in Settings.
- **Registration export:** In house → **Export registration CSV** produces the passport details of in-house guests for foreign-guest registration.
- The Supabase security advisor lists the tablet and staff functions as "callable by anon/authenticated". That is intended, because each function checks the tablet secret or the staff role itself.

## Development

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # MRZ parser tests (ICAO specimens and real OCR output)
npm run build    # type-check and production build
```

- `/dev/staff` (development only) shows the front-desk UI with fixture data, so you can work on screens without signing in. It is not included in production builds.
- The Supabase URL and publishable key are in `src/lib/supabase.ts`; you can override them with `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. The publishable key is designed to be public; access is enforced in the database.
- The database schema, row-level security and functions are applied as Supabase migrations: `core_schema`, `device_secrets_and_rpcs`, `fix_unaccent_and_schedule_purge` and `cyrillic_name_matching`.

## Deploy

The project is deployed on Vercel from the GitHub repo. `vercel.json` rewrites app routes to `index.html` and serves `sw.js` uncached.

```bash
npx vercel --prod
```

## Languages

Guest strings are in `src/translations.ts` (en, ru, tg). The staff app is in English.

**TODO: review by a native Tajik speaker.** The Tajik translation is a best-effort draft and should be checked before guests use it.

## Known limits and next steps

- **eZee FrontDesk:** there is no API connection yet, so bookings come in by hand or by CSV export from eZee. With eZee kiosk API credentials, a Supabase Edge Function can sync today's arrivals and push check-in status back. Keep the credentials in Supabase secrets.
- **Passport reading:** reading uses Tesseract OCR with check-digit correction. It needs a steady passport and reasonable light; glare is the usual problem. If it can't read the passport, the guest uses the booking number and staff enter the passport details in the check-in drawer.
- **Email:** Supabase's built-in email sender is rate-limited (a few messages per hour). For more staff sign-ups or password resets, add your own SMTP under Authentication → Emails.

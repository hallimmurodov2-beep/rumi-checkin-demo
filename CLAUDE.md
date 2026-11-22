# The Rumi – self check-in

Guest tablet (`/tablet`) and front-desk staff app (`/staff`) for The Rumi Hotel & Residences, Dushanbe. README.md explains the product; this file is for working on the code.

## Stack and commands

- Vite + React 19 + TypeScript + Tailwind v4, Supabase (Postgres, Auth, Realtime, Edge Functions), hosted on Vercel.
- `npm run dev` (the `rumi-dev` preview config serves on port 5199), `npm run build` (type-check + build), `npm test` (eZee mapping tests).
- **Deploy:** pushing `main` to GitHub deploys the front end on Vercel. Database and Edge Function changes are NOT deployed by a push: apply them to Supabase project `qlvlmgrslqexmqmzpuko` (migrations via the Supabase connection; the local Supabase CLI token lacks deploy rights for this project, so deploy Edge Functions through the Supabase connection too).

## Where things live

- `src/pages/Tablet.tsx`: the kiosk state machine (steps, idle reset, screensaver, handoff polling).
- `src/tablet/*`: tablet screens. `Steps.tsx` = check-in steps incl. the Done screen with the Wi-Fi QR; `Checkout.tsx` = check-out with the guest's bill.
- `src/lib/device.ts`: every tablet call. Tablets have no table access; each call is a `SECURITY DEFINER` RPC that checks the tablet's pairing secret first.
- `src/staff/*`: staff app. `src/dev/*`: dev-only fixture previews (`/dev/staff`, `/dev/tablet?screen=done|checkout&lang=en|ru|tg&bill=due|paid|slow|none&wifi=stay`). Use these to check screens without pairing a tablet or touching live data.
- `src/translations.ts`: all guest strings in en, ru, tg. Every new guest-facing string needs all three (Tajik is best-effort, flagged for native review).
- `supabase/functions/partner-api`: REST API + signed webhooks for the owner's front desk app. Guide: `docs/partner-api.md`; Codex integration prompt: `docs/frontdesk-app-codex-prompt.md`.
- Migrations are not in the repo; they live in Supabase (`list_migrations`). Read live function definitions with `pg_get_functiondef` before changing one.

## Conventions

- Tablet UI is landscape-first, large touch targets (min-h-16 buttons), and must fit a ~1180x820 viewport without the important parts scrolling off.
- Guest data has a retention purge (`purge_guest_data`); anything new that holds guest data must be added to it.
- Test DB functions inside `begin; ... rollback;` so no live rows are left behind.
- `public/sw.js` gets a build id stamped in by `vite.config.ts`; that change is what makes installed tablets pick up a new deploy.

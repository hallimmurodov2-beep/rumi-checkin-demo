# The Rumi – self check-in

Guest tablet (`/tablet`) and front-desk staff app (`/staff`) for The Rumi Hotel & Residences, Dushanbe. README.md explains the product; this file is for working on the code.

## Stack and commands

- Vite + React 19 + TypeScript + Tailwind v4, Supabase (Postgres, Auth, Realtime, Edge Functions), hosted on Vercel.
- `npm run dev` (the `rumi-dev` preview config serves on port 5199), `npm run build` (type-check + build), `npm test` (eZee mapping, Wi-Fi QR text, and the partner API's Wi-Fi, bill and date checks in `supabase/functions/partner-api/validate.ts`).
- **Deploy:** **Pushing `main` now deploys production by itself** (seen on 2026-11-23, after the deploy lock was removed: Vercel's Git integration builds every push). So a push IS a deploy: push only what is ready, and don't also call `create_deployment` (it just makes a second identical build). Before the lock existed a push built nothing, so older notes may say otherwise. Confirm by checking that `https://rumi-checkin.vercel.app/sw.js` shows the new build id. Database and Edge Function changes are NOT deployed by a push: apply them to Supabase project `qlvlmgrslqexmqmzpuko` (migrations via the Supabase connection; the local Supabase CLI token lacks deploy rights for this project, so deploy Edge Functions through the Supabase connection too).

## Current state (as of 2026-11-23)

- **Live:** `https://rumi-checkin.vercel.app` (`/tablet`, `/staff`). Supabase project `qlvlmgrslqexmqmzpuko`. Vercel project `rumi-checkin-demo` (team `team_Of6vR4xLtrrOUqAmOn4gIwHO`). GitHub `hallimmurodov2-beep/rumi-checkin-demo` (private).
- **Deploy lock: removed (2026-11-23).** Abduhalim had locked every Vercel build until his dad's Codex connected the Front Desk app; he removed it again. Deploys are normal now, and a push to `main` deploys production on its own. `AGENTS.md` still tells the dad's Codex to finish the connection.
- **Check-in** is reception-led only (handoff from the owner's front desk app). Built but **not tested end to end** with the real front desk app, because it doesn't send handoffs yet; test with staff app -> Arrivals -> Send to tablet.
- **Not done / waiting on the owner:** publish the hotel policy (Settings -> Hotel policy; none published yet); native Tajik review of all `tg` strings; eZee credentials (so eZee sync is untested live); the owner's Codex connecting the front desk app (`CODEX-CONNECT-FRONTDESK.md`; the check-in flow has still never run end to end with the real front desk app).
- **Known risk:** real partner API credentials are committed in `docs/partner-api.md` (around lines 27-29) in the private repo. The owner chose to leave them; they should be rotated (staff app Settings -> Front desk app connection) before anyone else gets repo access. Never copy them elsewhere.
- **Android kiosk** (`android-kiosk/`): see its README. The lobby Galaxy Tab A8 (SM-X205, Android 14) is a locked device-owner kiosk; the admin PIN is held by the owner (it is not stored in the repo; it can be changed in the kiosk admin menu). Back up `android-kiosk/signing/` (not in git). The target tablet may be Android 16/17: tested on an Android 17 emulator only.
- **Knowledge graph:** `graphify-out/` (gitignored) holds a graphify map of the repo (`/graphify query "..."`; last updated 2026-11-22; the 19 gallery/logo images are not in it yet). Read `graphify-out/GRAPH_REPORT.md` first when exploring.
- **Dev tools you will need:** `adb` is at `~/Library/Android/sdk/platform-tools/adb` (needs the sandbox off to see USB); Android emulator AVD `Tab_API_37`; Supabase and Vercel work through the connected MCP tools (the local CLIs cannot deploy).

## Where things live

- `src/pages/Tablet.tsx`: the kiosk state machine (steps, idle reset, screensaver, handoff polling).
- `src/tablet/*`: tablet screens. Check-in is reception-led: a handoff opens `Steps.tsx` at Details → Signature (hotel policy, `src/lib/markdown.tsx`) → Done (room with a photo of its room type, Wi-Fi QR, breakfast). There is no Check-in button. `PhotoGallery.tsx` = the full-screen hotel photo gallery guests open from the Welcome tile (the screensaver has no button; its caption card is English only so the photos stay visible); it is an overlay on Welcome (not a step) so reception handoffs still interrupt it, and it falls back to the screensaver after max(idle_seconds, 90) s untouched. Photos and captions: `gallery.ts` (24 photos; mark tall photos `portrait` so `SlideImage.tsx` shows them whole over a blurred copy; originals live in `assets/`, the webp files in `public/gallery/` are made from them with sharp, 1600 px max) (`gallery.ts` and `PhotoGallery.tsx` must keep different names: macOS disks ignore case). There is no check-out on the tablet (removed 2026-11-23 at the owner's request): the owner's eZee button pushes the guest's invoice to the tablet and his mobile app collects feedback. The check-out tables, RPCs and partner API endpoints are still in Supabase but unused. `frontdesk.tsx` = the front desk server integrations (Visitors Wi-Fi voucher, folio invoice station = that eZee invoice button, `FolioOverlay`/`FolioPages`) written by the owner's Codex; keep them working.
- Screensaver on the tablet: it starts after `screensaver_seconds` without a touch (default 45), or when the Welcome screen is tapped 3 times quickly (`src/lib/tripleTap.ts`: taps on buttons and in the top-right admin corner, which the kiosk app uses for its 5-tap admin menu, never count). One tap wakes it. While the Visitors Wi-Fi window is open (it has a "Full screen" button that shows the code as large as the screen allows, `VisitorWifi` in `frontdesk.tsx`) the screensaver waits 5 minutes (`WIFI_QR_OPEN_SECONDS` in `Tablet.tsx`) and the 3-tap is off. To test the kiosk page in the preview, fake a pairing: load `/tablet`, then in the console set `window.fetch` to reject, put `{id,name,secret,camera}` in `localStorage['rumi-tablet-device']` and dispatch a `rumi-device` event (a real server call with a fake secret would un-pair it).
- `src/lib/device.ts`: every tablet call. Tablets have no table access; each call is a `SECURITY DEFINER` RPC that checks the tablet's pairing secret first.
- `src/staff/*`: staff app. `src/dev/*`: dev-only fixture previews (`/dev/staff`, and `/dev/tablet?screen=<welcome|details|signature|help|done|folio|saver|gallery|settings>&at=<photo index>&type=<room type>&policy=0&lang=en|ru|tg&wifi=stay`). Use these to check screens without pairing a tablet or touching live data.
- `src/translations.ts`: all guest strings in en, ru, tg. Every new guest-facing string needs all three (Tajik is best-effort, flagged for native review).
- `supabase/functions/partner-api`: REST API + signed webhooks for the owner's front desk app. Guide: `docs/partner-api.md`; Codex integration prompt: `docs/frontdesk-app-codex-prompt.md`.
- Migrations are not in the repo; they live in Supabase (`list_migrations`). Read live function definitions with `pg_get_functiondef` before changing one.

## Deploy lock (history)

A deploy gate (Vercel Ignored Build Step, a build-script check and a Vite plugin) existed 2026-11-22 to 2026-11-23 and was removed at Abduhalim's request. Nothing in the repo or in the Vercel project refers to it any more. Still in Supabase but inert: the `deploy-gate` Edge Function (answers `ready: true`), the tables `deploy_gate` and `deploy_gate_log` (with `override = true`), their functions and the three `deploy_gate_touch_*` triggers. They are harmless. Drop them if you want a clean schema, but nothing needs it, and an old copy of the folder that still calls the function keeps working while they exist.

## Conventions

- The owner's Codex also works on this repo (see `AGENTS.md`, `CODEX-CONNECT-FRONTDESK.md`). Before deploying, check that production wasn't deployed from another copy: list the Vercel deployments, and if the newest has no git commit, diff its bundles against `main` and port its changes first (this happened on 2026-11-22).

- When editing files through shell heredocs, backslashes can get halved: re-check regexes and escapes (the Wi-Fi QR escape bug came from this). Write such lines with Python and `chr(92)`, or use the Edit tool.
- Never put PINs, passwords, API keys or secrets in repo files, docs or memory.
- Tablet UI is landscape-first, large touch targets (min-h-16 buttons), and must fit a ~1180x820 viewport without the important parts scrolling off.
- Guest data has a retention purge (`purge_guest_data`); anything new that holds guest data must be added to it.
- Test DB functions inside `begin; ... rollback;` so no live rows are left behind.
- `public/sw.js` gets a build id stamped in by `vite.config.ts`; that change is what makes installed tablets pick up a new deploy.

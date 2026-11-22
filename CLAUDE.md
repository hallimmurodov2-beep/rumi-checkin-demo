# The Rumi – self check-in

Guest tablet (`/tablet`) and front-desk staff app (`/staff`) for The Rumi Hotel & Residences, Dushanbe. README.md explains the product; this file is for working on the code.

## Stack and commands

- Vite + React 19 + TypeScript + Tailwind v4, Supabase (Postgres, Auth, Realtime, Edge Functions), hosted on Vercel.
- `npm run dev` (the `rumi-dev` preview config serves on port 5199), `npm run build` (type-check + build), `npm test` (eZee mapping, Wi-Fi QR text, and the partner API's Wi-Fi and bill checks in `supabase/functions/partner-api/validate.ts`).
- **Deploy:** pushing `main` does NOT trigger a Vercel build (no Git auto-deploy on project `rumi-checkin-demo`). Push, then create a production deployment from the pushed commit (Vercel connection `create_deployment` with the GitHub source, or `npx vercel --prod` where the CLI is signed in). Confirm by checking that `https://rumi-checkin.vercel.app/sw.js` shows the new build id. Database and Edge Function changes are NOT deployed by a push: apply them to Supabase project `qlvlmgrslqexmqmzpuko` (migrations via the Supabase connection; the local Supabase CLI token lacks deploy rights for this project, so deploy Edge Functions through the Supabase connection too).

## Current state (as of 2026-11-22)

- **Live:** `https://rumi-checkin.vercel.app` (`/tablet`, `/staff`). Supabase project `qlvlmgrslqexmqmzpuko`. Vercel project `rumi-checkin-demo` (team `team_Of6vR4xLtrrOUqAmOn4gIwHO`). GitHub `hallimmurodov2-beep/rumi-checkin-demo` (private).
- **Check-in** is reception-led only (handoff from the owner's front desk app). Built but **not tested end to end** with the real front desk app, because it doesn't send handoffs yet; test with staff app -> Arrivals -> Send to tablet.
- **Not done / waiting on the owner:** publish the hotel policy (Settings -> Hotel policy; none published yet); native Tajik review of all `tg` strings; eZee credentials (so eZee sync is untested live); the owner's Codex connecting the front desk app (`CODEX-CONNECT-FRONTDESK.md`).
- **Known risk:** real partner API credentials are committed in `docs/partner-api.md` (around lines 27-29) in the private repo. The owner chose to leave them; they should be rotated (staff app Settings -> Front desk app connection) before anyone else gets repo access. Never copy them elsewhere.
- **Android kiosk** (`android-kiosk/`): see its README. The lobby Galaxy Tab A8 (SM-X205, Android 14) is a locked device-owner kiosk; the admin PIN is held by the owner (it is not stored in the repo; it can be changed in the kiosk admin menu). Back up `android-kiosk/signing/` (not in git). The target tablet may be Android 16/17: tested on an Android 17 emulator only.
- **Dev tools you will need:** `adb` is at `~/Library/Android/sdk/platform-tools/adb` (needs the sandbox off to see USB); Android emulator AVD `Tab_API_37`; Supabase and Vercel work through the connected MCP tools (the local CLIs cannot deploy).

## Where things live

- `src/pages/Tablet.tsx`: the kiosk state machine (steps, idle reset, screensaver, handoff polling).
- `src/tablet/*`: tablet screens. Check-in is reception-led: a handoff opens `Steps.tsx` at Details → Signature (hotel policy, `src/lib/markdown.tsx`) → Done (room, Wi-Fi QR, breakfast). There is no Check-in button. `Checkout.tsx` = check-out with the guest's bill. `frontdesk.tsx` = the front desk server integrations (Visitors Wi-Fi voucher, folio invoice station) written by the owner's Codex; keep them working.
- `src/lib/device.ts`: every tablet call. Tablets have no table access; each call is a `SECURITY DEFINER` RPC that checks the tablet's pairing secret first.
- `src/staff/*`: staff app. `src/dev/*`: dev-only fixture previews (`/dev/staff`, and `/dev/tablet?screen=<welcome|details|signature|help|done|cofind|checkout|codone|saver|settings>&policy=0&lang=en|ru|tg&bill=due|paid|slow|none&wifi=stay&due=1`). Use these to check screens without pairing a tablet or touching live data.
- `src/translations.ts`: all guest strings in en, ru, tg. Every new guest-facing string needs all three (Tajik is best-effort, flagged for native review).
- `supabase/functions/partner-api`: REST API + signed webhooks for the owner's front desk app. Guide: `docs/partner-api.md`; Codex integration prompt: `docs/frontdesk-app-codex-prompt.md`.
- Migrations are not in the repo; they live in Supabase (`list_migrations`). Read live function definitions with `pg_get_functiondef` before changing one.

## Production deploy gate (added 2026-11-22)

- Locks **every** Vercel build (production and preview) until the Front Desk app is connected. Three layers: Vercel project setting "Ignored Build Step" (calls the `deploy-gate` Edge Function), `scripts/deploy-gate.mjs` (called first by `npm run build`, only acts when a `VERCEL*` env var is set), and the `deployGate` plugin in `vite.config.ts`. Plain local `npm run build` and `npm run dev` are not affected.
- The gate is computed in SQL (`public.deploy_gate_status()`), not by flags: a check-in counts only if it came from a `source='partner'` handoff, was approved by the partner API (`approved_by` null) within 2 hours of a **delivered, error-free** `checkin.created` webhook. A bill counts only if the invoice (total > 0) arrived within 2 hours of a delivered `invoice.requested` webhook. Statement triggers on `checkins`, `invoices` and `webhook_outbox` latch `public.deploy_gate` the moment both are true (errors there are swallowed so they never break check-in or billing), so deleting the test booking afterwards doesn't lose the proof.
- Every call from a Vercel build is logged in `public.deploy_gate_log` (source, env, commit sha, ready). Look there to see what tried to build.
- **Owner override** (to deploy your own fixes before the integration is done): in Supabase run `update public.deploy_gate set override_until = now() + interval '2 hours', override_note = '<why>' where id = 1;`. It closes again by itself. (`override = true` also exists, but it stays open until set back to `false`.)
- Limits (Hobby Vercel and free GitHub: no deployment-source policy, no branch protection): someone with repo and Vercel access who deliberately edits the three layers, or hand-builds `.vercel/output`, can still get around it. `AGENTS.md` tells Codex not to.

## Conventions

- The owner's Codex also works on this repo (see `AGENTS.md`, `CODEX-CONNECT-FRONTDESK.md`). Before deploying, check that production wasn't deployed from another copy: list the Vercel deployments, and if the newest has no git commit, diff its bundles against `main` and port its changes first (this happened on 2026-11-22).

- When editing files through shell heredocs, backslashes can get halved: re-check regexes and escapes (the Wi-Fi QR escape bug came from this). Write such lines with Python and `chr(92)`, or use the Edit tool.
- Never put PINs, passwords, API keys or secrets in repo files, docs or memory.
- Tablet UI is landscape-first, large touch targets (min-h-16 buttons), and must fit a ~1180x820 viewport without the important parts scrolling off.
- Guest data has a retention purge (`purge_guest_data`); anything new that holds guest data must be added to it.
- Test DB functions inside `begin; ... rollback;` so no live rows are left behind.
- `public/sw.js` gets a build id stamped in by `vite.config.ts`; that change is what makes installed tablets pick up a new deploy.

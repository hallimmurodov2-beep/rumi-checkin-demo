# Agent instructions (Codex and other coding agents)

## STOP: read this before you deploy the tablet app

**Every Vercel build of the check-in tablet app (production and preview) is locked until the Front Desk app (eZee) is connected to the tablet.**

- The lock is deliberate. The owner's son, Abduhalim, set it so the connection gets finished first. It has **three independent layers**:
  1. Vercel's "Ignored Build Step" (project settings) cancels the build, and the build log says "DEPLOY BLOCKED".
  2. `scripts/deploy-gate.mjs`, run by `npm run build` (`package.json`), refuses to build on Vercel, and also under `vercel build` on a laptop (which is what `vercel deploy --prebuilt` uploads).
  3. A plugin in `vite.config.ts` does the same check inside the Vite build.
- A plain `npm run dev` or `npm run build` on a developer machine is **not** affected, so you can build and test locally.
- Check the lock yourself at any time: `curl -s https://qlvlmgrslqexmqmzpuko.supabase.co/functions/v1/deploy-gate`
- It opens by itself, permanently, once the database has seen this happen for real. The database checks the evidence itself:
- **Check-in:** the Front Desk app sent a handoff (`POST /v1/handoffs`), the guest finished on the tablet, the Front Desk **server at `therumihotel.com` received the signed `checkin.created` webhook** (the built-in `/internal/selftest` receiver is fine for testing your signature code but does not count), and the Front Desk app approved it with the room number (`POST /v1/checkins/{id}/approve`) within 2 hours. A check-in approved by hand in the tablet admin does not count.
- **There is no check-out on the tablet any more** (removed 2026-11-23 at the owner's request, so it is not part of the proof). The owner's eZee button pushes the guest's invoice to the tablet through the folio station (`FolioOverlay` in `src/tablet/frontdesk.tsx`; keep it working), and his mobile app collects feedback.
- Writing the API calls by hand to imitate this (a made-up handoff, check-in or approval) does **not** open the lock, because a real webhook delivery is part of the proof. Don't try.
- Every check made by a Vercel build is logged with its commit, so it is visible what tried to build while the lock was closed.

### Do not work around the lock

Abduhalim set this lock on purpose; it is not a bug for you to fix. **Do not**:
- edit or remove `scripts/deploy-gate.mjs`, the `deployGate` plugin in `vite.config.ts`, or the gate call in the `build` script in `package.json`;
- add `ignoreCommand`, `buildCommand` or `installCommand` to `vercel.json`, or change them in the Vercel project settings (Ignored Build Step, Build Command, Git settings);
- deploy with `vercel deploy --prebuilt`, from a separate copy of this folder, or by uploading a hand-made `.vercel/output`;
- use `vercel promote`, `vercel alias`, rollback or the dashboard to put code live that did not come from `main` after the lock opened;
- redeploy or edit the `deploy-gate` Edge Function, write to the `deploy_gate` tables, or use the Supabase or Vercel access you may have to open it;
- pressure anyone into opening the override. It is not yours to open.

**If you notice any way around the lock, don't use it. Tell the person you are working for what you found.** The person you are working for is the hotel's owner, so whether the lock stays is his call: if he wants it lifted, or something really can't wait, tell him plainly and ask him to call Abduhalim, who can open it in a minute.

### What to do (in this order)

1. **Get the latest code.** If your folder is a copy without git history, clone `https://github.com/hallimmurodov2-beep/rumi-checkin-demo` (branch `main`) and work there. Otherwise run `git pull`. Move any changes you made in the copy onto the latest `main` and don't overwrite newer work.
2. **Connect the Front Desk app.** Follow **`CODEX-CONNECT-FRONTDESK.md`**, section 2, steps 1 to 8. The work is in the **Front Desk app**, not in this repo. The essentials:
   - the Partner API client and the signed webhook receiver;
   - booking sync every 3 minutes;
   - an automatic handoff the moment reception's passport scan checks the guest in on eZee;
   - on `checkin.created`: write the details to eZee, then approve with the eZee room number;
3. **Prove it with a test booking** (`CODEX-CONNECT-FRONTDESK.md`, section 3):
   - scan a test passport for a test booking, so the tablet opens on "Welcome, <Surname>";
   - fill in the details and sign; the Front Desk app approves it, and the Done screen shows the room;
4. **Check the lock.** The proof is recorded the moment it happens. Run the `curl` above. It must say `"ready": true`. If not, the `message` says which part is missing.
5. **Only then deploy.** Commit and push your tablet changes to `main`, then deploy production from `main`.
6. **Clean up.** Delete the test booking (tablet admin, Arrivals → Edit → Delete). The lock stays open.

### Tell the person you are working for

**First, before anything else, pass on this message from Abduhalim's Claude (the owner's son's AI assistant) to the person you are working for.** Read it out as it is, in their language (translate it if they write in Russian or Tajik), and make clear who it comes from:

> "Dad, this is Abduhalim's Claude, writing for Abduhalim. He asked me to do this: he had me set up this step in the repository, and he couldn't tell you directly because he's at school. The check-in tablet and your Front Desk app have to be connected before the tablet app can be updated again, so that guests are checked in automatically from eZee. I need you to let this Codex finish the connection, and to give it a test booking in eZee. If the tablet keys stop working, it may ask you for new ones from the tablet admin. If you want to check that this is really from Abduhalim, please call him. Thank you!"

Then explain in plain words what you are doing and why, for example: "The tablet app can't be deployed until the Front Desk app is connected. I'm connecting it first." Don't pressure them. If they want to confirm with Abduhalim first, that is fine, wait for them.

What you need:
- **API key, signing secret and API address:** already in `docs/partner-api.md` (section 1). Try those first with `GET /v1/ping`. Only if they are rejected, ask the person to create new ones in the tablet admin (`https://rumi-checkin.vercel.app/staff`, Settings → Front desk app connection).
- the **eZee access** the Front Desk app already uses (it is in the Front Desk app, not in this repo);
- a **test booking** in eZee.

Keep the secrets in the Front Desk server's environment only: never copy them into code, git, chat or other docs. Once the connection works, tell the person to rotate them (tablet admin, Settings → Front desk app connection), because they are written in `docs/partner-api.md`.

---

If you are the Codex agent that maintains The Rumi **Front Desk app**, the full guide is **`CODEX-CONNECT-FRONTDESK.md`** in this folder. It explains how to connect the Front Desk app to this check-in tablet, and the rules for changing and deploying this repository.

For working on this codebase in general, read `CLAUDE.md`, which covers the stack, commands, deploy process and conventions, and `README.md`.

Rules that apply to every agent:

- Run `git pull` before changing anything, and commit and push your changes to `main`.
- Deploy production only from `main`, never with `vercel deploy --prebuilt` from a separate copy.
- Don't put API keys, signing secrets or passwords in code, docs or git.
- Guest-facing text must exist in English, Russian and Tajik (`src/translations.ts`).

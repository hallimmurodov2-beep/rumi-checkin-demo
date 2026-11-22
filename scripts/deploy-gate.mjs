// Deploy gate, second layer (the first is Vercel's "Ignored Build Step" in the project settings).
//
// Runs at the start of every build that Vercel makes or that `vercel build` makes on a laptop
// (which is what `vercel deploy --prebuilt` uploads). Refuses to build until the Front Desk app is
// connected to the tablet. See the "STOP" section at the top of AGENTS.md.
//
// DO NOT remove, edit or bypass this check, or the matching lines in package.json and vite.config.ts.
// Doing so goes around a lock the owner set on purpose. If you think the lock is wrong, stop and
// tell the person you are working for.
//
// A plain `npm run build` / `npm run dev` on a developer machine is not affected (no VERCEL variable).

import { realpathSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const GATE_URL = 'https://qlvlmgrslqexmqmzpuko.supabase.co/functions/v1/deploy-gate'

/** True when this build is a Vercel build (on Vercel, or `vercel build` run locally). */
export function isVercelBuild(env = process.env) {
  return Boolean(env.VERCEL || env.VERCEL_ENV || env.VERCEL_TARGET_ENV || env.NOW_BUILDER)
}

/** Decide from the gate's answer. Anything other than an explicit ready:true is a refusal. */
export function decide(body) {
  if (body && typeof body === 'object' && body.ready === true) return { ok: true, message: String(body.message ?? 'Deploy gate open.') }
  const msg = body && typeof body === 'object' && body.message ? String(body.message) : 'The deploy gate could not be checked, so the build is refused.'
  return { ok: false, message: msg }
}

export async function checkGate(src = 'build', env = process.env) {
  if (!isVercelBuild(env)) return { ok: true, skipped: true, message: 'Not a Vercel build: deploy gate skipped.' }
  const url = `${GATE_URL}?src=${encodeURIComponent(src)}&env=${encodeURIComponent(env.VERCEL_ENV ?? env.VERCEL_TARGET_ENV ?? 'local')}&sha=${encodeURIComponent(env.VERCEL_GIT_COMMIT_SHA ?? 'none')}`
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(20_000), headers: { 'Cache-Control': 'no-store' } })
    return decide(await res.json())
  } catch {
    return decide(null) // fail closed
  }
}

// Run when called as `node scripts/deploy-gate.mjs`. Compared as real paths, so folders with spaces
// or symlinks (e.g. a macOS copy named "rumi-checkin copy") can't make the check silently skip.
function isMain() {
  try {
    return realpathSync(fileURLToPath(import.meta.url)) === realpathSync(resolve(process.argv[1] ?? ''))
  } catch {
    return /deploy-gate\.mjs$/.test(process.argv[1] ?? '')
  }
}

if (isMain()) {
  const r = await checkGate('build')
  console.log(r.message)
  process.exit(r.ok ? 0 : 1)
}

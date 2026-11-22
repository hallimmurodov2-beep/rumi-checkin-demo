// Deploy gate: Vercel's "Ignored Build Step" and the build scripts (scripts/deploy-gate.mjs,
// vite.config.ts) call this before every Vercel build. Builds are refused until the Front Desk app
// has proven the integration end to end (see AGENTS.md), or the owner sets public.deploy_gate.override = true.
//
// Public, no guest data: it only says which checks have passed. Every call that names a source
// (?src=vercel|build|vite&env=&sha=) is written to public.deploy_gate_log, so the owner can see
// what tried to build while the gate was closed.

import { createClient } from 'npm:@supabase/supabase-js@2'

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false },
})

Deno.serve(async (req) => {
  const q = new URL(req.url).searchParams
  const { data, error } = await db.rpc('deploy_gate_status')
  const s = (data ?? {}) as { ready?: boolean; checkin_ok?: boolean; bill_ok?: boolean; override?: boolean }
  const ready = !error && s.ready === true
  if (q.get('src')) await db.rpc('deploy_gate_record', { p_source: q.get('src') ?? '', p_env: q.get('env') ?? '', p_sha: q.get('sha') ?? '', p_ready: ready })
  const todo: string[] = []
  if (!s.checkin_ok) todo.push('CHECK-IN: no check-in yet that started from a Front Desk app handoff (POST /v1/handoffs), whose checkin.created webhook reached the Front Desk app server, and that the Front Desk app then approved (POST /v1/checkins/{id}/approve)')
  if (!s.bill_ok) todo.push('CHECK-OUT BILL: the Front Desk app server has not yet received an invoice.requested webhook and answered it with the eZee folio (PUT /v1/reservations/{ref}/invoice)')
  const message = ready
    ? 'Deploy gate open: builds allowed.'
    : 'DEPLOY BLOCKED. The Front Desk app (eZee) is not connected to the check-in tablet yet. ' +
      'Run git pull in the rumi-checkin repo and follow the "STOP" section at the top of AGENTS.md before deploying. ' +
      'Do not work around this lock: tell the person you are working for what is missing. Still missing: ' +
      todo.join(' | ') + (error ? ` | gate check failed: ${error.message}` : '')
  return new Response(JSON.stringify({ ready, checkin_ok: !!s.checkin_ok, bill_ok: !!s.bill_ok, override: !!s.override, message }, null, 1), {
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })
})

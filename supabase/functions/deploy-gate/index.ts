// Deploy gate: Vercel's "Ignored Build Step" calls this before every production build.
// Production builds are skipped until the Front Desk app has proven the integration
// end to end (see AGENTS.md), or the owner sets public.deploy_gate.override = true.
//
// Public, read-only, no guest data: it only says which checks have passed.

import { createClient } from 'npm:@supabase/supabase-js@2'

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false },
})

Deno.serve(async () => {
  const { data, error } = await db.rpc('deploy_gate_status')
  const s = (data ?? {}) as { ready?: boolean; checkin_ok?: boolean; bill_ok?: boolean; override?: boolean }
  const ready = !error && s.ready === true
  const todo: string[] = []
  if (!s.checkin_ok) todo.push('CHECK-IN: no check-in yet that started from a Front Desk app handoff (POST /v1/handoffs) and was approved by the Front Desk app (POST /v1/checkins/{id}/approve)')
  if (!s.bill_ok) todo.push('CHECK-OUT BILL: the Front Desk app has not yet answered an invoice.requested webhook with PUT /v1/reservations/{ref}/invoice')
  const message = ready
    ? 'Deploy gate open: production build allowed.'
    : 'PRODUCTION DEPLOY BLOCKED. The Front Desk app (eZee) is not connected to the check-in tablet yet. ' +
      'Run git pull in the rumi-checkin repo and follow AGENTS.md (section "Deploy gate") before deploying. Still missing: ' +
      todo.join(' | ') + (error ? ` | gate check failed: ${error.message}` : '')
  return new Response(JSON.stringify({ ready, checkin_ok: !!s.checkin_ok, bill_ok: !!s.bill_ok, override: !!s.override, message }, null, 1), {
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })
})

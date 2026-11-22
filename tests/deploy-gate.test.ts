import assert from 'node:assert/strict'
import { decide, isVercelBuild } from '../scripts/deploy-gate.mjs'

// Only an explicit ready:true opens the gate; everything else refuses (fail closed).
assert.equal(decide({ ready: true, message: 'ok' }).ok, true)
assert.equal(decide({ ready: false, message: 'blocked' }).ok, false)
assert.equal(decide({ ready: 'true' }).ok, false)
assert.equal(decide({}).ok, false)
assert.equal(decide(null).ok, false)
assert.equal(decide('ready').ok, false)
assert.match(decide(null).message, /refused/)

// Vercel builds (on Vercel or `vercel build` on a laptop) are gated; plain local builds are not.
assert.equal(isVercelBuild({}), false)
assert.equal(isVercelBuild({ VERCEL: '1' }), true)
assert.equal(isVercelBuild({ VERCEL_ENV: 'preview' }), true)
assert.equal(isVercelBuild({ VERCEL_TARGET_ENV: 'production' }), true)

console.log('deploy-gate tests passed')

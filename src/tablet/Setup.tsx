import { useState } from 'react'
import { clearDevice, saveDevice, tablet, type StoredDevice } from '../lib/device'
import { ApiError } from '../lib/supabase'
import { Button, COLORS, Emblem, ErrorNote, Spinner } from '../ui'

/** First-run screen on a new tablet: pair it with a code from the staff app. */
export function PairTablet() {
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const clean = code.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8)
  const shown = clean.length > 4 ? `${clean.slice(0, 4)}-${clean.slice(4)}` : clean

  const pair = async () => {
    if (clean.length !== 8 || busy) return
    setBusy(true)
    setError(null)
    try {
      await tablet.pair(clean)
    } catch (e) {
      const c = e instanceof ApiError ? e.code : 'unknown_error'
      setError(
        c === 'invalid_code'
          ? 'That code is not valid or has expired. Create a new code in the staff app.'
          : c === 'network'
            ? 'No internet connection. Check the Wi-Fi and try again.'
            : 'Pairing failed. Please try again.',
      )
      setBusy(false)
    }
  }

  return (
    <div className="flex h-dvh">
      <section className="relative hidden w-[40%] flex-col items-center justify-center overflow-hidden bg-forest text-center lg:flex">
        <span className="pointer-events-none absolute inset-6 rounded-[28px] border border-gold-light/15" aria-hidden="true" />
        <Emblem color={COLORS.goldLight} className="rise h-36 w-36" />
        <p className="rise mt-5 font-serif text-xl font-semibold tracking-[0.4em] text-gold-light" style={{ animationDelay: '80ms' }}>THE RUMI</p>
        <p className="rise mt-1 text-[11px] font-medium tracking-[0.24em] text-gold-light" style={{ animationDelay: '120ms' }}>HOTEL AND RESIDENCES</p>
      </section>
      <section className="flex flex-1 flex-col justify-center px-8 sm:px-16">
        <p className="eyebrow rise">Tablet setup</p>
        <h1 className="rise mt-2 text-5xl text-forest" style={{ animationDelay: '60ms' }}>Pair this tablet</h1>
        <p className="rise mt-3 max-w-lg text-lg text-muted" style={{ animationDelay: '120ms' }}>
          In the staff app, open <strong className="font-semibold text-ink">Settings → Tablets</strong>, add a tablet and type its 8-character
          pairing code here.
        </p>
        <form
          className="rise mt-8 max-w-lg"
          style={{ animationDelay: '180ms' }}
          onSubmit={(e) => {
            e.preventDefault()
            pair()
          }}
        >
          <label htmlFor="pair" className="eyebrow block">Pairing code</label>
          <input
            id="pair"
            value={shown}
            onChange={(e) => setCode(e.target.value)}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            placeholder="XXXX-XXXX"
            className="field mt-2 h-20 text-center font-mono text-4xl uppercase tracking-[0.3em]"
          />
          <Button type="submit" className="mt-5 w-full" disabled={clean.length !== 8 || busy}>
            {busy && <Spinner />}
            {busy ? 'Pairing...' : 'Pair tablet'}
          </Button>
          <div className="mt-4 min-h-14">{error && <ErrorNote>{error}</ErrorNote>}</div>
        </form>
      </section>
    </div>
  )
}

/** Staff-only sheet, opened by holding the emblem on the welcome screen for 3 seconds. */
export function TabletSettings({ device, onClose }: { device: StoredDevice; onClose: () => void }) {
  const [confirmUnpair, setConfirmUnpair] = useState(false)
  return (
    <div className="fade-in fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-6" role="dialog" aria-modal="true" aria-labelledby="ts-title">
      <div className="pop-in card w-full max-w-xl p-8">
        <p className="eyebrow">Staff</p>
        <h2 id="ts-title" className="mt-1 text-4xl text-forest">Tablet settings</h2>
        <dl className="mt-6 space-y-1">
          <dt className="eyebrow">This tablet</dt>
          <dd className="text-xl font-medium">{device.name}</dd>
        </dl>
        <div className="mt-8 flex items-center justify-between gap-4 border-t border-line pt-6">
          <Button
            variant="secondary"
            className={confirmUnpair ? '!border-danger !text-danger' : ''}
            onClick={() => (confirmUnpair ? clearDevice() : setConfirmUnpair(true))}
          >
            {confirmUnpair ? 'Tap again to unpair' : 'Unpair tablet'}
          </Button>
          <Button onClick={onClose}>Close</Button>
        </div>
      </div>
    </div>
  )
}

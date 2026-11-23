import { useEffect, useRef } from 'react'

/** Staff shortcut: the Android kiosk app opens its admin menu after 5 taps in this top-right corner. */
const ADMIN_CORNER = 140 // CSS px; the app's own corner is 96 dp, this leaves a margin
const MAX_GAP_MS = 700
/** Things a guest taps on purpose: they are never counted as part of a triple tap. */
const INTERACTIVE = 'button, a, input, select, textarea, label, dialog, [data-no-tap]'

/**
 * Calls onTriple when the screen is tapped 3 times quickly. Taps in the admin corner and taps on buttons,
 * links and fields don't count (and start the count again), so rapid language switching or the admin
 * 5-tap can't trigger it. `blocked()` can switch it off at the moment of the tap (for example while a dialog is open).
 */
export function useTripleTap({
  enabled,
  onTriple,
  blocked,
}: {
  enabled: boolean
  onTriple: () => void
  blocked?: () => boolean
}) {
  const cb = useRef({ onTriple, blocked })
  useEffect(() => {
    cb.current = { onTriple, blocked }
  })
  useEffect(() => {
    if (!enabled) return
    let times: number[] = []
    const onDown = (e: PointerEvent) => {
      if (!e.isPrimary) return
      const target = e.target as Element | null
      const inCorner = e.clientX > window.innerWidth - ADMIN_CORNER && e.clientY < ADMIN_CORNER
      if (inCorner || cb.current.blocked?.() || target?.closest?.(INTERACTIVE)) {
        times = []
        return
      }
      const now = performance.now()
      times = times.filter((t) => now - t <= MAX_GAP_MS * 2)
      if (times.length && now - times[times.length - 1] > MAX_GAP_MS) times = []
      times.push(now)
      if (times.length >= 3) {
        times = []
        cb.current.onTriple()
      }
    }
    window.addEventListener('pointerdown', onDown, { passive: true })
    return () => window.removeEventListener('pointerdown', onDown)
  }, [enabled])
}

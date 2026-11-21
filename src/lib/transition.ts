import { flushSync } from 'react-dom'

const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** Run a state update inside a view transition (slide forward/back) when the browser supports it. */
export function transition(update: () => void, dir: 'fwd' | 'back' = 'fwd') {
  const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown }
  document.documentElement.dataset.dir = dir
  if (!doc.startViewTransition || reduced()) {
    update()
    return
  }
  doc.startViewTransition(() => flushSync(update))
}

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import '@fontsource-variable/cormorant-garamond'
import '@fontsource-variable/inter'
import App from './App'
import './index.css'

if (!(document as Document & { startViewTransition?: unknown }).startViewTransition) document.documentElement.classList.add('no-vt')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)

// Offline support (production builds only, so the dev server is never cached).
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        // Check for a new version every 30 minutes; the tablet reloads itself when idle.
        window.setInterval(() => reg.update().catch(() => {}), 30 * 60_000)
        reg.addEventListener('updatefound', () => {
          const sw = reg.installing
          sw?.addEventListener('statechange', () => {
            if (sw.state === 'activated' && navigator.serviceWorker.controller) {
              ;(window as Window & { __rumiUpdateReady?: boolean }).__rumiUpdateReady = true
            }
          })
        })
      })
      .catch(() => {})
  })
}

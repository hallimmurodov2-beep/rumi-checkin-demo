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
  // Only an existing controller being replaced indicates an update. The first
  // installation already matches the page and must not trigger a kiosk reload.
  let controlled = Boolean(navigator.serviceWorker.controller)
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (controlled) (window as Window & { __rumiUpdateReady?: boolean }).__rumiUpdateReady = true
    controlled = true
  })
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then((reg) => {
      window.setInterval(() => reg.update().catch(() => {}), 30 * 60_000)
    }).catch(() => {})
  })
}

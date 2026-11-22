// The Android kiosk app (android-kiosk/) shows this site in a locked, full-screen WebView and
// exposes a small bridge as window.RumiKiosk. Outside the kiosk app none of this exists.

interface Bridge {
  openAdmin: () => void
  info: () => string
}

export function kioskBridge(): Bridge | null {
  return (window as Window & { RumiKiosk?: Bridge }).RumiKiosk ?? null
}

/** Running inside the kiosk app (it adds "RumiKiosk/<version>" to the user agent). */
export const inKioskApp = /\bRumiKiosk\//.test(navigator.userAgent)

export interface KioskInfo {
  version: string
  owner: boolean
  locked: boolean
}

export function kioskInfo(): KioskInfo | null {
  try {
    const b = kioskBridge()
    return b ? (JSON.parse(b.info()) as KioskInfo) : null
  } catch {
    return null
  }
}


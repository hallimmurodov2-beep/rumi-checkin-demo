import type { WifiInfo } from './types'

// Special characters must be escaped in the Wi-Fi QR format.
const esc = (s: string) => s.replace(/([\\;,:"])/g, '\\$1')

/**
 * Text for a Wi-Fi QR code. Phones (iOS camera, Android) offer to join the network when they scan it:
 *   WIFI:T:WPA;S:<network>;P:<password>;H:true;;
 * The front desk app can send its own text instead (qr_payload), for example a hotspot login link.
 */
export function wifiQrText(w: WifiInfo): string {
  if (w.qr_payload) return w.qr_payload
  const sec = w.security === 'nopass' || !w.password ? 'nopass' : w.security
  return `WIFI:T:${sec};S:${esc(w.ssid)};${sec !== 'nopass' ? `P:${esc(w.password ?? '')};` : ''}${w.hidden ? 'H:true;' : ''};`
}

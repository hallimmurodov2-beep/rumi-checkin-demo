import { rpc, ApiError } from './supabase'
import type { PublicReservation, TabletConfig } from './types'

// A paired tablet keeps a random secret in local storage. The database only
// stores its SHA-256 hash; every tablet call proves itself with the secret.

const KEY = 'rumi-tablet-device'

export interface StoredDevice {
  id: string
  name: string
  secret: string
  camera: 'user' | 'environment'
}

export function getDevice(): StoredDevice | null {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as StoredDevice) : null
  } catch {
    return null
  }
}

export function saveDevice(d: StoredDevice) {
  try {
    localStorage.setItem(KEY, JSON.stringify(d))
  } catch {
    /* private mode: pairing will not survive a reload */
  }
  window.dispatchEvent(new Event('rumi-device'))
}

export function clearDevice() {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event('rumi-device'))
}

function newSecret(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

async function call<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const d = getDevice()
  if (!d) throw new ApiError('device_not_paired')
  try {
    return await rpc<T>(fn, { p_secret: d.secret, ...args })
  } catch (e) {
    if (e instanceof ApiError && e.code === 'device_not_paired') clearDevice()
    throw e
  }
}

export interface Handoff {
  id: string
  language: 'en' | 'ru' | 'tg' | null
  passport: {
    surname?: string
    given_names?: string
    nationality?: string
    document_number?: string
    birth_date?: string
    sex?: string
    expiry_date?: string
    doc_type?: string
    issuing_country?: string
  } | null
  reservation: PublicReservation
}

type Lookup = { status: 'found'; reservation: PublicReservation } | { status: 'none' | 'multiple' }

export const tablet = {
  async pair(code: string): Promise<StoredDevice> {
    const secret = newSecret()
    const res = await rpc<{ id: string; name: string }>('pair_device', { p_code: code, p_secret: secret })
    const device: StoredDevice = { id: res.id, name: res.name, secret, camera: 'user' }
    saveDevice(device)
    return device
  },
  config: () => call<TabletConfig>('tablet_config', {}),
  /** A booking reception sent to this tablet after scanning the passport (null when none). */
  poll: () => call<Handoff | null>('tablet_poll', {}),
  declineHandoff: (id: string) => call<null>('tablet_decline_handoff', { p_handoff_id: id }),
  findByRef: (ref: string, surname: string) => call<Lookup>('find_reservation_by_ref', { p_ref: ref, p_surname: surname }),
  findByName: (surname: string, given: string) => call<Lookup>('find_reservation_by_name', { p_surname: surname, p_given: given }),
  submitCheckin: (reservationId: string, p: CheckinPayload) =>
    call<{ id: string; desk_code: string }>('submit_checkin', { p_reservation_id: reservationId, p }),
  findStay: (room: string, surname: string) => call<Lookup>('find_stay_for_checkout', { p_room: room, p_surname: surname }),
  submitCheckout: (reservationId: string, rating: number | null, comment: string) =>
    call<string>('submit_checkout', { p_reservation_id: reservationId, p_rating: rating, p_comment: comment }),
}

export interface CheckinPayload {
  language: string
  doc_source: 'mrz' | 'none'
  doc_type?: string
  issuing_country?: string
  nationality?: string
  surname?: string
  given_names?: string
  document_number?: string
  birth_date?: string
  sex?: string
  expiry_date?: string
  mrz_valid?: boolean
  phone: string
  email: string
  shuttle: boolean
  consent: boolean
  signature_png: string
  handoff_id?: string
}

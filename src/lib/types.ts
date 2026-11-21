export type Lang = 'en' | 'ru' | 'tg'

export type StayStatus = 'expected' | 'pending_desk' | 'in_house' | 'checked_out' | 'cancelled' | 'no_show'
export type Role = 'pending' | 'staff' | 'admin'

export interface Reservation {
  id: string
  booking_ref: string
  guest_name: string
  source: string
  room_type: string
  room_number: string | null
  arrival_date: string
  departure_date: string
  adults: number
  breakfast: boolean
  notes: string | null
  status: StayStatus
  created_at: string
  updated_at: string
  ezee_booking_id: string | null
  ezee_status: string | null
}

/** What a tablet is allowed to see about a booking. */
export interface PublicReservation {
  id: string
  booking_ref: string
  guest_name: string
  source: string
  room_type: string
  room_number: string | null
  arrival_date: string
  departure_date: string
  nights: number
  adults: number
  breakfast: boolean
}

export interface Checkin {
  id: string
  reservation_id: string
  device_id: string | null
  created_at: string
  language: Lang
  doc_source: 'mrz' | 'manual' | 'none'
  doc_type: string | null
  issuing_country: string | null
  nationality: string | null
  surname: string | null
  given_names: string | null
  document_number: string | null
  birth_date: string | null
  sex: 'M' | 'F' | 'X' | null
  expiry_date: string | null
  mrz_valid: boolean | null
  phone: string | null
  email: string | null
  shuttle: boolean
  consent_at: string
  signature_png: string | null
  status: 'waiting' | 'approved' | 'rejected'
  approved_at: string | null
  approved_by: string | null
  data_purged_at: string | null
  ezee_synced_at: string | null
  ezee_error: string | null
}

export interface CheckinGuest {
  id: string
  checkin_id: string
  created_at: string
  doc_source: 'mrz' | 'manual'
  doc_type: string | null
  issuing_country: string | null
  nationality: string | null
  surname: string | null
  given_names: string | null
  document_number: string | null
  birth_date: string | null
  sex: 'M' | 'F' | 'X' | null
  expiry_date: string | null
  mrz_valid: boolean | null
  ezee_synced_at: string | null
  ezee_error: string | null
}

export interface IntegrationSettings {
  id: 1
  ezee_enabled: boolean
  push_guest_data: boolean
  auto_checkin: boolean
  push_checkout: boolean
  last_pull_at: string | null
  last_push_at: string | null
  last_error: string | null
  last_error_at: string | null
}

export interface PartnerSettings {
  id: 1
  webhook_enabled: boolean
  webhook_url: string | null
  api_key_prefix: string | null
  api_key_created_at: string | null
  webhook_secret_created_at: string | null
  last_delivery_at: string | null
  last_error: string | null
  last_error_at: string | null
}

export interface SyncLogEntry {
  id: number
  created_at: string
  direction: 'pull' | 'push' | 'system'
  action: string
  booking_ref: string | null
  ok: boolean
  message: string | null
}

export interface Checkout {
  id: string
  reservation_id: string
  device_id: string | null
  rating: number | null
  key_returned: boolean
  created_at: string
}

export interface Feedback {
  id: string
  reservation_id: string | null
  rating: number
  comment: string
  resolved: boolean
  resolved_by: string | null
  created_at: string
}

export interface Device {
  id: string
  name: string
  pairing_code: string | null
  pairing_expires_at: string | null
  paired_at: string | null
  last_seen_at: string | null
  revoked: boolean
  created_at: string
}

export interface Profile {
  user_id: string
  email: string
  full_name: string
  role: Role
  created_at: string
}

export interface HotelSettings {
  id: 1
  hotel_name: string
  wifi_name: string
  wifi_password: string
  breakfast_hours: string
  review_url: string
  idle_seconds: number
  retention_days: number
  updated_at: string
}

export interface TabletConfig {
  device_name: string
  hotel_name: string
  wifi_name: string
  wifi_password: string
  breakfast_hours: string
  review_url: string
  idle_seconds: number
  retention_days?: number
}

/** Passport/ID fields read from the machine-readable zone. */
export interface MrzData {
  docType: string
  issuingCountry: string
  surname: string
  givenNames: string
  documentNumber: string
  nationality: string
  birthDate: string // YYYY-MM-DD
  sex: 'M' | 'F' | 'X'
  expiryDate: string // YYYY-MM-DD
  valid: boolean // document number, birth date and expiry check digits all pass
  compositeOk?: boolean
}

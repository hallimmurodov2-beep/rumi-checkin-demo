// Development-only: renders the front-desk UI with fixture data so screens can
// be reviewed without signing in. Not included in production builds.
import { hotelToday, type StaffData } from '../staff/data'
import { ToastProvider } from '../staff/kit'
import { DeskUI } from '../staff/StaffApp'
import type { Checkin, Profile, Reservation } from '../lib/types'

const t = hotelToday()
const iso = (minsAgo: number) => new Date(Date.now() - minsAgo * 60_000).toISOString()
const res = (id: string, ref: string, name: string, extra: Partial<Reservation> = {}): Reservation => ({
  id, booking_ref: ref, guest_name: name, source: 'Booking.com', room_type: 'Deluxe Double', room_number: null,
  arrival_date: t, departure_date: hotelToday(3), adults: 2, breakfast: true, notes: null, status: 'expected',
  created_at: iso(600), updated_at: iso(600), ezee_booking_id: null, ezee_status: null, ...extra,
})
const reservations: Reservation[] = [
  res('r1', 'FX-1001', 'Fixture Guest One', { status: 'pending_desk' }),
  res('r2', 'FX-1002', 'Fixture Guest Two', { source: 'Direct', room_type: 'Junior Suite' }),
  res('r3', 'FX-1003', 'Fixture Guest Three', { status: 'in_house', room_number: '214', arrival_date: hotelToday(-2), departure_date: t }),
  res('r4', 'FX-1004', 'Fixture Guest Four', { status: 'in_house', room_number: '508', arrival_date: hotelToday(-1), departure_date: hotelToday(2) }),
]
const checkin = (id: string, rid: string, extra: Partial<Checkin> = {}): Checkin => ({
  id, reservation_id: rid, device_id: 'd1', created_at: iso(3), language: 'ru', doc_source: 'mrz', doc_type: 'P',
  issuing_country: 'UTO', nationality: 'UTO', surname: 'GUEST', given_names: 'FIXTURE ONE', document_number: 'L898902C3',
  birth_date: '1974-08-12', sex: 'F', expiry_date: '2031-04-15', mrz_valid: true, phone: '+000', email: 'fixture@example.com',
  shuttle: true, consent_at: iso(3), signature_png: null, status: 'waiting', approved_at: null, approved_by: null, data_purged_at: null, ezee_synced_at: null, ezee_error: null, ...extra,
})
const data: StaffData = {
  reservations,
  checkins: [checkin('c1', 'r1'), checkin('c2', 'r4', { status: 'approved', approved_at: iso(1400), created_at: iso(1410), shuttle: false })],
  checkouts: [{ id: 'o1', reservation_id: 'r3', device_id: 'd1', rating: 4, key_returned: false, created_at: iso(30) }],
  feedback: [{ id: 'f1', reservation_id: 'r3', rating: 2, comment: 'Fixture comment: the room was warm at night.', resolved: false, resolved_by: null, created_at: iso(30) }],
  devices: [
    { id: 'd1', name: 'Lobby tablet 1', pairing_code: null, pairing_expires_at: null, paired_at: iso(9000), last_seen_at: iso(0.5), revoked: false, created_at: iso(9000) },
    { id: 'd2', name: 'Lobby tablet 2', pairing_code: 'ABCD2345', pairing_expires_at: iso(-10), paired_at: null, last_seen_at: null, revoked: false, created_at: iso(5) },
  ],
  settings: { id: 1, hotel_name: 'The Rumi Hotel & Residences', wifi_name: 'Rumi-Guest', wifi_password: '********', breakfast_hours: '07:00 - 10:30', review_url: '', idle_seconds: 60, retention_days: 90, updated_at: iso(100) },
  profiles: [{ user_id: 'u1', email: 'admin@example.com', full_name: 'Fixture Admin', role: 'admin', created_at: iso(9000) }],
  guests: [{ id: 'g1', checkin_id: 'c1', created_at: iso(3), doc_source: 'mrz', doc_type: 'P', issuing_country: 'UTO', nationality: 'UTO', surname: 'GUEST', given_names: 'FIXTURE COMPANION', document_number: 'X1234567', birth_date: '1980-01-01', sex: 'M', expiry_date: '2030-01-01', mrz_valid: true, ezee_synced_at: null, ezee_error: null }],
  integration: { id: 1, ezee_enabled: false, push_guest_data: true, auto_checkin: false, push_checkout: true, last_pull_at: null, last_push_at: null, last_error: 'eZee credentials are not set. Add EZEE_HOTEL_CODE and EZEE_AUTH_CODE as Edge Function secrets.', last_error_at: iso(2) },
  partner: { id: 1, webhook_enabled: false, webhook_url: null, api_key_prefix: null, api_key_created_at: null, webhook_secret_created_at: null, last_delivery_at: null, last_error: null, last_error_at: null },
  syncLog: [],
  loading: false,
  error: null,
  live: true,
  reload: () => {},
}
const profile: Profile = data.profiles[0]

export default function StaffPreview() {
  return (
    <ToastProvider>
      <DeskUI profile={profile} data={data} />
    </ToastProvider>
  )
}

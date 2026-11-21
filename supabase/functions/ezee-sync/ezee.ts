// eZee FrontDesk / Yanolja Cloud Solution connectivity: request builders and
// response mapping. Pure functions (no I/O) so they can be unit-tested.
//
// Endpoints (from eZee's connectivity docs):
//   PMS:   POST https://live.ipms247.com/pmsinterface/pms_connectivity.php
//          ArrivalList, DepartureList, FetchSingleBooking
//   Kiosk: POST https://live.ipms247.com/index.php/page/service.kioskconnectivity
//          UploadDocument, AddSharer, GuestCheckIn, GuestCheckOut, RetrieveIdentityType
// Both take a JSON body { RES_Request: { Request_Type, Authentication: { HotelCode, AuthCode }, ... } }.

export const PMS_URL = 'https://live.ipms247.com/pmsinterface/pms_connectivity.php'
export const KIOSK_URL = 'https://live.ipms247.com/index.php/page/service.kioskconnectivity'

export interface Creds {
  hotelCode: string
  authCode: string
}

// deno-lint-ignore no-explicit-any
type Json = any

export function request(type: string, creds: Creds, extra: Record<string, unknown> = {}) {
  return {
    RES_Request: {
      Request_Type: type,
      Authentication: { HotelCode: creds.hotelCode, AuthCode: creds.authCode },
      ...extra,
    },
  }
}

export function dateRange(type: 'ArrivalList' | 'DepartureList', creds: Creds, from: string, to: string) {
  return request(type, creds, { Date: { from_date: from, to_date: to } })
}

/**
 * eZee answers in several shapes: { Success, Errors:[{ErrorCode:"0"}] },
 * { Error:[{ErrorCode:100,...}] }, { Errors:{ErrorCode:"301",...} } or a plain
 * data object (Reservations). Returns null when the call succeeded.
 */
export function errorOf(res: Json): { code: string; message: string } | null {
  if (!res || typeof res !== 'object') return { code: 'bad_response', message: 'Empty or invalid response from eZee' }
  for (const key of ['Errors', 'Error']) {
    const e = res[key]
    const list = Array.isArray(e) ? e : e ? [e] : []
    for (const item of list) {
      const code = String(item?.ErrorCode ?? '')
      if (code && code !== '0') return { code, message: String(item?.ErrorMessage ?? item?.ErrorMsg ?? `eZee error ${code}`) }
    }
  }
  return null
}

const asArray = <T>(x: T | T[] | undefined | null): T[] => (Array.isArray(x) ? x : x ? [x] : [])
const str = (x: unknown) => (x == null ? '' : String(x).trim())
const day = (x: unknown) => str(x).slice(0, 10)

export type StayStatus = 'expected' | 'in_house' | 'checked_out' | 'cancelled' | 'no_show'

/** Map eZee's CurrentStatus / Status text to our stay status. */
export function statusFromEzee(current: string, status: string): StayStatus {
  const s = `${current} ${status}`.toLowerCase()
  if (/cancel|void/.test(s)) return 'cancelled'
  if (/no.?show/.test(s)) return 'no_show'
  if (/check(ed)?.?out|departed/.test(s)) return 'checked_out'
  if (/in.?house|check(ed)?.?in|arrived|stay/.test(s)) return 'in_house'
  return 'expected'
}

const BREAKFAST = /breakfast|\bbb\b|\bb&b\b|bed\s*(and|&)\s*breakfast|half\s*board|full\s*board|\bhb\b|\bfb\b|завтрак/i

export interface MergedBooking {
  ezee_booking_id: string
  booking_ref: string
  alt_refs: string[]
  guest_name: string
  source: string
  room_type: string
  room_number: string | null
  arrival_date: string
  departure_date: string
  adults: number
  breakfast: boolean
  status: StayStatus
  ezee_status: string
  ezee_room_type_id: string
  ezee_guest: { first_name: string; last_name: string; email: string }
}

/** Flatten an ArrivalList / DepartureList / FetchSingleBooking response into one row per room. */
export function bookingsFrom(res: Json): MergedBooking[] {
  const out: MergedBooking[] = []
  const reservations = asArray(res?.Reservations?.Reservation)
  for (const r of reservations) {
    const uniqueId = str(r.UniqueID)
    for (const t of asArray(r.BookingTran)) {
      const id = str(t.SubBookingId) || uniqueId
      if (!id) continue
      const first = str(t.FirstName) || str(r.FirstName)
      const last = str(t.LastName) || str(r.LastName)
      const arrival = day(t.Start)
      const departure = day(t.End)
      if (!/^\d{4}-\d{2}-\d{2}$/.test(arrival) || !/^\d{4}-\d{2}-\d{2}$/.test(departure) || departure <= arrival) continue
      const rental = asArray(t.RentalInfo)[0] ?? {}
      const adults = Number(rental.Adult ?? rental.Adults ?? t.Adult ?? 1) || 1
      const plan = `${str(t.RateplanName)} ${str(t.PackageName)} ${str(t.RateplanCode)}`
      const current = str(t.CurrentStatus)
      const status = str(t.Status)
      out.push({
        ezee_booking_id: id,
        booking_ref: id,
        alt_refs: [...new Set([uniqueId, str(t.VoucherNo), str(r.VoucherNo)].filter((v) => v && v !== id))],
        guest_name: `${first} ${last}`.trim() || 'Guest',
        source: str(r.Source) || 'eZee',
        room_type: str(t.RoomTypeName),
        room_number: str(t.RoomName) || null,
        arrival_date: arrival,
        departure_date: departure,
        adults: Math.max(1, Math.min(20, adults)),
        breakfast: BREAKFAST.test(plan),
        status: statusFromEzee(current, status),
        ezee_status: [current, status].filter(Boolean).join(' / '),
        ezee_room_type_id: str(t.RoomTypeCode ?? t.RoomTypeID),
        ezee_guest: { first_name: first, last_name: last, email: str(t.Email) || str(r.Email) },
      })
    }
  }
  return out
}

/** Pick the passport identity type id from RetrieveIdentityType (shape not documented in detail). */
export function passportIdentityType(res: Json): string | null {
  const lists = [res?.IdentityTypes?.IdentityType, res?.IdentityType, res?.Success?.IdentityType, res?.Data, res]
  for (const l of lists) {
    for (const item of asArray(l)) {
      if (item && typeof item === 'object') {
        const name = str(item.Name ?? item.IdentityType ?? item.Type ?? item.name)
        const id = str(item.ID ?? item.Id ?? item.IdentityTypeID ?? item.id)
        if (id && /passport|паспорт/i.test(name)) return id
      }
    }
  }
  return null
}

const GENDER: Record<string, string> = { M: 'Male', F: 'Female' }

export interface GuestDoc {
  surname: string | null
  given_names: string | null
  document_number: string | null
  birth_date: string | null
  sex: string | null
  expiry_date: string | null
}

function titleCase(s: string | null) {
  return (s ?? '').toLowerCase().replace(/(^|[\s-])([a-z])/g, (m) => m.toUpperCase())
}

/** UploadDocument: send the tablet's guest details and signature to the booking in eZee. */
export function uploadDocumentRequest(
  creds: Creds,
  bookingId: string,
  ezeeGuest: { first_name: string; last_name: string; email: string },
  doc: GuestDoc & { phone: string | null; email: string | null; signature_png: string | null },
  identityTypeId: string | null,
) {
  const data: Record<string, string> = {
    FirstName: titleCase(doc.given_names) || ezeeGuest.first_name,
    LastName: titleCase(doc.surname) || ezeeGuest.last_name,
    Type: 'Adult',
  }
  if (doc.sex && GENDER[doc.sex]) data.Gender = GENDER[doc.sex]
  if (doc.birth_date) data.DateOfBirth = doc.birth_date
  if (doc.phone) data.Mobile = doc.phone
  if (doc.email || ezeeGuest.email) data.Email = doc.email || ezeeGuest.email
  if (identityTypeId && doc.document_number) {
    data.IdentityTypeID = identityTypeId
    data.IdentityNo = doc.document_number
    if (doc.expiry_date) data.ExpiryDate = doc.expiry_date
  }
  const documents = doc.signature_png
    ? [{ Type: '2', Images: doc.signature_png.replace(/^data:image\/\w+;base64,/, '') }]
    : []
  return request('UploadDocument', creds, {
    Reservation: [
      {
        BookingId: bookingId,
        GuestDetails: [
          {
            // Identifies the existing guest on the booking.
            FirstName: ezeeGuest.first_name,
            LastName: ezeeGuest.last_name,
            Email: ezeeGuest.email,
            UpdateSinglebooking: '1',
            UpdateGuestData: [data],
            Documents: documents,
          },
        ],
      },
    ],
  })
}

/** AddSharer: additional guests on the same booking. */
export function addSharerRequest(creds: Creds, bookingId: string, guests: GuestDoc[], identityTypeId: string | null, fallbackEmail: string) {
  return request('AddSharer', creds, {
    Sharers: guests.slice(0, 5).map((g) => {
      const s: Record<string, string> = {
        BookingId: bookingId,
        FirstName: titleCase(g.given_names) || 'Guest',
        LastName: titleCase(g.surname) || 'Guest',
        Gender: GENDER[g.sex ?? ''] ?? 'Male',
        Type: 'Adult',
        Email: fallbackEmail,
      }
      if (g.birth_date) s.DateOfBirth = g.birth_date
      if (identityTypeId && g.document_number) {
        s.IdentityTypeID = identityTypeId
        s.IdentityNo = g.document_number
        if (g.expiry_date) s.ExpiryDate = g.expiry_date
      }
      return s
    }),
  })
}

export function checkInRequest(
  creds: Creds,
  bookingId: string,
  guestName: string,
  doc: { email: string | null; phone: string | null; document_number: string | null; signature_png: string | null },
  identityTypeId: string | null,
  fallbackEmail: string,
) {
  const r: Record<string, string> = {
    BookingId: bookingId,
    GuestName: guestName,
    Email: doc.email || fallbackEmail,
    Address: 'Not provided at kiosk',
    Phone: doc.phone ?? '',
    Mobile: doc.phone ?? '',
  }
  if (identityTypeId && doc.document_number) {
    r.IdentityTypeID = identityTypeId
    r.IdentityNo = doc.document_number
  }
  if (doc.signature_png) r.GuestSignature = doc.signature_png.replace(/^data:image\/\w+;base64,/, '')
  return request('GuestCheckIn', creds, { Reservation: [r] })
}

export function checkOutRequest(creds: Creds, bookingId: string) {
  return request('GuestCheckOut', creds, { Reservation: [{ BookingId: bookingId }] })
}

/** Errors that will not fix themselves by retrying. */
export function isFinal(action: string, code: string): boolean {
  if (['301', '302', '303', '201', '202'].includes(code)) return false // config problem: retry after it is fixed
  if (action === 'GuestCheckOut') return ['113', '114', '115', '116', '117', '119'].includes(code)
  if (action === 'GuestCheckIn') return ['113', '116', '117', '126', '127', '130', '133'].includes(code)
  return ['113', '116', '117', '127'].includes(code)
}

/** Friendly explanation for staff of the most common eZee errors. */
export function explain(action: string, code: string, message: string): string {
  const common: Record<string, string> = {
    '301': 'eZee rejected the hotel code or auth code.',
    '302': 'Kiosk/PMS integration is not enabled for this hotel in eZee. Ask eZee support to enable it.',
    '303': 'The eZee auth code is inactive.',
    '202': 'The hotel is not active in eZee.',
  }
  if (common[code]) return common[code]
  if (action === 'GuestCheckOut' && code === '114') return 'Bill not settled in eZee. Settle the folio at the desk, then check out in eZee.'
  if (action === 'GuestCheckOut' && code === '118') return 'Already checked out in eZee.'
  if (action === 'GuestCheckIn' && code === '116') return 'No room assigned in eZee yet.'
  if (action === 'GuestCheckIn' && code === '117') return 'Room is not clean in eZee yet.'
  if (action === 'GuestCheckIn' && code === '128') return 'Already checked in on eZee.'
  return `${message} (eZee ${code})`
}

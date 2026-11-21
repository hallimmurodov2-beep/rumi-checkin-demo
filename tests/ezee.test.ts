import { strict as assert } from 'node:assert'
import * as E from '../supabase/functions/ezee-sync/ezee.ts'

const creds = { hotelCode: 'H1', authCode: 'A1' }

// Request envelope matches eZee's samples.
const arr = E.dateRange('ArrivalList', creds, '2026-11-20', '2026-11-22')
assert.deepEqual(arr, { RES_Request: { Request_Type: 'ArrivalList', Authentication: { HotelCode: 'H1', AuthCode: 'A1' }, Date: { from_date: '2026-11-20', to_date: '2026-11-22' } } })

// Error shapes.
assert.equal(E.errorOf({ Success: { SuccessMsg: 'ok' }, Errors: [{ ErrorCode: '0', ErrorMessage: 'Success' }] }), null)
assert.deepEqual(E.errorOf({ Error: [{ ErrorCode: 113, ErrorMessage: 'Reservation not found' }] }), { code: '113', message: 'Reservation not found' })
assert.equal(E.errorOf({ Errors: { ErrorCode: '301', ErrorMessage: 'Unauthorized' } })!.code, '301')
assert.equal(E.errorOf({ Reservations: { Reservation: [] } }), null)

// Booking mapping, two rooms on one reservation.
const res = {
  Reservations: {
    Reservation: [
      {
        UniqueID: '333', FirstName: 'Anna', LastName: 'Eriksson', Email: 'a@example.com', Source: 'Booking.com',
        BookingTran: [
          { SubBookingId: '333-1', VoucherNo: '4455667788', RoomTypeName: 'Deluxe Double', RoomTypeCode: '12', RoomName: '305', Start: '2026-11-21', End: '2026-11-24', RateplanName: 'Bed & Breakfast', CurrentStatus: 'Arrived', Status: 'Confirmed', RentalInfo: [{ Adult: '2' }] },
          { SubBookingId: '333-2', RoomTypeName: 'Twin', Start: '2026-11-21 14:00:00', End: '2026-11-23', RateplanName: 'Room Only', CurrentStatus: 'Reserved', FirstName: 'John', LastName: 'Smith' },
        ],
      },
    ],
  },
}
const b = E.bookingsFrom(res)
assert.equal(b.length, 2)
assert.equal(b[0].booking_ref, '333-1')
assert.deepEqual(b[0].alt_refs, ['333', '4455667788'])
assert.equal(b[0].guest_name, 'Anna Eriksson')
assert.equal(b[0].room_number, '305')
assert.equal(b[0].breakfast, true)
assert.equal(b[0].adults, 2)
assert.equal(b[0].status, 'in_house')
assert.equal(b[1].guest_name, 'John Smith')
assert.equal(b[1].arrival_date, '2026-11-21')
assert.equal(b[1].breakfast, false)
assert.equal(b[1].status, 'expected')
assert.equal(b[1].room_number, null)

// Status words.
assert.equal(E.statusFromEzee('Checked Out', ''), 'checked_out')
assert.equal(E.statusFromEzee('', 'Cancelled'), 'cancelled')
assert.equal(E.statusFromEzee('No Show', ''), 'no_show')
assert.equal(E.statusFromEzee('In House', ''), 'in_house')

// Upload request carries passport data, identity and signature without the data-URL prefix.
const up = E.uploadDocumentRequest(creds, '333-1', { first_name: 'Anna', last_name: 'Eriksson', email: 'a@example.com' },
  { surname: 'ERIKSSON', given_names: 'ANNA MARIA', document_number: 'L898902C3', birth_date: '1974-08-12', sex: 'F', expiry_date: '2031-04-15', phone: '+992', email: null, signature_png: 'data:image/png;base64,QUJD' }, '7')
const gd = up.RES_Request.Reservation[0].GuestDetails[0]
assert.equal(gd.LastName, 'Eriksson')
assert.equal(gd.UpdateGuestData[0].FirstName, 'Anna Maria')
assert.equal(gd.UpdateGuestData[0].Gender, 'Female')
assert.equal(gd.UpdateGuestData[0].IdentityTypeID, '7')
assert.equal(gd.Documents[0].Type, '2')
assert.equal(gd.Documents[0].Images, 'QUJD')

assert.equal(E.passportIdentityType({ IdentityType: [{ ID: '3', Name: 'Driving licence' }, { ID: '7', Name: 'Passport' }] }), '7')
assert.equal(E.isFinal('GuestCheckOut', '114'), true)
assert.equal(E.isFinal('GuestCheckOut', '301'), false)
console.log('ezee tests passed')

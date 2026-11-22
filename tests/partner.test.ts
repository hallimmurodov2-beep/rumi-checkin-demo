import { strict as assert } from 'node:assert'
import { cleanInvoice, cleanWifi, isDate } from '../supabase/functions/partner-api/validate.ts'
import { wifiQrText } from '../src/lib/wifi.ts'

/* ---- Wi-Fi QR text: what phones read when a guest scans the code ---- */

assert.equal(wifiQrText({ ssid: 'Rumi-Guest', password: 'welcome2026', security: 'WPA' }), 'WIFI:T:WPA;S:Rumi-Guest;P:welcome2026;;')
assert.equal(wifiQrText({ ssid: 'Lobby', password: null, security: 'nopass' }), 'WIFI:T:nopass;S:Lobby;;')
assert.equal(wifiQrText({ ssid: 'Hidden', password: 'pw', security: 'WPA', hidden: true }), 'WIFI:T:WPA;S:Hidden;P:pw;H:true;;')
// Special characters are escaped, so a password with ; or : cannot break the code.
assert.equal(wifiQrText({ ssid: 'A;B', password: 'p:w"\\', security: 'WPA' }), 'WIFI:T:WPA;S:A\\;B;P:p\\:w\\"\\\\;;')
// A security type with no password falls back to an open network instead of a code that cannot connect.
assert.equal(wifiQrText({ ssid: 'X', password: null, security: 'WPA' }), 'WIFI:T:nopass;S:X;;')
// The front desk app can supply its own text (for example a hotspot login link).
assert.equal(wifiQrText({ ssid: 'X', password: 'p', security: 'WPA', qr_payload: 'https://wifi.example/login' }), 'https://wifi.example/login')

/* ---- Wi-Fi input from the front desk app ---- */

assert.deepEqual(cleanWifi({ ssid: ' Rumi ', password: 'abc12345' }).wifi, { ssid: 'Rumi', password: 'abc12345', security: 'WPA', hidden: false, qr_payload: null, note: null })
assert.equal(cleanWifi({ ssid: 'Open' }).wifi?.security, 'nopass')
assert.equal(cleanWifi({ ssid: 'Open', security: 'nopass', password: 'ignored' }).wifi?.password, null)
assert.match(cleanWifi({ password: 'x' }).error!, /ssid/)
assert.match(cleanWifi({ ssid: 'A', security: 'WPA' }).error!, /password/)
assert.match(cleanWifi({ ssid: 'A', password: 'x', security: 'WPA3' }).error!, /security/)
assert.match(cleanWifi(null).error!, /object/)

/* ---- Bills: the guest reads these figures at check-out ---- */

const base = {
  currency: 'tjs',
  lines: [
    { date: '2026-11-21', description: 'Room', quantity: 2, unit_price: 950 },
    { description: 'Minibar', amount: 75.5 },
    { description: 'Loyalty discount', amount: -50 },
  ],
  taxes: [{ name: 'VAT 15%', amount: 100 }],
  payments: [{ date: '2026-11-21T10:00:00Z', method: 'Visa •••• 4242', amount: 500 }],
}
const ok = cleanInvoice(base)
assert.equal(ok.error, undefined)
const inv = ok.invoice!
assert.equal(inv.currency, 'TJS')
assert.deepEqual((inv.lines as { amount: number }[]).map((l) => l.amount), [1900, 75.5, -50]) // unit price x quantity
assert.equal(inv.subtotal, 1925.5)
assert.equal(inv.tax_total, 100)
assert.equal(inv.total, 2025.5) // taxes are added on top
assert.equal(inv.paid, 500)
assert.equal(inv.balance, 1525.5)
assert.equal((inv.payments as { date: string }[])[0].date, '2026-11-21')

// Prices that already include tax: the total is just the lines.
const incl = cleanInvoice({ ...base, prices_include_tax: true }).invoice!
assert.equal(incl.total, 1925.5)
assert.equal(incl.balance, 1425.5)

// Paid in full and overpaid (refund) come out as 0 and negative.
assert.equal(cleanInvoice({ ...base, payments: [{ method: 'Cash', amount: 2025.5 }] }).invoice!.balance, 0)
assert.equal(cleanInvoice({ ...base, payments: [{ method: 'Cash', amount: 2100 }] }).invoice!.balance, -74.5)

// Floating-point sums are rounded to cents, and "950,00" style strings are accepted.
const fp = cleanInvoice({ currency: 'USD', lines: [{ description: 'A', amount: 0.1 }, { description: 'B', amount: '0,2' }] }).invoice!
assert.equal(fp.total, 0.3)

// The front desk app's own totals win over the computed ones.
const own = cleanInvoice({ ...base, total: 2000, paid: 500, balance: 1500 }).invoice!
assert.equal(own.total, 2000)
assert.equal(own.balance, 1500)

// Bad input says which field is wrong.
assert.match(cleanInvoice({ ...base, currency: 'TJSS' }).error!, /currency/)
assert.match(cleanInvoice({ ...base, lines: [] }).error!, /lines/)
assert.match(cleanInvoice({ ...base, lines: [{ amount: 5 }] }).error!, /lines\[0\]\.description/)
assert.match(cleanInvoice({ ...base, lines: [{ description: 'X' }] }).error!, /lines\[0\]\.amount/)
assert.match(cleanInvoice({ ...base, lines: [{ description: 'X', amount: 1, date: '21/11/2026' }] }).error!, /date/)
assert.match(cleanInvoice({ ...base, taxes: [{ amount: 3 }] }).error!, /taxes\[0\]/)
assert.match(cleanInvoice({ ...base, payments: [{ method: 'Cash', amount: 'lots' }] }).error!, /payments\[0\]/)
assert.match(cleanInvoice({ ...base, issued_at: 'yesterday' }).error!, /issued_at/)
assert.match(cleanInvoice('nope').error!, /object/)

/* ---- Dates from the front desk app ---- */

assert.equal(isDate('2026-11-22'), true)
assert.equal(isDate('2028-02-29'), true) // leap day
assert.equal(isDate('2026-02-31'), false) // no such day
assert.equal(isDate('2026-13-01'), false)
assert.equal(isDate('22.11.2026'), false)
assert.equal(isDate(undefined), false)

console.log('partner tests passed')

// Development-only: shows tablet screens with fixture data, without pairing a tablet.
// Open /dev/tablet?screen=done&lang=ru&bill=due. Not included in production builds.
import { useState } from 'react'
import { LangContext } from '../i18n'
import { tablet } from '../lib/device'
import type { Invoice, PublicReservation, TabletConfig } from '../lib/types'
import { Checkout } from '../tablet/Checkout'
import { DeskModeContext } from '../tablet/Shell'
import { Done } from '../tablet/Steps'
import type { Lang } from '../translations'

const q = new URLSearchParams(window.location.search)
const screen = q.get('screen') ?? 'done'
const lang = (['en', 'ru', 'tg'].includes(q.get('lang') ?? '') ? q.get('lang') : 'en') as Lang
const bill = q.get('bill') ?? 'due' // due | paid | slow | none
const perStay = q.get('wifi') === 'stay'

const config: TabletConfig = {
  device_name: 'Fixture tablet',
  hotel_name: 'The Rumi Hotel & Residences',
  wifi_name: 'Rumi-Guest',
  wifi_password: 'fixture-pass-123',
  wifi_security: 'WPA',
  breakfast_hours: '07:00 - 10:30',
  review_url: 'https://example.com/review',
  idle_seconds: 600,
}

const stay: PublicReservation = {
  id: 'fixture', booking_ref: 'FX-1003', guest_name: 'Fixture Guest Three', source: 'Booking.com', room_type: 'Deluxe Double',
  room_number: '214', arrival_date: '2026-11-19', departure_date: '2026-11-22', nights: 3, adults: 2, breakfast: true,
}

const invoice: Invoice = {
  invoice_number: 'FX-INV-0042', currency: 'TJS', issued_at: new Date().toISOString(), lines: [
    { date: '2026-11-19', description: 'Deluxe Double, room and breakfast', quantity: 1, unit_price: 950, amount: 950 },
    { date: '2026-11-20', description: 'Deluxe Double, room and breakfast', quantity: 1, unit_price: 950, amount: 950 },
    { date: '2026-11-21', description: 'Deluxe Double, room and breakfast', quantity: 1, unit_price: 950, amount: 950 },
    { date: '2026-11-20', description: 'Restaurant dinner', quantity: 1, unit_price: 315, amount: 315 },
    { date: '2026-11-21', description: 'Minibar', quantity: 3, unit_price: 25, amount: 75 },
    { date: '2026-11-21', description: 'Laundry service', quantity: 1, unit_price: 120, amount: 120 },
  ],
  taxes: [{ name: 'VAT 15%', amount: 511.5 }], payments: [{ date: '2026-11-19', method: 'Visa •••• 4242', amount: 1500 }],
  prices_include_tax: false, subtotal: 3360, tax_total: 511.5, total: 3871.5, paid: 1500, balance: 2371.5, note: null,
}
const paidInvoice: Invoice = { ...invoice, payments: [{ date: '2026-11-22', method: 'Visa •••• 4242', amount: 3871.5 }], paid: 3871.5, balance: 0 }

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))
const started = Date.now()
tablet.wifi = async () => {
  await wait(300)
  return perStay
    ? { ssid: 'Rumi-Room-214', password: 'K7QF-29XA', security: 'WPA', per_stay: true, note: 'Valid until 22 Nov, 12:00' }
    : { ssid: config.wifi_name, password: config.wifi_password, security: 'WPA', per_stay: false }
}
tablet.invoice = async () => {
  await wait(400)
  const now = new Date().toISOString()
  if (bill === 'none') return { invoice: null, received_at: null, requested_at: null, can_request: false }
  if (bill === 'slow' && Date.now() - started < 4000) return { invoice: null, received_at: null, requested_at: now, can_request: true }
  return { invoice: bill === 'paid' ? paidInvoice : invoice, received_at: now, requested_at: now, can_request: true }
}

export default function TabletPreview() {
  const [key, setKey] = useState(0)
  const again = () => setKey((k) => k + 1)
  return (
    <div className="kiosk h-dvh w-full overflow-hidden bg-cream" lang={lang}>
      <LangContext.Provider value={lang}>
        <DeskModeContext.Provider value>
          {screen === 'checkout' ? (
            <Checkout key={key} stay={stay} reviewUrl={config.review_url} onBack={again} onComplete={async () => again()} />
          ) : (
            <Done key={key} onFinish={again} shuttle breakfast config={config} room="214" fromDesk checkinId="fixture" />
          )}
        </DeskModeContext.Provider>
      </LangContext.Provider>
    </div>
  )
}

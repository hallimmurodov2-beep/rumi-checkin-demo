// Development-only: shows tablet screens with fixture data, without pairing a tablet.
// Open /dev/tablet?screen=done&lang=ru&bill=due. Screens: welcome, details, signature (&policy=0 for none), help, done, cofind, checkout, codone (add &due=1), saver, settings. Not included in production builds.
import { useState } from 'react'
import { LangContext, SetLangContext } from '../i18n'
import { tablet } from '../lib/device'
import type { Invoice, PublicReservation, TabletConfig } from '../lib/types'
import { Checkout, CheckoutDone, CheckoutFind } from '../tablet/Checkout'
import { Screensaver } from '../tablet/Screensaver'
import { TabletSettings } from '../tablet/Setup'
import { DeskModeContext } from '../tablet/Shell'
import { DetailsStep, Done, NeedHelp, SignatureStep, emptyDetails } from '../tablet/Steps'
import { Welcome } from '../tablet/Welcome'
import type { Lang } from '../translations'

const q = new URLSearchParams(window.location.search)
const screen = q.get('screen') ?? 'done'
const initialLang = (['en', 'ru', 'tg'].includes(q.get('lang') ?? '') ? q.get('lang') : 'en') as Lang
const bill = q.get('bill') ?? 'due' // due | paid | slow | none
const perStay = q.get('wifi') === 'stay'
// &kiosk=1 fakes the Android kiosk app's bridge.
if (q.get('kiosk')) (window as Window & { RumiKiosk?: unknown }).RumiKiosk = { openAdmin: () => alert('Kiosk admin PIN screen opens here'), info: () => '{"version":"1.0.20261122.0801","owner":true,"locked":true}' }

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
  room_number: '214', arrival_date: '2026-11-19', departure_date: '2026-11-24', nights: 5, adults: 2, breakfast: true,
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
const POLICY = `# House rules

Welcome to **The Rumi Hotel & Residences**. By signing, you agree to the following.

## Your stay
- Check-in is from 14:00 and check-out is until 12:00.
- Late check-out depends on availability and may be charged.
- Please keep your key card with you and return it at departure.

## In the room
1. Smoking is not allowed in rooms or on balconies. A cleaning fee of 500 TJS applies.
2. Pets are not allowed.
3. Quiet hours are 23:00 to 07:00.

## Payment
The room and all extras are paid at departure unless prepaid. Damage to hotel property is charged at cost.

---
*Thank you for staying with us.*`
tablet.policy = async () => {
  await wait(300)
  return q.get('policy') === '0' ? null : { id: 'pol-1', lang: 'en', version: 3, body_md: POLICY }
}
tablet.checkinInfo = async () => {
  await wait(300)
  return { status: 'waiting', room_number: '305', wifi: await tablet.wifi('fixture') }
}
tablet.invoice = async () => {
  await wait(400)
  const now = new Date().toISOString()
  if (bill === 'none') return { invoice: null, received_at: null, requested_at: null, can_request: false }
  if (bill === 'slow' && Date.now() - started < 4000) return { invoice: null, received_at: null, requested_at: now, can_request: true }
  return { invoice: bill === 'paid' ? paidInvoice : invoice, received_at: now, requested_at: now, can_request: true }
}

const noop = () => {}

export default function TabletPreview() {
  const [key, setKey] = useState(0)
  const [details, setDetails] = useState(emptyDetails)
  const [lang, setLang] = useState<Lang>(initialLang)
  const again = () => setKey((k) => k + 1)
  const view = (() => {
    switch (screen) {
      case 'welcome':
        return <Welcome lang={lang} setLang={setLang} hotelName={config.hotel_name} onCheckout={noop} onSettings={noop} />
      case 'details':
        return <DetailsStep value={details} onChange={setDetails} greetName="Eriksson" onNotMe={noop} onNext={noop} />
      case 'signature':
        return <SignatureStep onBack={noop} onSubmit={async () => again()} signerName="Anna Maria Eriksson" />
      case 'help':
        return <NeedHelp onStart={noop} step={1} />
      case 'cofind':
        return <CheckoutFind onBack={noop} onFound={noop} />
      case 'codone':
        return <CheckoutDone onFinish={noop} due={q.get('due') ? { amount: 2371.5, currency: 'TJS' } : null} />
      case 'settings':
        return <TabletSettings device={{ id: 'x', name: 'Lobby tablet 1', secret: '', camera: 'user' }} hotel={config.hotel_name} online onClose={noop} />
      case 'saver':
        return <Screensaver onWake={noop} />
      case 'checkout':
        return <Checkout key={key} stay={stay} reviewUrl={config.review_url} shuttle onBack={again} onComplete={async () => again()} />
      default:
        return <Done key={key} onFinish={again} breakfast config={config} room={null} checkinId="fixture" />
    }
  })()
  return (
    <div className="kiosk h-dvh w-full overflow-hidden bg-cream" lang={lang}>
      <LangContext.Provider value={lang}>
        <SetLangContext.Provider value={setLang}>
          <DeskModeContext.Provider value>{view}</DeskModeContext.Provider>
        </SetLangContext.Provider>
      </LangContext.Provider>
    </div>
  )
}

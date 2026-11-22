// Development-only: shows tablet screens with fixture data, without pairing a tablet.
// Open /dev/tablet?screen=done&lang=ru&bill=due. Screens: welcome, wait, find, confirm, details,
// signature, help, done, cofind, checkout, codone (add &due=1), saver, settings. Not included in production builds.
import { useState } from 'react'
import { LangContext, SetLangContext } from '../i18n'
import { tablet } from '../lib/device'
import type { Invoice, PublicReservation, TabletConfig } from '../lib/types'
import { Checkout, CheckoutDone, CheckoutFind } from '../tablet/Checkout'
import { Screensaver } from '../tablet/Screensaver'
import { TabletSettings } from '../tablet/Setup'
import { DeskModeContext } from '../tablet/Shell'
import { Confirm, DetailsStep, Done, FindBooking, NeedHelp, SignatureStep, WaitForDesk, emptyDetails } from '../tablet/Steps'
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

const arrival: PublicReservation = { ...stay, id: 'arr', booking_ref: 'FX-2001', guest_name: 'Anna Maria Eriksson', room_number: null, arrival_date: '2026-11-22', departure_date: '2026-11-25', nights: 3 }
const noop = () => {}

export default function TabletPreview() {
  const [key, setKey] = useState(0)
  const [details, setDetails] = useState(emptyDetails)
  const [lang, setLang] = useState<Lang>(initialLang)
  const again = () => setKey((k) => k + 1)
  const view = (() => {
    switch (screen) {
      case 'welcome':
        return <Welcome lang={lang} setLang={noop} hotelName={config.hotel_name} onStart={noop} onCheckout={noop} onSettings={noop} />
      case 'wait':
        return <WaitForDesk onBack={noop} onManual={noop} />
      case 'find':
        return <FindBooking deskMode initialSurname="" multiple={false} onBack={noop} onFound={noop} onHelp={noop} />
      case 'confirm':
        return <Confirm reservation={arrival} mrz={null} onYes={noop} onNo={noop} greetName="Anna" onLang={noop} />
      case 'details':
        return <DetailsStep value={details} onChange={setDetails} onBack={noop} onNext={noop} />
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
        return <Checkout key={key} stay={stay} reviewUrl={config.review_url} onBack={again} onComplete={async () => again()} />
      default:
        return <Done key={key} onFinish={again} shuttle breakfast config={config} room="214" fromDesk checkinId="fixture" />
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

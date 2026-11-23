// Development-only: shows tablet screens with fixture data, without pairing a tablet.
// Open /dev/tablet?screen=done&lang=ru. Screens: welcome, details, signature (&policy=0 for none), help, done, folio, saver, gallery (&at=<photo index>), settings. Done takes &type=<room type> for the room photo. Not included in production builds.
import { useState } from 'react'
import { LangContext, SetLangContext } from '../i18n'
import { tablet } from '../lib/device'
import type { TabletConfig } from '../lib/types'
import { Screensaver } from '../tablet/Screensaver'
import { Gallery } from '../tablet/PhotoGallery'
import { TabletSettings } from '../tablet/Setup'
import { DeskModeContext } from '../tablet/Shell'
import { DetailsStep, Done, NeedHelp, SignatureStep, emptyDetails } from '../tablet/Steps'
import { Welcome } from '../tablet/Welcome'
import { FolioPages } from '../tablet/frontdesk'
import type { Lang } from '../translations'

const q = new URLSearchParams(window.location.search)
const screen = q.get('screen') ?? 'done'
const initialLang = (['en', 'ru', 'tg'].includes(q.get('lang') ?? '') ? q.get('lang') : 'en') as Lang
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

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))
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
const noop = () => {}

/** A blank A4-shaped fixture page with a few lines, standing in for an eZee invoice image. */
function FolioFixture() {
  const [zoom, setZoom] = useState(false)
  const [page] = useState(() => {
    const c = document.createElement('canvas')
    c.width = 1240
    c.height = 1754
    const x = c.getContext('2d')!
    x.fillStyle = '#fff'
    x.fillRect(0, 0, c.width, c.height)
    x.fillStyle = '#17221D'
    x.font = '48px serif'
    x.fillText('Fixture invoice', 90, 140)
    x.font = '30px sans-serif'
    for (let i = 0; i < 14; i++) x.fillText(`Fixture line ${i + 1}`, 90, 260 + i * 62)
    return c.toDataURL('image/png').split(',')[1]
  })
  return <FolioPages pages={[page, page]} zoom={zoom} onZoom={() => setZoom(!zoom)} />
}

export default function TabletPreview() {
  const [key, setKey] = useState(0)
  const [details, setDetails] = useState(emptyDetails)
  const [lang, setLang] = useState<Lang>(initialLang)
  const again = () => setKey((k) => k + 1)
  const view = (() => {
    switch (screen) {
      case 'welcome':
        return <Welcome lang={lang} setLang={setLang} hotelName={config.hotel_name} onSettings={noop} onGallery={noop} />
      case 'details':
        return <DetailsStep
            value={details}
            onChange={setDetails}
            reservation={{
              id: 'fx',
              booking_ref: 'RUM-1042',
              guest_name: 'Anna Maria Eriksson',
              source: 'Booking.com',
              room_type: q.get('type') ?? 'Deluxe Double',
              room_number: null,
              arrival_date: '2026-11-23',
              departure_date: '2026-11-26',
              nights: 3,
              adults: 2,
              breakfast: q.get('breakfast') !== '0',
            }}
            breakfastHours={config.breakfast_hours}
            greetName="Eriksson"
            onNotMe={noop}
            onNext={noop}
          />
      case 'signature':
        return <SignatureStep onBack={noop} onSubmit={async () => again()} signerName="Anna Maria Eriksson" />
      case 'help':
        return <NeedHelp onStart={noop} step={1} />
      case 'folio':
        return <FolioFixture />
      case 'settings':
        return <TabletSettings device={{ id: 'x', name: 'Lobby tablet 1', secret: '', camera: 'user' }} hotel={config.hotel_name} online onClose={noop} />
      case 'saver':
        return <Screensaver onWake={noop} />
      case 'gallery':
        return (
          <>
            <Welcome lang={lang} setLang={setLang} hotelName={config.hotel_name} onSettings={noop} onGallery={noop} />
            <Gallery key={key} start={Number(q.get('at') ?? 0)} onClose={again} />
          </>
        )
      default:
        return <Done key={key} onFinish={again} breakfast config={config} room={null} roomType={q.get('type') ?? 'Deluxe Double'} checkinId="fixture" />
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

// Integration with the owner's Front Desk app server (menu.therumihotel.com:8844), written by the
// Front Desk app's own developer (Codex) and ported here from the build it deployed on 2026-11-22.
//
//  - Visitors Wi-Fi: the tablet is paired once with an 8-digit code from reception, then gets a
//    time-limited Wi-Fi login link (login.therumihotel.com) shown as a QR code. The Done screen
//    reuses the same voucher for checked-in guests.
//  - Folio station: the tablet is paired as a "station"; when reception pushes a guest's invoice,
//    it is shown full screen as page images.
import { useEffect, useId, useRef, useState } from 'react'
import { readVisitorVoucher, visitorQr, type VisitorPath, type VisitorVoucher } from '../lib/visitorVoucher'
import { FolioReader } from './FolioReader'
import { useLang } from '../i18n'
import { ArrowRight, Brand, ExpandIcon, QrCode, WifiIcon } from '../ui'

export const LOBBY_WIFI_ENDPOINT = 'https://menu.therumihotel.com:8844/wifi/lobby-tablet'
const LOBBY_WIFI_TOKEN = 'rumi-lobby-wifi-token'
const FOLIO_BASE = 'https://menu.therumihotel.com:8844/wifi/folio/'
const FOLIO_TOKEN = 'rumi-folio-station-v1'

const WIFI_TEXT = {
  // 6-8: the one-time pairing form (reception types the code; shown in the guest's language too).
  en: ['Visitors Wi-Fi', 'Choose how your phone is connected, then scan.', 'Code valid until', 'Loading…', 'Wi-Fi code temporarily unavailable', 'Close', 'Pairing code from reception', 'Pair tablet', 'Check the code and the connection to the Rumi network.', 'Full screen'],
  ru: ['Wi-Fi для посетителей', 'Выберите подключение телефона и отсканируйте QR-код.', 'Код действует до', 'Загрузка…', 'Код Wi-Fi временно недоступен', 'Закрыть', 'Код привязки с ресепшена', 'Привязать планшет', 'Проверьте код и связь с сетью Rumi.', 'На весь экран'],
  tg: ['Wi-Fi барои меҳмонон', 'Навъи пайвасти телефонро интихоб кунед ва QR-рамзро скан кунед.', 'Рамз амал мекунад то', 'Бор шуда истодааст…', 'Рамзи Wi-Fi муваққатан дастнорас аст', 'Пӯшидан', 'Рамзи пайвасткунӣ аз мизи қабул', 'Планшетро пайваст кунед', 'Рамз ва пайвастшавӣ ба шабакаи Rumi-ро санҷед.', 'Экрани пурра'],
} as const

export const dushanbeTime = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Dushanbe', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })

const NETWORK_LABELS = {
  en: { mobile: 'Mobile data', hotel: 'Hotel Wi-Fi' },
  ru: { mobile: 'Мобильный интернет', hotel: 'Wi-Fi отеля' },
  tg: { mobile: 'Интернати мобилӣ', hotel: 'Wi-Fi-и меҳмонхона' },
}

export function VisitorPathPicker({ path, onChange }: { path: VisitorPath; onChange: (path: VisitorPath) => void }) {
  const lang = useLang()
  return <div className="my-2 flex flex-wrap gap-1 rounded-xl bg-stone-100 p-1" role="group" aria-label={WIFI_TEXT[lang][0]}>
    {(['mobile', 'hotel'] as const).map(item => <button key={item} type="button" aria-pressed={item === path}
      onClick={() => onChange(item)} className={`min-h-11 flex-1 cursor-pointer rounded-lg px-2 text-sm font-semibold ${item === path ? 'bg-forest text-white' : 'text-forest'}`}>
      {NETWORK_LABELS[lang][item]}
    </button>)}
  </div>
}

export function hasLobbyWifiPairing(): boolean {
  try {
    return !!(localStorage.getItem(FOLIO_TOKEN) || localStorage.getItem(LOBBY_WIFI_TOKEN))
  } catch {
    return false
  }
}

/** Fetches the current Wi-Fi login link. Returns 'unpaired' when the tablet has no (valid) pairing. */
export async function fetchWifiVoucher(signal?: AbortSignal): Promise<VisitorVoucher | 'unpaired'> {
  const reader = localStorage.getItem(FOLIO_TOKEN)
  let res: Response | undefined
  if (reader) {
    res = await fetch(FOLIO_BASE + 'visitor-wifi', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + reader },
      body: '{}',
      cache: 'no-store',
      signal,
    })
    if (res.status === 401) res = undefined
  }
  if (!res) {
    const token = localStorage.getItem(LOBBY_WIFI_TOKEN)
    if (!token) return 'unpaired'
    res = await fetch(LOBBY_WIFI_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
      cache: 'no-store',
      signal,
    })
    if (res.status === 401) {
      if (localStorage.getItem(LOBBY_WIFI_TOKEN) === token) localStorage.removeItem(LOBBY_WIFI_TOKEN)
      return 'unpaired'
    }
  }
  if (!res.ok) throw new Error(String(res.status))
  return readVisitorVoucher(await res.json())
}

/** Keeps a fresh voucher while mounted (renewed when it expires, retried every 5 s on errors). */
export function useWifiVoucher(enabled = true) {
  const [voucher, setVoucher] = useState<VisitorVoucher | null>(null)
  const [state, setState] = useState<'loading' | 'ok' | 'error' | 'unpaired'>('loading')
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    if (!enabled) { setVoucher(null); setState('loading'); return }
    const ac = new AbortController()
    let timer: number | undefined
    const load = async () => {
      try {
        const v = await fetchWifiVoucher(ac.signal)
        if (ac.signal.aborted) return
        if (v === 'unpaired') {
          setVoucher(null)
          setState('unpaired')
          return
        }
        setVoucher(v)
        setState('ok')
        timer = window.setTimeout(() => { setVoucher(null); load() }, Math.max(0, v.expiresAt - Date.now()))
      } catch {
        if (ac.signal.aborted) return
        setState('error')
        timer = window.setTimeout(load, 5000)
      }
    }
    load()
    return () => {
      ac.abort()
      window.clearTimeout(timer)
    }
  }, [enabled, attempt])
  return { voucher, state, reload: () => setAttempt((n) => n + 1) }
}

/** "Visitors Wi-Fi" button on the Welcome screen: pairing (once) and the QR code. */
export function VisitorWifi({ endpoint = LOBBY_WIFI_ENDPOINT }: { endpoint?: string }) {
  const lang = useLang()
  const t = WIFI_TEXT[lang]
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const [open, setOpen] = useState(false)
  // The code shown as large as the screen allows. It stays up until closed, or until the screensaver
  // takes over after 5 idle minutes (see WIFI_QR_OPEN_SECONDS in pages/Tablet.tsx).
  const [big, setBig] = useState(false)
  const [path, setPath] = useState<VisitorPath>('mobile')
  const [pin, setPin] = useState('')
  const [pairError, setPairError] = useState(false)
  const busy = useRef(false)
  const { voucher, state, reload } = useWifiVoucher(open)
  const qr = voucher ? visitorQr(voucher, path, lang) : ''

  const pair = async () => {
    if (busy.current || !/^\d{8}$/.test(pin)) return
    busy.current = true
    try {
      const res = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pin }) })
      if (!res.ok) throw new Error()
      const data = (await res.json()) as { token: string }
      if (!/^[0-9a-f]{64}$/.test(data.token)) throw new Error()
      localStorage.setItem(LOBBY_WIFI_TOKEN, data.token)
      setPin('')
      setPairError(false)
      reload()
    } catch {
      setPairError(true)
    } finally {
      busy.current = false
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          dialog.current?.showModal()
          setOpen(true)
        }}
        className="mt-3 flex min-h-16 w-full shrink-0 cursor-pointer items-center gap-3 rounded-2xl border-2 border-line bg-white px-6 text-left text-lg font-semibold text-forest transition active:scale-[0.99]"
      >
        <WifiIcon />
        <span className="flex-1">{t[0]}</span>
        <ArrowRight className="h-5 w-5" />
      </button>
      <dialog
        data-kiosk-wifi
        ref={dialog}
        aria-labelledby={titleId}
        onClose={() => {
          setOpen(false)
          setBig(false)
          setPath('mobile')
          setPin('')
        }}
        className={
          big && voucher
            ? 'fixed inset-0 m-0 h-full max-h-none w-full max-w-none rounded-none border-0 bg-forest-deep p-0 text-cream'
            : 'fixed inset-auto right-4 bottom-4 m-0 max-h-[calc(100dvh-2rem)] w-80 max-w-[92vw] overflow-y-auto rounded-2xl border border-line bg-white p-5 text-ink shadow-xl backdrop:bg-forest/25'
        }
      >
        {big && voucher ? (
          <div className="wf-wrap fade-in">
            <QrCode key={qr} text={qr} label={t[0]} className="wf-qr" />
            <div className="wf-text">
              <div className="wf-brand">
                <Brand tone="light" />
              </div>
              <h2 id={titleId} className="mt-10 font-serif text-5xl font-semibold leading-tight">{t[0]}</h2>
              <p className="mt-4 text-2xl leading-snug text-gold-light">{t[1]}</p>
              <VisitorPathPicker path={path} onChange={setPath} />
              <p className="mt-6 text-lg text-cream/80">
                {t[2]} {dushanbeTime.format(voucher.expiresAt)}
              </p>
              <button
                type="button"
                onClick={() => dialog.current?.close()}
                className="mt-10 min-h-16 w-full cursor-pointer rounded-2xl bg-cream px-8 text-xl font-semibold text-forest transition active:scale-[0.98]"
              >
                {t[5]}
              </button>
            </div>
          </div>
        ) : (
          <>
        <h2 id={titleId} className="font-serif text-2xl font-semibold">{t[0]}</h2>
        <p className="my-2 text-sm">{t[1]}</p>
        {state === 'unpaired' ? (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              pair()
            }}
          >
            <label className="block text-sm font-medium">
              {t[6]}
              <input className="field my-2 tracking-[0.3em]" inputMode="numeric" maxLength={8} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} />
            </label>
            <button type="submit" className="min-h-14 w-full cursor-pointer rounded-xl bg-forest px-5 font-semibold text-cream">{t[7]}</button>
            {pairError && <p role="status" className="mt-2 text-sm text-danger">{t[8]}</p>}
          </form>
        ) : voucher ? (
          <>
            <VisitorPathPicker path={path} onChange={setPath} />
            <QrCode key={qr} text={qr} label={t[0]} className="mx-auto h-52 w-52" />
            <p className="text-center text-sm">
              {t[2]} {dushanbeTime.format(voucher.expiresAt)}
            </p>
            <button
              type="button"
              onClick={() => setBig(true)}
              className="mt-3 flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-forest/30 font-medium text-forest transition active:scale-[0.98]"
            >
              <ExpandIcon className="h-5 w-5" /> {t[9]}
            </button>
          </>
        ) : (
          <p role="status">{state === 'error' ? t[4] : t[3]}</p>
        )}
        <button type="button" onClick={() => dialog.current?.close()} className="mt-4 min-h-12 w-full rounded-xl bg-forest text-cream">
          {t[5]}
        </button>
          </>
        )}
      </dialog>
    </>
  )
}

export const wifiVoucherText = WIFI_TEXT

/* ------------------------------------------------------------ folio station */

async function folio<T>(action: string, token: string, body: unknown, signal?: AbortSignal): Promise<T> {
  const res = await fetch(FOLIO_BASE + action, {
    method: 'POST',
    cache: 'no-store',
    signal,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(String(res.status))
  return res.json() as Promise<T>
}

/** Pairing field in the staff-only tablet settings: links this tablet to a front desk computer. */
export function FolioPairing() {
  const [pin, setPin] = useState('')
  const [station, setStation] = useState(() => localStorage.getItem(FOLIO_TOKEN + '.name') || '')
  const [busy, setBusy] = useState(false)
  return (
    <div className="mt-4">
      <label>
        Гостевой экран · код с компьютера стойки
        <input className="ml-2 w-32 rounded border px-2 py-1" inputMode="numeric" value={pin} maxLength={8} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} />
      </label>{' '}
      <button
        type="button"
        disabled={busy || pin.length !== 8}
        onClick={async () => {
          setBusy(true)
          try {
            const r = await folio<{ token: string; station: string }>('pair', '', { pin })
            localStorage.setItem(FOLIO_TOKEN, r.token)
            localStorage.setItem(FOLIO_TOKEN + '.name', r.station)
            setStation(r.station)
            setPin('')
            window.dispatchEvent(new Event('folio-pair'))
          } catch {
            setStation('Проверьте код и подключение к сети отеля')
          } finally {
            setBusy(false)
          }
        }}
      >
        Привязать
      </button>
      <small className="block">{station}</small>
    </div>
  )
}

/** Full-screen invoice pushed by reception to this station; disappears when the lease ends. */
export function FolioOverlay() {
  const [invoice, setInvoice] = useState<{ version: string; pages: string[] } | null>(null)
  useEffect(() => {
    let stopped = false
    let version = ''
    let poll: number | undefined
    let lease: number | undefined
    let ac: AbortController | undefined
    const clear = () => {
      version = ''
      setInvoice(null)
    }
    async function tick() {
      if (stopped) return
      const token = localStorage.getItem(FOLIO_TOKEN)
      if (token && !document.hidden) {
        const started = performance.now()
        ac = new AbortController()
        const timeout = window.setTimeout(() => ac?.abort(), 3500)
        try {
          const r = await folio<{ version: string; pages: string[]; leaseMs: number }>('read', token, { version }, ac.signal)
          if (stopped) return
          const left = Number(r.leaseMs) - (performance.now() - started)
          if (document.hidden || token !== localStorage.getItem(FOLIO_TOKEN) || !r.version || !(left > 0)) clear()
          else {
            if (r.version !== version) {
              if (!Array.isArray(r.pages) || !r.pages.length) throw new Error()
              version = r.version
              setInvoice({ version, pages: r.pages })
            }
            window.clearTimeout(lease)
            lease = window.setTimeout(clear, Math.min(left, 5000))
          }
        } catch {
          if (!stopped) clear()
        } finally {
          window.clearTimeout(timeout)
        }
      } else if (version) clear()
      if (!stopped) poll = window.setTimeout(tick, version ? 650 : 1000)
    }
    const reset = () => {
      ac?.abort()
      clear()
    }
    window.addEventListener('folio-pair', reset)
    window.addEventListener('offline', reset)
    document.addEventListener('visibilitychange', reset)
    tick()
    return () => {
      stopped = true
      ac?.abort()
      window.clearTimeout(poll)
      window.clearTimeout(lease)
      window.removeEventListener('folio-pair', reset)
      window.removeEventListener('offline', reset)
      document.removeEventListener('visibilitychange', reset)
    }
  }, [])
  if (!invoice) return null
  return <FolioReader key={invoice.version} pages={invoice.pages} />
}

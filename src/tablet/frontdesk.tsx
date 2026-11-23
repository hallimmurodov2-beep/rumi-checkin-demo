// Integration with the owner's Front Desk app server (menu.therumihotel.com:8844), written by the
// Front Desk app's own developer (Codex) and ported here from the build it deployed on 2026-11-22.
//
//  - Visitors Wi-Fi: the tablet is paired once with an 8-digit code from reception, then gets a
//    time-limited Wi-Fi login link (login.therumihotel.com) shown as a QR code. The Done screen
//    reuses the same voucher for checked-in guests.
//  - Folio station: the tablet is paired as a "station"; when reception pushes a guest's invoice,
//    it is shown full screen as page images.
import { useEffect, useRef, useState } from 'react'
import { useLang } from '../i18n'
import { ArrowRight, Brand, ExpandIcon, QrCode, WifiIcon } from '../ui'

export const LOBBY_WIFI_ENDPOINT = 'https://menu.therumihotel.com:8844/wifi/lobby-tablet'
const LOBBY_WIFI_TOKEN = 'rumi-lobby-wifi-token'
const FOLIO_BASE = 'https://menu.therumihotel.com:8844/wifi/folio/'
const FOLIO_TOKEN = 'rumi-folio-station-v1'

const WIFI_TEXT = {
  // 6-8: the one-time pairing form (reception types the code; shown in the guest's language too).
  en: ['Visitors Wi-Fi', 'Connect to The Rumi Hotel, then scan the code.', 'Code valid until', 'Loading…', 'Wi-Fi code temporarily unavailable', 'Close', 'Pairing code from reception', 'Pair tablet', 'Check the code and the connection to the Rumi network.', 'Full screen'],
  ru: ['Wi-Fi для посетителей', 'Подключитесь к сети The Rumi Hotel и отсканируйте код.', 'Код действует до', 'Загрузка…', 'Код Wi-Fi временно недоступен', 'Закрыть', 'Код привязки с ресепшена', 'Привязать планшет', 'Проверьте код и связь с сетью Rumi.', 'На весь экран'],
  tg: ['Wi-Fi барои меҳмонон', 'Ба шабакаи The Rumi Hotel пайваст шавед ва рамзро скан кунед.', 'Рамз амал мекунад то', 'Бор шуда истодааст…', 'Рамзи Wi-Fi муваққатан дастнорас аст', 'Пӯшидан', 'Рамзи пайвасткунӣ аз мизи қабул', 'Планшетро пайваст кунед', 'Рамз ва пайвастшавӣ ба шабакаи Rumi-ро санҷед.', 'Экрани пурра'],
} as const

export const dushanbeTime = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Dushanbe', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })

export interface WifiVoucher {
  url: string
  expiresAt: number
}

export function hasLobbyWifiPairing(): boolean {
  try {
    return !!localStorage.getItem(LOBBY_WIFI_TOKEN)
  } catch {
    return false
  }
}

/** Fetches the current Wi-Fi login link. Returns 'unpaired' when the tablet has no (valid) pairing. */
export async function fetchWifiVoucher(signal?: AbortSignal): Promise<WifiVoucher | 'unpaired'> {
  const token = localStorage.getItem(LOBBY_WIFI_TOKEN)
  if (!token) return 'unpaired'
  const res = await fetch(LOBBY_WIFI_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
    cache: 'no-store',
    signal,
  })
  if (res.status === 401) {
    localStorage.removeItem(LOBBY_WIFI_TOKEN)
    return 'unpaired'
  }
  if (!res.ok) throw new Error(String(res.status))
  const v = (await res.json()) as WifiVoucher
  const url = new URL(v.url)
  const left = v.expiresAt - Date.now()
  // Only ever show a login link on the hotel's own Wi-Fi portal.
  if (url.hostname !== 'login.therumihotel.com' || !['http:', 'https:'].includes(url.protocol) || !Number.isFinite(left) || left <= 0 || left > 14_460_000)
    throw new Error('bad voucher')
  return v
}

/** Keeps a fresh voucher while mounted (renewed when it expires, retried every 5 s on errors). */
export function useWifiVoucher(enabled = true) {
  const [voucher, setVoucher] = useState<WifiVoucher | null>(null)
  const [state, setState] = useState<'loading' | 'ok' | 'error' | 'unpaired'>('loading')
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    if (!enabled) return
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
        timer = window.setTimeout(load, v.expiresAt - Date.now())
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
  const [open, setOpen] = useState(false)
  // The code shown as large as the screen allows. It stays up until closed, or until the screensaver
  // takes over after 5 idle minutes (see WIFI_QR_OPEN_SECONDS in pages/Tablet.tsx).
  const [big, setBig] = useState(false)
  const [pin, setPin] = useState('')
  const [pairError, setPairError] = useState(false)
  const busy = useRef(false)
  const { voucher, state, reload } = useWifiVoucher(open)

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
        ref={dialog}
        onClose={() => {
          setOpen(false)
          setBig(false)
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
            <QrCode key={voucher.url} text={voucher.url} label={t[0]} className="wf-qr" />
            <div className="wf-text">
              <div className="wf-brand">
                <Brand tone="light" />
              </div>
              <h2 className="mt-10 font-serif text-5xl font-semibold leading-tight">{t[0]}</h2>
              <p className="mt-4 text-2xl leading-snug text-gold-light">{t[1]}</p>
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
        <h2 className="font-serif text-2xl font-semibold">{t[0]}</h2>
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
            <QrCode key={voucher.url} text={voucher.url} label={t[0]} className="mx-auto h-52 w-52" />
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
  const [pages, setPages] = useState<string[]>([])
  const [zoom, setZoom] = useState(false)
  useEffect(() => {
    let stopped = false
    let version = ''
    let poll: number | undefined
    let lease: number | undefined
    let ac: AbortController | undefined
    const clear = () => {
      version = ''
      setPages([])
      setZoom(false)
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
              setPages(r.pages)
              setZoom(false)
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
  if (!pages.length) return null
  return <FolioPages pages={pages} zoom={zoom} onZoom={() => setZoom(!zoom)} />
}

/** The invoice as the guest sees it. Sits outside the language setting, so its title is in all three languages. */
export function FolioPages({ pages, zoom, onZoom }: { pages: string[]; zoom: boolean; onZoom: () => void }) {
  return (
    <section aria-label="Invoice" className="fade-in fixed inset-0 z-[200] flex flex-col bg-forest-deep text-cream">
      <header className="flex shrink-0 items-center justify-between gap-6 border-b border-gold-light/20 px-8 py-3.5">
        <Brand tone="light" />
        <p className="text-center">
          <span className="block font-serif text-3xl font-semibold leading-tight">Your invoice</span>
          <span className="block text-sm text-gold-light">
            <span lang="ru">Ваш счёт</span>
            <span className="mx-2 text-cream/50" aria-hidden="true">/</span>
            <span lang="tg">Ҳисобнома</span>
          </span>
        </p>
        <div className="flex items-center gap-4">
          {pages.length > 1 && (
            <span className="font-serif text-2xl font-semibold tabular-nums" aria-label={`${pages.length} pages`}>
              {pages.length} <span className="text-base text-gold-light">pp.</span>
            </span>
          )}
          <button
            type="button"
            onClick={onZoom}
            aria-pressed={zoom}
            aria-label={zoom ? 'Make smaller' : 'Make larger'}
            className="flex h-14 w-14 cursor-pointer items-center justify-center rounded-xl bg-cream text-forest shadow-lg transition active:scale-95"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" className="h-6 w-6" aria-hidden="true">
              <circle cx="10.5" cy="10.5" r="6.5" />
              <path d="M15.5 15.5L21 21M8 10.5h5" />
              {!zoom && <path d="M10.5 8v5" />}
            </svg>
          </button>
        </div>
      </header>
      <div className="min-h-0 flex-1 overflow-auto overscroll-contain px-6 py-6">
        <div className="mx-auto space-y-5" style={{ width: zoom ? 1240 : 'min(860px, 100%)' }}>
          {pages.map((p, i) => (
            <img key={i} alt={'Invoice · ' + (i + 1)} className="block w-full rounded-md bg-white shadow-[0_20px_50px_-20px_rgb(0_0_0/0.8)]" src={'data:image/png;base64,' + p} />
          ))}
        </div>
      </div>
    </section>
  )
}

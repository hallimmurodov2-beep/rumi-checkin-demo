export type VisitorPath = 'mobile' | 'hotel'

export interface VisitorVoucher {
  code: string
  expiresAt: number
}

export function readVisitorVoucher(value: { url: string; expiresAt: number }, now = Date.now()): VisitorVoucher {
  const url = new URL(value.url)
  const code = new URLSearchParams(url.hash.slice(1)).get('voucher') ?? ''
  if (!['https:', 'http:'].includes(url.protocol) || url.host !== 'login.therumihotel.com' ||
      url.username || url.password || url.pathname !== '/login' || !/^V[0-9A-F]{12}$/.test(code) ||
      !Number.isSafeInteger(value.expiresAt) || value.expiresAt <= now || value.expiresAt - now > 14_460_000)
    throw new Error('bad voucher')
  return { code, expiresAt: value.expiresAt }
}

export function visitorQr(voucher: VisitorVoucher, path: VisitorPath, lang: string) {
  const fragment = new URLSearchParams({ voucher: voucher.code })
  if (path === 'hotel') return 'https://menu.therumihotel.com:8844/wifi?connect=1&entry=system#' + fragment
  fragment.set('until', String(voucher.expiresAt))
  fragment.set('lang', lang)
  return 'https://rumi-checkin.vercel.app/visitor-wifi#' + fragment
}

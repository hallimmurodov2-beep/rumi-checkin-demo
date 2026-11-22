// Input checking for the partner API. Kept free of Deno and Supabase imports so that
// `npm test` can run it under Node (tests/partner.test.ts).

export const STATUSES = ['expected', 'pending_desk', 'in_house', 'checked_out', 'cancelled', 'no_show']
// A real calendar date in YYYY-MM-DD (rejects 2026-02-31).
export const isDate = (s: unknown) =>
  typeof s === 'string' &&
  /^\d{4}-\d{2}-\d{2}$/.test(s) &&
  !Number.isNaN(Date.parse(`${s}T00:00:00Z`)) &&
  new Date(`${s}T00:00:00Z`).toISOString().slice(0, 10) === s
export const normRef = (s: string) => s.trim().toUpperCase().replace(/\s+/g, '')
export const str = (v: unknown, max: number) => (v === undefined || v === null ? null : String(v).trim().slice(0, max) || null)

/* ---------------------------------------------------------------- Wi-Fi */

// deno-lint-ignore no-explicit-any
export function cleanWifi(w: any): { wifi?: Record<string, unknown>; error?: string } {
  if (!w || typeof w !== 'object') return { error: 'wifi must be an object' }
  const ssid = str(w.ssid, 64)
  if (!ssid) return { error: 'wifi.ssid is required' }
  const password = str(w.password, 63)
  const security = w.security === undefined ? (password ? 'WPA' : 'nopass') : String(w.security).toUpperCase() === 'NOPASS' ? 'nopass' : String(w.security).toUpperCase()
  if (!['WPA', 'WEP', 'nopass'].includes(security)) return { error: 'wifi.security must be WPA, WEP or nopass' }
  if (security !== 'nopass' && !password) return { error: 'wifi.password is required unless security is nopass' }
  const qr = str(w.qr_payload, 500)
  return {
    wifi: {
      ssid,
      password: security === 'nopass' ? null : password,
      security,
      hidden: !!w.hidden,
      qr_payload: qr,
      note: str(w.note, 140),
    },
  }
}

/* ---------------------------------------------------------------- Invoices */

export const money = (v: unknown) => {
  const n = typeof v === 'string' ? Number(v.replace(',', '.')) : Number(v)
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null
}

// deno-lint-ignore no-explicit-any
export function cleanInvoice(b: any): { invoice?: Record<string, unknown>; error?: string } {
  if (!b || typeof b !== 'object') return { error: 'Send the invoice as a JSON object.' }
  const currency = str(b.currency, 10)?.toUpperCase() // not cut to 3 letters, so "TJSS" is rejected rather than read as "TJS"
  if (!currency || !/^[A-Z]{3}$/.test(currency)) return { error: 'currency must be a 3-letter code such as TJS or USD' }
  if (!Array.isArray(b.lines) || b.lines.length === 0) return { error: 'lines must be a non-empty array' }
  if (b.lines.length > 300) return { error: 'At most 300 lines' }
  const lines = []
  for (const [i, l] of b.lines.entries()) {
    const description = str(l?.description, 120)
    if (!description) return { error: `lines[${i}].description is required` }
    const quantity = l.quantity === undefined ? 1 : money(l.quantity)
    const unit = l.unit_price === undefined ? null : money(l.unit_price)
    const amount = l.amount === undefined ? (unit !== null && quantity !== null ? money(unit * quantity) : null) : money(l.amount)
    if (amount === null) return { error: `lines[${i}].amount (or unit_price) must be a number` }
    if (l.date !== undefined && l.date !== null && !isDate(l.date)) return { error: `lines[${i}].date must be YYYY-MM-DD` }
    lines.push({ date: l.date ?? null, description, quantity, unit_price: unit, amount, category: str(l.category, 30) })
  }
  const taxes = []
  for (const [i, t] of (Array.isArray(b.taxes) ? b.taxes : []).slice(0, 20).entries()) {
    const amount = money(t?.amount)
    if (!str(t?.name, 60) || amount === null) return { error: `taxes[${i}] needs name and amount` }
    taxes.push({ name: str(t.name, 60), amount })
  }
  const payments = []
  for (const [i, p] of (Array.isArray(b.payments) ? b.payments : []).slice(0, 50).entries()) {
    const amount = money(p?.amount)
    if (amount === null) return { error: `payments[${i}].amount must be a number` }
    if (p.date !== undefined && p.date !== null && !isDate(String(p.date).slice(0, 10))) return { error: `payments[${i}].date must be YYYY-MM-DD` }
    payments.push({ date: p.date ? String(p.date).slice(0, 10) : null, method: str(p.method, 60) ?? 'Payment', amount })
  }
  const sum = (xs: { amount: number | null }[]) => Math.round(xs.reduce((a, x) => a + (x.amount ?? 0), 0) * 100) / 100
  const includeTax = !!b.prices_include_tax
  const subtotal = b.subtotal !== undefined ? money(b.subtotal) : sum(lines)
  const tax_total = b.tax_total !== undefined ? money(b.tax_total) : sum(taxes)
  const total = b.total !== undefined ? money(b.total) : Math.round(((subtotal ?? 0) + (includeTax ? 0 : tax_total ?? 0)) * 100) / 100
  const paid = b.paid !== undefined ? money(b.paid) : sum(payments)
  const balance = b.balance !== undefined ? money(b.balance) : Math.round(((total ?? 0) - (paid ?? 0)) * 100) / 100
  if ([subtotal, tax_total, total, paid, balance].some((x) => x === null)) return { error: 'subtotal, tax_total, total, paid and balance must be numbers' }
  if (b.issued_at !== undefined && Number.isNaN(Date.parse(b.issued_at))) return { error: 'issued_at must be an ISO date-time' }
  return {
    invoice: {
      invoice_number: str(b.invoice_number, 40),
      currency,
      issued_at: b.issued_at ?? new Date().toISOString(),
      guest_name: str(b.guest_name, 120),
      lines,
      taxes,
      payments,
      prices_include_tax: includeTax,
      subtotal,
      tax_total,
      total,
      paid,
      balance,
      note: str(b.note, 300),
    },
  }
}


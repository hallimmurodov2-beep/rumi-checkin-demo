// Machine-readable zone (MRZ) parser for passports (TD3), ID cards (TD1) and
// TD2 documents, following ICAO Doc 9303. Check digits are validated, and
// common OCR confusions (O/0, I/1, S/5, B/8, Z/2 ...) are corrected using the
// check digits as a guide.

import type { MrzData } from './types'

const WEIGHTS = [7, 3, 1]

function charValue(c: string): number {
  if (c === '<') return 0
  if (c >= '0' && c <= '9') return c.charCodeAt(0) - 48
  if (c >= 'A' && c <= 'Z') return c.charCodeAt(0) - 55
  return -100
}

export function checkDigit(s: string): number {
  let sum = 0
  for (let i = 0; i < s.length; i++) sum += charValue(s[i]) * WEIGHTS[i % 3]
  return ((sum % 10) + 10) % 10
}

const TO_DIGIT: Record<string, string> = { O: '0', Q: '0', D: '0', U: '0', I: '1', L: '1', T: '7', Z: '2', S: '5', B: '8', G: '6' }
const TO_ALPHA: Record<string, string> = { '0': 'O', '1': 'I', '2': 'Z', '5': 'S', '8': 'B', '6': 'G', '7': 'Z' }
// Characters OCR commonly confuses, tried one at a time until a check digit matches.
const ALTERNATES: Record<string, string[]> = {
  '0': ['O', 'D', 'Q'], O: ['0', 'D'], D: ['0', 'O'], Q: ['0', 'O'],
  '1': ['I', 'L'], I: ['1', 'L'], L: ['1', 'I', '<'],
  '2': ['Z'], Z: ['2', '7'], '7': ['Z', 'T', '1'], T: ['7'],
  '5': ['S'], S: ['5'], '8': ['B'], B: ['8'], '6': ['G'], G: ['6'],
  K: ['<'], C: ['<'], '<': ['K', 'L', 'C'],
}

const digits = (s: string) => s.replace(/./g, (c) => TO_DIGIT[c] ?? c)
const alpha = (s: string) => s.replace(/./g, (c) => TO_ALPHA[c] ?? c)

/** Field + its check digit; tries single-character OCR fixes until the check digit matches. */
function checked(field: string, check: string, numeric: boolean): { value: string; ok: boolean; guessed: boolean } {
  const f = numeric ? digits(field) : field
  const c = digits(check)
  if (!/^\d$/.test(c)) return { value: f, ok: false, guessed: false }
  if (checkDigit(f) === Number(c)) return { value: f, ok: true, guessed: false }
  if (!numeric) {
    for (let i = 0; i < f.length; i++) {
      for (const alt of ALTERNATES[f[i]] ?? []) {
        const candidate = f.slice(0, i) + alt + f.slice(i + 1)
        // A guessed fix is only trusted when the composite check digit agrees (see below).
        if (checkDigit(candidate) === Number(c)) return { value: candidate, ok: true, guessed: true }
      }
    }
  }
  return { value: f, ok: false, guessed: false }
}

function toDate(yymmdd: string, kind: 'birth' | 'expiry'): string {
  if (!/^\d{6}$/.test(yymmdd)) return ''
  const yy = Number(yymmdd.slice(0, 2))
  const now = new Date().getFullYear() % 100
  let century: number
  if (kind === 'birth') century = yy > now ? 1900 : 2000
  else century = yy >= 70 ? 1900 : 2000
  const y = century + yy
  const m = yymmdd.slice(2, 4)
  const d = yymmdd.slice(4, 6)
  const dt = new Date(`${y}-${m}-${d}T00:00:00Z`)
  if (Number.isNaN(dt.getTime()) || dt.getUTCMonth() + 1 !== Number(m)) return ''
  return `${y}-${m}-${d}`
}

function names(field: string): { surname: string; givenNames: string } {
  // Trailing filler '<' is often read as K, L or C. Cut a trailing run of those
  // from its first real '<' (or the whole run when it is long and has none).
  let cleaned = alpha(field)
  const run = cleaned.match(/[<KLC]{3,}$/)
  if (run) {
    const firstLt = run[0].indexOf('<')
    if (firstLt >= 0) cleaned = cleaned.slice(0, run.index! + firstLt)
    else if (run[0].length >= 5) cleaned = cleaned.slice(0, run.index)
  }
  cleaned = cleaned.replace(/<+$/, '')
  const [sur, ...rest] = cleaned.split('<<')
  const clean = (s: string) => s.replace(/</g, ' ').replace(/\s+/g, ' ').trim()
  return { surname: clean(sur ?? ''), givenNames: clean(rest.join(' ')) }
}

function sexOf(c: string): 'M' | 'F' | 'X' {
  return c === 'M' || c === 'F' ? c : 'X'
}

const country = (s: string) => alpha(s).replace(/</g, '')

function fit(line: string, len: number): string {
  if (line.length >= len) return line.slice(0, len)
  return line + '<'.repeat(len - line.length)
}

function fixDocType(l1: string): string {
  // "P<" (ordinary passport) is sometimes read as "PK", "PL" or "PC".
  return /^P[KLC]/.test(l1) ? `P<${l1.slice(2)}` : l1
}

function parseTD3(a: string, b: string): MrzData {
  const l1 = fixDocType(fit(a, 44))
  const l2 = fit(b, 44)
  const doc = checked(l2.slice(0, 9), l2[9], false)
  const dob = checked(l2.slice(13, 19), l2[19], true)
  const exp = checked(l2.slice(21, 27), l2[27], true)
  const personal = l2.slice(28, 42)
  const composite = doc.value + l2[9] + dob.value + l2[19] + exp.value + l2[27] + personal + digits(l2[42])
  const compOk = /^\d$/.test(digits(l2[43])) && checkDigit(composite) === Number(digits(l2[43]))
  const n = names(l1.slice(5))
  return {
    docType: alpha(l1.slice(0, 2)).replace(/</g, ''),
    issuingCountry: country(l1.slice(2, 5)),
    surname: n.surname,
    givenNames: n.givenNames,
    documentNumber: doc.value.replace(/</g, ''),
    nationality: country(l2.slice(10, 13)),
    birthDate: toDate(dob.value, 'birth'),
    sex: sexOf(l2[20]),
    expiryDate: toDate(exp.value, 'expiry'),
    // The composite digit also covers the optional personal number, which is not
    // stored; the stored fields are each protected by their own check digit.
    valid: doc.ok && dob.ok && exp.ok && (!doc.guessed || compOk),
    compositeOk: compOk,
  }
}

function parseTD2(a: string, b: string): MrzData {
  const l1 = fit(a, 36)
  const l2 = fit(b, 36)
  const doc = checked(l2.slice(0, 9), l2[9], false)
  const dob = checked(l2.slice(13, 19), l2[19], true)
  const exp = checked(l2.slice(21, 27), l2[27], true)
  const composite = doc.value + l2[9] + dob.value + l2[19] + exp.value + l2[27] + l2.slice(28, 35)
  const compOk = /^\d$/.test(digits(l2[35])) && checkDigit(composite) === Number(digits(l2[35]))
  const n = names(l1.slice(5))
  return {
    docType: alpha(l1.slice(0, 2)).replace(/</g, ''),
    issuingCountry: country(l1.slice(2, 5)),
    surname: n.surname,
    givenNames: n.givenNames,
    documentNumber: doc.value.replace(/</g, ''),
    nationality: country(l2.slice(10, 13)),
    birthDate: toDate(dob.value, 'birth'),
    sex: sexOf(l2[20]),
    expiryDate: toDate(exp.value, 'expiry'),
    valid: doc.ok && dob.ok && exp.ok && (!doc.guessed || compOk),
    compositeOk: compOk,
  }
}

function parseTD1(a: string, b: string, c: string): MrzData {
  const l1 = fit(a, 30)
  const l2 = fit(b, 30)
  const l3 = fit(c, 30)
  const doc = checked(l1.slice(5, 14), l1[14], false)
  const dob = checked(l2.slice(0, 6), l2[6], true)
  const exp = checked(l2.slice(8, 14), l2[14], true)
  const composite = l1.slice(5, 14).replace(/./g, (ch, i) => doc.value[i] ?? ch) + l1.slice(14, 30) + dob.value + l2[6] + exp.value + l2[14] + l2.slice(18, 29)
  const compOk = /^\d$/.test(digits(l2[29])) && checkDigit(composite) === Number(digits(l2[29]))
  const n = names(l3)
  return {
    docType: alpha(l1.slice(0, 2)).replace(/</g, ''),
    issuingCountry: country(l1.slice(2, 5)),
    surname: n.surname,
    givenNames: n.givenNames,
    documentNumber: doc.value.replace(/</g, ''),
    nationality: country(l2.slice(15, 18)),
    birthDate: toDate(dob.value, 'birth'),
    sex: sexOf(l2[7]),
    expiryDate: toDate(exp.value, 'expiry'),
    valid: doc.ok && dob.ok && exp.ok && (!doc.guessed || compOk),
    compositeOk: compOk,
  }
}

/** Normalise OCR output into candidate MRZ lines. */
export function mrzLines(text: string): string[] {
  return text
    .toUpperCase()
    .split(/\r?\n/)
    .map((l) => l.replace(/[«‹]/g, '<').replace(/\s+/g, '').replace(/[^A-Z0-9<]/g, ''))
    .filter((l) => l.length >= 26 && (l.includes('<') || l.length >= 40))
}

/** Parse OCR text; returns the best MRZ found (valid ones first), or null. */
export function parseMrz(text: string): MrzData | null {
  const lines = mrzLines(text)
  const results: MrzData[] = []
  for (let i = 0; i < lines.length; i++) {
    const a = lines[i]
    const b = lines[i + 1]
    const c = lines[i + 2]
    if (b && a.length >= 40 && b.length >= 40) results.push(parseTD3(a, b))
    else if (b && a.length >= 33 && b.length >= 33) results.push(parseTD2(a, b))
    if (b && c && a.length >= 28 && a.length <= 32 && b.length >= 28 && c.length >= 26) results.push(parseTD1(a, b, c))
  }
  const usable = results.filter((r) => r.surname && r.documentNumber && r.birthDate && r.expiryDate)
  return usable.find((r) => r.valid && r.compositeOk) ?? usable.find((r) => r.valid) ?? null
}

/**
 * OCR sometimes merges a stray character into a name (ANNA<MARIA read as
 * ANNA<KMARIA, MICHAEL cut to MICHAE). Once the booking is known, snap each
 * MRZ name token to the booking's spelling when they are within one edit.
 */
export function reconcileNames(m: MrzData, bookingName: string): MrzData {
  const book = bookingName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .split(/[^A-Z]+/)
    .filter(Boolean)
  const fix = (s: string) =>
    s
      .split(' ')
      .filter(Boolean)
      .map((tok) => book.find((b) => b === tok) ?? book.find((b) => withinOneEdit(b, tok)) ?? tok)
      .join(' ')
  return { ...m, surname: fix(m.surname), givenNames: fix(m.givenNames) }
}

const DROPPABLE = new Set(['K', 'L', 'C', 'I'])

/** True when a and b differ by one OCR-typical edit (a stray/missing K, L, C or I, or a confusable letter). */
function withinOneEdit(a: string, b: string): boolean {
  if (a === b || Math.abs(a.length - b.length) > 1 || Math.min(a.length, b.length) < 3) return false
  if (a.length === b.length) {
    const diffs = [...a].map((ch, i) => [ch, b[i]] as const).filter(([x, y]) => x !== y)
    return diffs.length === 1 && (ALTERNATES[diffs[0][1]] ?? []).includes(diffs[0][0])
  }
  const [long, short] = a.length > b.length ? [a, b] : [b, a]
  for (let i = 0; i < long.length; i++) {
    if (long.slice(0, i) + long.slice(i + 1) === short) return DROPPABLE.has(long[i])
  }
  return false
}

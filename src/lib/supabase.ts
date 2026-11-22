import { createClient } from '@supabase/supabase-js'

// The publishable key is meant to ship in the browser. Data is protected by
// row-level security; tablets only reach the database through RPC functions
// that check the tablet's pairing secret.
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? 'https://qlvlmgrslqexmqmzpuko.supabase.co'
export const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? 'sb_publishable_O3pm6Hq6yphZWEf5UtqV4Q_CfwcE__i'

/**
 * Every request gives up after 25 s. On a half-open lobby Wi-Fi connection a request can otherwise hang
 * for minutes, and the tablet's handoff polling waits for the previous call before starting the next.
 */
const timedFetch: typeof fetch = (input, init) => {
  const limit = typeof AbortSignal.timeout === 'function' ? AbortSignal.timeout(25_000) : null
  if (!limit) return fetch(input, init)
  const signal = init?.signal ? (typeof AbortSignal.any === 'function' ? AbortSignal.any([init.signal, limit]) : init.signal) : limit
  return fetch(input, { ...init, signal })
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  global: { fetch: timedFetch },
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  realtime: { params: { eventsPerSecond: 5 } },
})

/** Turns a Supabase/PostgREST error into a short code such as "device_not_paired". */
export function errorCode(e: unknown): string {
  const msg = ((e as { message?: string })?.message ?? String(e)).trim()
  if (/^[a-z_]{3,}$/.test(msg)) return msg
  if (/fetch|network|load failed|abort|timed? ?out/i.test(msg)) return 'network'
  if (/invalid login credentials/i.test(msg)) return 'invalid_login'
  if (/email not confirmed/i.test(msg)) return 'email_not_confirmed'
  return 'unknown_error'
}

export class ApiError extends Error {
  code: string
  constructor(code: string, message?: string) {
    super(message ?? code)
    this.code = code
  }
}

export async function rpc<T>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args)
  if (error) throw new ApiError(errorCode(error), error.message)
  return data as T
}

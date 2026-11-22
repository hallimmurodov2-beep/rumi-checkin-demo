import { useCallback, useEffect, useRef, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { Checkin, CheckinGuest, Checkout, Device, Feedback, HotelSettings, IntegrationSettings, PartnerSettings, Profile, Reservation, SyncLogEntry } from '../lib/types'

/** Today's date at the hotel (Dushanbe), as YYYY-MM-DD. */
export function hotelToday(offsetDays = 0): string {
  const d = new Date(Date.now() + offsetDays * 86_400_000)
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dushanbe' }).format(d)
}

export function nightsBetween(a: string, b: string) {
  return Math.round((new Date(`${b}T12:00:00Z`).getTime() - new Date(`${a}T12:00:00Z`).getTime()) / 86_400_000)
}

export function fmtDate(iso: string, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }) {
  return new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString('en-GB', opts)
}

export function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

export function timeAgo(iso: string, now = Date.now()) {
  const m = Math.floor((now - new Date(iso).getTime()) / 60_000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m} min ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} h ago`
  return fmtDate(iso)
}

export function useSession() {
  const [session, setSession] = useState<Session | null>(null)
  const [ready, setReady] = useState(false)
  const [recovery, setRecovery] = useState(false)
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setReady(true)
    })
    const { data } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s)
      if (event === 'PASSWORD_RECOVERY') setRecovery(true)
    })
    return () => data.subscription.unsubscribe()
  }, [])
  return { session, ready, recovery, clearRecovery: () => setRecovery(false) }
}

export function useProfile(userId: string | undefined) {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const load = useCallback(async () => {
    if (!userId) return
    const { data } = await supabase.from('profiles').select('*').eq('user_id', userId).maybeSingle()
    setProfile(data as Profile | null)
    setLoading(false)
  }, [userId])
  useEffect(() => {
    setLoading(true)
    load()
  }, [load])
  return { profile, loading, reload: load }
}

const CHECKIN_LIST_COLUMNS =
  'id,reservation_id,device_id,created_at,language,doc_source,doc_type,issuing_country,nationality,surname,given_names,document_number,birth_date,sex,expiry_date,mrz_valid,phone,email,shuttle,consent_at,status,approved_at,approved_by,data_purged_at,ezee_synced_at,ezee_error,desk_code'

export interface StaffData {
  reservations: Reservation[]
  checkins: Checkin[]
  checkouts: Checkout[]
  feedback: Feedback[]
  devices: Device[]
  settings: HotelSettings | null
  profiles: Profile[]
  guests: CheckinGuest[]
  integration: IntegrationSettings | null
  partner: PartnerSettings | null
  syncLog: SyncLogEntry[]
  loading: boolean
  error: string | null
  live: boolean
  reload: (table?: Table) => void
}

type Table = 'reservations' | 'checkins' | 'checkouts' | 'feedback' | 'devices' | 'settings' | 'profiles' | 'guests' | 'integration'

/** Everything the front desk sees, kept current with Supabase Realtime. */
export function useStaffData(isAdmin: boolean): StaffData {
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [checkins, setCheckins] = useState<Checkin[]>([])
  const [checkouts, setCheckouts] = useState<Checkout[]>([])
  const [feedback, setFeedback] = useState<Feedback[]>([])
  const [devices, setDevices] = useState<Device[]>([])
  const [settings, setSettings] = useState<HotelSettings | null>(null)
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [guests, setGuests] = useState<CheckinGuest[]>([])
  const [integration, setIntegration] = useState<IntegrationSettings | null>(null)
  const [partner, setPartner] = useState<PartnerSettings | null>(null)
  const [syncLog, setSyncLog] = useState<SyncLogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [live, setLive] = useState(false)

  const loaders = useRef<Record<Table, () => Promise<void>>>(null!)
  loaders.current = {
    reservations: async () => {
      const since = hotelToday(-30)
      const { data, error } = await supabase
        .from('reservations')
        .select('*')
        .or(`arrival_date.gte.${since},status.in.(pending_desk,in_house)`)
        .order('arrival_date', { ascending: true })
        .order('guest_name', { ascending: true })
        .limit(2000)
      if (error) throw error
      setReservations(data as Reservation[])
    },
    checkins: async () => {
      const since = new Date(Date.now() - 30 * 86_400_000).toISOString()
      const { data, error } = await supabase
        .from('checkins')
        .select(CHECKIN_LIST_COLUMNS)
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(1000)
      if (error) throw error
      setCheckins(data as unknown as Checkin[])
    },
    checkouts: async () => {
      const since = new Date(Date.now() - 30 * 86_400_000).toISOString()
      const { data, error } = await supabase.from('checkouts').select('*').gte('created_at', since).order('created_at', { ascending: false })
      if (error) throw error
      setCheckouts(data as Checkout[])
    },
    feedback: async () => {
      const since = new Date(Date.now() - 120 * 86_400_000).toISOString()
      const { data, error } = await supabase.from('feedback').select('*').gte('created_at', since).order('created_at', { ascending: false })
      if (error) throw error
      setFeedback(data as Feedback[])
    },
    devices: async () => {
      const { data, error } = await supabase.from('devices').select('*').order('created_at')
      if (error) throw error
      setDevices(data as Device[])
    },
    settings: async () => {
      const { data, error } = await supabase.from('hotel_settings').select('*').eq('id', 1).maybeSingle()
      if (error) throw error
      setSettings(data as HotelSettings)
    },
    guests: async () => {
      const since = new Date(Date.now() - 30 * 86_400_000).toISOString()
      const { data, error } = await supabase.from('checkin_guests').select('*').gte('created_at', since).order('created_at')
      if (error) throw error
      setGuests(data as CheckinGuest[])
    },
    integration: async () => {
      const [a, b, c] = await Promise.all([
        supabase.from('integration_settings').select('*').eq('id', 1).maybeSingle(),
        supabase.from('sync_log').select('*').order('created_at', { ascending: false }).limit(40),
        supabase.from('partner_settings').select('*').eq('id', 1).maybeSingle(),
      ])
      if (a.error) throw a.error
      setIntegration(a.data as IntegrationSettings)
      setPartner(c.data as PartnerSettings | null)
      setSyncLog((b.data ?? []) as SyncLogEntry[])
    },
    profiles: async () => {
      if (!isAdmin) return
      const { data, error } = await supabase.from('profiles').select('*').order('created_at')
      if (error) throw error
      setProfiles(data as Profile[])
    },
  }

  const timers = useRef<Partial<Record<Table, number>>>({})
  const reload = useCallback((table?: Table) => {
    const tables = table ? [table] : (Object.keys(loaders.current) as Table[])
    for (const t of tables) {
      window.clearTimeout(timers.current[t])
      timers.current[t] = window.setTimeout(() => {
        loaders.current[t]().catch((e) => setError(e?.message ?? 'Could not load data'))
      }, table ? 150 : 0)
    }
  }, [])

  useEffect(() => {
    let alive = true
    Promise.all(Object.values(loaders.current).map((f) => f()))
      .then(() => alive && setError(null))
      .catch((e) => alive && setError(e?.message ?? 'Could not load data'))
      .finally(() => alive && setLoading(false))

    const channel = supabase.channel('front-desk')
    for (const t of ['reservations', 'checkins', 'checkouts', 'feedback', 'devices'] as const) {
      channel.on('postgres_changes', { event: '*', schema: 'public', table: t }, () => reload(t))
    }
    channel.on('postgres_changes', { event: '*', schema: 'public', table: 'checkin_guests' }, () => reload('guests'))
    channel.on('postgres_changes', { event: '*', schema: 'public', table: 'integration_settings' }, () => reload('integration'))
    channel.on('postgres_changes', { event: '*', schema: 'public', table: 'partner_settings' }, () => reload('integration'))
    // Changes made while the live connection was down are never replayed: reload everything when it comes back.
    let connectedBefore = false
    channel.subscribe((status) => {
      if (!alive) return
      setLive(status === 'SUBSCRIBED')
      if (status === 'SUBSCRIBED') {
        if (connectedBefore) reload()
        connectedBefore = true
      }
    })

    // Tablet heartbeats update last_seen_at; refresh device status regularly.
    const id = window.setInterval(() => reload('devices'), 30_000)
    const onFocus = () => reload()
    window.addEventListener('focus', onFocus)
    return () => {
      alive = false
      window.clearInterval(id)
      window.removeEventListener('focus', onFocus)
      supabase.removeChannel(channel)
    }
  }, [reload])

  return { reservations, checkins, checkouts, feedback, devices, settings, profiles, guests, integration, partner, syncLog, loading, error, live, reload }
}

export function deviceOnline(d: Device, now = Date.now()) {
  return !!d.last_seen_at && !d.revoked && now - new Date(d.last_seen_at).getTime() < 3 * 60_000
}

import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Profile } from '../lib/types'
import { Brand, COLORS, Emblem, Spinner } from '../ui'
import { deviceOnline, useProfile, useSession, useStaffData, type StaffData } from './data'
import { Btn, ToastProvider, useToast } from './kit'
import { Login } from './Login'
import { ArrivalsView } from './views/Arrivals'
import { CheckinDrawer, QueueView } from './views/Queue'
import { SettingsView } from './views/Settings'
import { CheckoutsView, FeedbackView, InHouseView } from './views/Stays'
import { TodayView } from './views/Today'

export type View = 'today' | 'arrivals' | 'queue' | 'inhouse' | 'checkouts' | 'feedback' | 'settings'

function Loading() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-cream">
      <Emblem color={COLORS.gold} className="breathe h-16 w-16" />
    </div>
  )
}

export default function StaffApp() {
  const { session, ready, recovery, clearRecovery } = useSession()
  const { profile, loading } = useProfile(session?.user.id)

  useEffect(() => {
    document.title = 'Front desk - The Rumi'
  }, [])

  if (!ready) return <Loading />
  if (!session || recovery) return <Login recovery={recovery} onRecovered={clearRecovery} />
  if (loading) return <Loading />
  if (!profile || profile.role === 'pending') return <Pending email={session.user.email ?? ''} />
  return (
    <ToastProvider>
      <Desk profile={profile} />
    </ToastProvider>
  )
}

function Pending({ email }: { email: string }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-cream px-6 text-center">
      <Emblem color={COLORS.gold} className="rise h-16 w-16" />
      <h1 className="rise mt-6 text-4xl text-forest">Waiting for approval</h1>
      <p className="rise mt-3 max-w-md text-muted">
        Your account ({email}) has been created. An administrator needs to give you access under Settings → Team.
      </p>
      <Btn className="mt-8" onClick={() => supabase.auth.signOut()}>Sign out</Btn>
    </div>
  )
}

function NavIcon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  )
}

const ICONS: Record<View, string> = {
  today: 'M3 12l9-8 9 8M5 10v10h14V10',
  arrivals: 'M4 7h16M4 12h16M4 17h10',
  queue: 'M9 4h6l1 2h3v14H5V6h3zM9 12l2 2 4-4',
  inhouse: 'M4 20V8l8-4 8 4v12M9 20v-6h6v6',
  checkouts: 'M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10',
  feedback: 'M4 5h16v11H8l-4 4z',
  settings: 'M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z',
}

function Desk({ profile }: { profile: Profile }) {
  const data = useStaffData(profile.role === 'admin')
  return <DeskUI profile={profile} data={data} />
}

export function DeskUI({ profile, data }: { profile: Profile; data: StaffData }) {
  const isAdmin = profile.role === 'admin'
  const toast = useToast()
  const [view, setView] = useState<View>('today')
  const [openId, setOpenId] = useState<string | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const [menu, setMenu] = useState(false)

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 20_000)
    return () => window.clearInterval(id)
  }, [])

  const waiting = data.checkins.filter((c) => c.status === 'waiting')
  const openFeedback = data.feedback.filter((f) => !f.resolved).length
  const inHouse = data.reservations.filter((r) => r.status === 'in_house').length
  const online = data.devices.filter((d) => deviceOnline(d, now)).length

  // Announce new tablet check-ins.
  const seen = useRef<Set<string> | null>(null)
  useEffect(() => {
    if (data.loading) return
    const ids = new Set(waiting.map((c) => c.id))
    if (seen.current) {
      const fresh = waiting.filter((c) => !seen.current!.has(c.id))
      if (fresh.length) {
        const r = data.reservations.find((x) => x.id === fresh[0].reservation_id)
        toast(`New tablet check-in: ${r?.guest_name ?? 'guest'}`)
      }
    }
    seen.current = ids
  }, [waiting, data.loading, data.reservations, toast])

  useEffect(() => {
    document.title = waiting.length ? `(${waiting.length}) Front desk - The Rumi` : 'Front desk - The Rumi'
  }, [waiting.length])

  const nav: { id: View; label: string; count?: number; highlight?: boolean }[] = [
    { id: 'today', label: 'Today' },
    { id: 'queue', label: 'Tablet check-ins', count: waiting.length, highlight: waiting.length > 0 },
    { id: 'arrivals', label: 'Arrivals' },
    { id: 'inhouse', label: 'In house', count: inHouse },
    { id: 'checkouts', label: 'Check-outs' },
    { id: 'feedback', label: 'Feedback', count: openFeedback, highlight: openFeedback > 0 },
    { id: 'settings', label: 'Settings' },
  ]

  const go = (v: View) => {
    setView(v)
    window.scrollTo({ top: 0 })
  }
  const openCheckin = (id: string) => setOpenId(id)
  const openCheckinObj = view !== 'queue' ? data.checkins.find((c) => c.id === openId) : undefined

  return (
    <div className="flex min-h-dvh flex-col bg-cream md:flex-row">
      <aside className="relative bg-forest-deep text-cream md:sticky md:top-0 md:flex md:h-dvh md:w-64 md:shrink-0 md:flex-col">
        <Emblem color={COLORS.goldLight} className="pointer-events-none absolute -bottom-16 -left-16 hidden h-64 w-64 opacity-[0.05] md:block" />
        <div className="flex items-center justify-between px-4 py-4 md:block md:px-5 md:py-6">
          <Brand tone="light" size="sm" />
          <p className="mt-2 hidden text-xs tracking-[0.18em] text-gold-light md:block">FRONT DESK</p>
        </div>
        <nav aria-label="Sections" className="relative flex gap-1 overflow-x-auto px-3 pb-3 [mask-image:linear-gradient(to_right,black_85%,transparent)] md:mt-2 md:flex-col md:overflow-visible md:px-3 md:[mask-image:none]">
          {nav.map((n) => (
            <button
              key={n.id}
              type="button"
              aria-current={view === n.id ? 'page' : undefined}
              onClick={() => go(n.id)}
              className={`group flex min-h-11 shrink-0 cursor-pointer items-center gap-3 rounded-lg px-3 text-left text-sm font-medium transition-colors ${
                view === n.id ? 'bg-cream text-forest' : 'text-cream/85 hover:bg-white/10 hover:text-cream'
              }`}
            >
              <NavIcon d={ICONS[n.id]} />
              <span className="flex-1 whitespace-nowrap">{n.label}</span>
              {n.count !== undefined && n.count > 0 && (
                <span
                  className={`rounded-full px-2 py-0.5 text-xs tabular-nums ${
                    view === n.id ? 'bg-forest text-cream' : n.highlight ? 'bg-gold-light text-ink' : 'bg-white/15 text-gold-light'
                  }`}
                >
                  {n.count}
                </span>
              )}
            </button>
          ))}
        </nav>
        <div className="relative mt-auto hidden border-t border-white/10 px-5 py-4 text-xs text-cream/70 md:block">
          <p className="flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${data.live ? 'bg-gold-light' : 'bg-white/30'}`} aria-hidden="true" />
            {data.live ? 'Live updates on' : 'Connecting...'}
          </p>
          <p className="mt-1">Tablets online: {online} of {data.devices.length}</p>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <div className="sticky top-0 z-30 flex items-center gap-3 border-b border-line bg-cream/90 px-4 py-3 backdrop-blur md:px-8">
          <span className="hidden items-center gap-2 rounded-full border border-line bg-white px-3 py-1 text-xs font-semibold text-muted sm:inline-flex">
            {data.integration?.ezee_enabled ? `eZee sync: ${data.integration.last_error ? 'needs attention' : 'on'}` : 'Bookings: manual / CSV'}
          </span>
          <span className="inline-flex items-center gap-2 rounded-full border border-line bg-white px-3 py-1 text-xs font-semibold text-muted md:hidden">
            <span className={`h-2 w-2 rounded-full ${data.live ? 'bg-forest' : 'bg-line'}`} aria-hidden="true" /> {online}/{data.devices.length} tablets
          </span>
          <div className="relative ml-auto">
            <button
              type="button"
              onClick={() => setMenu((m) => !m)}
              aria-expanded={menu}
              className="flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-line bg-white py-1 pl-1 pr-3 text-sm font-medium hover:border-forest/40"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-forest text-xs font-semibold text-gold-light">
                {(profile.full_name || profile.email).slice(0, 1).toUpperCase()}
              </span>
              <span className="hidden max-w-40 truncate sm:inline">{profile.full_name || profile.email}</span>
            </button>
            {menu && (
              <div className="pop-in absolute right-0 top-12 w-56 overflow-hidden rounded-xl border border-line bg-paper shadow-xl">
                <p className="border-b border-line px-4 py-3 text-xs text-muted">
                  {profile.email}
                  <br />
                  <span className="capitalize">{profile.role}</span>
                </p>
                <button type="button" onClick={() => supabase.auth.signOut()} className="block min-h-11 w-full cursor-pointer px-4 text-left text-sm hover:bg-cream">
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>

        {data.error && (
          <div className="mx-4 mt-4 rounded-xl border border-danger/30 bg-[#FDF1EC] px-4 py-3 text-sm text-danger md:mx-8">
            Could not load everything: {data.error}. <button className="font-semibold underline" onClick={() => data.reload()}>Retry</button>
          </div>
        )}

        <main key={view} className="fade-in mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-8">
          {data.loading ? (
            <div className="flex justify-center py-24 text-muted">
              <Spinner className="h-6 w-6" />
            </div>
          ) : view === 'today' ? (
            <TodayView data={data} now={now} go={go} openCheckin={openCheckin} />
          ) : view === 'arrivals' ? (
            <ArrivalsView data={data} />
          ) : view === 'queue' ? (
            <QueueView data={data} now={now} openId={openId} setOpenId={setOpenId} />
          ) : view === 'inhouse' ? (
            <InHouseView data={data} openCheckin={openCheckin} />
          ) : view === 'checkouts' ? (
            <CheckoutsView data={data} />
          ) : view === 'feedback' ? (
            <FeedbackView data={data} now={now} />
          ) : (
            <SettingsView data={data} isAdmin={isAdmin} profile={profile} now={now} />
          )}
        </main>
      </div>

      {openCheckinObj && (
        <CheckinDrawer
          key={openCheckinObj.id}
          c={openCheckinObj}
          r={data.reservations.find((r) => r.id === openCheckinObj.reservation_id)}
          guests={data.guests.filter((g) => g.checkin_id === openCheckinObj.id)}
          onClose={() => setOpenId(null)}
          reload={data.reload}
        />
      )}
    </div>
  )
}

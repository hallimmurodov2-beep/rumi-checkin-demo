import { useSyncExternalStore } from 'react'

// Demo state shared between browser tabs through localStorage + the "storage" event.
// Everything here is fake sample data.

export type QueueStatus = 'waiting' | 'checked_in'

export interface QueueItem {
  id: string
  guest: string
  source: string
  room: string
  status: QueueStatus
  time: string // ISO
}

export interface CheckoutItem {
  id: string
  guest: string
  room: string
  rating: number
  time: string
}

export interface FeedbackItem {
  id: string
  guest: string
  rating: number
  text: string
  time: string
}

export interface DemoState {
  queue: QueueItem[]
  checkouts: CheckoutItem[]
  feedback: FeedbackItem[]
}

const KEY = 'rumi-demo-state-v1'

function minutesAgo(m: number) {
  return new Date(Date.now() - m * 60_000).toISOString()
}

function seed(): DemoState {
  return {
    queue: [
      { id: 'seed-1', guest: 'Demo Guest A', source: 'Booking.com', room: 'Deluxe Double, 214', status: 'waiting', time: minutesAgo(12) },
      { id: 'seed-2', guest: 'Demo Guest B', source: 'Expedia', room: 'Twin Room, 118', status: 'waiting', time: minutesAgo(7) },
      { id: 'seed-3', guest: 'Demo Guest C', source: 'Direct', room: 'Residence Suite, 502', status: 'checked_in', time: minutesAgo(31) },
    ],
    checkouts: [
      { id: 'seed-c1', guest: 'Demo Guest D', room: 'Deluxe Double, 307', rating: 5, time: minutesAgo(48) },
      { id: 'seed-c2', guest: 'Demo Guest E', room: 'Twin Room, 121', rating: 2, time: minutesAgo(25) },
    ],
    feedback: [
      { id: 'seed-f1', guest: 'Demo Guest E', rating: 2, text: 'Sample comment: the room was warm at night.', time: minutesAgo(25) },
    ],
  }
}

// --- storage plumbing -------------------------------------------------------

let memoryRaw: string | null = null // fallback when localStorage is unavailable
const listeners = new Set<() => void>()

function getRaw(): string | null {
  try {
    return localStorage.getItem(KEY)
  } catch {
    return memoryRaw
  }
}

let cachedRaw: string | null = null
let cachedState: DemoState = seed()

function read(): DemoState {
  const raw = getRaw()
  if (raw !== cachedRaw) {
    cachedRaw = raw
    if (raw) {
      try {
        cachedState = JSON.parse(raw) as DemoState
      } catch {
        cachedState = seed()
      }
    } else {
      cachedState = seed()
    }
  }
  return cachedState
}

function write(next: DemoState) {
  const raw = JSON.stringify(next)
  memoryRaw = raw
  try {
    localStorage.setItem(KEY, raw)
  } catch {
    /* ignore: memory fallback is used */
  }
  listeners.forEach((l) => l())
}

function subscribe(cb: () => void) {
  listeners.add(cb)
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY || e.key === null) cb()
  }
  window.addEventListener('storage', onStorage)
  return () => {
    listeners.delete(cb)
    window.removeEventListener('storage', onStorage)
  }
}

export function useDemoState(): DemoState {
  return useSyncExternalStore(subscribe, read, read)
}

// --- actions ----------------------------------------------------------------

const uid = () => Math.random().toString(36).slice(2, 9)

export const actions = {
  addCheckin(guest: string, source: string, room: string) {
    const s = read()
    write({
      ...s,
      queue: [{ id: uid(), guest, source, room, status: 'waiting', time: new Date().toISOString() }, ...s.queue],
    })
  },
  approve(id: string) {
    const s = read()
    write({ ...s, queue: s.queue.map((q) => (q.id === id ? { ...q, status: 'checked_in' as const } : q)) })
  },
  addCheckout(guest: string, room: string, rating: number, feedbackText: string | null) {
    const s = read()
    const time = new Date().toISOString()
    write({
      ...s,
      checkouts: [{ id: uid(), guest, room, rating, time }, ...s.checkouts],
      feedback:
        feedbackText !== null
          ? [{ id: uid(), guest, rating, text: feedbackText, time }, ...s.feedback]
          : s.feedback,
    })
  },
  reset() {
    write(seed())
  },
}

export function statusLabel(s: QueueStatus) {
  return s === 'waiting' ? 'Waiting for passport check' : 'Checked in - key given'
}

export function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

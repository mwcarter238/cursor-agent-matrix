import type { CursorAgent } from '../types'

export type KanbanLane = 'queue' | 'running' | 'review' | 'done'

export type RosterFilter = 'all' | 'live' | 'error' | 'idle'

/** Map Cursor Cloud Agent statuses into Kanban lanes (inspired board). */
export function agentKanbanLane(a: CursorAgent): KanbanLane {
  const s = (a.status ?? '').toUpperCase()
  if (s === 'FAILED' || s === 'ERROR') return 'running'
  if (s === 'RUNNING') return 'running'
  if (s === 'FINISHED') return a.target?.prUrl ? 'review' : 'done'
  if (s === 'STOPPED' || s === 'CANCELLED' || s === 'CANCELED') return 'done'
  return 'queue'
}

export function isFailedAgent(a: CursorAgent): boolean {
  const s = (a.status ?? '').toUpperCase()
  return s === 'FAILED' || s === 'ERROR'
}

export function rosterVisualStatus(a: CursorAgent): 'online' | 'overload' | 'error' | 'idle' {
  const s = (a.status ?? '').toUpperCase()
  if (s === 'FAILED' || s === 'ERROR') return 'error'
  if (s === 'RUNNING') {
    const load = agentLoadPercent(a)
    return load >= 88 ? 'overload' : 'online'
  }
  if (s === 'FINISHED' || s === 'STOPPED' || s === 'CANCELLED' || s === 'CANCELED') return 'idle'
  return 'online'
}

function hashId(id: string): number {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0
  return Math.abs(h)
}

/** Deterministic pseudo “load” for gauges / roster bars (Cursor API has no CPU metric). */
export function agentLoadPercent(a: CursorAgent): number {
  const s = (a.status ?? '').toUpperCase()
  if (s === 'FAILED' || s === 'ERROR') return 5
  if (s === 'FINISHED') return 100
  if (s === 'STOPPED' || s === 'CANCELLED' || s === 'CANCELED') return 0
  if (s === 'RUNNING') return 62 + (hashId(a.id) % 28)
  if (s === 'CREATING' || s === 'CREATED' || s === 'PENDING' || s === 'QUEUED') return 22 + (hashId(a.id) % 35)
  return 18 + (hashId(a.id) % 40)
}

export function passesRosterFilter(a: CursorAgent, f: RosterFilter): boolean {
  const v = rosterVisualStatus(a)
  if (f === 'all') return true
  if (f === 'live') return v === 'online' || v === 'overload'
  if (f === 'error') return v === 'error'
  if (f === 'idle') return v === 'idle'
  return true
}

export function formatClock(d: Date): string {
  return [d.getHours(), d.getMinutes(), d.getSeconds()].map((x) => String(x).padStart(2, '0')).join(':')
}

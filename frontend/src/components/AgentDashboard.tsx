import { ReactFlowProvider } from '@xyflow/react'
import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from 'react'
import { ApiError, apiDelete, apiGet, apiPost } from '../api'
import type { AgentsListResponse, ConversationResponse, CursorAgent } from '../types'
import {
  agentKanbanLane,
  agentLoadPercent,
  formatClock,
  isFailedAgent,
  passesRosterFilter,
  rosterVisualStatus,
  type RosterFilter,
} from '../utils/agentUi'
import { MatrixRain } from './MatrixRain'
import { TimelineGraph } from './TimelineGraph'

const RM_KEY = 'cam_reduce_motion'
const APP_VERSION = '0.2.0'

type LogCls = 'ok' | 'warn' | 'err' | 'info' | 'sys' | ''

type LogLine = { id: string; t: string; m: string; c: LogCls }

type ViewMode = 'board' | 'timeline' | 'analytics'

function formatDetail(err: unknown): string {
  if (err instanceof ApiError) return err.message
  if (err instanceof Error) return err.message
  return String(err)
}

function shortRepo(url: string | undefined): string {
  if (!url) return '—'
  const m = url.match(/github\.com\/([^/]+\/[^/]+)/i)
  return m?.[1] ?? url.replace(/^https?:\/\//, '').slice(0, 22)
}

export function AgentDashboard() {
  const [agents, setAgents] = useState<CursorAgent[]>([])
  const [nextCursor, setNextCursor] = useState<string | undefined>()
  const [selected, setSelected] = useState<CursorAgent | null>(null)
  const [conversation, setConversation] = useState<ConversationResponse | null>(null)

  const [loading, setLoading] = useState(false)
  const [syncError, setSyncError] = useState<string | null>(null)
  const [lastSync, setLastSync] = useState<Date | null>(null)
  const [clock, setClock] = useState(() => new Date())

  const [tabHidden, setTabHidden] = useState(document.visibilityState === 'hidden')
  const [paused, setPaused] = useState(false)

  const [reduceMotion, setReduceMotion] = useState(() => {
    if (typeof window === 'undefined') return false
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return true
    return window.localStorage.getItem(RM_KEY) === '1'
  })

  const [rosterFilter, setRosterFilter] = useState<RosterFilter>('all')
  const [taskSearch, setTaskSearch] = useState('')
  const [viewMode, setViewMode] = useState<ViewMode>('board')

  const [logLines, setLogLines] = useState<LogLine[]>([])
  const logId = useRef(0)

  const [spark, setSpark] = useState<number[]>(() => Array.from({ length: 8 }, () => 2))

  const appendLog = useCallback((message: string, c: LogCls = '') => {
    const t = formatClock(new Date())
    const id = `log-${logId.current++}`
    setLogLines((prev) => {
      const next = [...prev, { id, t, m: message, c }]
      return next.length > 48 ? next.slice(-48) : next
    })
  }, [])

  const refresh = useCallback(async () => {
    if (paused) return
    setLoading(true)
    setSyncError(null)
    try {
      const res = await apiGet<AgentsListResponse>('/agents?limit=80')
      const list = res.agents ?? []
      setAgents(list)
      setNextCursor(res.nextCursor)
      setLastSync(new Date())

      const running = list.filter((a) => (a.status ?? '').toUpperCase() === 'RUNNING').length
      setSpark((prev) => [...prev.slice(-7), running])

      appendLog(`sync ok — ${list.length} agent(s)`, 'ok')
    } catch (e) {
      const msg = formatDetail(e)
      setSyncError(msg)
      appendLog(`sync error — ${msg}`, 'err')
    } finally {
      setLoading(false)
    }
  }, [appendLog, paused])

  useEffect(() => {
    const t = window.setTimeout(() => void refresh(), 0)
    return () => window.clearTimeout(t)
  }, [refresh])

  useEffect(() => {
    const id = window.setInterval(() => {
      if (!document.hidden && !paused) void refresh()
    }, 8000)
    return () => window.clearInterval(id)
  }, [refresh, paused])

  useEffect(() => {
    const onVis = () => setTabHidden(document.visibilityState === 'hidden')
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [])

  useEffect(() => {
    const id = window.setInterval(() => setClock(new Date()), 1000)
    return () => window.clearInterval(id)
  }, [])

  const rosterAgents = useMemo(() => {
    return agents.filter((a) => passesRosterFilter(a, rosterFilter))
  }, [agents, rosterFilter])

  const lanes = useMemo(() => {
    const q: CursorAgent[] = []
    const r: CursorAgent[] = []
    const v: CursorAgent[] = []
    const d: CursorAgent[] = []
    const qy = taskSearch.trim().toLowerCase()
    const match = (a: CursorAgent) => {
      if (!qy) return true
      const blob = `${a.id} ${a.name ?? ''} ${a.status ?? ''} ${a.source?.repository ?? ''}`.toLowerCase()
      return blob.includes(qy)
    }
    for (const a of agents) {
      if (!match(a)) continue
      const lane = agentKanbanLane(a)
      if (lane === 'queue') q.push(a)
      else if (lane === 'running') r.push(a)
      else if (lane === 'review') v.push(a)
      else d.push(a)
    }
    return { q, r, v, d }
  }, [agents, taskSearch])

  const kpis = useMemo(() => {
    const total = agents.length
    const running = agents.filter((a) => (a.status ?? '').toUpperCase() === 'RUNNING').length
    const creating = agents.filter((a) => {
      const s = (a.status ?? '').toUpperCase()
      return s === 'CREATING' || s === 'CREATED' || s === 'PENDING' || s === 'QUEUED'
    }).length
    const finished = agents.filter((a) => (a.status ?? '').toUpperCase() === 'FINISHED').length
    const failed = agents.filter((a) => isFailedAgent(a)).length
    const activeApprox = running + creating
    const denom = Math.max(1, total)
    const failPct = (failed / denom) * 100
    const cap = Math.max(1, agents.filter((a) => (a.status ?? '').toUpperCase() !== 'FINISHED').length)
    const activeRatio = Math.min(100, Math.round((activeApprox / cap) * 100))
    return { total, running, creating, finished, failed, activeApprox, failPct, activeRatio }
  }, [agents])

  const overloadAgents = useMemo(() => {
    return agents.filter((a) => {
      const s = (a.status ?? '').toUpperCase()
      return s === 'RUNNING' && agentLoadPercent(a) >= 88
    })
  }, [agents])

  const topGauges = useMemo(() => {
    return [...agents]
      .sort((a, b) => agentLoadPercent(b) - agentLoadPercent(a))
      .slice(0, 5)
  }, [agents])

  const alertCount = useMemo(() => {
    return agents.filter((a) => isFailedAgent(a)).length + overloadAgents.length
  }, [agents, overloadAgents.length])

  const toggleRM = () => {
    const v = !reduceMotion
    setReduceMotion(v)
    window.localStorage.setItem(RM_KEY, v ? '1' : '0')
    appendLog(`reduce_motion=${v ? 'on' : 'off'}`, 'sys')
  }

  const loadConversation = async () => {
    if (!selected) return
    try {
      const c = await apiGet<ConversationResponse>(`/agents/${selected.id}/conversation`)
      setConversation(c)
      appendLog(`transcript loaded — ${selected.id}`, 'info')
    } catch (e) {
      const msg = formatDetail(e)
      setSyncError(msg)
      appendLog(`transcript error — ${msg}`, 'err')
    }
  }

  const [launchOpen, setLaunchOpen] = useState(false)
  const [followOpen, setFollowOpen] = useState(false)
  const [launchText, setLaunchText] = useState('Summarize open pull requests and suggest next steps.')
  const [launchRepo, setLaunchRepo] = useState('')
  const [launchRef, setLaunchRef] = useState('main')
  const [launchModel, setLaunchModel] = useState('default')
  const [followText, setFollowText] = useState('')

  const submitLaunch = async () => {
    try {
      await apiPost('/agents', {
        prompt: { text: launchText },
        model: launchModel || 'default',
        source: { repository: launchRepo, ref: launchRef || undefined },
        target: { autoCreatePr: true },
      })
      setLaunchOpen(false)
      appendLog('launch command accepted', 'ok')
      void refresh()
    } catch (e) {
      setSyncError(formatDetail(e))
    }
  }

  const submitFollow = async () => {
    if (!selected) return
    try {
      await apiPost(`/agents/${selected.id}/followup`, { prompt: { text: followText } })
      setFollowOpen(false)
      setFollowText('')
      appendLog(`follow-up sent — ${selected.id}`, 'ok')
      void refresh()
    } catch (e) {
      setSyncError(formatDetail(e))
    }
  }

  const stopSelected = async () => {
    if (!selected) return
    if (!window.confirm(`Stop agent ${selected.name ?? selected.id}?`)) return
    try {
      await apiPost(`/agents/${selected.id}/stop`, {})
      appendLog(`stop sent — ${selected.id}`, 'warn')
      void refresh()
    } catch (e) {
      setSyncError(formatDetail(e))
    }
  }

  const deleteSelected = async () => {
    if (!selected) return
    if (!window.confirm(`DELETE agent ${selected.name ?? selected.id}? This cannot be undone.`)) return
    const id = selected.id
    try {
      await apiDelete(`/agents/${id}`)
      setSelected(null)
      setConversation(null)
      appendLog(`delete sent — ${id}`, 'warn')
      void refresh()
    } catch (e) {
      setSyncError(formatDetail(e))
    }
  }

  const onSelectFromTimeline = useCallback((a: CursorAgent) => {
    setSelected(a)
    setConversation(null)
  }, [])

  const ringClass = (a: CursorAgent) => {
    const v = rosterVisualStatus(a)
    if (v === 'error') return 'nx-sring nx-sr'
    if (v === 'overload') return 'nx-sring nx-sa'
    if (v === 'idle') return 'nx-sring nx-si'
    return 'nx-sring nx-sg'
  }

  const laneCardTone = (a: CursorAgent) => {
    const lane = agentKanbanLane(a)
    if (isFailedAgent(a)) return 'nx-tc nx-te'
    if (lane === 'queue') return 'nx-tc nx-tq'
    if (lane === 'running') return 'nx-tc nx-tr'
    if (lane === 'review') return 'nx-tc nx-tv'
    return 'nx-tc nx-td'
  }

  const sparkHeights = useMemo(() => {
    const mx = Math.max(1, ...spark)
    return spark.map((v) => Math.round((v / mx) * 100))
  }, [spark])

  const onAlertsClick = (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault()
    const parts: string[] = []
    for (const a of agents) {
      if (isFailedAgent(a)) parts.push(`${a.name ?? a.id}: ${a.status}`)
    }
    for (const a of overloadAgents) {
      parts.push(`${a.name ?? a.id}: high load (${agentLoadPercent(a)}%)`)
    }
    window.alert(parts.length ? parts.join('\n') : 'No active alerts.')
  }

  const drawerOpen = selected !== null

  return (
    <>
      <MatrixRain reducedMotion={reduceMotion} paused={paused || tabHidden} />

      <div className={`nx-app${reduceMotion ? ' reduced-motion' : ''}`}>
        <header className="nx-chrome">
          <div className="nx-logo">
            <div className="nx-logo-icon" aria-hidden>
              <svg viewBox="0 0 20 20">
                <polygon points="10,1 18,6 18,14 10,19 2,14 2,6" fill="none" stroke="#00ff41" strokeWidth="1.2" />
                <polygon points="10,5 14,7.5 14,12.5 10,15 6,12.5 6,7.5" fill="rgba(0,255,65,.15)" stroke="#00ff41" strokeWidth="0.5" />
                <circle cx="10" cy="10" r="2" fill="#00ff41" />
              </svg>
            </div>
            NEXUS<span style={{ color: 'var(--muted)' }}>::</span>CTRL<span style={{ color: 'var(--muted)' }}>::</span>OPS
          </div>

          <div className="nx-chrome-center">
            <span className="nx-dot-live" />
            <span id="clock" className="nx-sys-stat">
              {formatClock(clock)}
            </span>
            <span>CURSOR</span>
            <span style={{ color: 'var(--g)' }}>CLOUD</span>
            <span>v{APP_VERSION}</span>
          </div>

          <div className="nx-chrome-right">
            <button type="button" className={`nx-cbtn${alertCount ? ' alert' : ''}`} onClick={onAlertsClick}>
              {alertCount ? `⚠ ${alertCount} ALERTS` : '⚠ ALERTS'}
            </button>
            <button
              type="button"
              className="nx-cbtn"
              onClick={() => {
                setPaused((p) => !p)
                appendLog(paused ? 'resume' : 'pause', 'sys')
              }}
            >
              {paused ? '▶ RESUME' : '⏸ PAUSE'}
            </button>
            <button type="button" className="nx-cbtn" onClick={() => void refresh()}>
              SYNC
            </button>
            <button type="button" className="nx-cbtn" onClick={toggleRM}>
              MOTION
            </button>
            <button type="button" className="nx-cbtn primary" onClick={() => setLaunchOpen(true)}>
              + AGENT
            </button>
          </div>
        </header>

        <div className="nx-kpi-strip">
          <div className="nx-kpi">
            <div className="nx-kpi-label">ACTIVE AGENTS</div>
            <div className="nx-kpi-val nx-c-green">
              {kpis.running}
              <span style={{ fontSize: 11, color: 'var(--muted)' }}>/{Math.max(1, kpis.total)}</span>
            </div>
            <div className="nx-kpi-sub">
              {kpis.creating} queued · {kpis.failed} error
            </div>
            <div className="nx-kpi-bar">
              <div className="nx-kpi-fill" style={{ width: `${kpis.activeRatio}%`, background: 'var(--g)' }} />
            </div>
          </div>

          <div className="nx-kpi">
            <div className="nx-kpi-label">IN FLIGHT</div>
            <div className="nx-kpi-val nx-c-blue">{kpis.activeApprox}</div>
            <div className="nx-kpi-sub">{overloadAgents.length} high load</div>
            <div className="nx-kpi-bar">
              <div
                className="nx-kpi-fill"
                style={{
                  width: `${Math.min(100, kpis.activeApprox * 14)}%`,
                  background: 'var(--blue)',
                }}
              />
            </div>
          </div>

          <div className="nx-kpi">
            <div className="nx-kpi-label">COMPLETED (SNAPSHOT)</div>
            <div className="nx-kpi-val nx-c-green">{kpis.finished}</div>
            <div className="nx-kpi-sub">FINISHED in current fetch</div>
            <div className="nx-kpi-bar">
              <div
                className="nx-kpi-fill"
                style={{
                  width: `${Math.min(100, (kpis.finished / Math.max(1, kpis.total)) * 100)}%`,
                  background: 'var(--teal)',
                }}
              />
            </div>
          </div>

          <div className="nx-kpi">
            <div className="nx-kpi-label">LAST SYNC</div>
            <div className="nx-kpi-val nx-c-teal" style={{ fontSize: 16 }}>
              {loading ? '…' : lastSync ? formatClock(lastSync) : '—'}
            </div>
            <div className="nx-kpi-sub">{loading ? 'fetching' : 'poll /api/v1/agents'}</div>
            <div className="nx-kpi-bar">
              <div className="nx-kpi-fill" style={{ width: loading ? '38%' : '100%', background: 'var(--teal)' }} />
            </div>
          </div>

          <div className="nx-kpi">
            <div className="nx-kpi-label">FAILURE RATE</div>
            <div className="nx-kpi-val nx-c-amber">
              {kpis.failPct.toFixed(1)}
              <span style={{ fontSize: 11 }}>%</span>
            </div>
            <div className="nx-kpi-sub">FAILED / total</div>
            <div className="nx-kpi-bar">
              <div className="nx-kpi-fill" style={{ width: `${Math.min(100, kpis.failPct * 8)}%`, background: 'var(--amber)' }} />
            </div>
          </div>
        </div>

        {syncError && (
          <div className="nx-banner">
            <span>{syncError}</span>
            <button type="button" className="nx-cbtn" onClick={() => setSyncError(null)}>
              DISMISS
            </button>
          </div>
        )}

        <div className="nx-body">
          <aside className="nx-left">
            <div className="nx-panel-hd">
              AGENT ROSTER
              <button type="button" className="nx-panel-hd-btn" onClick={() => appendLog('config (stub)', 'info')}>
                CONFIG
              </button>
            </div>
            <div className="nx-agent-list">
              {rosterAgents.map((a) => {
                const load = agentLoadPercent(a)
                const sel = selected?.id === a.id
                return (
                  <button
                    key={a.id}
                    type="button"
                    className={`nx-agent${sel ? ' sel' : ''}`}
                    onClick={() => {
                      setSelected(a)
                      setConversation(null)
                    }}
                  >
                    <div className="nx-agent-top">
                      <span className={ringClass(a)} />
                      <div className="nx-agent-name">{a.name ?? a.id}</div>
                      <div className="nx-agent-pct" style={{ color: isFailedAgent(a) ? 'var(--red)' : undefined }}>
                        {isFailedAgent(a) ? 'ERR' : `${load}%`}
                      </div>
                    </div>
                    <div className="nx-load-track">
                      <div
                        className="nx-load-fill"
                        style={{
                          width: `${load}%`,
                          background: isFailedAgent(a) ? 'var(--red)' : load >= 88 ? 'var(--amber)' : 'var(--g)',
                        }}
                      />
                    </div>
                    <div className="nx-agent-role">{(a.status ?? 'UNKNOWN').toUpperCase()}</div>
                  </button>
                )
              })}
              {!rosterAgents.length && <div className="nx-agent-role" style={{ padding: 12 }}>NO AGENTS</div>}
            </div>
            <div className="nx-filter-row">
              {(['all', 'live', 'error', 'idle'] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  className={`nx-fpill${rosterFilter === f ? ' on' : ''}`}
                  onClick={() => setRosterFilter(f)}
                >
                  {f.toUpperCase()}
                </button>
              ))}
            </div>
          </aside>

          <section className="nx-center">
            <div className="nx-k-topbar">
              <div className="nx-k-title">{viewMode === 'board' ? 'WORKLOAD PIPELINE' : viewMode === 'timeline' ? 'TOPOLOGY' : 'ANALYTICS'}</div>
              <div className="nx-k-controls">
                <input
                  className="nx-k-search"
                  value={taskSearch}
                  onChange={(e) => setTaskSearch(e.target.value)}
                  placeholder="search agents…"
                />
                <button type="button" className={`nx-kctrl${viewMode === 'board' ? ' on' : ''}`} onClick={() => setViewMode('board')}>
                  BOARD
                </button>
                <button type="button" className={`nx-kctrl${viewMode === 'timeline' ? ' on' : ''}`} onClick={() => setViewMode('timeline')}>
                  TIMELINE
                </button>
                <button type="button" className={`nx-kctrl${viewMode === 'analytics' ? ' on' : ''}`} onClick={() => setViewMode('analytics')}>
                  ANALYTICS
                </button>
              </div>
            </div>

            {viewMode === 'board' && (
              <div className="nx-cols">
                <div className="nx-col-wrap">
                  <div className="nx-col-hd nx-hq">
                    QUEUE<div className="nx-col-ct">{lanes.q.length}</div>
                  </div>
                  <div className="nx-col-body">
                    {lanes.q.map((a) => (
                      <button
                        key={a.id}
                        type="button"
                        className={laneCardTone(a)}
                        onClick={() => {
                          setSelected(a)
                          setConversation(null)
                        }}
                      >
                        <div className="nx-tc-top">
                          <div className="nx-tc-id">{a.id.slice(0, 10)}…</div>
                          <div className="nx-tag">{(a.status ?? '').toUpperCase()}</div>
                        </div>
                        <div className="nx-tc-name">{a.name ?? 'Untitled agent'}</div>
                        <div className="nx-tc-ft">
                          <div className="nx-tag">{shortRepo(a.source?.repository)}</div>
                          <div className="nx-tc-time">load {agentLoadPercent(a)}%</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="nx-col-wrap">
                  <div className="nx-col-hd nx-hr">
                    RUNNING<div className="nx-col-ct">{lanes.r.length}</div>
                  </div>
                  <div className="nx-col-body">
                    {lanes.r.map((a) => {
                      const load = agentLoadPercent(a)
                      return (
                        <button
                          key={a.id}
                          type="button"
                          className={laneCardTone(a)}
                          onClick={() => {
                            setSelected(a)
                            setConversation(null)
                          }}
                        >
                          <div className="nx-tc-top">
                            <div className="nx-tc-id" style={isFailedAgent(a) ? { color: 'var(--red)' } : undefined}>
                              {a.id.slice(0, 10)}…{isFailedAgent(a) ? ' !' : ''}
                            </div>
                            <div className="nx-tag">{isFailedAgent(a) ? 'FAIL' : 'RUN'}</div>
                          </div>
                          <div className="nx-tc-name" style={isFailedAgent(a) ? { color: '#ffaaaa' } : undefined}>
                            {a.name ?? 'Untitled agent'}
                          </div>
                          <div className="nx-tc-ft">
                            <div className={`nx-tag${isFailedAgent(a) ? ' r' : ' b'}`}>{shortRepo(a.source?.repository)}</div>
                            <div className="nx-tc-time" style={isFailedAgent(a) ? { color: 'var(--red)' } : undefined}>
                              {isFailedAgent(a) ? 'failed' : 'live'}
                            </div>
                          </div>
                          {!isFailedAgent(a) && (
                            <div className="nx-prog-wrap">
                              <div className="nx-prog-track">
                                <div className={`nx-prog-fill nx-pb${reduceMotion ? '' : ' anim'}`} style={{ width: `${load}%` }} />
                              </div>
                              <div className="nx-prog-label">{load}%</div>
                            </div>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div className="nx-col-wrap">
                  <div className="nx-col-hd nx-hv">
                    REVIEW<div className="nx-col-ct">{lanes.v.length}</div>
                  </div>
                  <div className="nx-col-body">
                    {lanes.v.map((a) => (
                      <button
                        key={a.id}
                        type="button"
                        className={laneCardTone(a)}
                        onClick={() => {
                          setSelected(a)
                          setConversation(null)
                        }}
                      >
                        <div className="nx-tc-top">
                          <div className="nx-tc-id">{a.id.slice(0, 10)}…</div>
                          <div className="nx-tag a">PR</div>
                        </div>
                        <div className="nx-tc-name">{a.name ?? 'Untitled agent'}</div>
                        <div className="nx-tc-ft">
                          <div className="nx-tag a">{shortRepo(a.source?.repository)}</div>
                          <div className="nx-tc-time">finished</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="nx-col-wrap">
                  <div className="nx-col-hd nx-hd">
                    DONE<div className="nx-col-ct">{lanes.d.length}</div>
                  </div>
                  <div className="nx-col-body">
                    {lanes.d.map((a) => (
                      <button
                        key={a.id}
                        type="button"
                        className={laneCardTone(a)}
                        onClick={() => {
                          setSelected(a)
                          setConversation(null)
                        }}
                      >
                        <div className="nx-tc-top">
                          <div className="nx-tc-id">{a.id.slice(0, 10)}…</div>
                          <div className="nx-tag" style={{ color: 'var(--g)', borderColor: 'var(--gb)' }}>
                            ✓
                          </div>
                        </div>
                        <div className="nx-tc-name">{a.name ?? 'Untitled agent'}</div>
                        <div className="nx-tc-ft">
                          <div className="nx-tag">{shortRepo(a.source?.repository)}</div>
                          <div className="nx-tc-time">{(a.status ?? '').toUpperCase()}</div>
                        </div>
                        <div className="nx-prog-wrap">
                          <div className="nx-prog-track">
                            <div className="nx-prog-fill nx-pg" style={{ width: '100%' }} />
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {viewMode === 'timeline' && (
              <ReactFlowProvider>
                <TimelineGraph agents={agents} reduceMotion={reduceMotion} onSelectAgent={onSelectFromTimeline} />
              </ReactFlowProvider>
            )}

            {viewMode === 'analytics' && (
              <div className="nx-analytics">
                <div className="nx-analytics-grid">
                  <div className="nx-stat-card">
                    <div className="nx-stat-k">TOTAL</div>
                    <div className="nx-stat-v">{kpis.total}</div>
                  </div>
                  <div className="nx-stat-card">
                    <div className="nx-stat-k">RUNNING</div>
                    <div className="nx-stat-v">{kpis.running}</div>
                  </div>
                  <div className="nx-stat-card">
                    <div className="nx-stat-k">FAILED</div>
                    <div className="nx-stat-v nx-c-red">{kpis.failed}</div>
                  </div>
                  <div className="nx-stat-card">
                    <div className="nx-stat-k">FINISHED</div>
                    <div className="nx-stat-v">{kpis.finished}</div>
                  </div>
                </div>
                <div style={{ marginTop: 12, fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--muted)', lineHeight: 1.6 }}>
                  Metrics are derived from the latest Cloud Agents list response (Cursor does not expose CPU load). “Load %” is a deterministic visual heuristic for roster gauges.
                </div>
              </div>
            )}
          </section>

          <aside className="nx-right">
            <div className="nx-spark-section">
              <div className="nx-sec-hd">
                RUNNING COUNT — LAST 8 POLLS <span className="nx-sec-badge">LIVE</span>
              </div>
              <div className="nx-spark-bars">
                {sparkHeights.map((h, i) => (
                  <div key={i} className={`nx-sbar${i === sparkHeights.length - 1 ? ' now' : ''}`} style={{ height: `${Math.max(8, h)}%` }} title={`${spark[i] ?? 0} running`} />
                ))}
              </div>
              <div className="nx-spark-hours">
                {spark.map((v, i) => (
                  <span key={i}>{v}</span>
                ))}
              </div>
            </div>

            <div className="nx-gauge-section">
              <div className="nx-sec-hd">AGENT LOAD (TOP 5)</div>
              {topGauges.map((a) => {
                const load = agentLoadPercent(a)
                const color = isFailedAgent(a) ? 'var(--red)' : load >= 88 ? 'var(--amber)' : 'var(--g)'
                return (
                  <div key={a.id} className="nx-gauge-row">
                    <div className="nx-gauge-name">{(a.name ?? a.id).slice(0, 10)}</div>
                    <div className="nx-gauge-track">
                      <div className="nx-gauge-fill" style={{ width: `${load}%`, background: color }} />
                    </div>
                    <div className="nx-gauge-num" style={{ color }}>
                      {isFailedAgent(a) ? 'ERR' : `${load}%`}
                    </div>
                  </div>
                )
              })}
              {!topGauges.length && <div className="nx-agent-role" style={{ padding: 6 }}>NO DATA</div>}
            </div>

            <div className="nx-alert-section">
              <div className="nx-sec-hd" style={{ marginBottom: 6 }}>
                ALERTS
              </div>
              {agents
                .filter((a) => isFailedAgent(a))
                .slice(0, 3)
                .map((a) => (
                  <div key={a.id} className="nx-alert-item">
                    <div className="nx-alert-dot" />
                    <div className="nx-alert-text">
                      {a.name ?? a.id} — {a.status}
                    </div>
                    <div className="nx-alert-time">now</div>
                  </div>
                ))}
              {overloadAgents.slice(0, 2).map((a) => (
                <div key={`o-${a.id}`} className="nx-alert-item amber">
                  <div className="nx-alert-dot amber" />
                  <div className="nx-alert-text amber">
                    {a.name ?? a.id} load {agentLoadPercent(a)}%
                  </div>
                  <div className="nx-alert-time">now</div>
                </div>
              ))}
              {!agents.some((a) => isFailedAgent(a)) && !overloadAgents.length && (
                <div className="nx-agent-role" style={{ padding: 6 }}>
                  CLEAR
                </div>
              )}
            </div>

            <div className="nx-log-hd">
              LIVE FEED <span style={{ color: 'var(--g)', fontSize: 7 }}>{logLines.length} entries</span>
            </div>
            <div className="nx-log-feed">
              {logLines.map((e) => (
                <div key={e.id} className="nx-ll">
                  <span className="nx-lt">{e.t}</span>
                  <span className={`nx-lm${e.c ? ` ${e.c}` : ''}`}>{e.m}</span>
                </div>
              ))}
            </div>
            <div className="nx-log-footer">
              <div className="nx-log-prompt">&gt;_</div>
              <div style={{ flex: 1, fontFamily: 'var(--mono)', fontSize: 8, color: 'var(--g)' }}>
                {loading ? 'sync…' : paused ? 'paused' : 'nominal'}
              </div>
              <div className="nx-log-cursor" />
            </div>
          </aside>
        </div>

        <div className={`nx-drawer${drawerOpen ? ' open' : ''}`}>
          <div className="nx-drawer-inner">
            {!selected && <div className="nx-agent-role">SELECT AN AGENT</div>}
            {selected && (
              <>
                <div className="nx-dc">
                  <div className="nx-dl">AGENT ID</div>
                  <div className="nx-dv mono">{selected.name ?? selected.id}</div>
                  <div className="nx-dl" style={{ marginTop: 8 }}>
                    RAW ID
                  </div>
                  <div className="nx-dv mono" style={{ fontSize: 11 }}>
                    {selected.id}
                  </div>
                </div>
                <div className="nx-dc">
                  <div className="nx-dl">STATUS</div>
                  <div className="nx-dv" style={{ color: isFailedAgent(selected) ? 'var(--red)' : 'var(--g)' }}>
                    {(selected.status ?? 'UNKNOWN').toUpperCase()}
                  </div>
                  <div className="nx-dl" style={{ marginTop: 8 }}>
                    REPO
                  </div>
                  <div className="nx-dv mono" style={{ fontSize: 11 }}>
                    {shortRepo(selected.source?.repository)}
                  </div>
                </div>
                <div className="nx-dc">
                  <div className="nx-dl">BRANCH</div>
                  <div className="nx-dv mono" style={{ fontSize: 11 }}>
                    {selected.target?.branchName ?? '—'}
                  </div>
                  <div className="nx-d-actions">
                    {selected.target?.prUrl && (
                      <a className="nx-d-action" href={selected.target.prUrl} target="_blank" rel="noreferrer">
                        OPEN PR ↗
                      </a>
                    )}
                    {selected.target?.url && (
                      <a className="nx-d-action" href={selected.target.url} target="_blank" rel="noreferrer">
                        CURSOR ↗
                      </a>
                    )}
                  </div>
                </div>
                <div className="nx-dc" style={{ minWidth: 220 }}>
                  <div className="nx-dl">ACTIONS</div>
                  <div className="nx-d-actions">
                    <button type="button" className="nx-d-action" onClick={() => void loadConversation()}>
                      TRANSCRIPT
                    </button>
                    <button type="button" className="nx-d-action" onClick={() => setFollowOpen(true)}>
                      FOLLOW-UP
                    </button>
                    <button type="button" className="nx-d-action warn" onClick={() => void stopSelected()}>
                      STOP
                    </button>
                    <button type="button" className="nx-d-action danger" onClick={() => void deleteSelected()}>
                      DELETE
                    </button>
                  </div>
                  {!!selected.summary && (
                    <div style={{ marginTop: 10, fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--muted)', lineHeight: 1.5 }}>
                      {selected.summary}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  className="nx-drawer-close"
                  onClick={() => {
                    setSelected(null)
                    setConversation(null)
                  }}
                >
                  CLOSE ×
                </button>
              </>
            )}
          </div>
          {!!conversation?.messages?.length && (
            <div style={{ padding: '0 16px 12px', maxHeight: 160, overflow: 'auto', borderTop: '1px solid var(--gm)' }}>
              {conversation.messages.slice(-6).map((m, i) => (
                <div key={m.id ?? i} style={{ fontFamily: 'var(--mono)', fontSize: 9, color: '#a0e8b0', marginTop: 8 }}>
                  <span style={{ color: 'var(--muted)' }}>{m.type ?? 'msg'}:</span> {m.text}
                </div>
              ))}
            </div>
          )}
        </div>

        <footer className="nx-footer">
          next_cursor: {nextCursor ?? 'null'} · api: {import.meta.env.VITE_API_URL ? 'absolute' : 'proxied /api/v1'}
        </footer>
      </div>

      {launchOpen && (
        <div className="nx-modal-backdrop" role="presentation" onClick={() => setLaunchOpen(false)}>
          <div className="nx-modal" role="dialog" aria-modal="true" aria-label="Launch agent" onClick={(e) => e.stopPropagation()}>
            <h3 className="nx-modal-title">LAUNCH_CLOUD_AGENT</h3>
            <label className="nx-lbl">prompt.text</label>
            <textarea className="nx-inp-ta" value={launchText} onChange={(e) => setLaunchText(e.target.value)} rows={5} />
            <label className="nx-lbl">source.repository</label>
            <input className="nx-inp" value={launchRepo} onChange={(e) => setLaunchRepo(e.target.value)} placeholder="https://github.com/org/repo" />
            <label className="nx-lbl">source.ref</label>
            <input className="nx-inp" value={launchRef} onChange={(e) => setLaunchRef(e.target.value)} />
            <label className="nx-lbl">model</label>
            <input className="nx-inp" value={launchModel} onChange={(e) => setLaunchModel(e.target.value)} placeholder="default" />
            <div className="nx-modal-actions">
              <button type="button" className="nx-cbtn" onClick={() => setLaunchOpen(false)}>
                CANCEL
              </button>
              <button type="button" className="nx-cbtn primary" onClick={() => void submitLaunch()}>
                LAUNCH
              </button>
            </div>
          </div>
        </div>
      )}

      {followOpen && selected && (
        <div className="nx-modal-backdrop" role="presentation" onClick={() => setFollowOpen(false)}>
          <div className="nx-modal" role="dialog" aria-modal="true" aria-label="Follow up" onClick={(e) => e.stopPropagation()}>
            <h3 className="nx-modal-title">FOLLOW_UP — {selected.id}</h3>
            <textarea className="nx-inp-ta" value={followText} onChange={(e) => setFollowText(e.target.value)} rows={5} />
            <div className="nx-modal-actions">
              <button type="button" className="nx-cbtn" onClick={() => setFollowOpen(false)}>
                CANCEL
              </button>
              <button type="button" className="nx-cbtn primary" onClick={() => void submitFollow()}>
                SEND
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

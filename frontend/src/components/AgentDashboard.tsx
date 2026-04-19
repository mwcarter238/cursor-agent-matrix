import {
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  MarkerType,
  MiniMap,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps,
  useEdgesState,
  useNodesState,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { memo, useCallback, useEffect, useMemo, useState, type MouseEvent } from 'react'
import { ApiError, apiDelete, apiGet, apiPost } from '../api'
import type { AgentsListResponse, ConversationResponse, CursorAgent } from '../types'
import { MatrixRain } from './MatrixRain'

const RM_KEY = 'cam_reduce_motion'

function CoreNode({ data }: NodeProps) {
  return (
    <div className="node-core">
      <Handle type="target" position={Position.Left} className="handle-invis" />
      <div className="node-core-ring" />
      <div className="node-core-label">{String(data.label ?? 'NEXUS')}</div>
      <Handle type="source" position={Position.Right} id="src" isConnectable={false} />
    </div>
  )
}

const AgentNode = memo(function AgentNode({ data }: NodeProps) {
  const a = data.agent as CursorAgent
  const st = (a.status ?? 'UNKNOWN').toUpperCase()
  return (
    <div className={`node-agent status-${st}`}>
      <Handle type="target" position={Position.Left} />
      <div className="node-agent-title">{a.name ?? a.id}</div>
      <div className="node-agent-meta">{st}</div>
      <Handle type="source" position={Position.Right} />
    </div>
  )
})

const nodeTypes = { core: CoreNode, agent: AgentNode }

function formatDetail(err: unknown): string {
  if (err instanceof ApiError) return err.message
  if (err instanceof Error) return err.message
  return String(err)
}

export function AgentDashboard() {
  const [agents, setAgents] = useState<CursorAgent[]>([])
  const [nextCursor, setNextCursor] = useState<string | undefined>()
  const [selected, setSelected] = useState<CursorAgent | null>(null)
  const [conversation, setConversation] = useState<ConversationResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [syncError, setSyncError] = useState<string | null>(null)
  const [lastSync, setLastSync] = useState<Date | null>(null)
  const [tabHidden, setTabHidden] = useState(document.visibilityState === 'hidden')

  const [reduceMotion, setReduceMotion] = useState(() => {
    if (typeof window === 'undefined') return false
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return true
    return window.localStorage.getItem(RM_KEY) === '1'
  })

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])

  const onNodeClick = useCallback(
    (_e: MouseEvent, node: Node) => {
      if (node.id === 'core') {
        setSelected(null)
        setConversation(null)
        return
      }
      const ag = agents.find((a) => a.id === node.id)
      setSelected(ag ?? null)
      setConversation(null)
    },
    [agents],
  )

  const refresh = useCallback(async () => {
    setLoading(true)
    setSyncError(null)
    try {
      const res = await apiGet<AgentsListResponse>('/agents?limit=50')
      setAgents(res.agents ?? [])
      setNextCursor(res.nextCursor)
      setLastSync(new Date())
    } catch (e) {
      setSyncError(formatDetail(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const t = window.setTimeout(() => {
      void refresh()
    }, 0)
    return () => window.clearTimeout(t)
  }, [refresh])

  useEffect(() => {
    const id = window.setInterval(
      () => {
        if (!document.hidden) void refresh()
      },
      8000,
    )
    return () => window.clearInterval(id)
  }, [refresh])

  useEffect(() => {
    const onVis = () => setTabHidden(document.visibilityState === 'hidden')
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [])

  useEffect(() => {
    const core: Node = {
      id: 'core',
      type: 'core',
      position: { x: 40, y: 220 },
      data: { label: 'NEXUS' },
    }
    const agentNodes: Node[] = agents.map((a, i) => ({
      id: a.id,
      type: 'agent',
      position: { x: 320 + (i % 3) * 280, y: 60 + Math.floor(i / 3) * 150 },
      data: { agent: a },
    }))
    const es: Edge[] = agents.map((a) => ({
      id: `e-${a.id}`,
      source: 'core',
      sourceHandle: 'src',
      target: a.id,
      animated: !reduceMotion,
      style: { stroke: 'rgba(0, 255, 170, 0.35)', strokeWidth: 1.5 },
      markerEnd: { type: MarkerType.ArrowClosed, color: '#00ffaa', width: 18, height: 18 },
    }))
    setNodes([core, ...agentNodes])
    setEdges(es)
  }, [agents, reduceMotion, setEdges, setNodes])

  const toggleRM = () => {
    const v = !reduceMotion
    setReduceMotion(v)
    window.localStorage.setItem(RM_KEY, v ? '1' : '0')
  }

  const loadConversation = async () => {
    if (!selected) return
    try {
      const c = await apiGet<ConversationResponse>(`/agents/${selected.id}/conversation`)
      setConversation(c)
    } catch (e) {
      setSyncError(formatDetail(e))
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
      void refresh()
    } catch (e) {
      setSyncError(formatDetail(e))
    }
  }

  const deleteSelected = async () => {
    if (!selected) return
    if (!window.confirm(`DELETE agent ${selected.name ?? selected.id}? This cannot be undone.`)) return
    try {
      await apiDelete(`/agents/${selected.id}`)
      setSelected(null)
      setConversation(null)
      void refresh()
    } catch (e) {
      setSyncError(formatDetail(e))
    }
  }

  const minimapStyle = useMemo(
    () => ({
      backgroundColor: 'rgba(0, 20, 10, 0.6)',
      maskImage: 'radial-gradient(circle, black 55%, transparent 100%)',
    }),
    [],
  )

  return (
    <div className="dashboard">
      <MatrixRain reducedMotion={reduceMotion} paused={tabHidden} />

      <header className="top-bar">
        <div className="brand">
          <span className="brand-mark">◈</span>
          <div>
            <div className="brand-title">CURSOR_AGENT_MATRIX</div>
            <div className="brand-sub">workflow / cloud agents</div>
          </div>
        </div>
        <div className="top-meta">
          <span className="pill">{loading ? 'SYNC…' : 'ONLINE'}</span>
          <span className="mono faint">
            last_sync: {lastSync ? lastSync.toLocaleTimeString() : '—'}
          </span>
          <button type="button" className="btn-ghost" onClick={() => void refresh()}>
            refresh
          </button>
          <button type="button" className="btn-ghost" onClick={toggleRM}>
            reduce_motion: {reduceMotion ? 'on' : 'off'}
          </button>
          <button type="button" className="btn-accent" onClick={() => setLaunchOpen(true)}>
            launch_agent
          </button>
        </div>
      </header>

      {syncError && (
        <div className="banner-err">
          <span className="mono">{syncError}</span>
          <button type="button" className="btn-ghost" onClick={() => setSyncError(null)}>
            dismiss
          </button>
        </div>
      )}

      <main className="main-grid">
        <section className="flow-panel">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeClick={onNodeClick}
            nodeTypes={nodeTypes}
            fitView
            minZoom={0.4}
            maxZoom={1.4}
            proOptions={{ hideAttribution: true }}
          >
            <Background color="#003b22" gap={22} size={1.2} variant={BackgroundVariant.Dots} />
            <Controls className="flow-controls" />
            <MiniMap pannable zoomable style={minimapStyle} />
          </ReactFlow>
        </section>

        <aside className="inspector">
          <div className="inspector-header">inspector</div>
          {!selected && <p className="mono faint">select a node…</p>}
          {selected && (
            <div className="inspector-body fade-in">
              <div className="kv">
                <span className="k">id</span>
                <span className="v mono">{selected.id}</span>
              </div>
              <div className="kv">
                <span className="k">status</span>
                <span className="v mono glow">{(selected.status ?? '—').toUpperCase()}</span>
              </div>
              <div className="kv">
                <span className="k">repo</span>
                <span className="v mono small">{selected.source?.repository ?? '—'}</span>
              </div>
              <div className="kv">
                <span className="k">branch</span>
                <span className="v mono small">{selected.target?.branchName ?? '—'}</span>
              </div>
              {selected.target?.prUrl && (
                <a className="link" href={selected.target.prUrl} target="_blank" rel="noreferrer">
                  open_pr ↗
                </a>
              )}
              {selected.target?.url && (
                <a className="link" href={selected.target.url} target="_blank" rel="noreferrer">
                  open_in_cursor ↗
                </a>
              )}
              {selected.summary && (
                <div className="block">
                  <div className="k">summary</div>
                  <div className="mono small">{selected.summary}</div>
                </div>
              )}
              <div className="btn-row">
                <button type="button" className="btn-ghost" onClick={() => void loadConversation()}>
                  load_transcript
                </button>
                <button type="button" className="btn-ghost" onClick={() => setFollowOpen(true)}>
                  follow_up
                </button>
                <button type="button" className="btn-warn" onClick={() => void stopSelected()}>
                  stop
                </button>
                <button type="button" className="btn-danger" onClick={() => void deleteSelected()}>
                  delete
                </button>
              </div>
              {conversation?.messages && (
                <div className="transcript">
                  {conversation.messages.map((m, i) => (
                    <div key={m.id ?? i} className={`msg msg-${m.type ?? 'unknown'}`}>
                      <span className="tag mono">{(m.type ?? '?').replace('_', ' ')}</span>
                      <div className="mono small">{m.text}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </aside>
      </main>

      {launchOpen && (
        <div className="modal-backdrop" role="presentation" onClick={() => setLaunchOpen(false)}>
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label="Launch agent"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="modal-title">launch_cloud_agent</h3>
            <label className="lbl">prompt.text</label>
            <textarea className="inp-ta" value={launchText} onChange={(e) => setLaunchText(e.target.value)} rows={5} />
            <label className="lbl">source.repository (GitHub URL)</label>
            <input className="inp" value={launchRepo} onChange={(e) => setLaunchRepo(e.target.value)} placeholder="https://github.com/org/repo" />
            <label className="lbl">source.ref</label>
            <input className="inp" value={launchRef} onChange={(e) => setLaunchRef(e.target.value)} />
            <label className="lbl">model</label>
            <input className="inp" value={launchModel} onChange={(e) => setLaunchModel(e.target.value)} placeholder="default" />
            <div className="modal-actions">
              <button type="button" className="btn-ghost" onClick={() => setLaunchOpen(false)}>
                cancel
              </button>
              <button type="button" className="btn-accent" onClick={() => void submitLaunch()}>
                launch
              </button>
            </div>
          </div>
        </div>
      )}

      {followOpen && selected && (
        <div className="modal-backdrop" role="presentation" onClick={() => setFollowOpen(false)}>
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label="Follow up"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="modal-title">follow_up — {selected.id}</h3>
            <textarea className="inp-ta" value={followText} onChange={(e) => setFollowText(e.target.value)} rows={5} />
            <div className="modal-actions">
              <button type="button" className="btn-ghost" onClick={() => setFollowOpen(false)}>
                cancel
              </button>
              <button type="button" className="btn-accent" onClick={() => void submitFollow()}>
                send
              </button>
            </div>
          </div>
        </div>
      )}

      <footer className="footer mono faint">
        next_cursor: {nextCursor ?? 'null'} · api: {import.meta.env.VITE_API_URL ? 'absolute' : 'proxied /api/v1'}
      </footer>
    </div>
  )
}

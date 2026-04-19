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
import { memo, useCallback, useEffect, type MouseEvent } from 'react'
import type { CursorAgent } from '../types'

function CoreNode({ data }: NodeProps) {
  return (
    <div className="nx-node-core">
      <Handle type="target" position={Position.Left} className="nx-handle-invis" />
      <div className="nx-node-core-ring" />
      <div className="nx-node-core-label">{String(data.label ?? 'NEXUS')}</div>
      <Handle type="source" position={Position.Right} id="src" isConnectable={false} />
    </div>
  )
}

const AgentNode = memo(function AgentNode({ data }: NodeProps) {
  const a = data.agent as CursorAgent
  const st = (a.status ?? 'UNKNOWN').toUpperCase()
  return (
    <div className={`nx-node-agent nx-status-${st}`}>
      <Handle type="target" position={Position.Left} />
      <div className="nx-node-agent-title">{a.name ?? a.id}</div>
      <div className="nx-node-agent-meta">{st}</div>
      <Handle type="source" position={Position.Right} />
    </div>
  )
})

const nodeTypes = { core: CoreNode, agent: AgentNode }

type Props = {
  agents: CursorAgent[]
  reduceMotion: boolean
  onSelectAgent: (a: CursorAgent) => void
}

export function TimelineGraph({ agents, reduceMotion, onSelectAgent }: Props) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])

  useEffect(() => {
    const core: Node = {
      id: 'core',
      type: 'core',
      position: { x: 40, y: 200 },
      data: { label: 'NEXUS' },
    }
    const agentNodes: Node[] = agents.map((a, i) => ({
      id: a.id,
      type: 'agent',
      position: { x: 300 + (i % 3) * 260, y: 40 + Math.floor(i / 3) * 140 },
      data: { agent: a },
    }))
    const es: Edge[] = agents.map((a) => ({
      id: `e-${a.id}`,
      source: 'core',
      sourceHandle: 'src',
      target: a.id,
      animated: !reduceMotion,
      style: { stroke: 'rgba(0, 255, 170, 0.28)', strokeWidth: 1.5 },
      markerEnd: { type: MarkerType.ArrowClosed, color: '#00ff9d', width: 16, height: 16 },
    }))
    setNodes([core, ...agentNodes])
    setEdges(es)
  }, [agents, reduceMotion, setEdges, setNodes])

  const onNodeClick = useCallback(
    (_e: MouseEvent, node: Node) => {
      if (node.id === 'core') return
      const ag = agents.find((x) => x.id === node.id)
      if (ag) onSelectAgent(ag)
    },
    [agents, onSelectAgent],
  )

  return (
    <div className="nx-timeline-wrap">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        nodeTypes={nodeTypes}
        fitView
        minZoom={0.35}
        maxZoom={1.35}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#0b3220" gap={22} size={1.1} variant={BackgroundVariant.Dots} />
        <Controls className="nx-flow-controls" />
        <MiniMap
          pannable
          zoomable
          style={{
            backgroundColor: 'rgba(4, 16, 10, 0.75)',
            border: '1px solid rgba(0, 255, 100, 0.2)',
            borderRadius: 8,
          }}
        />
      </ReactFlow>
    </div>
  )
}

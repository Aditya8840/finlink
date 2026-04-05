import { useEffect, useRef, useCallback } from 'react'
import cytoscape from 'cytoscape'
import type { Core } from 'cytoscape'
import { useNavigate } from 'react-router-dom'
import { Download } from 'lucide-react'
import type { UserConnections } from '@/api/relationships'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

const EDGE_COLORS: Record<string, string> = {
  SHARED_EMAIL: '#f59e0b',
  SHARED_PHONE: '#f59e0b',
  SHARED_ADDRESS: '#84cc16',
  SHARED_PAYMENT_METHOD: '#ef4444',
  SHARED_PAYMENT: '#ef4444',
  SHARED_IP: '#ec4899',
  SHARED_DEVICE: '#a855f7',
  CREDIT: '#3b82f6',
  DEBIT: '#22c55e',
}

const EDGE_LABELS: Record<string, string> = {
  SHARED_EMAIL: 'Email',
  SHARED_PHONE: 'Phone',
  SHARED_ADDRESS: 'Address',
  SHARED_PAYMENT_METHOD: 'Payment Method',
  SHARED_PAYMENT: 'Payment Method',
  SHARED_IP: 'IP',
  SHARED_DEVICE: 'Device',
  CREDIT: 'Sent',
  DEBIT: 'Received',
}

const LEGEND_ITEMS: { key: string; label: string; color: string }[] = [
  { key: 'SHARED_EMAIL', label: 'Email', color: '#f59e0b' },
  { key: 'SHARED_PHONE', label: 'Phone', color: '#f59e0b' },
  { key: 'SHARED_ADDRESS', label: 'Address', color: '#84cc16' },
  { key: 'SHARED_PAYMENT', label: 'Payment Method', color: '#ef4444' },
  { key: 'SHARED_IP', label: 'IP', color: '#ec4899' },
  { key: 'SHARED_DEVICE', label: 'Device', color: '#a855f7' },
  { key: 'CREDIT', label: 'Sent', color: '#3b82f6' },
  { key: 'DEBIT', label: 'Received', color: '#22c55e' },
]

interface Props {
  userId: string
  userName: string
  connections: UserConnections
}

export default function RelationshipGraph({ userId, userName, connections }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const cyRef = useRef<Core | null>(null)
  const navigate = useNavigate()

  const buildElements = useCallback(() => {
    const nodes: cytoscape.ElementDefinition[] = []
    const edges: cytoscape.ElementDefinition[] = []
    const addedEdges = new Set<string>()
    const addedNodes = new Set<string>()

    nodes.push({
      data: { id: userId, label: userName, type: 'center' },
    })
    addedNodes.add(userId)

    for (const link of connections.shared_links) {
      if (!addedNodes.has(link.user.id)) {
        nodes.push({
          data: {
            id: link.user.id,
            label: `${link.user.first_name} ${link.user.last_name}`,
            type: 'shared',
          },
        })
        addedNodes.add(link.user.id)
      }
      const edgeLabel = EDGE_LABELS[link.link_type] ?? link.link_type
      const edgeKey = `${userId}|${link.user.id}|${edgeLabel}`
      if (!addedEdges.has(edgeKey)) {
        addedEdges.add(edgeKey)
        edges.push({
          data: {
            id: `shared-${link.link_type}-${link.user.id}`,
            source: userId,
            target: link.user.id,
            edgeType: link.link_type,
            label: edgeLabel,
          },
        })
      }
    }

    for (const link of connections.credit_links) {
      if (!addedNodes.has(link.counterparty.id)) {
        nodes.push({
          data: {
            id: link.counterparty.id,
            label: `${link.counterparty.first_name} ${link.counterparty.last_name}`,
            type: 'counterparty',
          },
        })
        addedNodes.add(link.counterparty.id)
      }
      edges.push({
        data: {
          id: `credit-${link.transaction.id}`,
          source: userId,
          target: link.counterparty.id,
          edgeType: 'CREDIT',
          label: `Sent $${link.transaction.amount.toLocaleString()}`,
        },
      })
    }

    for (const link of connections.debit_links) {
      if (!addedNodes.has(link.counterparty.id)) {
        nodes.push({
          data: {
            id: link.counterparty.id,
            label: `${link.counterparty.first_name} ${link.counterparty.last_name}`,
            type: 'counterparty',
          },
        })
        addedNodes.add(link.counterparty.id)
      }
      edges.push({
        data: {
          id: `debit-${link.transaction.id}`,
          source: link.counterparty.id,
          target: userId,
          edgeType: 'DEBIT',
          label: `Received $${link.transaction.amount.toLocaleString()}`,
        },
      })
    }

    return [...nodes, ...edges]
  }, [userId, userName, connections])

  useEffect(() => {
    if (!containerRef.current) return

    const cy = cytoscape({
      container: containerRef.current,
      elements: buildElements(),
      style: [
        {
          selector: 'node[type="center"]',
          style: {
            'background-color': '#4f46e5',
            label: 'data(label)',
            color: '#1e293b',
            'font-size': '12px',
            'font-weight': 'bold',
            'text-valign': 'bottom',
            'text-margin-y': 8,
            'text-outline-width': 2,
            'text-outline-color': '#fff',
            width: 50,
            height: 50,
            'border-width': 3,
            'border-color': '#312e81',
          },
        },
        {
          selector: 'node[type="shared"]',
          style: {
            'background-color': '#f97316',
            label: 'data(label)',
            color: '#1e293b',
            'font-size': '10px',
            'text-valign': 'bottom',
            'text-margin-y': 6,
            'text-outline-width': 2,
            'text-outline-color': '#fff',
            width: 40,
            height: 40,
            'border-width': 2,
            'border-color': '#fff',
          },
        },
        {
          selector: 'node[type="counterparty"]',
          style: {
            'background-color': '#0ea5e9',
            label: 'data(label)',
            color: '#1e293b',
            'font-size': '10px',
            'text-valign': 'bottom',
            'text-margin-y': 6,
            'text-outline-width': 2,
            'text-outline-color': '#fff',
            width: 40,
            height: 40,
            'border-width': 2,
            'border-color': '#fff',
          },
        },
        {
          selector: 'edge',
          style: {
            width: 2.5,
            'line-color': (ele: cytoscape.EdgeSingular) =>
              EDGE_COLORS[ele.data('edgeType')] ?? '#94a3b8',
            'target-arrow-color': (ele: cytoscape.EdgeSingular) =>
              EDGE_COLORS[ele.data('edgeType')] ?? '#94a3b8',
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier',
            'arrow-scale': 0.8,
            opacity: 0.7,
            label: 'data(label)',
            'font-size': '7px',
            'text-rotation': 'autorotate',
            'text-outline-width': 2,
            'text-outline-color': '#fff',
            color: '#9ca3af',
          },
        },
        {
          selector: 'node:active, node:selected',
          style: {
            'border-width': 4,
            'border-color': '#4f46e5',
            'overlay-opacity': 0,
          },
        },
      ],
      layout: {
        name: 'concentric',
        concentric: (node: cytoscape.NodeSingular) => (node.data('type') === 'center' ? 10 : 1),
        levelWidth: () => 1,
        animate: true,
        animationDuration: 500,
        padding: 60,
        minNodeSpacing: 80,
        startAngle: Math.PI,
      },
      minZoom: 0.3,
      maxZoom: 3,
    })

    cy.on('tap', 'node', (evt: cytoscape.EventObject) => {
      const nodeId = evt.target.data('id')
      if (nodeId && nodeId !== userId) {
        navigate(`/users/${nodeId}`)
      }
    })

    cy.on('layoutstop', () => {
      cy.fit(undefined, 40)
      if (cy.zoom() > 1.5) {
        cy.zoom({
          level: 1.5,
          renderedPosition: { x: cy.width() / 2, y: cy.height() / 2 },
        })
        cy.center()
      }
    })

    cyRef.current = cy

    return () => {
      cy.removeAllListeners()
      cy.destroy()
    }
  }, [buildElements, navigate, userId])

  const exportJSON = useCallback(() => {
    const data = {
      user: { id: userId, name: userName },
      connections,
      exported_at: new Date().toISOString(),
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `user-relationships-${userId.slice(0, 8)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }, [connections, userId, userName])

  const hasData =
    connections.shared_links.length > 0 ||
    connections.credit_links.length > 0 ||
    connections.debit_links.length > 0

  if (!hasData) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span>Relationship Graph</span>
            <Button variant="ghost" size="sm" onClick={exportJSON}>
              <Download className="mr-1 h-4 w-4" /> Export JSON
            </Button>
          </div>
          <div className="flex gap-2 flex-wrap">
            {LEGEND_ITEMS.map((item) => (
              <Badge
                key={item.key}
                variant="outline"
                className="text-xs font-normal"
                style={{ borderColor: item.color, color: item.color }}
              >
                {item.label}
              </Badge>
            ))}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div ref={containerRef} className="w-full h-[500px] bg-muted/30" />
      </CardContent>
    </Card>
  )
}

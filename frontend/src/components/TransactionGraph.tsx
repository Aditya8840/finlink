import { useEffect, useRef, useCallback } from 'react'
import cytoscape from 'cytoscape'
import type { Core } from 'cytoscape'
import { useNavigate } from 'react-router-dom'
import type { TransactionConnections } from '@/api/relationships'
import type { Transaction } from '@/api/transactions'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

const EDGE_COLORS: Record<string, string> = {
  SENT: '#3b82f6',
  SHARED_PAYMENT: '#ef4444',
  SHARED_PAYMENT_METHOD: '#ef4444',
  SHARED_IP: '#ec4899',
  SHARED_DEVICE: '#a855f7',
}

const LEGEND_ITEMS = [
  { key: 'sender', label: 'Sender', color: '#3b82f6' },
  { key: 'receiver', label: 'Receiver', color: '#22c55e' },
  { key: 'tx', label: 'This Transaction', color: '#4f46e5' },
  { key: 'SHARED_PAYMENT', label: 'Same Payment', color: '#ef4444' },
  { key: 'SHARED_IP', label: 'Same IP', color: '#ec4899' },
  { key: 'SHARED_DEVICE', label: 'Same Device', color: '#a855f7' },
]

interface Props {
  transaction: Transaction
  connections: TransactionConnections
}

export default function TransactionGraph({ transaction, connections }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const cyRef = useRef<Core | null>(null)
  const navigate = useNavigate()

  const buildElements = useCallback(() => {
    const nodes: cytoscape.ElementDefinition[] = []
    const edges: cytoscape.ElementDefinition[] = []
    const addedNodes = new Set<string>()

    const txNodeId = `tx-${transaction.id}`
    nodes.push({
      data: {
        id: txNodeId,
        label: `$${transaction.amount.toLocaleString()} ${transaction.currency}`,
        type: 'transaction',
      },
    })
    addedNodes.add(txNodeId)

    nodes.push({
      data: {
        id: connections.sender.id,
        label: `${connections.sender.first_name} ${connections.sender.last_name}`,
        type: 'sender',
      },
    })
    addedNodes.add(connections.sender.id)

    if (!addedNodes.has(connections.receiver.id)) {
      nodes.push({
        data: {
          id: connections.receiver.id,
          label: `${connections.receiver.first_name} ${connections.receiver.last_name}`,
          type: 'receiver',
        },
      })
      addedNodes.add(connections.receiver.id)
    }

    edges.push({
      data: {
        id: 'edge-sent',
        source: connections.sender.id,
        target: txNodeId,
        edgeType: 'SENT',
        label: 'sent',
      },
    })
    edges.push({
      data: {
        id: 'edge-received',
        source: txNodeId,
        target: connections.receiver.id,
        edgeType: 'SENT',
        label: 'received',
      },
    })

    const addedEdges = new Set<string>()
    for (const link of connections.linked_transactions) {
      const otherTx = link.transaction
      const otherNodeId = `tx-${otherTx.id}`

      if (!addedNodes.has(otherNodeId)) {
        nodes.push({
          data: {
            id: otherNodeId,
            txId: otherTx.id,
            label: `$${otherTx.amount.toLocaleString()}`,
            type: 'linked',
          },
        })
        addedNodes.add(otherNodeId)
      }

      const linkLabel =
        link.link_type === 'SHARED_IP'
          ? 'Same IP'
          : link.link_type === 'SHARED_DEVICE'
            ? 'Same Device'
            : 'Same Payment'
      const edgeKey = `${txNodeId}|${otherNodeId}|${linkLabel}`
      if (!addedEdges.has(edgeKey)) {
        addedEdges.add(edgeKey)
        edges.push({
          data: {
            id: `link-${link.link_type}-${otherTx.id}`,
            source: txNodeId,
            target: otherNodeId,
            edgeType: link.link_type,
            label: linkLabel,
          },
        })
      }

      if (link.sender && !addedNodes.has(link.sender.id)) {
        nodes.push({
          data: {
            id: link.sender.id,
            label: `${link.sender.first_name} ${link.sender.last_name}`,
            type: 'linked-sender',
          },
        })
        addedNodes.add(link.sender.id)
      }
      if (link.sender) {
        edges.push({
          data: {
            id: `linked-sent-${otherTx.id}`,
            source: link.sender.id,
            target: otherNodeId,
            edgeType: 'SENT',
            label: 'sent',
          },
        })
      }

      if (link.receiver && !addedNodes.has(link.receiver.id)) {
        nodes.push({
          data: {
            id: link.receiver.id,
            label: `${link.receiver.first_name} ${link.receiver.last_name}`,
            type: 'linked-receiver',
          },
        })
        addedNodes.add(link.receiver.id)
      }
      if (link.receiver) {
        edges.push({
          data: {
            id: `linked-recv-${otherTx.id}`,
            source: otherNodeId,
            target: link.receiver.id,
            edgeType: 'SENT',
            label: 'received',
          },
        })
      }
    }

    return [...nodes, ...edges]
  }, [transaction, connections])

  useEffect(() => {
    if (!containerRef.current) return

    const cy = cytoscape({
      container: containerRef.current,
      elements: buildElements(),
      style: [
        {
          selector: 'node[type="transaction"]',
          style: {
            'background-color': '#4f46e5',
            label: 'data(label)',
            color: '#1e293b',
            'font-size': '11px',
            'font-weight': 'bold',
            'text-valign': 'bottom',
            'text-margin-y': 8,
            'text-outline-width': 2,
            'text-outline-color': '#fff',
            width: 55,
            height: 55,
            shape: 'round-rectangle',
            'border-width': 3,
            'border-color': '#312e81',
          },
        },
        {
          selector: 'node[type="sender"]',
          style: {
            'background-color': '#3b82f6',
            label: 'data(label)',
            color: '#1e293b',
            'font-size': '11px',
            'font-weight': 'bold',
            'text-valign': 'bottom',
            'text-margin-y': 8,
            'text-outline-width': 2,
            'text-outline-color': '#fff',
            width: 50,
            height: 50,
            'border-width': 3,
            'border-color': '#1d4ed8',
          },
        },
        {
          selector: 'node[type="receiver"]',
          style: {
            'background-color': '#22c55e',
            label: 'data(label)',
            color: '#1e293b',
            'font-size': '11px',
            'font-weight': 'bold',
            'text-valign': 'bottom',
            'text-margin-y': 8,
            'text-outline-width': 2,
            'text-outline-color': '#fff',
            width: 50,
            height: 50,
            'border-width': 3,
            'border-color': '#15803d',
          },
        },
        {
          selector: 'node[type="linked"]',
          style: {
            'background-color': '#f97316',
            label: 'data(label)',
            color: '#1e293b',
            'font-size': '9px',
            'text-valign': 'bottom',
            'text-margin-y': 6,
            'text-outline-width': 2,
            'text-outline-color': '#fff',
            width: 40,
            height: 40,
            shape: 'round-rectangle',
            'border-width': 2,
            'border-color': '#c2410c',
          },
        },
        {
          selector: 'node[type="linked-sender"], node[type="linked-receiver"]',
          style: {
            'background-color': '#94a3b8',
            label: 'data(label)',
            color: '#64748b',
            'font-size': '9px',
            'text-valign': 'bottom',
            'text-margin-y': 6,
            'text-outline-width': 2,
            'text-outline-color': '#fff',
            width: 35,
            height: 35,
            'border-width': 2,
            'border-color': '#cbd5e1',
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
          selector: 'edge[edgeType="SENT"]',
          style: {
            width: 4,
            opacity: 1,
            'font-size': '9px',
            color: '#3b82f6',
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
        concentric: (node: cytoscape.NodeSingular) => {
          const type = node.data('type')
          if (type === 'transaction') return 10
          if (type === 'sender' || type === 'receiver') return 7
          if (type === 'linked') return 4
          return 1
        },
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
      const node = evt.target
      const type = node.data('type')
      const id = node.data('id')
      const txId = node.data('txId')

      if (
        type === 'sender' ||
        type === 'receiver' ||
        type === 'linked-sender' ||
        type === 'linked-receiver'
      ) {
        navigate(`/users/${id}`)
      } else if (type === 'linked' && txId) {
        navigate(`/transactions/${txId}`)
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
  }, [buildElements, navigate, transaction.id])

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Transaction Graph</span>
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
        <div ref={containerRef} className="w-full h-[450px] bg-muted/30" />
      </CardContent>
    </Card>
  )
}

import { useState, useEffect, useRef } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Route } from 'lucide-react'
import cytoscape from 'cytoscape'
import type { Core } from 'cytoscape'
import type { AxiosError } from 'axios'
import { fetchShortestPath } from '@/api/relationships'
import type { ShortestPathResponse } from '@/api/relationships'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

interface Props {
  currentUserId: string
}

const EDGE_COLORS: Record<string, string> = {
  SHARED_EMAIL: '#f59e0b',
  SHARED_PHONE: '#f59e0b',
  SHARED_ADDRESS: '#84cc16',
  SHARED_PAYMENT_METHOD: '#ef4444',
  SHARED_PAYMENT: '#ef4444',
  SHARED_IP: '#ec4899',
  SHARED_DEVICE: '#a855f7',
  SENT: '#3b82f6',
  RECEIVED_BY: '#22c55e',
}

const EDGE_LABELS: Record<string, string> = {
  SHARED_EMAIL: 'Email',
  SHARED_PHONE: 'Phone',
  SHARED_ADDRESS: 'Address',
  SHARED_PAYMENT_METHOD: 'Payment',
  SHARED_PAYMENT: 'Payment',
  SHARED_IP: 'IP',
  SHARED_DEVICE: 'Device',
  SENT: 'Sent',
  RECEIVED_BY: 'Received',
}

export default function ShortestPathFinder({ currentUserId }: Props) {
  const [targetId, setTargetId] = useState('')
  const [result, setResult] = useState<ShortestPathResponse | null>(null)
  const [error, setError] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const cyRef = useRef<Core | null>(null)
  const navigate = useNavigate()

  const mutation = useMutation({
    mutationFn: () => fetchShortestPath(currentUserId, targetId),
    onSuccess: (data) => {
      setResult(data)
      setError('')
    },
    onError: (err: AxiosError<{ detail?: string }>) => {
      setResult(null)
      setError(err.response?.data?.detail ?? 'No path found between these users.')
    },
  })

  // Render graph when result changes
  useEffect(() => {
    if (!result || !containerRef.current) return

    // Destroy previous
    if (cyRef.current) {
      cyRef.current.removeAllListeners()
      cyRef.current.destroy()
      cyRef.current = null
    }

    // Build elements
    const elements: cytoscape.ElementDefinition[] = []

    for (const node of result.path) {
      const isSource = node.id === currentUserId
      const isTarget = node.id === targetId
      const nodeType = node.properties.type as string

      elements.push({
        data: {
          id: node.id,
          label: node.label,
          nodeType,
          isSource,
          isTarget,
        },
      })
    }

    for (const edge of result.edges) {
      elements.push({
        data: {
          id: `edge-${edge.source}-${edge.target}`,
          source: edge.source,
          target: edge.target,
          edgeType: edge.type,
          label: EDGE_LABELS[edge.type] ?? edge.type,
        },
      })
    }

    const cy = cytoscape({
      container: containerRef.current,
      elements,
      style: [
        // Source node (current user)
        {
          selector: 'node[?isSource]',
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
            width: 50,
            height: 50,
            'border-width': 3,
            'border-color': '#312e81',
          },
        },
        // Target node
        {
          selector: 'node[?isTarget]',
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
        // Intermediate User nodes
        {
          selector: 'node[nodeType="User"][!isSource][!isTarget]',
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
            'border-color': '#c2410c',
          },
        },
        // Transaction nodes on the path
        {
          selector: 'node[nodeType="Transaction"]',
          style: {
            'background-color': '#64748b',
            label: 'data(label)',
            color: '#1e293b',
            'font-size': '9px',
            'text-valign': 'bottom',
            'text-margin-y': 6,
            'text-outline-width': 2,
            'text-outline-color': '#fff',
            width: 35,
            height: 35,
            shape: 'round-rectangle',
            'border-width': 2,
            'border-color': '#475569',
          },
        },
        // Edges
        {
          selector: 'edge',
          style: {
            width: 3,
            'line-color': (ele: cytoscape.EdgeSingular) =>
              EDGE_COLORS[ele.data('edgeType')] ?? '#94a3b8',
            'target-arrow-color': (ele: cytoscape.EdgeSingular) =>
              EDGE_COLORS[ele.data('edgeType')] ?? '#94a3b8',
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier',
            'arrow-scale': 0.8,
            label: 'data(label)',
            'font-size': '9px',
            'font-weight': 'bold',
            'text-rotation': 'autorotate',
            'text-outline-width': 2,
            'text-outline-color': '#fff',
            color: (ele: cytoscape.EdgeSingular) => EDGE_COLORS[ele.data('edgeType')] ?? '#94a3b8',
          },
        },
      ],
      layout: {
        name: 'preset',
        positions: ((node: cytoscape.NodeSingular) => {
          const idx = result.path.findIndex((n) => n.id === node.data('id'))
          const spacing = 180
          return { x: idx * spacing, y: 0 }
        }) as unknown as cytoscape.PresetLayoutOptions['positions'],
        padding: 60,
      },
      minZoom: 0.3,
      maxZoom: 3,
    })

    // Fit after render
    cy.fit(undefined, 50)
    if (cy.zoom() > 1.3) {
      cy.zoom({ level: 1.3, renderedPosition: { x: cy.width() / 2, y: cy.height() / 2 } })
      cy.center()
    }

    // Click to navigate
    cy.on('tap', 'node', (evt: cytoscape.EventObject) => {
      const node = evt.target
      const nodeType = node.data('nodeType')
      const id = node.data('id')
      if (nodeType === 'User') navigate(`/users/${id}`)
      else if (nodeType === 'Transaction') navigate(`/transactions/${id}`)
    })

    cyRef.current = cy

    return () => {
      cy.removeAllListeners()
      cy.destroy()
    }
  }, [result, currentUserId, targetId, navigate])

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Route className="h-5 w-5" />
          Shortest Path Finder
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input
            placeholder="Target user ID (paste from another user's page)"
            value={targetId}
            onChange={(e) => setTargetId(e.target.value)}
            className="flex-1"
          />
          <Button onClick={() => mutation.mutate()} disabled={!targetId || mutation.isPending}>
            {mutation.isPending ? 'Finding...' : 'Find Path'}
          </Button>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        {result && (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <p className="text-sm text-muted-foreground">
                Path found:{' '}
                <strong>
                  {result.length} hop{result.length !== 1 ? 's' : ''}
                </strong>
              </p>
              <div className="flex gap-1">
                <Badge variant="outline" style={{ borderColor: '#4f46e5', color: '#4f46e5' }}>
                  Source
                </Badge>
                <Badge variant="outline" style={{ borderColor: '#f97316', color: '#f97316' }}>
                  Intermediate
                </Badge>
                <Badge variant="outline" style={{ borderColor: '#22c55e', color: '#22c55e' }}>
                  Target
                </Badge>
              </div>
            </div>
            <div ref={containerRef} className="w-full h-[250px] bg-muted/30 rounded-md" />
          </div>
        )}
      </CardContent>
    </Card>
  )
}

import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { Cosmograph, usePreparedCosmographData, type CosmographConfig, type CosmographDataPrepConfig, type CosmographRef } from '@cosmograph/react'
import type { GraphLink, GraphNode, LayoutSettings, Selection } from '../types/graph'
import { CATEGORY_BY_ID } from '../utils/colors'
import { evidenceQuotes } from '../utils/context'
import { formatConfidence } from '../utils/format'
import { LINK_CURVE } from '../utils/linkLabels'
import { RelationLabelOverlay } from './RelationLabelOverlay'

const DATA_CONFIG: CosmographDataPrepConfig = {
  points: {
    pointIdBy: 'id',
    pointLabelBy: 'label',
    pointColorBy: 'color',
  },
  links: {
    linkSourceBy: 'source',
    linkTargetsBy: ['target'],
    linkColorBy: 'color',
    linkWidthBy: 'width',
  },
}

export interface GraphHandle {
  fit: () => void
  resetView: () => void
  exportPng: () => void
  pause: () => void
  resume: () => void
  reheat: () => void
}

interface GraphViewerProps {
  nodes: GraphNode[]
  links: GraphLink[]
  layout: LayoutSettings
  showLabels: boolean
  showDynamicLabels: boolean
  showRelationLabels: boolean
  selection: Selection
  hop: 0 | 1 | 2
  focusNonce: number
  onSelectNode: (id: string) => void
  onSelectLink: (id: string) => void
  onClearSelection: () => void
}

type PointRecord = Record<string, unknown> & {
  id: string
  label: string
  color: string
}

type LinkRecord = Record<string, unknown> & {
  id: string
  source: string
  target: string
  color: string
  width: number
}

function truncateLabel(value: unknown): string {
  const text = String(value ?? '')
  return text.length > 48 ? `${text.slice(0, 46)}…` : text
}

function colorFromColumn(value: unknown): string {
  const color = String(value ?? '').trim()
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(color) ? color : '#94A3B8'
}

export const GraphViewer = forwardRef<GraphHandle, GraphViewerProps>(function GraphViewer(
  { nodes, links, layout, showLabels, showDynamicLabels, showRelationLabels, selection, hop, focusNonce, onSelectNode, onSelectLink, onClearSelection },
  ref,
) {
  const cosmographRef = useRef<CosmographRef>(undefined)
  const pointsRef = useRef<PointRecord[]>([])
  const linksRef = useRef<LinkRecord[]>([])
  const onSelectNodeRef = useRef(onSelectNode)
  const onSelectLinkRef = useRef(onSelectLink)
  const onClearSelectionRef = useRef(onClearSelection)
  const fullLinksRef = useRef<GraphLink[]>([])
  const nodesRef = useRef<GraphNode[]>([])
  const indexByIdRef = useRef(new Map<string, number>())
  const userMovedRef = useRef(false)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const pointerRef = useRef({ x: 16, y: 16 })
  const hoverClearRef = useRef<number>(0)
  const [mountedTick, setMountedTick] = useState(0)
  const [stableConfig, setStableConfig] = useState<CosmographConfig | null>(null)
  const [hoveredLinkId, setHoveredLinkId] = useState<string | null>(null)
  const zoomedNonce = useRef(0)
  fullLinksRef.current = links
  nodesRef.current = nodes

  onSelectNodeRef.current = onSelectNode
  onSelectLinkRef.current = onSelectLink
  onClearSelectionRef.current = onClearSelection

  const points = useMemo<PointRecord[]>(
    () => nodes.map((node) => ({ id: node.id, label: node.label, color: node.color })),
    [nodes],
  )
  const linkRecords = useMemo<LinkRecord[]>(
    () =>
      links.map((link) => ({
        id: link.id,
        source: link.source,
        target: link.target,
        color: link.color,
        width: 0.85 + Math.max(0, Math.min(1, link.width)) * 1.7,
      })),
    [links],
  )
  pointsRef.current = points
  linksRef.current = linkRecords

  const prepared = usePreparedCosmographData(DATA_CONFIG, points, linkRecords.length > 0 ? linkRecords : undefined)

  useEffect(() => {
    if (prepared.config.points) setStableConfig(prepared.config)
  }, [prepared.config])

  useEffect(() => {
    userMovedRef.current = false
    const fitLater = window.setTimeout(() => {
      if (!userMovedRef.current) cosmographRef.current?.fitView(700, 0.22)
    }, 1600)
    return () => window.clearTimeout(fitLater)
  }, [points, links])

  useEffect(() => {
    const parent = cosmographRef.current?.getCanvas()?.parentElement
    if (!parent || mountedTick === 0) return
    const observer = new ResizeObserver(() => {
      if (!userMovedRef.current) cosmographRef.current?.fitView(400, 0.22)
    })
    observer.observe(parent)
    return () => observer.disconnect()
  }, [mountedTick, stableConfig])

  useEffect(() => {
    const map = new Map<string, number>()
    points.forEach((point, index) => map.set(point.id, index))
    indexByIdRef.current = map
  }, [points])

  useEffect(() => {
    let cancelled = false
    const graph = cosmographRef.current
    if (!graph || !stableConfig || mountedTick === 0) return
    void (async () => {
      await graph.dataUploaded()
      if (cancelled) return
      const indices = await graph.getPointIndicesByIds(pointsRef.current.map((point) => point.id))
      if (cancelled || !indices) return
      const map = new Map<string, number>()
      pointsRef.current.forEach((point, index) => {
        const resolved = indices[index]
        if (resolved != null && resolved >= 0) map.set(point.id, resolved)
      })
      if (map.size === pointsRef.current.length) indexByIdRef.current = map
    })()
    return () => {
      cancelled = true
    }
  }, [stableConfig, mountedTick, points])

  useImperativeHandle(ref, () => ({
    fit: () => cosmographRef.current?.fitView(450, 0.14),
    resetView: () => {
      cosmographRef.current?.unselectAllPoints(true)
      cosmographRef.current?.setFocusedPoint(undefined)
      cosmographRef.current?.fitView(500, 0.14)
    },
    exportPng: () => cosmographRef.current?.captureScreenshot('knowledge-graph.png', 2),
    pause: () => cosmographRef.current?.pause(),
    resume: () => cosmographRef.current?.unpause(),
    reheat: () => cosmographRef.current?.start(0.8),
  }))

  const handlePointClick = useCallback((index: number) => {
    const point = pointsRef.current[index]
    if (point) onSelectNodeRef.current(point.id)
  }, [])

  const handleLinkClick = useCallback((index: number) => {
    const link = linksRef.current[index]
    if (link) onSelectLinkRef.current(link.id)
  }, [])

  const handleBackgroundClick = useCallback(() => {
    onClearSelectionRef.current()
  }, [])

  useEffect(() => {
    if (!stableConfig || mountedTick === 0) return
    const graph = cosmographRef.current
    if (!graph) return
    let cancelled = false
    void (async () => {
      await graph.dataUploaded()
      if (cancelled) return
      if (selection?.kind === 'node') {
        const indices = await graph.getPointIndicesByIds([selection.id])
        const index = indices?.[0]
        if (index == null || index < 0) return
        if (hop >= 1) {
          const first = graph.getNeighboringPointIndices(index) ?? []
          const second = hop === 2 ? (graph.getNeighboringPointIndices(first) ?? []) : []
          const all = [...new Set([index, ...first, ...second])]
          graph.selectPoints(all, false, false)
          graph.setFocusedPoint(index)
          graph.fitViewByIndices(all, 450, 0.18)
        } else {
          graph.selectPoint(index, false, true)
          graph.setFocusedPoint(index)
          if (focusNonce !== zoomedNonce.current) {
            graph.zoomToPoint(index, 450, 4, true)
            zoomedNonce.current = focusNonce
          }
        }
      } else if (selection?.kind === 'link') {
        const index = linksRef.current.findIndex((link) => link.id === selection.id)
        if (index >= 0) {
          graph.selectLink(index, false, true)
          const endpoints = [linksRef.current[index].source, linksRef.current[index].target]
          const indices = await graph.getPointIndicesByIds(endpoints)
          const valid = (indices ?? []).filter((value) => value != null && value >= 0)
          if (valid.length > 0) graph.fitViewByIndices(valid, 450, 0.22)
        }
      } else {
        graph.unselectAllPoints(true)
        graph.setFocusedPoint(undefined)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [stableConfig, mountedTick, selection, hop, focusNonce])

  const hoveredLink = hoveredLinkId ? (links.find((link) => link.id === hoveredLinkId) ?? null) : null
  const hoverQuote = hoveredLink ? (evidenceQuotes(hoveredLink.triple.raw)[0] ?? '') : ''

  const moveTooltip = (clientX: number, clientY: number, bounds: DOMRect) => {
    const x = Math.min(Math.max(8, clientX - bounds.left + 14), Math.max(8, bounds.width - 280))
    const y = Math.min(Math.max(8, clientY - bounds.top + 16), Math.max(8, bounds.height - 120))
    pointerRef.current = { x, y }
    const tooltip = tooltipRef.current
    if (!tooltip) return
    tooltip.style.left = `${x}px`
    tooltip.style.top = `${y}px`
  }

  useEffect(() => {
    const tooltip = tooltipRef.current
    if (!tooltip) return
    tooltip.style.left = `${pointerRef.current.x}px`
    tooltip.style.top = `${pointerRef.current.y}px`
  }, [hoveredLinkId])

  return (
    <div
      className="absolute inset-0"
      data-testid="graph-canvas"
      onPointerMove={(event) => moveTooltip(event.clientX, event.clientY, event.currentTarget.getBoundingClientRect())}
    >
      {stableConfig ? (
        <Cosmograph
          ref={cosmographRef}
          {...stableConfig}
          backgroundColor="#070b14"
          enableDrag
          enableZoom
          linkDefaultArrows
          linkArrowsSizeScale={1.25}
          curvedLinks
          curvedLinkSegments={8}
          curvedLinkWeight={LINK_CURVE.weight}
          curvedLinkControlPointDistance={LINK_CURVE.controlDistance}
          pointSizeStrategy="degree"
          pointSizeRange={[16, 42]}
          pointDefaultSize={18}
          linkWidthStrategy="direct"
          pointColorByFn={colorFromColumn}
          linkColorByFn={colorFromColumn}
          showTopLabels={false}
          showDynamicLabels={false}
          pointLabelColor="#e2e8f0"
          pointLabelFn={truncateLabel}
          pointGreyoutOpacity={0.15}
          linkGreyoutOpacity={0.06}
          renderHoveredPointRing
          hoveredPointRingColor="#ffffff"
          focusedPointRingColor="#ffffff"
          hoveredPointCursor="pointer"
          fitViewOnInit={false}
          fitViewPadding={0.22}
          onZoom={(_event, userDriven) => {
            if (userDriven) userMovedRef.current = true
          }}
          onSimulationEnd={() => {
            if (!userMovedRef.current) cosmographRef.current?.fitView(700, 0.22)
          }}
          simulationGravity={layout.gravity}
          simulationRepulsion={layout.repulsion}
          simulationLinkSpring={layout.linkSpring}
          simulationLinkDistance={layout.linkDistance}
          simulationFriction={layout.friction}
          onPointClick={handlePointClick}
          onLinkClick={handleLinkClick}
          onBackgroundClick={handleBackgroundClick}
          onLinkMouseOver={(index) => {
            window.clearTimeout(hoverClearRef.current)
            const link = fullLinksRef.current[index]
            if (link) setHoveredLinkId(link.id)
          }}
          onLinkMouseOut={() => {
            window.clearTimeout(hoverClearRef.current)
            hoverClearRef.current = window.setTimeout(() => setHoveredLinkId(null), 80)
          }}
          onMount={() => setMountedTick((value) => value + 1)}
          style={{ width: '100%', height: '100%' }}
        />
      ) : null}
      <RelationLabelOverlay
        graphRef={cosmographRef}
        linksRef={fullLinksRef}
        nodesRef={nodesRef}
        indexByIdRef={indexByIdRef}
        showRelations={showRelationLabels && links.length > 0 && Boolean(stableConfig)}
        showEntities={(showLabels || showDynamicLabels) && nodes.length > 0 && Boolean(stableConfig)}
        selectedLinkId={selection?.kind === 'link' ? selection.id : null}
        selectedNodeId={selection?.kind === 'node' ? selection.id : null}
        hoveredLinkId={hoveredLinkId}
        onSelectLink={onSelectLink}
        onSelectNode={onSelectNode}
        onHoverLink={(id) => {
          window.clearTimeout(hoverClearRef.current)
          setHoveredLinkId(id)
        }}
      />
      {hoveredLink && (
        <div
          ref={tooltipRef}
          className="pointer-events-none absolute z-20 w-64 rounded-xl border border-white/10 bg-slate-950/95 p-3 text-xs shadow-2xl"
          data-testid="edge-tooltip"
        >
          <div className="font-medium text-slate-100">
            {hoveredLink.triple.head}
            <span className="text-slate-500"> → </span>
            <span style={{ color: hoveredLink.color }}>{hoveredLink.relation}</span>
            <span className="text-slate-500"> → </span>
            {hoveredLink.triple.tail}
          </div>
          <div className="mt-1.5 flex items-center gap-2 text-slate-300">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: hoveredLink.color }} />
            {CATEGORY_BY_ID[hoveredLink.category].label}
          </div>
          {hoveredLink.triple.extractionConfidence != null && (
            <div className="mt-1 text-slate-400">Confidence {formatConfidence(hoveredLink.triple.extractionConfidence)}</div>
          )}
          {hoverQuote && <p className="mt-1.5 line-clamp-3 text-slate-300">“{hoverQuote}”</p>}
        </div>
      )}
      {(prepared.isLoading || !stableConfig) && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm text-slate-200 shadow-xl">
            Preparing the graph…
          </div>
        </div>
      )}
      {prepared.error && !prepared.isLoading && (
        <div className="absolute left-1/2 top-4 max-w-md -translate-x-1/2 rounded-xl border border-rose-400/30 bg-rose-950/80 px-4 py-3 text-sm text-rose-100">
          {prepared.error.message}
        </div>
      )}
    </div>
  )
})

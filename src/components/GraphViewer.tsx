import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { Cosmograph, usePreparedCosmographData, type CosmographConfig, type CosmographDataPrepConfig, type CosmographRef } from '@cosmograph/react'
import type { GraphLink, GraphNode, LayoutSettings, Selection } from '../types/graph'

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
  { nodes, links, layout, showLabels, showDynamicLabels, selection, hop, focusNonce, onSelectNode, onSelectLink, onClearSelection },
  ref,
) {
  const cosmographRef = useRef<CosmographRef>(undefined)
  const pointsRef = useRef<PointRecord[]>([])
  const linksRef = useRef<LinkRecord[]>([])
  const onSelectNodeRef = useRef(onSelectNode)
  const onSelectLinkRef = useRef(onSelectLink)
  const onClearSelectionRef = useRef(onClearSelection)
  const [mountedTick, setMountedTick] = useState(0)
  const [stableConfig, setStableConfig] = useState<CosmographConfig | null>(null)
  const zoomedNonce = useRef(0)

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

  return (
    <div className="absolute inset-0" data-testid="graph-canvas">
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
          curvedLinkWeight={0.4}
          pointSizeStrategy="preciseDegree"
          pointSizeRange={[3, 16]}
          linkWidthStrategy="direct"
          pointColorByFn={colorFromColumn}
          linkColorByFn={colorFromColumn}
          showTopLabels={showLabels}
          showTopLabelsLimit={26}
          showDynamicLabels={showDynamicLabels}
          showDynamicLabelsLimit={16}
          pointLabelColor="#e2e8f0"
          pointLabelFn={truncateLabel}
          pointGreyoutOpacity={0.15}
          linkGreyoutOpacity={0.06}
          renderHoveredPointRing
          hoveredPointRingColor="#ffffff"
          focusedPointRingColor="#ffffff"
          hoveredPointCursor="pointer"
          fitViewOnInit
          fitViewDelay={900}
          fitViewPadding={0.16}
          simulationGravity={layout.gravity}
          simulationRepulsion={layout.repulsion}
          simulationLinkSpring={layout.linkSpring}
          simulationLinkDistance={layout.linkDistance}
          simulationFriction={layout.friction}
          onPointClick={handlePointClick}
          onLinkClick={handleLinkClick}
          onBackgroundClick={handleBackgroundClick}
          onMount={() => setMountedTick((value) => value + 1)}
          style={{ width: '100%', height: '100%' }}
        />
      ) : null}
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

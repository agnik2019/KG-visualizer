import { useEffect, useRef, type RefObject } from 'react'
import type { CosmographRef } from '@cosmograph/react'
import type { GraphLink } from '../types/graph'
import { LINK_CURVE, RELATION_LABEL_ALL_MAX, conicPoint, readableAngle, selectRelationLabels } from '../utils/linkLabels'

interface RelationLabelOverlayProps {
  graphRef: RefObject<CosmographRef | undefined>
  linksRef: RefObject<GraphLink[]>
  indexByIdRef: RefObject<Map<string, number>>
  enabled: boolean
  selectedLinkId: string | null
  selectedNodeId: string | null
  hoveredLinkId: string | null
  onSelectLink: (id: string) => void
  onHoverLink: (id: string | null) => void
}

interface Placed {
  link: GraphLink
  x: number
  y: number
  angle: number
  length: number
}

function placeLinks(graph: NonNullable<CosmographRef>, links: GraphLink[], indexById: Map<string, number>): Placed[] {
  const positions = graph.getPointPositions()
  if (!positions || indexById.size === 0) return []
  const placed: Placed[] = []
  for (const link of links) {
    const sourceIndex = indexById.get(link.source)
    const targetIndex = indexById.get(link.target)
    if (sourceIndex == null || targetIndex == null) continue
    const ax = positions[sourceIndex * 2]
    const ay = positions[sourceIndex * 2 + 1]
    const bx = positions[targetIndex * 2]
    const by = positions[targetIndex * 2 + 1]
    if (![ax, ay, bx, by].every((value) => Number.isFinite(value))) continue
    const mid = conicPoint(ax, ay, bx, by, 0.5, LINK_CURVE.weight, LINK_CURVE.controlDistance)
    const ahead = conicPoint(ax, ay, bx, by, 0.62, LINK_CURVE.weight, LINK_CURVE.controlDistance)
    const screen = graph.spaceToScreenPosition([mid.x, mid.y])
    const screenAhead = graph.spaceToScreenPosition([ahead.x, ahead.y])
    const sourceScreen = graph.spaceToScreenPosition([ax, ay])
    const targetScreen = graph.spaceToScreenPosition([bx, by])
    if (!screen || !screenAhead || !sourceScreen || !targetScreen) continue
    placed.push({
      link,
      x: screen[0],
      y: screen[1],
      angle: readableAngle(screenAhead[0] - screen[0], screenAhead[1] - screen[1]),
      length: Math.hypot(targetScreen[0] - sourceScreen[0], targetScreen[1] - sourceScreen[1]),
    })
  }
  return placed
}

function separateParallelLabels(items: Placed[]): void {
  const groups = new Map<string, Placed[]>()
  for (const item of items) {
    const key = `${item.link.source}\0${item.link.target}`
    const group = groups.get(key) ?? []
    group.push(item)
    groups.set(key, group)
  }
  for (const group of groups.values()) {
    if (group.length < 2) continue
    group.forEach((item, index) => {
      const shift = (index - (group.length - 1) / 2) * 16
      const radians = (item.angle * Math.PI) / 180
      item.x += Math.cos(radians + Math.PI / 2) * shift
      item.y += Math.sin(radians + Math.PI / 2) * shift
    })
  }
}

export function RelationLabelOverlay({
  graphRef,
  linksRef,
  indexByIdRef,
  enabled,
  selectedLinkId,
  selectedNodeId,
  hoveredLinkId,
  onSelectLink,
  onHoverLink,
}: RelationLabelOverlayProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const buttonsRef = useRef(new Map<string, HTMLButtonElement>())
  const onSelectRef = useRef(onSelectLink)
  const onHoverRef = useRef(onHoverLink)
  onSelectRef.current = onSelectLink
  onHoverRef.current = onHoverLink

  useEffect(() => {
    if (!enabled) {
      buttonsRef.current.clear()
      if (rootRef.current) rootRef.current.replaceChildren()
      return
    }
    let frame = 0
    const paint = () => {
      frame = requestAnimationFrame(paint)
      const root = rootRef.current
      const graph = graphRef.current
      const links = linksRef.current
      const indexById = indexByIdRef.current
      if (!root || !graph || !links || !indexById) return
      const width = root.clientWidth
      const height = root.clientHeight
      if (width === 0 || height === 0) return
      const placed = placeLinks(graph, links, indexById)
      const ids = new Set(
        selectRelationLabels(
          placed.map((item) => ({
            id: item.link.id,
            source: item.link.source,
            target: item.link.target,
            x: item.x,
            y: item.y,
            length: item.length,
            confidence: item.link.triple.extractionConfidence ?? 0,
          })),
          {
            totalLinks: links.length,
            width,
            height,
            selectedId: selectedLinkId,
            selectedNodeId,
            hoveredId: hoveredLinkId,
          },
        ),
      )
      const visible = placed.filter((item) => ids.has(item.link.id))
      separateParallelLabels(visible)
      const nextIds = new Set(visible.map((item) => item.link.id))
      for (const [id, button] of buttonsRef.current) {
        if (!nextIds.has(id)) {
          button.remove()
          buttonsRef.current.delete(id)
        }
      }
      for (const item of visible) {
        let button = buttonsRef.current.get(item.link.id)
        if (!button) {
          button = document.createElement('button')
          button.type = 'button'
          button.dataset.linkId = item.link.id
          button.dataset.testid = 'relation-label'
          button.className = 'pointer-events-auto absolute left-0 top-0 max-w-[220px] truncate rounded-full border px-2 py-0.5 text-[11px] leading-4 tracking-wide shadow-lg'
          button.addEventListener('click', (event) => {
            event.stopPropagation()
            const id = (event.currentTarget as HTMLButtonElement).dataset.linkId
            if (id) onSelectRef.current(id)
          })
          button.addEventListener('pointerenter', (event) => {
            const id = (event.currentTarget as HTMLButtonElement).dataset.linkId
            if (id) onHoverRef.current(id)
          })
          button.addEventListener('pointerleave', () => onHoverRef.current(null))
          buttonsRef.current.set(item.link.id, button)
          root.append(button)
        }
        const selected = item.link.id === selectedLinkId
        button.textContent = item.link.relation
        button.title = `${item.link.triple.head} → ${item.link.relation} → ${item.link.triple.tail}`
        button.setAttribute('aria-label', button.title)
        button.style.transform = `translate(${item.x}px, ${item.y}px) translate(-50%, -50%) rotate(${item.angle}deg)`
        button.style.color = selected ? '#ffffff' : '#e2e8f0'
        button.style.background = selected ? 'rgba(7, 11, 20, 0.94)' : 'rgba(7, 11, 20, 0.72)'
        button.style.borderColor = selected ? item.link.color : 'rgba(255,255,255,0.16)'
        button.style.boxShadow = selected ? `0 0 0 1px ${item.link.color}` : '0 8px 20px rgba(0,0,0,0.28)'
        button.style.zIndex = selected ? '3' : '1'
        button.style.fontWeight = selected ? '600' : '500'
      }
      let note = root.querySelector<HTMLDivElement>('[data-adaptive-note]')
      if (links.length > RELATION_LABEL_ALL_MAX) {
        if (!note) {
          note = document.createElement('div')
          note.dataset.adaptiveNote = 'true'
          note.className = 'pointer-events-none absolute bottom-4 right-4 rounded-full border border-white/10 bg-slate-950/80 px-3 py-1 text-[11px] text-slate-300'
          root.append(note)
        }
        note.textContent = `${visible.length.toLocaleString()} relation labels · adaptive`
      } else if (note) {
        note.remove()
      }
    }
    frame = requestAnimationFrame(paint)
    return () => cancelAnimationFrame(frame)
  }, [enabled, graphRef, hoveredLinkId, indexByIdRef, linksRef, selectedLinkId, selectedNodeId])

  if (!enabled) return null
  return <div ref={rootRef} className="pointer-events-none absolute inset-0 z-10 overflow-hidden" data-testid="relation-labels" />
}

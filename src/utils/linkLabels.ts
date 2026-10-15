/** Matches the curved-link settings passed to Cosmograph. */
export const LINK_CURVE = { weight: 0.4, controlDistance: 0.5 }

export const RELATION_LABEL_ALL_MAX = 90
export const RELATION_LABEL_CAP = 72

export interface LabelCandidate {
  id: string
  source: string
  target: string
  x: number
  y: number
  length: number
  confidence: number
}

/**
 * Midpoint of Cosmograph's rational quadratic (conic) curve at t = 0.5.
 * Control point sits `controlDistance * length` off the chord, on the left perpendicular.
 */
export function conicMidpoint(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  weight = LINK_CURVE.weight,
  controlDistance = LINK_CURVE.controlDistance,
): { x: number; y: number } {
  const dx = bx - ax
  const dy = by - ay
  const length = Math.hypot(dx, dy) || 1
  const px = -dy / length
  const py = dx / length
  const offset = (weight / (1 + weight)) * length * controlDistance
  return { x: (ax + bx) / 2 + px * offset, y: (ay + by) / 2 + py * offset }
}

export function conicPoint(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  t: number,
  weight = LINK_CURVE.weight,
  controlDistance = LINK_CURVE.controlDistance,
): { x: number; y: number } {
  const dx = bx - ax
  const dy = by - ay
  const length = Math.hypot(dx, dy) || 1
  const px = -dy / length
  const py = dx / length
  const cx = (ax + bx) / 2 + px * length * controlDistance
  const cy = (ay + by) / 2 + py * length * controlDistance
  const omt = 1 - t
  const dividentX = omt * omt * ax + 2 * omt * t * weight * cx + t * t * bx
  const dividentY = omt * omt * ay + 2 * omt * t * weight * cy + t * t * by
  const divisor = omt * omt + 2 * omt * t * weight + t * t
  return { x: dividentX / divisor, y: dividentY / divisor }
}

/** Degrees for CSS rotation, flipped so labels stay upright. */
export function readableAngle(dx: number, dy: number): number {
  let degrees = (Math.atan2(dy, dx) * 180) / Math.PI
  if (degrees > 90 || degrees < -90) degrees += 180
  if (degrees > 180) degrees -= 360
  return degrees
}

function onScreen(candidate: LabelCandidate, width: number, height: number): boolean {
  return candidate.x >= -48 && candidate.y >= -28 && candidate.x <= width + 48 && candidate.y <= height + 28
}

/**
 * Small graphs label every on-screen relationship.
 * Large graphs keep the selection, the hover, a node's incident edges, and the longest remaining edges.
 */
export function selectRelationLabels(
  candidates: LabelCandidate[],
  options: {
    totalLinks: number
    width: number
    height: number
    selectedId?: string | null
    selectedNodeId?: string | null
    hoveredId?: string | null
  },
): string[] {
  const visible = candidates.filter((candidate) => onScreen(candidate, options.width, options.height))
  if (options.totalLinks <= RELATION_LABEL_ALL_MAX) return visible.map((candidate) => candidate.id)

  const byId = new Map(candidates.map((candidate) => [candidate.id, candidate]))
  const chosen: string[] = []
  const seen = new Set<string>()
  const take = (id: string | null | undefined) => {
    if (!id || seen.has(id) || !byId.has(id)) return
    seen.add(id)
    chosen.push(id)
  }
  take(options.selectedId)
  take(options.hoveredId)
  if (options.selectedNodeId) {
    let incident = 0
    for (const candidate of visible) {
      if (candidate.source !== options.selectedNodeId && candidate.target !== options.selectedNodeId) continue
      take(candidate.id)
      incident += 1
      if (incident >= 24) break
    }
  }
  const ranked = visible
    .filter((candidate) => candidate.length >= 72)
    .sort((a, b) => b.length - a.length || b.confidence - a.confidence)
  for (const candidate of ranked) {
    if (chosen.length >= RELATION_LABEL_CAP) break
    take(candidate.id)
  }
  if (chosen.length === 0) {
    const longest = [...visible].sort((a, b) => b.length - a.length).slice(0, 24)
    for (const candidate of longest) take(candidate.id)
  }
  return chosen
}

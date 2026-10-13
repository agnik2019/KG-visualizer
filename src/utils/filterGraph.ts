import type { BuiltGraph, EdgeCategory, Filters, GraphLink, GraphNode, Triple } from '../types/graph'
import { categoryGroup } from './colors'
import { recomputeVisibleDegrees } from './graphTransformer'

export interface FilterResult {
  nodes: GraphNode[]
  links: GraphLink[]
  capped: boolean
  matchedBeforeCap: number
}

export function defaultFilters(): Filters {
  return {
    categories: {
      'original-theory': true,
      'original-practice': true,
      'new-theory-practice': true,
      'new-practice-theory': true,
      'new-theory-theory': true,
      'new-practice-practice': true,
      unknown: true,
    },
    showOriginal: true,
    showNew: true,
    showUnknown: true,
    entityQuery: '',
    relationQuery: '',
    relationAllow: null,
    minConfidence: 0,
    verificationStatus: 'all',
    hop: 0,
    performanceMode: false,
    performanceLimit: 1500,
  }
}

export function defaultLayout() {
  return {
    gravity: 0.22,
    repulsion: 0.9,
    linkSpring: 0.8,
    linkDistance: 14,
    friction: 0.85,
  }
}

function originAllowed(category: EdgeCategory, filters: Filters): boolean {
  const group = categoryGroup(category)
  if (group === 'original') return filters.showOriginal
  if (group === 'new') return filters.showNew
  return filters.showUnknown
}

function neighborhood(links: GraphLink[], seeds: string[], hops: number): Set<string> {
  const adjacent = new Map<string, string[]>()
  for (const link of links) {
    const from = adjacent.get(link.source) ?? []
    from.push(link.target)
    adjacent.set(link.source, from)
    const to = adjacent.get(link.target) ?? []
    to.push(link.source)
    adjacent.set(link.target, to)
  }
  const allowed = new Set(seeds)
  let frontier = [...seeds]
  for (let hop = 0; hop < hops; hop += 1) {
    const next: string[] = []
    for (const id of frontier) {
      for (const neighbor of adjacent.get(id) ?? []) {
        if (!allowed.has(neighbor)) {
          allowed.add(neighbor)
          next.push(neighbor)
        }
      }
    }
    frontier = next
  }
  return allowed
}

export function applyFilters(graph: BuiltGraph, filters: Filters, focusIds: string[]): FilterResult {
  const query = filters.entityQuery.trim().toLowerCase()
  const relationQuery = filters.relationQuery.trim().toLowerCase()
  const allowedRelations = filters.relationAllow ? new Set(filters.relationAllow) : null
  const labels = new Map(graph.nodes.map((node) => [node.id, node.label.toLowerCase()]))

  let links = graph.links.filter((link) => {
    if (!filters.categories[link.category]) return false
    if (!originAllowed(link.category, filters)) return false
    if (relationQuery && !link.relation.toLowerCase().includes(relationQuery)) return false
    if (allowedRelations && !allowedRelations.has(link.relation)) return false
    if (filters.minConfidence > 0) {
      if (link.triple.extractionConfidence == null || link.triple.extractionConfidence < filters.minConfidence) {
        return false
      }
    }
    if (filters.verificationStatus !== 'all') {
      const status = link.triple.verificationStatus
      if (filters.verificationStatus === '__none__') {
        if (status) return false
      } else if (status !== filters.verificationStatus) {
        return false
      }
    }
    if (query) {
      const source = labels.get(link.source) ?? ''
      const target = labels.get(link.target) ?? ''
      if (!source.includes(query) && !target.includes(query)) return false
    }
    return true
  })

  if (filters.hop > 0 && focusIds.length > 0) {
    const allowed = neighborhood(links, focusIds, filters.hop)
    links = links.filter((link) => allowed.has(link.source) && allowed.has(link.target))
  }

  const matchedBeforeCap = links.length
  let capped = false
  if (filters.performanceMode && links.length > filters.performanceLimit) {
    links = [...links].sort((a, b) => (b.triple.extractionConfidence ?? -1) - (a.triple.extractionConfidence ?? -1))
    links = links.slice(0, Math.max(1, filters.performanceLimit))
    capped = true
  }

  const visibleIds = new Set<string>()
  for (const link of links) {
    visibleIds.add(link.source)
    visibleIds.add(link.target)
  }
  if (query) {
    for (const node of graph.nodes) {
      if (node.label.toLowerCase().includes(query)) visibleIds.add(node.id)
    }
  }

  const nodes = recomputeVisibleDegrees(
    graph.nodes.filter((node) => visibleIds.has(node.id)),
    links,
  ).sort((a, b) => b.degree - a.degree || a.label.localeCompare(b.label))

  return { nodes, links, capped, matchedBeforeCap }
}

export function focusIdsFor(selection: { kind: 'node'; id: string } | { kind: 'link'; id: string } | null, links: GraphLink[]): string[] {
  if (!selection) return []
  if (selection.kind === 'node') return [selection.id]
  const link = links.find((item) => item.id === selection.id)
  return link ? [link.source, link.target] : []
}

export function selectDatasetTriples(files: { presetId?: string; source: 'preset' | 'upload'; triples: Triple[] }[], datasetId: string): Triple[] {
  const chosen = files.filter((file) => {
    if (datasetId === 'theory') return file.presetId === 'theory'
    if (datasetId === 'practice') return file.presetId === 'practice'
    if (datasetId === 'combined') return file.presetId === 'theory' || file.presetId === 'practice'
    if (datasetId === 'sample') return file.presetId === 'sample'
    if (datasetId === 'uploads') return file.source === 'upload'
    return true
  })
  return chosen.flatMap((file) => file.triples)
}

export function datasetOptions(files: { presetId?: string; source: 'preset' | 'upload'; triples: Triple[] }[]): { id: string; label: string; count: number }[] {
  const options = [
    { id: 'combined', label: 'Theory + Practice' },
    { id: 'theory', label: 'TheoryKG' },
    { id: 'practice', label: 'PracticeKG' },
    { id: 'sample', label: 'Sample reconciled' },
    { id: 'uploads', label: 'Uploaded files' },
    { id: 'all', label: 'Everything loaded' },
  ]
  return options.map((option) => ({ ...option, count: selectDatasetTriples(files, option.id).length }))
}

export function defaultDatasetId(files: { presetId?: string; source: 'preset' | 'upload'; triples: Triple[] }[]): string {
  const presets = new Set(files.filter((file) => file.triples.length > 0).map((file) => file.presetId))
  if (presets.has('theory') && presets.has('practice')) return 'combined'
  if (presets.has('theory')) return 'theory'
  if (presets.has('practice')) return 'practice'
  if (presets.has('sample')) return 'sample'
  if (files.some((file) => file.source === 'upload' && file.triples.length > 0)) return 'uploads'
  return 'all'
}

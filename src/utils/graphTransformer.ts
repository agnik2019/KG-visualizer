import type { BuiltGraph, GraphLink, GraphNode, Triple } from '../types/graph'
import { NODE_COLORS, sourceLabel } from './colors'

export function buildGraph(triples: Triple[]): BuiltGraph {
  const nodes = new Map<string, GraphNode & { types: Map<string, number> }>()

  const ensure = (id: string, label: string, kg: Triple['headKg'], entityType: string) => {
    const sourceKg = sourceLabel(kg)
    let node = nodes.get(id)
    if (!node) {
      node = {
        id,
        label,
        sourceKg,
        entityType: '',
        color: NODE_COLORS[sourceKg],
        degree: 0,
        inDegree: 0,
        outDegree: 0,
        loadedDegree: 0,
        types: new Map(),
      }
      nodes.set(id, node)
    }
    if (entityType) node.types.set(entityType, (node.types.get(entityType) ?? 0) + 1)
  }

  const links: GraphLink[] = triples.map((triple) => {
    ensure(triple.headNodeId, triple.head, triple.headKg, triple.headType)
    ensure(triple.tailNodeId, triple.tail, triple.tailKg, triple.tailType)
    const source = nodes.get(triple.headNodeId)!
    const target = nodes.get(triple.tailNodeId)!
    source.outDegree += 1
    target.inDegree += 1
    if (triple.headNodeId === triple.tailNodeId) {
      source.degree += 1
    }
    return {
      id: triple.id,
      source: triple.headNodeId,
      target: triple.tailNodeId,
      relation: triple.relation,
      category: triple.category,
      color: triple.color,
      width: triple.extractionConfidence ?? 0.5,
      triple,
    }
  })

  const graphNodes = [...nodes.values()].map((node) => {
    let best = ''
    let bestCount = -1
    for (const [type, count] of node.types) {
      if (count > bestCount) {
        best = type
        bestCount = count
      }
    }
    const degree = node.inDegree + node.outDegree
    return {
      id: node.id,
      label: node.label,
      sourceKg: node.sourceKg,
      entityType: best,
      color: node.color,
      degree,
      inDegree: node.inDegree,
      outDegree: node.outDegree,
      loadedDegree: degree,
    }
  })

  graphNodes.sort((a, b) => b.degree - a.degree || a.label.localeCompare(b.label))
  return { nodes: graphNodes, links }
}

export function recomputeVisibleDegrees(nodes: GraphNode[], links: GraphLink[]): GraphNode[] {
  const stats = new Map<string, { inDegree: number; outDegree: number }>()
  for (const node of nodes) stats.set(node.id, { inDegree: 0, outDegree: 0 })
  for (const link of links) {
    const source = stats.get(link.source)
    const target = stats.get(link.target)
    if (source) source.outDegree += 1
    if (target) target.inDegree += 1
  }
  return nodes.map((node) => {
    const value = stats.get(node.id) ?? { inDegree: 0, outDegree: 0 }
    return {
      ...node,
      inDegree: value.inDegree,
      outDegree: value.outDegree,
      degree: value.inDegree + value.outDegree,
    }
  })
}

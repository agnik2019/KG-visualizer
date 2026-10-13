import type { EdgeCategory, GraphLink, GraphNode, GraphStats, Triple } from '../types/graph'
import { CATEGORIES } from './colors'

function emptyCounts(): Record<EdgeCategory, number> {
  return Object.fromEntries(CATEGORIES.map((category) => [category.id, 0])) as Record<EdgeCategory, number>
}

export function countCategories(links: { category: EdgeCategory }[]): Record<EdgeCategory, number> {
  const counts = emptyCounts()
  for (const link of links) counts[link.category] += 1
  return counts
}

export function connectedComponentCount(nodes: GraphNode[], links: GraphLink[]): number {
  const parent = new Map<string, string>()
  const find = (id: string): string => {
    let current = parent.get(id) ?? id
    if (current !== id) {
      current = find(current)
      parent.set(id, current)
    }
    return current
  }
  const union = (a: string, b: string) => {
    const rootA = find(a)
    const rootB = find(b)
    if (rootA !== rootB) parent.set(rootA, rootB)
  }
  for (const node of nodes) parent.set(node.id, node.id)
  for (const link of links) {
    if (parent.has(link.source) && parent.has(link.target)) union(link.source, link.target)
  }
  const roots = new Set<string>()
  for (const node of nodes) roots.add(find(node.id))
  return roots.size
}

export function computeStats(
  loadedNodes: GraphNode[],
  loadedLinks: GraphLink[],
  visibleNodes: GraphNode[],
  visibleLinks: GraphLink[],
): GraphStats {
  const degreeSum = visibleNodes.reduce((sum, node) => sum + node.degree, 0)
  return {
    loadedNodes: loadedNodes.length,
    loadedLinks: loadedLinks.length,
    visibleNodes: visibleNodes.length,
    visibleLinks: visibleLinks.length,
    categoryCounts: countCategories(visibleLinks),
    loadedCategoryCounts: countCategories(loadedLinks),
    relationCount: new Set(visibleLinks.map((link) => link.relation)).size,
    averageDegree: visibleNodes.length ? degreeSum / visibleNodes.length : 0,
    components: connectedComponentCount(visibleNodes, visibleLinks),
    topEntities: [...visibleNodes].sort((a, b) => b.degree - a.degree || a.label.localeCompare(b.label)).slice(0, 8),
  }
}

export function countTriplesByCategory(triples: Triple[]): Record<EdgeCategory, number> {
  return countCategories(triples)
}

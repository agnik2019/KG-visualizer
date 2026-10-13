import Papa from 'papaparse'
import type { GraphLink } from '../types/graph'
import { CATEGORY_BY_ID } from './colors'

export function triplesToCsv(links: GraphLink[]): string {
  const columns = new Set<string>()
  for (const link of links) {
    for (const key of Object.keys(link.triple.raw)) columns.add(key)
  }
  const derived = ['kg_category', 'edge_origin', 'color_code', 'head_node_id', 'tail_node_id', 'source_file']
  for (const key of derived) columns.add(key)
  const fields = [...columns]

  const rows = links.map((link) => {
    const row: Record<string, string> = {}
    for (const field of fields) row[field] = link.triple.raw[field] ?? ''
    if (!row.kg_category) row.kg_category = CATEGORY_BY_ID[link.category].label
    if (!row.edge_origin) row.edge_origin = link.triple.edgeOrigin
    if (!row.color_code) row.color_code = link.color
    row.head_node_id = link.source
    row.tail_node_id = link.target
    row.source_file = link.triple.fileName
    return row
  })

  return Papa.unparse({ fields, data: rows })
}

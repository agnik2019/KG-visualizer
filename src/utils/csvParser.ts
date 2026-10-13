import Papa from 'papaparse'
import type { FileHint, Triple } from '../types/graph'
import { classifyRelationship } from './colors'
import { nodeIdFor } from './colors'

export interface ParseOptions {
  fileId: string
  fileName: string
  fileHint: FileHint
}

export interface ParseResult {
  triples: Triple[]
  errors: string[]
  warnings: string[]
}

const REQUIRED = ['head', 'relation', 'tail'] as const

function cell(row: Record<string, string>, columns: Map<string, string>, key: string): string {
  const header = columns.get(key)
  if (!header) return ''
  const value = row[header]
  return value == null ? '' : String(value).trim()
}

function rawRecord(row: Record<string, string>): Record<string, string> {
  const raw: Record<string, string> = {}
  for (const [key, value] of Object.entries(row)) {
    if (!key || key.startsWith('__parsed_extra')) continue
    raw[key] = value == null ? '' : String(value)
  }
  return raw
}

function parseNumber(value: string): number | null {
  if (!value.trim()) return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

export function parseKnowledgeCsv(csvText: string, options: ParseOptions): ParseResult {
  const text = csvText.replace(/^\uFEFF/, '')
  if (text.trimStart().startsWith('<')) {
    return {
      triples: [],
      errors: [`${options.fileName} is not a CSV file.`],
      warnings: [],
    }
  }

  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: (header) => header.trim(),
  })

  const fields = (parsed.meta.fields ?? []).filter((field) => field && !field.startsWith('__parsed_extra'))
  const columns = new Map<string, string>()
  for (const field of fields) {
    const key = field.toLowerCase()
    if (!columns.has(key)) columns.set(key, field)
  }

  const missing = REQUIRED.filter((key) => !columns.has(key))
  if (missing.length > 0) {
    return {
      triples: [],
      errors: [`${options.fileName} is missing required columns: ${missing.join(', ')}.`],
      warnings: [],
    }
  }

  const warnings: string[] = []
  const fatal = parsed.errors.filter((error) => error.type === 'Quotes' || error.type === 'FieldMismatch')
  if (fatal.length > 0) {
    const sample = fatal
      .slice(0, 3)
      .map((error) => `row ${error.row ?? '?'}: ${error.message}`)
      .join('; ')
    warnings.push(`${options.fileName} has ${fatal.length} parse warning${fatal.length === 1 ? '' : 's'} (${sample}). Readable rows were kept.`)
  }

  const triples: Triple[] = []
  let skipped = 0
  const seenIds = new Set<string>()

  parsed.data.forEach((row, index) => {
    if (!row || typeof row !== 'object') {
      skipped += 1
      return
    }
    const head = cell(row, columns, 'head')
    const relation = cell(row, columns, 'relation')
    const tail = cell(row, columns, 'tail')
    if (!head || !relation || !tail) {
      skipped += 1
      return
    }

    const colorCode = cell(row, columns, 'color_code') || cell(row, columns, 'color-code')
    const classification = classifyRelationship({
      kgCategory: cell(row, columns, 'kg_category'),
      headKg: cell(row, columns, 'head_kg'),
      tailKg: cell(row, columns, 'tail_kg'),
      edgeOrigin: cell(row, columns, 'edge_origin'),
      colorCode,
      fileHint: options.fileHint,
    })

    let id = cell(row, columns, 'triple_id') || `${options.fileId}:${index + 1}`
    if (seenIds.has(id)) id = `${id}::${options.fileId}:${index + 1}`
    seenIds.add(id)

    const confidence = parseNumber(cell(row, columns, 'extraction_confidence'))
    triples.push({
      id,
      head,
      relation,
      tail,
      headType: cell(row, columns, 'head_type'),
      tailType: cell(row, columns, 'tail_type'),
      headNodeId: nodeIdFor(head, classification.headKg),
      tailNodeId: nodeIdFor(tail, classification.tailKg),
      headKg: classification.headKg,
      tailKg: classification.tailKg,
      category: classification.category,
      color: classification.color,
      edgeOrigin: classification.edgeOrigin,
      extractionConfidence: confidence,
      verdict: cell(row, columns, 'verdict'),
      verdictConfidence: parseNumber(cell(row, columns, 'verdict_confidence')),
      verificationStatus: cell(row, columns, 'verification_status'),
      fileId: options.fileId,
      fileName: options.fileName,
      raw: rawRecord(row),
    })
  })

  if (skipped > 0) {
    warnings.push(`${options.fileName}: skipped ${skipped} row${skipped === 1 ? '' : 's'} missing head, relation, or tail.`)
  }
  if (triples.length === 0 && skipped === 0) {
    warnings.push(`${options.fileName} did not contain any data rows.`)
  }

  return { triples, errors: [], warnings }
}

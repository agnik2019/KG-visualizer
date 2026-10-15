import Papa from 'papaparse'
import type { EdgeCategory, FileHint, Triple } from '../types/graph'
import { CATEGORY_BY_ID, classificationForSlot, classifyRelationship, kgDisplay, nodeIdFor, slotConflictReasons, slotProfile, type SlotProfile } from './colors'

export interface ParseOptions {
  fileId: string
  fileName: string
  fileHint: FileHint
  /** Dedicated upload slot. Classification comes from the slot, not the filename. */
  slot?: Exclude<EdgeCategory, 'unknown'>
  /**
   * `hold` omits rows whose provenance disagrees with the slot.
   * `apply-slot` writes the slot category onto those rows after the user confirms it.
   */
  slotConflictPolicy?: 'hold' | 'apply-slot'
}

export interface RowConflict {
  row: number
  head: string
  relation: string
  tail: string
  reasons: string[]
}

export interface ParseResult {
  triples: Triple[]
  errors: string[]
  warnings: string[]
  conflicts: RowConflict[]
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
      conflicts: [],
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
      conflicts: [],
    }
  }

  const warnings: string[] = []
  const conflicts: RowConflict[] = []
  const slot = options.slot ? slotProfile(options.slot) : null
  const applyConflicts = options.slotConflictPolicy === 'apply-slot'
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
    const provenance = {
      kgCategory: cell(row, columns, 'kg_category'),
      headKg: cell(row, columns, 'head_kg'),
      tailKg: cell(row, columns, 'tail_kg'),
      edgeOrigin: cell(row, columns, 'edge_origin'),
    }
    const reasons = slot ? slotConflictReasons(provenance, slot) : []
    if (slot && reasons.length > 0 && !applyConflicts) {
      conflicts.push({ row: index + 2, head, relation, tail, reasons })
      return
    }
    const classification = slot
      ? classificationForSlot(slot, colorCode)
      : classifyRelationship({
          ...provenance,
          colorCode,
          fileHint: options.fileHint,
        })
    const raw = rawRecord(row)
    if (slot) stampSlot(raw, slot, options.fileName, reasons.length > 0)

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
      raw,
    })
  })

  if (skipped > 0) {
    warnings.push(`${options.fileName}: skipped ${skipped} row${skipped === 1 ? '' : 's'} missing head, relation, or tail.`)
  }
  if (conflicts.length > 0) {
    warnings.push(
      `${options.fileName}: ${conflicts.length} row${conflicts.length === 1 ? '' : 's'} conflict with the selected upload slot and were not loaded.`,
    )
  }
  if (triples.length === 0 && skipped === 0 && conflicts.length === 0) {
    warnings.push(`${options.fileName} did not contain any data rows.`)
  }

  return { triples, errors: [], warnings, conflicts }
}

function writeField(raw: Record<string, string>, key: string, value: string, overwrite: boolean): void {
  const existing = Object.keys(raw).find((header) => header.toLowerCase() === key)
  const target = existing ?? key
  if (overwrite || !raw[target]?.trim()) raw[target] = value
}

function stampSlot(raw: Record<string, string>, slot: SlotProfile, fileName: string, overwrite: boolean): void {
  const meta = CATEGORY_BY_ID[slot.category]
  writeField(raw, 'kg_category', meta.label, overwrite)
  writeField(raw, 'edge_origin', slot.origin, overwrite)
  writeField(raw, 'head_kg', kgDisplay(slot.headKg), overwrite)
  writeField(raw, 'tail_kg', kgDisplay(slot.tailKg), overwrite)
  const colorHeader = Object.keys(raw).find((header) => header.toLowerCase() === 'color_code' || header.toLowerCase() === 'color-code')
  if (!colorHeader || !raw[colorHeader]?.trim()) raw.color_code = meta.color
  raw.source_file = fileName
}

import Papa from 'papaparse'
import { parseStringList } from './format'

export interface ContextIndex {
  byUnit: Map<string, string[]>
  bySource: Map<string, string[]>
  fileName: string
  count: number
}

export interface ContextParseResult {
  index: ContextIndex
  errors: string[]
  warnings: string[]
}

export function emptyContextIndex(): ContextIndex {
  return { byUnit: new Map(), bySource: new Map(), fileName: '', count: 0 }
}

function add(map: Map<string, string[]>, key: string, text: string): void {
  const id = key.trim()
  if (!id || !text.trim()) return
  const list = map.get(id) ?? []
  if (!list.includes(text)) list.push(text)
  map.set(id, list)
}

export function parseContextCsv(csvText: string, fileName: string): ContextParseResult {
  const text = csvText.replace(/^\uFEFF/, '')
  if (text.trimStart().startsWith('<')) {
    return { index: emptyContextIndex(), errors: [`${fileName} is not a CSV file.`], warnings: [] }
  }
  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: (header) => header.trim(),
  })
  const fields = parsed.meta.fields ?? []
  const columns = new Map<string, string>()
  for (const field of fields) {
    const key = field.toLowerCase()
    if (!columns.has(key)) columns.set(key, field)
  }
  const textHeader = columns.get('context_text') ?? columns.get('context') ?? columns.get('original_context') ?? columns.get('source_text')
  if (!textHeader) {
    return {
      index: emptyContextIndex(),
      errors: [`${fileName} needs a context_text column.`],
      warnings: [],
    }
  }
  if (!columns.has('context_unit_id') && !columns.has('source_id')) {
    return {
      index: emptyContextIndex(),
      errors: [`${fileName} needs context_unit_id or source_id so triples can find a passage.`],
      warnings: [],
    }
  }

  const index = emptyContextIndex()
  index.fileName = fileName
  let skipped = 0
  for (const row of parsed.data) {
    if (!row || typeof row !== 'object') {
      skipped += 1
      continue
    }
    const passage = String(row[textHeader] ?? '').trim()
    const unit = columns.get('context_unit_id') ? String(row[columns.get('context_unit_id')!] ?? '').trim() : ''
    const source = columns.get('source_id') ? String(row[columns.get('source_id')!] ?? '').trim() : ''
    if (!passage || (!unit && !source)) {
      skipped += 1
      continue
    }
    add(index.byUnit, unit, passage)
    add(index.bySource, source, passage)
    index.count += 1
  }
  const warnings: string[] = []
  if (skipped > 0) warnings.push(`${fileName}: skipped ${skipped} context row${skipped === 1 ? '' : 's'} without an id and passage.`)
  if (index.count === 0) warnings.push(`${fileName} did not contain any context passages.`)
  return { index, errors: [], warnings }
}

const CONTEXT_FIELDS = ['context', 'context_text', 'source_text', 'original_context'] as const
const LOOKUP_FIELDS = ['context_unit_id', 'context_id', 'paper_id', 'source_podcast_id', 'podcast_id', 'episode_id', 'source_id', 'document_id'] as const

export function rawField(raw: Record<string, string>, ...names: string[]): string {
  for (const name of names) {
    const header = Object.keys(raw).find((key) => key.toLowerCase() === name)
    const value = header ? String(raw[header] ?? '').trim() : ''
    if (value) return value
  }
  return ''
}

function field(raw: Record<string, string>, name: string): string {
  return rawField(raw, name)
}

/** Evidence quotes from either the plural research column or a single quote column. */
export function evidenceQuotes(raw: Record<string, string>): string[] {
  const values = ['evidence_quotes', 'evidence_quote', 'original_evidence_quote'].flatMap((name) => parseStringList(field(raw, name)))
  return [...new Set(values.map((quote) => quote.trim()).filter((quote) => quote && quote !== '[]'))]
}

function passages(map: Map<string, string[]>, key: string): string[] {
  if (!key) return []
  return map.get(key) ?? []
}

/**
 * Full original passage for a triple. Direct context columns win.
 * A short `text` note is used only when it actually contains an evidence quote.
 * Nothing is invented when no passage is present.
 */
export function resolveExtractionContext(raw: Record<string, string>, index: ContextIndex, quotes: string[]): string {
  const direct = CONTEXT_FIELDS.map((name) => field(raw, name)).filter(Boolean)
  if (direct.length > 0) return [...new Set(direct)].join('\n\n')

  const lookedUp: string[] = []
  for (const name of LOOKUP_FIELDS) {
    lookedUp.push(...passages(index.byUnit, field(raw, name)), ...passages(index.bySource, field(raw, name)))
  }
  for (const evidenceId of parseStringList(field(raw, 'evidence_ids'))) {
    lookedUp.push(...passages(index.byUnit, evidenceId), ...passages(index.bySource, evidenceId))
  }
  const unique = [...new Set(lookedUp.map((item) => item.trim()).filter(Boolean))]
  if (unique.length > 0) return unique.join('\n\n')

  const note = field(raw, 'text')
  if (note && quotes.some((quote) => note.includes(quote.trim()))) return note
  return ''
}

export interface TextSegment {
  text: string
  match: boolean
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function findQuote(context: string, quote: string): [number, number] | null {
  const needle = quote.trim()
  if (!needle) return null
  const exact = context.indexOf(needle)
  if (exact >= 0) return [exact, exact + needle.length]
  const parts = needle.split(/\s+/).filter(Boolean).map(escapeRegExp)
  if (parts.length === 0) return null
  const match = new RegExp(parts.join('\\s+'), 'i').exec(context)
  if (!match) return null
  return [match.index, match.index + match[0].length]
}

export function highlightQuotes(context: string, quotes: string[]): { segments: TextSegment[]; unmatched: string[] } {
  const ranges: { start: number; end: number; quote: string }[] = []
  const unmatched: string[] = []
  for (const quote of quotes) {
    const found = findQuote(context, quote)
    if (!found) {
      unmatched.push(quote)
      continue
    }
    ranges.push({ start: found[0], end: found[1], quote })
  }
  ranges.sort((a, b) => a.start - b.start || a.end - b.end)
  const accepted: { start: number; end: number }[] = []
  for (const range of ranges) {
    const overlaps = accepted.some((item) => range.start < item.end && range.end > item.start)
    if (overlaps) continue
    accepted.push(range)
  }
  const segments: TextSegment[] = []
  let cursor = 0
  for (const range of accepted) {
    if (range.start > cursor) segments.push({ text: context.slice(cursor, range.start), match: false })
    segments.push({ text: context.slice(range.start, range.end), match: true })
    cursor = range.end
  }
  if (cursor < context.length) segments.push({ text: context.slice(cursor), match: false })
  if (segments.length === 0) segments.push({ text: context, match: false })
  return { segments, unmatched }
}

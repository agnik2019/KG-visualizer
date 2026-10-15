import { describe, expect, it } from 'vitest'
import { parseKnowledgeCsv } from './csvParser'
import { highlightQuotes, parseContextCsv, resolveExtractionContext } from './context'
import { viewPresetPatch } from './filterGraph'
import { conicMidpoint, selectRelationLabels } from './linkLabels'
import { buildGraph } from './graphTransformer'

describe('six upload slots', () => {
  it('classifies a file from the slot even when the filename says TheoryKG', () => {
    const csv = 'head,relation,tail\nBrand Trust,Supports,Host Advice\n'
    const parsed = parseKnowledgeCsv(csv, {
      fileId: 'slot-new-theory-practice',
      fileName: 'theorykg.csv',
      fileHint: 'original-theory',
      slot: 'new-theory-practice',
    })
    expect(parsed.conflicts).toEqual([])
    expect(parsed.triples[0]).toMatchObject({
      category: 'new-theory-practice',
      color: '#F59E0B',
      edgeOrigin: 'new',
      headKg: 'theory',
      tailKg: 'practice',
      headNodeId: 'Theory::Brand Trust',
      tailNodeId: 'Practice::Host Advice',
    })
    expect(parsed.triples[0].raw).toMatchObject({
      kg_category: 'New Theory → Practice',
      edge_origin: 'new',
      head_kg: 'TheoryKG',
      tail_kg: 'PracticeKG',
      source_file: 'theorykg.csv',
    })
  })

  it('keeps an explicit color and does not silently relabel a conflicting row', () => {
    const csv = [
      'head,relation,tail,kg_category,edge_origin,head_kg,tail_kg,color_code',
      'A,Causes,B,Original TheoryKG,original,theory,theory,#112233',
      'C,Supports,D,New Theory → Practice,new,theory,practice,#445566',
    ].join('\n')
    const held = parseKnowledgeCsv(csv, {
      fileId: 'slot',
      fileName: 'mixed.csv',
      fileHint: 'unspecified',
      slot: 'new-theory-practice',
    })
    expect(held.triples).toHaveLength(1)
    expect(held.triples[0].head).toBe('C')
    expect(held.conflicts).toHaveLength(1)
    expect(held.conflicts[0].reasons.join(' ')).toMatch(/Original TheoryKG/)
    expect(held.triples[0].raw.kg_category).toBe('New Theory → Practice')

    const applied = parseKnowledgeCsv(csv, {
      fileId: 'slot',
      fileName: 'mixed.csv',
      fileHint: 'unspecified',
      slot: 'new-theory-practice',
      slotConflictPolicy: 'apply-slot',
    })
    expect(applied.conflicts).toEqual([])
    expect(applied.triples).toHaveLength(2)
    expect(applied.triples[0]).toMatchObject({ category: 'new-theory-practice', color: '#112233', headKg: 'theory', tailKg: 'practice' })
    expect(applied.triples[0].raw.kg_category).toBe('New Theory → Practice')
    expect(applied.triples[0].raw.edge_origin).toBe('new')
  })

  it('keeps parallel slot triples distinct', () => {
    const csv = 'head,relation,tail\nTrust,Supports,Advice\nTrust,Motivates,Advice\n'
    const parsed = parseKnowledgeCsv(csv, {
      fileId: 'slot-new-practice-practice',
      fileName: 'again.csv',
      fileHint: 'unspecified',
      slot: 'new-practice-practice',
    })
    const graph = buildGraph(parsed.triples)
    expect(graph.links.map((link) => link.relation).sort()).toEqual(['Motivates', 'Supports'])
    expect(graph.nodes.map((node) => node.id).sort()).toEqual(['Practice::Advice', 'Practice::Trust'])
  })
})

describe('extraction context', () => {
  it('highlights multiple quotes and preserves line breaks', () => {
    const context = 'First sentence about trust.\nTrust established in theory is used when hosts recommend products.\nA second quote lives here.'
    const result = highlightQuotes(context, [
      'Trust established in theory is used when hosts recommend products.',
      'A second quote lives here.',
      'missing quote',
    ])
    expect(result.unmatched).toEqual(['missing quote'])
    expect(result.segments.filter((segment) => segment.match).map((segment) => segment.text)).toEqual([
      'Trust established in theory is used when hosts recommend products.',
      'A second quote lives here.',
    ])
    expect(result.segments.map((segment) => segment.text).join('')).toBe(context)
  })

  it('loads a context CSV and leaves a triple without a match blank', () => {
    const csv = 'context_unit_id,source_id,context_text\nCU_1,paper-1,"Full paragraph with the quote inside."\n'
    const parsed = parseContextCsv(csv, 'context.csv')
    expect(parsed.errors).toEqual([])
    expect(parsed.index.count).toBe(1)
    const found = resolveExtractionContext({ context_unit_id: 'CU_1', evidence_quotes: '["the quote"]' }, parsed.index, ['the quote'])
    expect(found).toContain('Full paragraph')
    const missing = resolveExtractionContext({ evidence_quotes: '["only a quote"]', text: 'short note' }, parsed.index, ['only a quote'])
    expect(missing).toBe('')
  })

  it('parses quoted commas inside a context passage', () => {
    const csv = 'context_unit_id,context_text\nCU_9,"She said ""hello, world"" and continued."\n'
    const parsed = parseContextCsv(csv, 'quoted.csv')
    expect(parsed.index.byUnit.get('CU_9')?.[0]).toBe('She said "hello, world" and continued.')
  })
})

describe('relation labels and view presets', () => {
  it('offsets the curve midpoint away from the straight chord', () => {
    const mid = conicMidpoint(0, 0, 10, 0)
    expect(mid.x).toBeCloseTo(5)
    expect(Math.abs(mid.y)).toBeGreaterThan(1)
  })

  it('shows every label on a small graph and caps a large one without dropping the selection', () => {
    const small = selectRelationLabels(
      [
        { id: 'a', source: '1', target: '2', x: 10, y: 10, length: 40, confidence: 0.4 },
        { id: 'b', source: '1', target: '2', x: 12, y: 12, length: 40, confidence: 0.9 },
      ],
      { totalLinks: 2, width: 800, height: 600 },
    )
    expect(small.sort()).toEqual(['a', 'b'])

    const many = Array.from({ length: 200 }, (_, index) => ({
      id: `l${index}`,
      source: `s${index}`,
      target: `t${index}`,
      x: 20 + (index % 20) * 30,
      y: 20 + Math.floor(index / 20) * 40,
      length: index === 0 ? 20 : 100,
      confidence: index / 200,
    }))
    const selected = selectRelationLabels(many, {
      totalLinks: many.length,
      width: 900,
      height: 700,
      selectedId: 'l0',
    })
    expect(selected).toContain('l0')
    expect(selected.length).toBeLessThanOrEqual(72)
    expect(selected.length).toBeGreaterThan(1)
  })

  it('builds original, reconciled, cross-graph, and within-graph views', () => {
    expect(viewPresetPatch('original')).toMatchObject({
      showOriginal: true,
      showNew: false,
      categories: { 'original-theory': true, 'new-theory-theory': false, 'new-theory-practice': false },
    })
    expect(viewPresetPatch('reconciled').categories['new-practice-practice']).toBe(true)
    expect(viewPresetPatch('reconciled').categories['original-theory']).toBe(false)
    expect(viewPresetPatch('cross').categories).toMatchObject({
      'new-theory-practice': true,
      'new-practice-theory': true,
      'new-theory-theory': false,
      'original-practice': false,
    })
    expect(viewPresetPatch('within').categories).toMatchObject({
      'original-theory': true,
      'new-theory-theory': true,
      'new-practice-practice': true,
      'new-theory-practice': false,
    })
    expect(viewPresetPatch('all').showUnknown).toBe(true)
  })
})

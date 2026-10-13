import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parseKnowledgeCsv } from './csvParser'
import { classifyRelationship, inferFileHint } from './colors'
import { buildGraph } from './graphTransformer'
import { applyFilters, defaultFilters } from './filterGraph'

describe('classifyRelationship', () => {
  it('keeps original files on their own palette without provenance columns', () => {
    const theory = classifyRelationship({ fileHint: 'original-theory' })
    const practice = classifyRelationship({ fileHint: 'original-practice' })
    expect(theory).toMatchObject({ category: 'original-theory', color: '#8B5CF6', headKg: 'theory', tailKg: 'theory' })
    expect(practice).toMatchObject({ category: 'original-practice', color: '#22C55E', headKg: 'practice', tailKg: 'practice' })
  })

  it('derives new cross-graph categories from head_kg and tail_kg', () => {
    expect(classifyRelationship({ fileHint: 'unspecified', headKg: 'theory', tailKg: 'practice', edgeOrigin: 'new' }).category).toBe(
      'new-theory-practice',
    )
    expect(classifyRelationship({ fileHint: 'unspecified', headKg: 'PracticeKG', tailKg: 'TheoryKG', edgeOrigin: 'reconciled' })).toMatchObject({
      category: 'new-practice-theory',
      color: '#06B6D4',
    })
  })

  it('does not treat same-KG edges as original without an explicit origin', () => {
    const result = classifyRelationship({ fileHint: 'unspecified', headKg: 'theory', tailKg: 'theory' })
    expect(result.category).toBe('unknown')
    expect(result.color).toBe('#94A3B8')
  })

  it('classifies new same-KG edges only when they are marked new', () => {
    expect(classifyRelationship({ fileHint: 'unspecified', headKg: 'theory', tailKg: 'theory', edgeOrigin: 'new' })).toMatchObject({
      category: 'new-theory-theory',
      color: '#EF4444',
    })
    expect(classifyRelationship({ fileHint: 'unspecified', headKg: 'practice', tailKg: 'practice', edgeOrigin: 'new' }).category).toBe(
      'new-practice-practice',
    )
  })

  it('lets an explicit category and color code override inference', () => {
    const result = classifyRelationship({
      fileHint: 'original-theory',
      kgCategory: 'New Practice → Theory',
      headKg: 'theory',
      tailKg: 'theory',
      colorCode: 'color-placeholder',
    })
    expect(result.category).toBe('new-practice-theory')

    const colored = classifyRelationship({
      fileHint: 'unspecified',
      kgCategory: 'New Theory → Practice',
      colorCode: '#e11d48',
    })
    expect(colored.category).toBe('new-theory-practice')
    expect(colored.color).toBe('#E11D48')
  })

  it('does not guess a filename that mentions both graphs', () => {
    expect(inferFileHint('theorykg.csv')).toBe('original-theory')
    expect(inferFileHint('PracticeKG.csv')).toBe('original-practice')
    expect(inferFileHint('reconciled-theory-practice.csv')).toBe('unspecified')
  })
})

describe('parseKnowledgeCsv', () => {
  it('parses quoted commas, newlines, escaped quotes, and unicode', () => {
    const csv = [
      'triple_id,head,relation,tail,evidence_quotes,extraction_confidence',
      '1,"trust, calibrated",Causes,"尾部实体","[""line one"", ""she said ""hello""""]",0.8',
      '2,alpha,RelatedTo,"beta',
      'gamma",[],',
      'orphan,Relates,',
      '',
    ].join('\n')
    const result = parseKnowledgeCsv(csv, { fileId: 'f', fileName: 'demo.csv', fileHint: 'unspecified' })
    expect(result.errors).toEqual([])
    expect(result.triples).toHaveLength(2)
    expect(result.triples[0]).toMatchObject({ head: 'trust, calibrated', tail: '尾部实体', relation: 'Causes' })
    expect(result.triples[0].raw.evidence_quotes).toContain('hello')
    expect(result.triples[1].tail).toBe('beta\ngamma')
    expect(result.warnings.some((warning) => warning.includes('skipped 1'))).toBe(true)
  })

  it('rejects files that lack required columns without throwing', () => {
    const result = parseKnowledgeCsv('foo,bar\n1,2\n', { fileId: 'f', fileName: 'bad.csv', fileHint: 'unspecified' })
    expect(result.triples).toEqual([])
    expect(result.errors[0]).toMatch(/missing required columns: head, relation, tail/)
  })

  it('accepts the color-code alias and keeps parallel triples', () => {
    const csv = [
      'head,relation,tail,head_kg,tail_kg,edge_origin,color-code,triple_id',
      'Trust,Supports,Action,theory,practice,new,#00ffaa,same',
      'Trust,Enables,Action,theory,practice,new,#00ffaa,same',
    ].join('\n')
    const result = parseKnowledgeCsv(csv, { fileId: 'upload', fileName: 'new.csv', fileHint: 'unspecified' })
    expect(result.triples).toHaveLength(2)
    expect(result.triples[0].color).toBe('#00FFAA')
    expect(result.triples[0].id).not.toBe(result.triples[1].id)
    expect(result.triples[0].headNodeId).toBe('Theory::Trust')
    expect(result.triples[0].tailNodeId).toBe('Practice::Action')
    const graph = buildGraph(result.triples)
    expect(graph.links).toHaveLength(2)
    expect(graph.nodes.map((node) => node.id).sort()).toEqual(['Practice::Action', 'Theory::Trust'])
  })

  it('does not merge the same label across TheoryKG and PracticeKG', () => {
    const theory = parseKnowledgeCsv('head,relation,tail\nTrust,Causes,Outcome\n', {
      fileId: 't',
      fileName: 'theorykg.csv',
      fileHint: 'original-theory',
    })
    const practice = parseKnowledgeCsv('head,relation,tail\nTrust,UsedFor,Outcome\n', {
      fileId: 'p',
      fileName: 'practicekg.csv',
      fileHint: 'original-practice',
    })
    const graph = buildGraph([...theory.triples, ...practice.triples])
    expect(graph.nodes.map((node) => node.id).sort()).toEqual([
      'Practice::Outcome',
      'Practice::Trust',
      'Theory::Outcome',
      'Theory::Trust',
    ])
    expect(graph.links).toHaveLength(2)
  })

  it('loads the repository TheoryKG and PracticeKG files', () => {
    const theoryCsv = readFileSync('theorykg.csv', 'utf8')
    const practiceCsv = readFileSync('practicekg.csv', 'utf8')
    const theory = parseKnowledgeCsv(theoryCsv, { fileId: 'theory', fileName: 'theorykg.csv', fileHint: 'original-theory' })
    const practice = parseKnowledgeCsv(practiceCsv, { fileId: 'practice', fileName: 'practicekg.csv', fileHint: 'original-practice' })
    expect(theory.errors).toEqual([])
    expect(practice.errors).toEqual([])
    expect(theory.triples).toHaveLength(1956)
    expect(practice.triples).toHaveLength(4)
    expect(new Set(theory.triples.map((triple) => triple.category))).toEqual(new Set(['original-theory']))
    expect(new Set(practice.triples.map((triple) => triple.category))).toEqual(new Set(['original-practice']))
    expect(theory.triples.every((triple) => triple.color === '#8B5CF6')).toBe(true)
    expect(practice.triples.every((triple) => triple.color === '#22C55E')).toBe(true)
    expect(practice.triples.every((triple) => triple.headNodeId.startsWith('Practice::'))).toBe(true)
    expect(theory.triples[0].raw.verification_explanation.length).toBeGreaterThan(20)
    expect(practice.triples[0].raw.ep_title).toContain('Marketing')

    const graph = buildGraph([...theory.triples, ...practice.triples])
    expect(graph.links).toHaveLength(1960)
    expect(graph.nodes.some((node) => node.id.startsWith('Theory::'))).toBe(true)
    expect(graph.nodes.some((node) => node.id.startsWith('Practice::'))).toBe(true)
  })
})

describe('sample reconciled dataset', () => {
  it('covers every new category, an override color, and an unclassified same-KG edge', () => {
    const csv = readFileSync('public/data/sample-reconciled.csv', 'utf8')
    const parsed = parseKnowledgeCsv(csv, { fileId: 'sample', fileName: 'sample-reconciled.csv', fileHint: 'unspecified' })
    expect(parsed.errors).toEqual([])
    const byId = Object.fromEntries(parsed.triples.map((triple) => [triple.id, triple]))
    expect(byId.NX_001.category).toBe('new-theory-practice')
    expect(byId.NX_001.color).toBe('#F59E0B')
    expect(byId.NX_003.category).toBe('new-practice-theory')
    expect(byId.NX_004).toMatchObject({ category: 'new-theory-theory', color: '#EF4444' })
    expect(byId.NX_005).toMatchObject({ category: 'new-practice-practice', color: '#EC4899' })
    expect(byId.NX_006.category).toBe('unknown')
    expect(byId.NX_007).toMatchObject({ category: 'new-theory-practice', color: '#E11D48' })
    expect(byId.NX_008.category).toBe('unknown')
    expect(byId.NX_001.headNodeId).toBe(byId.NX_002.headNodeId)
    expect(parsed.triples.filter((triple) => triple.head === 'consumer trust' && triple.tail === 'host recommendation')).toHaveLength(2)
  })
})

describe('applyFilters', () => {
  it('filters by category, confidence, and hop while keeping parallel edges', () => {
    const csv = [
      'head,relation,tail,head_kg,tail_kg,edge_origin,extraction_confidence,triple_id',
      'A,Causes,B,theory,theory,original,0.9,1',
      'A,Supports,B,theory,theory,original,0.2,2',
      'B,LeadsTo,C,theory,theory,original,0.8,3',
      'C,Informs,D,practice,theory,new,0.7,4',
    ].join('\n')
    const parsed = parseKnowledgeCsv(csv, { fileId: 'f', fileName: 'mixed.csv', fileHint: 'unspecified' })
    const graph = buildGraph(parsed.triples)
    const filters = defaultFilters()
    filters.minConfidence = 0.5
    filters.categories['new-practice-theory'] = false
    const visible = applyFilters(graph, filters, [])
    expect(visible.links.map((link) => link.id).sort()).toEqual(['1', '3'])

    filters.hop = 1
    const neighborhood = applyFilters(graph, filters, ['Theory::B'])
    expect(new Set(neighborhood.links.map((link) => link.id))).toEqual(new Set(['1', '3']))
    expect(neighborhood.nodes.map((node) => node.id).sort()).toEqual(['Theory::A', 'Theory::B', 'Theory::C'])
  })
})

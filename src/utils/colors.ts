import type { EdgeCategory, EdgeOrigin, FileHint, KgName } from '../types/graph'

export interface CategoryMeta {
  id: EdgeCategory
  label: string
  short: string
  color: string
  group: 'original' | 'new' | 'unknown'
}

export const CATEGORIES: CategoryMeta[] = [
  { id: 'original-theory', label: 'Original TheoryKG', short: 'Theory', color: '#8B5CF6', group: 'original' },
  { id: 'original-practice', label: 'Original PracticeKG', short: 'Practice', color: '#22C55E', group: 'original' },
  { id: 'new-theory-practice', label: 'New Theory → Practice', short: 'T→P', color: '#F59E0B', group: 'new' },
  { id: 'new-practice-theory', label: 'New Practice → Theory', short: 'P→T', color: '#06B6D4', group: 'new' },
  { id: 'new-theory-theory', label: 'New Theory → Theory', short: 'T→T', color: '#EF4444', group: 'new' },
  { id: 'new-practice-practice', label: 'New Practice → Practice', short: 'P→P', color: '#EC4899', group: 'new' },
  { id: 'unknown', label: 'Unclassified', short: 'Unknown', color: '#94A3B8', group: 'unknown' },
]

export const CATEGORY_BY_ID: Record<EdgeCategory, CategoryMeta> = Object.fromEntries(
  CATEGORIES.map((category) => [category.id, category]),
) as Record<EdgeCategory, CategoryMeta>

export const NODE_COLORS = {
  TheoryKG: '#C4B5FD',
  PracticeKG: '#86EFAC',
  Unknown: '#CBD5E1',
} as const

const CATEGORY_ALIASES: Record<string, EdgeCategory> = {
  'original theorykg': 'original-theory',
  'original theory': 'original-theory',
  'original theory kg': 'original-theory',
  'new theory to practice': 'new-theory-practice',
  'new theory practice': 'new-theory-practice',
  'theory to practice': 'new-theory-practice',
  't to p': 'new-theory-practice',
  'new t to p': 'new-theory-practice',
  'new practice to theory': 'new-practice-theory',
  'new practice theory': 'new-practice-theory',
  'practice to theory': 'new-practice-theory',
  'p to t': 'new-practice-theory',
  'new p to t': 'new-practice-theory',
  'new theory to theory': 'new-theory-theory',
  'new theory theory': 'new-theory-theory',
  'new t to t': 'new-theory-theory',
  'new practice to practice': 'new-practice-practice',
  'new practice practice': 'new-practice-practice',
  'new p to p': 'new-practice-practice',
  unknown: 'unknown',
  unclassified: 'unknown',
}

export function categoryGroup(category: EdgeCategory): 'original' | 'new' | 'unknown' {
  return CATEGORY_BY_ID[category].group
}

export function normalizeCategoryLabel(value: string | undefined): EdgeCategory | null {
  if (!value || !value.trim()) return null
  const key = value
    .trim()
    .toLowerCase()
    .replace(/→|->|›|—/g, ' to ')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
  return CATEGORY_ALIASES[key] ?? null
}

export function normalizeKg(value: string | undefined): KgName | null {
  if (!value || !value.trim()) return null
  const key = value.trim().toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ')
  if (['theory', 'theorykg', 'theory kg', 'original theory', 'original theorykg', 'original theory kg', 't'].includes(key)) {
    return 'theory'
  }
  if (
    ['practice', 'practicekg', 'practice kg', 'original practice', 'original practicekg', 'original practice kg', 'p'].includes(
      key,
    )
  ) {
    return 'practice'
  }
  return null
}

export function normalizeOrigin(value: string | undefined): EdgeOrigin | null {
  if (!value || !value.trim()) return null
  const key = value.trim().toLowerCase().replace(/[_-]+/g, ' ')
  if (['original', 'orig', 'source', 'existing', 'base'].includes(key)) return 'original'
  if (['new', 'reconciled', 'reconciliation', 'generated', 'novel', 'cross', 'added'].includes(key)) return 'new'
  return null
}

export function normalizeHex(value: string | undefined): string | null {
  if (!value || !value.trim()) return null
  const raw = value.trim()
  const match = raw.match(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/)
  if (!match) return null
  const hex = match[1]
  if (hex.length === 3) {
    return `#${hex[0]}${hex[0]}${hex[1]}${hex[1]}${hex[2]}${hex[2]}`.toUpperCase()
  }
  return `#${hex.toUpperCase()}`
}

export function inferFileHint(fileName: string): FileHint {
  const name = fileName.toLowerCase()
  const hasTheory = name.includes('theory')
  const hasPractice = name.includes('practice')
  if (hasTheory && hasPractice) return 'unspecified'
  if (hasPractice) return 'original-practice'
  if (hasTheory) return 'original-theory'
  return 'unspecified'
}

export interface ClassificationInput {
  kgCategory?: string
  headKg?: string
  tailKg?: string
  edgeOrigin?: string
  colorCode?: string
  fileHint: FileHint
}

export interface Classification {
  category: EdgeCategory
  color: string
  edgeOrigin: EdgeOrigin
  headKg: KgName
  tailKg: KgName
}

function kgFromCategory(category: EdgeCategory, role: 'head' | 'tail'): KgName | null {
  switch (category) {
    case 'original-theory':
    case 'new-theory-theory':
      return 'theory'
    case 'original-practice':
    case 'new-practice-practice':
      return 'practice'
    case 'new-theory-practice':
      return role === 'head' ? 'theory' : 'practice'
    case 'new-practice-theory':
      return role === 'head' ? 'practice' : 'theory'
    default:
      return null
  }
}

export function classifyRelationship(input: ClassificationInput): Classification {
  const explicitCategory = normalizeCategoryLabel(input.kgCategory)
  const headExplicit = normalizeKg(input.headKg)
  const tailExplicit = normalizeKg(input.tailKg)
  const origin = normalizeOrigin(input.edgeOrigin)
  const hasKg = Boolean(input.headKg?.trim() || input.tailKg?.trim())
  const hasOrigin = Boolean(input.edgeOrigin?.trim())
  const hasCategory = Boolean(input.kgCategory?.trim())
  const provenance = hasKg || hasOrigin || hasCategory

  let category: EdgeCategory = 'unknown'

  if (explicitCategory) {
    category = explicitCategory
  } else if (origin === 'original') {
    const sameTheory =
      (headExplicit === 'theory' || headExplicit === null) &&
      (tailExplicit === 'theory' || tailExplicit === null) &&
      (headExplicit === 'theory' || tailExplicit === 'theory')
    const samePractice =
      (headExplicit === 'practice' || headExplicit === null) &&
      (tailExplicit === 'practice' || tailExplicit === null) &&
      (headExplicit === 'practice' || tailExplicit === 'practice')
    const cross = headExplicit && tailExplicit && headExplicit !== tailExplicit
    if (cross) category = 'unknown'
    else if (sameTheory) category = 'original-theory'
    else if (samePractice) category = 'original-practice'
    else if (!hasKg && input.fileHint === 'original-theory') category = 'original-theory'
    else if (!hasKg && input.fileHint === 'original-practice') category = 'original-practice'
    else category = 'unknown'
  } else if (origin === 'new') {
    if (headExplicit === 'theory' && tailExplicit === 'practice') category = 'new-theory-practice'
    else if (headExplicit === 'practice' && tailExplicit === 'theory') category = 'new-practice-theory'
    else if (headExplicit === 'theory' && tailExplicit === 'theory') category = 'new-theory-theory'
    else if (headExplicit === 'practice' && tailExplicit === 'practice') category = 'new-practice-practice'
    else category = 'unknown'
  } else if (headExplicit && tailExplicit && headExplicit !== tailExplicit) {
    category = headExplicit === 'theory' ? 'new-theory-practice' : 'new-practice-theory'
  } else if (!provenance && input.fileHint === 'original-theory') {
    category = 'original-theory'
  } else if (!provenance && input.fileHint === 'original-practice') {
    category = 'original-practice'
  }

  const headKg = headExplicit ?? kgFromCategory(category, 'head') ?? (!provenance && input.fileHint === 'original-theory'
    ? 'theory'
    : !provenance && input.fileHint === 'original-practice'
      ? 'practice'
      : 'unknown')
  const tailKg = tailExplicit ?? kgFromCategory(category, 'tail') ?? (!provenance && input.fileHint === 'original-theory'
    ? 'theory'
    : !provenance && input.fileHint === 'original-practice'
      ? 'practice'
      : 'unknown')

  const override = normalizeHex(input.colorCode)
  return {
    category,
    color: override ?? CATEGORY_BY_ID[category].color,
    edgeOrigin: origin ?? (categoryGroup(category) === 'unknown' ? 'unknown' : categoryGroup(category)),
    headKg,
    tailKg,
  }
}

export interface SlotProfile {
  category: Exclude<EdgeCategory, 'unknown'>
  origin: 'original' | 'new'
  headKg: 'theory' | 'practice'
  tailKg: 'theory' | 'practice'
}

export const UPLOAD_SLOTS: SlotProfile[] = [
  { category: 'original-theory', origin: 'original', headKg: 'theory', tailKg: 'theory' },
  { category: 'original-practice', origin: 'original', headKg: 'practice', tailKg: 'practice' },
  { category: 'new-theory-theory', origin: 'new', headKg: 'theory', tailKg: 'theory' },
  { category: 'new-practice-practice', origin: 'new', headKg: 'practice', tailKg: 'practice' },
  { category: 'new-theory-practice', origin: 'new', headKg: 'theory', tailKg: 'practice' },
  { category: 'new-practice-theory', origin: 'new', headKg: 'practice', tailKg: 'theory' },
]

export function slotProfile(category: Exclude<EdgeCategory, 'unknown'>): SlotProfile {
  const profile = UPLOAD_SLOTS.find((slot) => slot.category === category)
  if (!profile) throw new Error(`No upload slot for ${category}`)
  return profile
}

export function kgDisplay(kg: KgName): string {
  if (kg === 'theory') return 'TheoryKG'
  if (kg === 'practice') return 'PracticeKG'
  return 'Unknown'
}

/**
 * Reasons a CSV row disagrees with the upload slot the user chose.
 * Empty provenance fields are not conflicts. A color override is not a conflict.
 */
export function slotConflictReasons(
  row: { kgCategory?: string; headKg?: string; tailKg?: string; edgeOrigin?: string },
  slot: SlotProfile,
): string[] {
  const reasons: string[] = []
  const expected = CATEGORY_BY_ID[slot.category].label
  if (row.kgCategory?.trim()) {
    const parsed = normalizeCategoryLabel(row.kgCategory)
    if (parsed !== slot.category) {
      reasons.push(`kg_category is "${row.kgCategory.trim()}", which does not match ${expected}.`)
    }
  }
  if (row.edgeOrigin?.trim()) {
    const parsed = normalizeOrigin(row.edgeOrigin)
    if (parsed !== slot.origin) {
      reasons.push(`edge_origin is "${row.edgeOrigin.trim()}", which does not match ${slot.origin} relationships in this slot.`)
    }
  }
  if (row.headKg?.trim()) {
    const parsed = normalizeKg(row.headKg)
    if (parsed !== slot.headKg) {
      reasons.push(`head_kg is "${row.headKg.trim()}", which does not match ${kgDisplay(slot.headKg)}.`)
    }
  }
  if (row.tailKg?.trim()) {
    const parsed = normalizeKg(row.tailKg)
    if (parsed !== slot.tailKg) {
      reasons.push(`tail_kg is "${row.tailKg.trim()}", which does not match ${kgDisplay(slot.tailKg)}.`)
    }
  }
  return reasons
}

export function classificationForSlot(slot: SlotProfile, colorCode?: string): Classification {
  const override = normalizeHex(colorCode)
  return {
    category: slot.category,
    color: override ?? CATEGORY_BY_ID[slot.category].color,
    edgeOrigin: slot.origin,
    headKg: slot.headKg,
    tailKg: slot.tailKg,
  }
}

export function nodeIdFor(label: string, kg: KgName): string {
  if (kg === 'theory') return `Theory::${label}`
  if (kg === 'practice') return `Practice::${label}`
  return `Unknown::${label}`
}

export function sourceLabel(kg: KgName): 'TheoryKG' | 'PracticeKG' | 'Unknown' {
  if (kg === 'theory') return 'TheoryKG'
  if (kg === 'practice') return 'PracticeKG'
  return 'Unknown'
}

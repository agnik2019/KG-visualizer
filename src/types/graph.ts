export type EdgeCategory =
  | 'original-theory'
  | 'original-practice'
  | 'new-theory-practice'
  | 'new-practice-theory'
  | 'new-theory-theory'
  | 'new-practice-practice'
  | 'unknown'

export type KgName = 'theory' | 'practice' | 'unknown'

export type FileHint = 'original-theory' | 'original-practice' | 'unspecified'

export type EdgeOrigin = 'original' | 'new' | 'unknown'

export interface Triple {
  id: string
  head: string
  relation: string
  tail: string
  headType: string
  tailType: string
  headNodeId: string
  tailNodeId: string
  headKg: KgName
  tailKg: KgName
  category: EdgeCategory
  color: string
  edgeOrigin: EdgeOrigin
  extractionConfidence: number | null
  verdict: string
  verdictConfidence: number | null
  verificationStatus: string
  fileId: string
  fileName: string
  raw: Record<string, string>
}

export interface GraphNode {
  id: string
  label: string
  sourceKg: 'TheoryKG' | 'PracticeKG' | 'Unknown'
  entityType: string
  color: string
  degree: number
  inDegree: number
  outDegree: number
  loadedDegree: number
}

export interface GraphLink {
  id: string
  source: string
  target: string
  relation: string
  category: EdgeCategory
  color: string
  width: number
  triple: Triple
}

export interface KnowledgeFile {
  id: string
  name: string
  source: 'preset' | 'upload'
  presetId?: 'theory' | 'practice' | 'sample'
  hint: FileHint
  /** Set when the file was loaded through one of the six dedicated upload slots. */
  slot?: Exclude<EdgeCategory, 'unknown'>
  triples: Triple[]
  warnings: string[]
}

export interface BuiltGraph {
  nodes: GraphNode[]
  links: GraphLink[]
}

export interface Filters {
  categories: Record<EdgeCategory, boolean>
  showOriginal: boolean
  showNew: boolean
  showUnknown: boolean
  entityQuery: string
  relationQuery: string
  /** null means every relation is allowed */
  relationAllow: string[] | null
  minConfidence: number
  /** "all", an observed status, or "__none__" for rows without a status */
  verificationStatus: string
  hop: 0 | 1 | 2
  performanceMode: boolean
  performanceLimit: number
}

export interface LayoutSettings {
  gravity: number
  repulsion: number
  linkSpring: number
  linkDistance: number
  friction: number
}

export type Selection =
  | { kind: 'node'; id: string }
  | { kind: 'link'; id: string }
  | null

export interface GraphStats {
  loadedNodes: number
  loadedLinks: number
  visibleNodes: number
  visibleLinks: number
  categoryCounts: Record<EdgeCategory, number>
  loadedCategoryCounts: Record<EdgeCategory, number>
  relationCount: number
  averageDegree: number
  components: number
  topEntities: GraphNode[]
}

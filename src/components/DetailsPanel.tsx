import { useState } from 'react'
import type { GraphLink, GraphNode } from '../types/graph'
import { CATEGORY_BY_ID } from '../utils/colors'
import { formatConfidence, parseStringList, present } from '../utils/format'

interface DetailsPanelProps {
  node: GraphNode | null
  link: GraphLink | null
  connected: GraphLink[]
  parallel: GraphLink[]
  onSelectNode: (id: string, zoom?: boolean) => void
  onSelectLink: (id: string) => void
}

const PRIMARY_KEYS = new Set([
  'triple_id',
  'head',
  'relation',
  'tail',
  'head_type',
  'tail_type',
  'evidence_ids',
  'evidence_quotes',
  'extraction_confidence',
  'verdict',
  'verdict_confidence',
  'verification_explanation',
  'verification_status',
  'verification_evidence_ids',
  'grounded_text_evidence_ids',
  'paper_id',
  'source_podcast_id',
  'episode_id',
  'ep_title',
  'pod_title',
  'context_unit_id',
  'head_kg',
  'tail_kg',
  'edge_origin',
  'kg_category',
  'color_code',
  'color-code',
  'text',
])

function Field({ label, value }: { label: string; value?: string | null }) {
  if (!present(value)) return null
  return (
    <div>
      <div className="text-[11px] uppercase tracking-[0.14em] text-slate-500">{label}</div>
      <div className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-100">{value}</div>
    </div>
  )
}

function QuoteList({ label, raw }: { label: string; raw?: string }) {
  const items = parseStringList(raw)
  if (items.length === 0 || (items.length === 1 && items[0] === '[]')) return null
  return (
    <div>
      <div className="text-[11px] uppercase tracking-[0.14em] text-slate-500">{label}</div>
      <ul className="mt-1 space-y-2">
        {items.map((item) => (
          <li key={item} className="rounded-lg border-l-2 border-violet-400/70 bg-white/5 px-3 py-2 text-sm leading-relaxed text-slate-100">
            {item}
          </li>
        ))}
      </ul>
    </div>
  )
}

export function DetailsPanel({ node, link, connected, parallel, onSelectNode, onSelectLink }: DetailsPanelProps) {
  const [showAllLinks, setShowAllLinks] = useState(false)
  const [showRaw, setShowRaw] = useState(false)
  const visibleConnected = showAllLinks ? connected : connected.slice(0, 12)

  return (
    <aside className="flex h-full w-[380px] shrink-0 flex-col border-l border-white/10 bg-slate-950/90" data-testid="details-panel">
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
        <h2 className="font-display text-sm font-semibold text-white">Details</h2>
        {!node && !link && (
          <p className="text-sm leading-relaxed text-slate-400">
            Select a node to inspect its source graph and neighbors, or select a relationship to read its evidence and verification record.
          </p>
        )}

        {node && (
          <section className="space-y-3">
            <div>
              <div className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Entity</div>
              <h3 className="mt-1 break-words font-display text-lg text-white">{node.label}</h3>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="rounded-full px-2 py-1" style={{ backgroundColor: `${node.color}22`, color: node.color }}>
                {node.sourceKg}
              </span>
              {node.entityType && <span className="rounded-full bg-white/10 px-2 py-1 text-slate-200">{node.entityType}</span>}
            </div>
            <dl className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl bg-white/5 px-2 py-2">
                <dt className="text-[11px] text-slate-500">Degree</dt>
                <dd className="font-display text-lg">{node.degree}</dd>
              </div>
              <div className="rounded-xl bg-white/5 px-2 py-2">
                <dt className="text-[11px] text-slate-500">Out</dt>
                <dd className="font-display text-lg">{node.outDegree}</dd>
              </div>
              <div className="rounded-xl bg-white/5 px-2 py-2">
                <dt className="text-[11px] text-slate-500">In</dt>
                <dd className="font-display text-lg">{node.inDegree}</dd>
              </div>
            </dl>
            <p className="text-xs text-slate-500">
              Identity <span className="text-slate-300">{node.id}</span>
              {node.loadedDegree !== node.degree && ` · ${node.loadedDegree} connections in the loaded dataset`}
            </p>
            <div>
              <div className="mb-1 text-[11px] uppercase tracking-[0.14em] text-slate-500">Connected relationships</div>
              {connected.length === 0 && <p className="text-sm text-slate-400">No relationships are visible with the current filters.</p>}
              <ul className="space-y-1">
                {visibleConnected.map((item) => {
                  const otherId = item.source === node.id ? item.target : item.source
                  const otherLabel = item.source === node.id ? item.triple.tail : item.triple.head
                  const direction = item.source === node.id ? '→' : '←'
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        className="flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-white/5"
                        onClick={() => onSelectLink(item.id)}
                      >
                        <span className="mt-1 h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
                        <span className="min-w-0">
                          <span className="text-slate-400">{direction} {item.relation}</span>
                          <span className="mt-0.5 block truncate text-slate-100">{otherLabel}</span>
                        </span>
                        <span className="sr-only">{otherId}</span>
                      </button>
                    </li>
                  )
                })}
              </ul>
              {connected.length > 12 && (
                <button type="button" className="mt-2 text-xs text-violet-200" onClick={() => setShowAllLinks((value) => !value)}>
                  {showAllLinks ? 'Show fewer' : `Show all ${connected.length}`}
                </button>
              )}
            </div>
          </section>
        )}

        {link && (
          <section className="space-y-3 border-t border-white/10 pt-4">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: link.color }} />
              <span className="text-sm text-slate-200">{CATEGORY_BY_ID[link.category].label}</span>
            </div>
            <h3 className="break-words font-display text-lg leading-snug text-white">
              <button type="button" className="hover:text-violet-200" onClick={() => onSelectNode(link.source, true)}>
                {link.triple.head}
              </button>
              <span className="mx-1 text-slate-500">→</span>
              <span className="text-violet-200">{link.relation}</span>
              <span className="mx-1 text-slate-500">→</span>
              <button type="button" className="hover:text-violet-200" onClick={() => onSelectNode(link.target, true)}>
                {link.triple.tail}
              </button>
            </h3>
            <Field label="Triple ID" value={link.triple.id} />
            <Field label="Paper ID" value={link.triple.raw.paper_id} />
            <Field label="Source KG of head" value={link.triple.headKg === 'unknown' ? '' : link.triple.headKg === 'theory' ? 'TheoryKG' : 'PracticeKG'} />
            <Field label="Source KG of tail" value={link.triple.tailKg === 'unknown' ? '' : link.triple.tailKg === 'theory' ? 'TheoryKG' : 'PracticeKG'} />
            <Field label="Head type" value={link.triple.headType} />
            <Field label="Tail type" value={link.triple.tailType} />
            <Field label="Note" value={link.triple.raw.text} />
            <QuoteList label="Evidence quotes" raw={link.triple.raw.evidence_quotes} />
            <QuoteList label="Evidence IDs" raw={link.triple.raw.evidence_ids} />
            <Field label="Podcast" value={link.triple.raw.pod_title} />
            <Field label="Episode" value={link.triple.raw.ep_title} />
            <Field label="Episode ID" value={link.triple.raw.episode_id} />
            <Field label="Podcast ID" value={link.triple.raw.source_podcast_id} />
            <Field label="Context unit" value={link.triple.raw.context_unit_id} />
            <Field label="Extraction confidence" value={formatConfidence(link.triple.extractionConfidence)} />
            <Field label="Verification verdict" value={link.triple.verdict} />
            <Field label="Verdict confidence" value={formatConfidence(link.triple.verdictConfidence)} />
            <Field label="Verification status" value={link.triple.verificationStatus} />
            <Field label="Verification explanation" value={link.triple.raw.verification_explanation} />
            <QuoteList label="Verification evidence" raw={link.triple.raw.verification_evidence_ids} />
            <Field label="Source file" value={link.triple.fileName} />
            {parallel.length > 1 && (
              <div>
                <div className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Parallel relationships</div>
                <ul className="mt-1 space-y-1">
                  {parallel.map((item) => (
                    <li key={item.id}>
                      <button
                        type="button"
                        className={`w-full rounded-lg px-2 py-1.5 text-left text-sm ${item.id === link.id ? 'bg-white/10 text-white' : 'text-slate-300 hover:bg-white/5'}`}
                        onClick={() => onSelectLink(item.id)}
                      >
                        {item.relation}
                        <span className="mt-0.5 block text-xs text-slate-500">{item.id}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <button type="button" className="text-xs text-violet-200" onClick={() => setShowRaw((value) => !value)}>
              {showRaw ? 'Hide additional metadata' : 'Show additional metadata'}
            </button>
            {showRaw && (
              <div className="space-y-3">
                {Object.entries(link.triple.raw)
                  .filter(([key, value]) => !PRIMARY_KEYS.has(key) && present(value))
                  .map(([key, value]) => (
                    <Field key={key} label={key} value={value} />
                  ))}
              </div>
            )}
          </section>
        )}
      </div>
    </aside>
  )
}

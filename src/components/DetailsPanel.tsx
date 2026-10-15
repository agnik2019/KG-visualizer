import { useState } from 'react'
import type { GraphLink, GraphNode } from '../types/graph'
import { CATEGORY_BY_ID, kgDisplay } from '../utils/colors'
import { evidenceQuotes, highlightQuotes, rawField, resolveExtractionContext, type ContextIndex } from '../utils/context'
import { formatConfidence, parseStringList, present } from '../utils/format'

interface DetailsPanelProps {
  node: GraphNode | null
  link: GraphLink | null
  connected: GraphLink[]
  parallel: GraphLink[]
  contextIndex: ContextIndex
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
  'context',
  'context_text',
  'source_text',
  'original_context',
  'source_file',
  'evidence_quote',
  'original_evidence_quote',
  'original_evidence_passage_id',
  'evidence_passage_id',
  'context_id',
  'podcast_id',
  'document_id',
  'verification_quote',
  'verification_reason',
  'verification_confidence',
  'verification_passage_id',
  'verifier_mode',
  'source_scope',
  'citation_alignment',
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

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      className="text-xs text-violet-200 hover:text-white"
      onClick={() => {
        void navigator.clipboard.writeText(text).then(() => {
          setCopied(true)
          window.setTimeout(() => setCopied(false), 1200)
        })
      }}
    >
      {copied ? 'Copied' : label}
    </button>
  )
}

export function DetailsPanel({ node, link, connected, parallel, contextIndex, onSelectNode, onSelectLink }: DetailsPanelProps) {
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
          <RelationshipDetails
            link={link}
            parallel={parallel}
            contextIndex={contextIndex}
            onSelectNode={onSelectNode}
            onSelectLink={onSelectLink}
            showRaw={showRaw}
            onToggleRaw={() => setShowRaw((value) => !value)}
          />
        )}
      </div>
    </aside>
  )
}

function RelationshipDetails({
  link,
  parallel,
  contextIndex,
  onSelectNode,
  onSelectLink,
  showRaw,
  onToggleRaw,
}: {
  link: GraphLink
  parallel: GraphLink[]
  contextIndex: ContextIndex
  onSelectNode: (id: string, zoom?: boolean) => void
  onSelectLink: (id: string) => void
  showRaw: boolean
  onToggleRaw: () => void
}) {
  const quotes = evidenceQuotes(link.triple.raw)
  const context = resolveExtractionContext(link.triple.raw, contextIndex, quotes)
  const highlighted = context ? highlightQuotes(context, quotes) : null
  const note = link.triple.raw.text?.trim()
  const noteIsContext = Boolean(note && context === note)
  const category = CATEGORY_BY_ID[link.category]

  return (
    <div className="space-y-5 border-t border-white/10 pt-4">
      <section className="space-y-2">
        <h3 className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Extracted triple</h3>
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: link.color }} />
          <span className="text-sm text-slate-200">{category.label}</span>
        </div>
        <p className="break-words font-display text-lg leading-snug text-white">
          <button type="button" className="hover:text-violet-200" onClick={() => onSelectNode(link.source, true)}>
            {link.triple.head}
          </button>
          <span className="mx-1 text-slate-500">→</span>
          <span style={{ color: link.color }}>{link.relation}</span>
          <span className="mx-1 text-slate-500">→</span>
          <button type="button" className="hover:text-violet-200" onClick={() => onSelectNode(link.target, true)}>
            {link.triple.tail}
          </button>
        </p>
      </section>

      <section className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Original extraction context</h3>
          {context && <CopyButton text={context} label="Copy context" />}
        </div>
        {highlighted ? (
          <div className="whitespace-pre-wrap break-words rounded-xl border border-white/10 bg-black/30 px-3 py-3 text-sm leading-relaxed text-slate-100">
            {highlighted.segments.map((segment, index) =>
              segment.match ? (
                <mark key={index} className="rounded bg-amber-300/25 px-0.5 text-amber-50">
                  {segment.text}
                </mark>
              ) : (
                <span key={index}>{segment.text}</span>
              ),
            )}
          </div>
        ) : (
          <p className="text-sm text-slate-400">The full original context is unavailable.</p>
        )}
        {quotes.length > 0 && (
          <div className="flex items-center justify-between">
            <div className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Evidence quotes</div>
            <CopyButton text={quotes.join('\n\n')} label="Copy evidence" />
          </div>
        )}
        {highlighted && highlighted.unmatched.length > 0 && <QuoteList label="Quotes not found in the passage" raw={JSON.stringify(highlighted.unmatched)} />}
        {!highlighted && quotes.length > 0 && <QuoteList label="Available evidence" raw={link.triple.raw.evidence_quotes} />}
        {!noteIsContext && <Field label="Note" value={note} />}
      </section>

      <section className="space-y-3">
        <h3 className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Source information</h3>
        <Field label="Triple ID" value={link.triple.id} />
        <Field label="Source KG" value={category.label} />
        <Field label="Paper ID" value={rawField(link.triple.raw, 'paper_id', 'document_id')} />
        <Field label="Podcast" value={rawField(link.triple.raw, 'pod_title')} />
        <Field label="Episode" value={rawField(link.triple.raw, 'ep_title')} />
        <Field label="Episode ID" value={rawField(link.triple.raw, 'episode_id')} />
        <Field label="Podcast ID" value={rawField(link.triple.raw, 'source_podcast_id', 'podcast_id')} />
        <Field label="Context unit" value={rawField(link.triple.raw, 'context_unit_id', 'context_id')} />
        <Field label="Source scope" value={rawField(link.triple.raw, 'source_scope')} />
        <QuoteList
          label="Evidence IDs"
          raw={JSON.stringify(
            [...new Set([
              ...parseStringList(rawField(link.triple.raw, 'evidence_ids')),
              rawField(link.triple.raw, 'evidence_passage_id'),
              rawField(link.triple.raw, 'original_evidence_passage_id'),
            ].filter(Boolean))],
          )}
        />
        <Field label="Head type" value={link.triple.headType} />
        <Field label="Tail type" value={link.triple.tailType} />
        <Field label="Head KG" value={link.triple.headKg === 'unknown' ? '' : kgDisplay(link.triple.headKg)} />
        <Field label="Tail KG" value={link.triple.tailKg === 'unknown' ? '' : kgDisplay(link.triple.tailKg)} />
        <Field label="Extraction confidence" value={formatConfidence(link.triple.extractionConfidence)} />
        <Field label="Source file" value={link.triple.fileName} />
      </section>

      {(link.triple.verdict ||
        link.triple.verificationStatus ||
        rawField(link.triple.raw, 'verification_explanation', 'verification_reason', 'verification_quote') ||
        link.triple.verdictConfidence != null ||
        rawField(link.triple.raw, 'verification_confidence')) && (
        <section className="space-y-3 rounded-xl border border-amber-200/15 bg-amber-950/20 px-3 py-3">
          <h3 className="text-[11px] uppercase tracking-[0.14em] text-amber-200/80">Verification commentary</h3>
          <p className="text-xs leading-relaxed text-amber-100/70">This is the verifier’s explanation, separate from the source passage the triple was extracted from.</p>
          <Field label="Verification verdict" value={link.triple.verdict} />
          <Field label="Verdict confidence" value={formatConfidence(link.triple.verdictConfidence)} />
          <Field label="Verification confidence" value={rawField(link.triple.raw, 'verification_confidence')} />
          <Field label="Verification status" value={link.triple.verificationStatus} />
          <Field label="Verifier mode" value={rawField(link.triple.raw, 'verifier_mode')} />
          <Field label="Verification explanation" value={rawField(link.triple.raw, 'verification_explanation', 'verification_reason')} />
          <QuoteList label="Verification evidence" raw={rawField(link.triple.raw, 'verification_evidence_ids', 'verification_passage_id')} />
          <Field label="Verification quote" value={rawField(link.triple.raw, 'verification_quote')} />
        </section>
      )}

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
      <button type="button" className="text-xs text-violet-200" onClick={onToggleRaw}>
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
    </div>
  )
}

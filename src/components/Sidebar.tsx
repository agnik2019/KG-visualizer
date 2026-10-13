import { useMemo, useState } from 'react'
import { Search, X } from 'lucide-react'
import type { Filters, GraphLink, GraphNode, GraphStats, KnowledgeFile, LayoutSettings } from '../types/graph'
import { CATEGORIES } from '../utils/colors'
import { GraphStatistics } from './GraphStatistics'
import { fieldClass } from '../ui'

interface SidebarProps {
  files: KnowledgeFile[]
  datasetId: string
  datasets: { id: string; label: string; count: number }[]
  onDatasetChange: (id: string) => void
  onRemoveFile: (id: string) => void
  filters: Filters
  onChange: (patch: Partial<Filters>) => void
  onResetFilters: () => void
  relations: string[]
  verificationStatuses: string[]
  hasUnspecifiedStatus: boolean
  layout: LayoutSettings
  onLayout: (patch: Partial<LayoutSettings>) => void
  showLabels: boolean
  showDynamicLabels: boolean
  onShowLabels: (value: boolean) => void
  onShowDynamicLabels: (value: boolean) => void
  onPause: () => void
  onResume: () => void
  onReheat: () => void
  stats: GraphStats
  suggestions: GraphNode[]
  onSelectNode: (id: string, zoom?: boolean) => void
  capped: boolean
  matchedBeforeCap: number
}

export function Sidebar({
  files,
  datasetId,
  datasets,
  onDatasetChange,
  onRemoveFile,
  filters,
  onChange,
  onResetFilters,
  relations,
  verificationStatuses,
  hasUnspecifiedStatus,
  layout,
  onLayout,
  showLabels,
  showDynamicLabels,
  onShowLabels,
  onShowDynamicLabels,
  onPause,
  onResume,
  onReheat,
  stats,
  suggestions,
  onSelectNode,
  capped,
  matchedBeforeCap,
}: SidebarProps) {
  const [suggestionOpen, setSuggestionOpen] = useState(false)
  const visibleRelations = useMemo(() => {
    const query = filters.relationQuery.trim().toLowerCase()
    return relations.filter((relation) => !query || relation.toLowerCase().includes(query))
  }, [relations, filters.relationQuery])

  const relationChecked = (relation: string) => (filters.relationAllow ? filters.relationAllow.includes(relation) : true)

  const toggleRelation = (relation: string) => {
    const selected = new Set(filters.relationAllow ?? relations)
    if (selected.has(relation)) selected.delete(relation)
    else selected.add(relation)
    onChange({ relationAllow: selected.size === relations.length ? null : [...selected] })
  }

  return (
    <aside className="flex h-full w-[340px] shrink-0 flex-col border-r border-white/10 bg-slate-950/90">
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-4">
        <section className="space-y-2">
          <h2 className="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400">Dataset</h2>
          <select className={fieldClass} value={datasetId} onChange={(event) => onDatasetChange(event.target.value)} aria-label="Dataset selection">
            {datasets.map((dataset) => (
              <option key={dataset.id} value={dataset.id}>
                {dataset.label} ({dataset.count.toLocaleString()})
              </option>
            ))}
          </select>
          <ul className="space-y-1">
            {files.map((file) => (
              <li key={file.id} className="flex items-center gap-2 rounded-lg bg-white/5 px-2 py-1.5 text-xs">
                <span className="min-w-0 flex-1 truncate text-slate-200" title={file.name}>
                  {file.name}
                  <span className="text-slate-500"> · {file.triples.length.toLocaleString()}</span>
                </span>
                {file.source === 'upload' && (
                  <button type="button" className="text-slate-400 hover:text-white" onClick={() => onRemoveFile(file.id)} aria-label={`Remove ${file.name}`}>
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400">KG categories</h2>
          {CATEGORIES.filter((category) => category.id !== 'unknown' || stats.loadedCategoryCounts.unknown > 0).map((category) => (
            <label key={category.id} className="flex items-center gap-2 text-sm text-slate-200">
              <input
                type="checkbox"
                checked={filters.categories[category.id]}
                onChange={() => onChange({ categories: { ...filters.categories, [category.id]: !filters.categories[category.id] } })}
              />
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: category.color }} />
              <span className="min-w-0 flex-1">{category.label}</span>
              <span className="tabular-nums text-slate-500">{stats.categoryCounts[category.id].toLocaleString()}</span>
            </label>
          ))}
          <div className="grid grid-cols-1 gap-1 pt-1 text-sm text-slate-200">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={filters.showOriginal} onChange={() => onChange({ showOriginal: !filters.showOriginal })} />
              Show original KG edges
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={filters.showNew} onChange={() => onChange({ showNew: !filters.showNew })} />
              Show newly reconciled edges
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={filters.showUnknown} onChange={() => onChange({ showUnknown: !filters.showUnknown })} />
              Show unclassified edges
            </label>
          </div>
        </section>

        <section className="space-y-2">
          <h2 className="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400">Search</h2>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
            <input
              className={`${fieldClass} pl-9`}
              placeholder="Entity name"
              value={filters.entityQuery}
              aria-label="Entity search"
              onChange={(event) => {
                onChange({ entityQuery: event.target.value })
                setSuggestionOpen(true)
              }}
              onFocus={() => setSuggestionOpen(true)}
            />
            {filters.entityQuery && (
              <button type="button" className="absolute right-2 top-2 text-slate-400" onClick={() => onChange({ entityQuery: '' })} aria-label="Clear entity search">
                <X className="h-4 w-4" />
              </button>
            )}
            {suggestionOpen && suggestions.length > 0 && (
              <ul className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-xl border border-white/10 bg-slate-950 p-1 shadow-2xl">
                {suggestions.map((node) => (
                  <li key={node.id}>
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-white/5"
                      onClick={() => {
                        onChange({ entityQuery: node.label })
                        onSelectNode(node.id, true)
                        setSuggestionOpen(false)
                      }}
                    >
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: node.color }} />
                      <span className="min-w-0 flex-1 truncate">{node.label}</span>
                      <span className="text-[11px] text-slate-500">{node.sourceKg}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <input
            className={fieldClass}
            placeholder="Relation search"
            aria-label="Relation search"
            value={filters.relationQuery}
            onChange={(event) => onChange({ relationQuery: event.target.value })}
          />
          <div className="max-h-40 space-y-1 overflow-auto rounded-xl border border-white/10 p-2">
            <div className="mb-1 flex justify-between text-[11px] text-slate-500">
              <span>Relations</span>
              <button type="button" className="hover:text-slate-200" onClick={() => onChange({ relationAllow: null })}>
                All
              </button>
            </div>
            {visibleRelations.slice(0, 200).map((relation) => (
              <label key={relation} className="flex items-center gap-2 text-xs text-slate-200">
                <input type="checkbox" checked={relationChecked(relation)} onChange={() => toggleRelation(relation)} />
                <span className="truncate">{relation}</span>
              </label>
            ))}
            {visibleRelations.length > 200 && <p className="text-[11px] text-slate-500">Refine the search to see more relations.</p>}
          </div>
        </section>

        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400">Minimum confidence</h2>
            <span className="text-xs tabular-nums text-slate-300">{filters.minConfidence.toFixed(2)}</span>
          </div>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={filters.minConfidence}
            aria-label="Minimum extraction confidence"
            onChange={(event) => onChange({ minConfidence: Number(event.target.value) })}
            className="w-full accent-violet-400"
          />
          <label className="block text-[11px] uppercase tracking-[0.14em] text-slate-400" htmlFor="verification-status">
            Verification status
          </label>
          <select
            id="verification-status"
            className={fieldClass}
            value={filters.verificationStatus}
            onChange={(event) => onChange({ verificationStatus: event.target.value })}
          >
            <option value="all">All statuses</option>
            {verificationStatuses.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
            {hasUnspecifiedStatus && <option value="__none__">Unspecified</option>}
          </select>
        </section>

        <section className="space-y-2">
          <h2 className="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400">Neighborhood</h2>
          <div className="grid grid-cols-3 gap-1 rounded-xl bg-white/5 p-1">
            {([
              [0, 'Full'],
              [1, '1-hop'],
              [2, '2-hop'],
            ] as const).map(([hop, label]) => (
              <button
                key={hop}
                type="button"
                className={`rounded-lg px-2 py-1.5 text-sm ${filters.hop === hop ? 'bg-violet-500/30 text-white' : 'text-slate-300 hover:bg-white/5'}`}
                onClick={() => onChange({ hop })}
              >
                {label}
              </button>
            ))}
          </div>
          <p className="text-xs text-slate-500">Select a node or relationship, then isolate its one-hop or two-hop neighborhood.</p>
        </section>

        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400">Performance</h2>
            <label className="flex items-center gap-2 text-xs text-slate-300">
              <input
                type="checkbox"
                checked={filters.performanceMode}
                onChange={() => onChange({ performanceMode: !filters.performanceMode })}
              />
              Limit graph
            </label>
          </div>
          <label className="flex items-center justify-between text-xs text-slate-400">
            Cap
            <input
              type="number"
              min={100}
              max={20000}
              step={100}
              value={filters.performanceLimit}
              className={`${fieldClass} w-28`}
              onChange={(event) => onChange({ performanceLimit: Math.max(100, Number(event.target.value) || 100) })}
            />
          </label>
          {capped && (
            <p className="text-xs text-amber-200">
              Showing {Math.min(filters.performanceLimit, matchedBeforeCap).toLocaleString()} of {matchedBeforeCap.toLocaleString()} matching relationships, highest confidence first.
            </p>
          )}
        </section>

        <section className="space-y-3">
          <h2 className="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400">Layout</h2>
          {(
            [
              ['gravity', 'Gravity', layout.gravity, 0, 1, 0.01],
              ['repulsion', 'Repulsion', layout.repulsion, 0, 3, 0.05],
              ['linkSpring', 'Link spring', layout.linkSpring, 0, 2, 0.05],
              ['linkDistance', 'Link distance', layout.linkDistance, 1, 80, 1],
              ['friction', 'Friction', layout.friction, 0, 1, 0.01],
            ] as const
          ).map(([key, label, value, min, max, step]) => (
            <label key={key} className="block text-xs text-slate-300">
              <span className="mb-1 flex justify-between">
                {label}
                <span className="tabular-nums text-slate-400">{value.toFixed(step < 1 ? 2 : 0)}</span>
              </span>
              <input
                type="range"
                min={min}
                max={max}
                step={step}
                value={value}
                className="w-full accent-violet-400"
                onChange={(event) => onLayout({ [key]: Number(event.target.value) })}
              />
            </label>
          ))}
          <div className="flex flex-wrap gap-2 text-xs">
            <button type="button" className="rounded-lg border border-white/10 px-2 py-1 hover:bg-white/5" onClick={onPause}>
              Pause
            </button>
            <button type="button" className="rounded-lg border border-white/10 px-2 py-1 hover:bg-white/5" onClick={onResume}>
              Resume
            </button>
            <button type="button" className="rounded-lg border border-white/10 px-2 py-1 hover:bg-white/5" onClick={onReheat}>
              Reheat
            </button>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-200">
            <input type="checkbox" checked={showLabels} onChange={() => onShowLabels(!showLabels)} />
            Show labels
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-200">
            <input type="checkbox" checked={showDynamicLabels} onChange={() => onShowDynamicLabels(!showDynamicLabels)} />
            Dynamic labels while panning
          </label>
        </section>

        <GraphStatistics stats={stats} onSelectNode={(id) => onSelectNode(id, true)} />
        <button type="button" className="text-sm text-violet-200 hover:text-white" onClick={onResetFilters}>
          Reset filters
        </button>
      </div>
    </aside>
  )
}

export function matchingNodes(nodes: GraphNode[], query: string): GraphNode[] {
  const needle = query.trim().toLowerCase()
  if (!needle) return []
  return nodes.filter((node) => node.label.toLowerCase().includes(needle)).slice(0, 8)
}

export function linksForNode(links: GraphLink[], nodeId: string): GraphLink[] {
  return links.filter((link) => link.source === nodeId || link.target === nodeId)
}

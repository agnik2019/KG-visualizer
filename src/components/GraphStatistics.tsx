import type { GraphStats } from '../types/graph'
import { CATEGORIES } from '../utils/colors'
import { formatNumber } from '../utils/format'

interface GraphStatisticsProps {
  stats: GraphStats
  onSelectNode: (id: string) => void
}

export function GraphStatistics({ stats, onSelectNode }: GraphStatisticsProps) {
  const cards = [
    ['Visible nodes', formatNumber(stats.visibleNodes)],
    ['Visible relationships', formatNumber(stats.visibleLinks)],
    ['Loaded nodes', formatNumber(stats.loadedNodes)],
    ['Loaded relationships', formatNumber(stats.loadedLinks)],
    ['Relation types', formatNumber(stats.relationCount)],
    ['Average degree', formatNumber(stats.averageDegree, 2)],
    ['Components', formatNumber(stats.components)],
  ]

  return (
    <section className="space-y-3">
      <h2 className="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400">Statistics</h2>
      <div className="grid grid-cols-2 gap-2">
        {cards.map(([label, value]) => (
          <div key={label} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
            <div className="text-[11px] text-slate-400">{label}</div>
            <div className="mt-1 font-display text-lg tabular-nums text-white" data-testid={`stat-${label.toLowerCase().replace(/\s+/g, '-')}`}>
              {value}
            </div>
          </div>
        ))}
      </div>
      <div className="space-y-1.5">
        {CATEGORIES.filter((category) => category.id !== 'unknown' || stats.loadedCategoryCounts.unknown > 0).map((category) => (
          <div key={category.id} className="flex items-center gap-2 text-xs text-slate-300">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: category.color }} />
            <span className="min-w-0 flex-1 truncate">{category.label}</span>
            <span className="tabular-nums text-slate-100">{formatNumber(stats.categoryCounts[category.id])}</span>
            <span className="w-12 text-right tabular-nums text-slate-500">{formatNumber(stats.loadedCategoryCounts[category.id])}</span>
          </div>
        ))}
        <div className="text-right text-[10px] uppercase tracking-wide text-slate-500">visible / loaded</div>
      </div>
      {stats.topEntities.length > 0 && (
        <div>
          <div className="mb-1.5 text-[11px] uppercase tracking-[0.14em] text-slate-400">Top entities by degree</div>
          <ul className="space-y-1">
            {stats.topEntities.map((node) => (
              <li key={node.id}>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-white/5"
                  onClick={() => onSelectNode(node.id)}
                >
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: node.color }} />
                  <span className="min-w-0 flex-1 truncate">{node.label}</span>
                  <span className="tabular-nums text-slate-400">{formatNumber(node.degree)}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}

import type { EdgeCategory } from '../types/graph'
import { CATEGORIES } from '../utils/colors'
import { formatNumber } from '../utils/format'

interface GraphLegendProps {
  counts: Record<EdgeCategory, number>
}

export function GraphLegend({ counts }: GraphLegendProps) {
  const rows = CATEGORIES.filter((category) => category.id !== 'unknown' || counts.unknown > 0)
  return (
    <div className="pointer-events-none max-w-xs rounded-2xl border border-white/10 bg-slate-950/80 p-3 shadow-xl backdrop-blur-md">
      <div className="mb-2 text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400">Relationships</div>
      <ul className="space-y-1.5">
        {rows.map((category) => (
          <li key={category.id} className="flex items-center gap-2 text-sm text-slate-100">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: category.color }} />
            <span className="min-w-0 flex-1 truncate">{category.label}</span>
            <span className="tabular-nums text-slate-400">{formatNumber(counts[category.id])}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

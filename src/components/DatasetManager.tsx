import { useRef } from 'react'
import { Upload, X } from 'lucide-react'
import type { EdgeCategory, KnowledgeFile } from '../types/graph'
import type { RowConflict } from '../utils/csvParser'
import { CATEGORY_BY_ID, UPLOAD_SLOTS } from '../utils/colors'

interface DatasetManagerProps {
  files: KnowledgeFile[]
  contextFileName: string
  contextCount: number
  pending: PendingSlot | null
  onUploadSlot: (slot: Exclude<EdgeCategory, 'unknown'>, file: File) => void
  onRemoveSlot: (slot: Exclude<EdgeCategory, 'unknown'>) => void
  onUploadContext: (file: File) => void
  onClearContext: () => void
  onClearUploads: () => void
  onResolve: (policy: 'apply-slot' | 'matching-only' | 'cancel') => void
  onClose: () => void
}

export interface PendingSlot {
  slot: Exclude<EdgeCategory, 'unknown'>
  fileName: string
  conflicts: RowConflict[]
  matchingCount: number
}

export function DatasetManager({
  files,
  contextFileName,
  contextCount,
  pending,
  onUploadSlot,
  onRemoveSlot,
  onUploadContext,
  onClearContext,
  onClearUploads,
  onResolve,
  onClose,
}: DatasetManagerProps) {
  const contextInput = useRef<HTMLInputElement>(null)
  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-slate-950/70 px-4 py-8" role="dialog" aria-modal="true" aria-labelledby="dataset-manager-title">
      <div className="w-full max-w-3xl rounded-2xl border border-white/10 bg-slate-950 shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-white/10 px-5 py-4">
          <div>
            <h2 id="dataset-manager-title" className="font-display text-lg text-white">Manage KG datasets</h2>
            <p className="mt-1 text-sm text-slate-400">
              Each slot classifies every loaded triple. A file named like another graph still takes the category of the slot you choose.
            </p>
          </div>
          <button type="button" className="rounded-lg p-1 text-slate-400 hover:bg-white/5 hover:text-white" onClick={onClose} aria-label="Close dataset manager">
            <X className="h-4 w-4" />
          </button>
        </div>

        {pending && (
          <div className="border-b border-amber-300/30 bg-amber-950/40 px-5 py-4" data-testid="slot-conflict">
            <h3 className="text-sm font-medium text-amber-50">
              {pending.fileName} disagrees with {CATEGORY_BY_ID[pending.slot].label}
            </h3>
            <p className="mt-1 text-sm text-amber-100/80">
              {pending.conflicts.length.toLocaleString()} row{pending.conflicts.length === 1 ? '' : 's'} {pending.conflicts.length === 1 ? 'declares' : 'declare'} different provenance.
              {' '}{pending.matchingCount.toLocaleString()} row{pending.matchingCount === 1 ? '' : 's'} already match this slot.
              Choose how to resolve this. The file is not loaded until you do.
            </p>
            <ul className="mt-2 max-h-28 space-y-1 overflow-auto text-xs text-amber-50/90">
              {pending.conflicts.slice(0, 4).map((conflict) => (
                <li key={`${conflict.row}-${conflict.relation}`}>
                  Row {conflict.row}: {conflict.head} → {conflict.relation} → {conflict.tail}. {conflict.reasons[0]}
                </li>
              ))}
            </ul>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" className="rounded-lg bg-amber-200 px-3 py-1.5 text-sm text-amber-950" onClick={() => onResolve('apply-slot')}>
                Use the slot category
              </button>
              <button type="button" className="rounded-lg border border-white/15 px-3 py-1.5 text-sm text-slate-100" onClick={() => onResolve('matching-only')} disabled={pending.matchingCount === 0}>
                Load matching rows only
              </button>
              <button type="button" className="rounded-lg px-3 py-1.5 text-sm text-slate-300" onClick={() => onResolve('cancel')}>
                Cancel
              </button>
            </div>
          </div>
        )}

        <ul className="space-y-2 px-5 py-4">
          {UPLOAD_SLOTS.map((slot) => {
            const meta = CATEGORY_BY_ID[slot.category]
            const file = files.find((item) => item.slot === slot.category)
            return (
              <li key={slot.category} className="flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3">
                <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: meta.color }} />
                <div className="min-w-[180px] flex-1">
                  <div className="text-sm text-slate-100">{meta.label}</div>
                  {file ? (
                    <div className="text-xs text-slate-400">
                      <span className="text-slate-200">{file.name}</span>
                      {' · '}
                      {file.triples.length.toLocaleString()} triple{file.triples.length === 1 ? '' : 's'}
                      {file.warnings.length > 0 ? ` · ${file.warnings.length} warning${file.warnings.length === 1 ? '' : 's'}` : ' · Valid'}
                    </div>
                  ) : (
                    <div className="text-xs text-slate-500">No file loaded</div>
                  )}
                </div>
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-white/10 px-3 py-1.5 text-sm text-slate-100 hover:bg-white/5">
                  <Upload className="h-3.5 w-3.5" />
                  {file ? 'Replace' : 'Upload CSV'}
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    className="sr-only"
                    aria-label={`${file ? 'Replace' : 'Upload'} ${meta.label}`}
                    onChange={(event) => {
                      const selected = event.target.files?.[0]
                      event.target.value = ''
                      if (selected) onUploadSlot(slot.category, selected)
                    }}
                  />
                </label>
                {file && (
                  <button type="button" className="rounded-lg px-2 py-1.5 text-sm text-slate-400 hover:text-white" onClick={() => onRemoveSlot(slot.category)}>
                    Remove
                  </button>
                )}
              </li>
            )
          })}
        </ul>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 px-5 py-4">
          <div className="text-sm text-slate-300">
            <div className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Context lookup</div>
            {contextFileName ? (
              <p className="mt-1">
                {contextFileName} · {contextCount.toLocaleString()} passages
              </p>
            ) : (
              <p className="mt-1 text-slate-500">Optional CSV with context_unit_id or source_id, and context_text.</p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="rounded-lg border border-white/10 px-3 py-1.5 text-sm" onClick={() => contextInput.current?.click()}>
              {contextFileName ? 'Replace context CSV' : 'Upload context CSV'}
            </button>
            <input
              ref={contextInput}
              type="file"
              accept=".csv,text/csv"
              className="sr-only"
              aria-label="Upload context CSV"
              onChange={(event) => {
                const selected = event.target.files?.[0]
                event.target.value = ''
                if (selected) onUploadContext(selected)
              }}
            />
            {contextFileName && (
              <button type="button" className="rounded-lg px-3 py-1.5 text-sm text-slate-400" onClick={onClearContext}>
                Remove context
              </button>
            )}
            <button type="button" className="rounded-lg px-3 py-1.5 text-sm text-rose-200" onClick={onClearUploads}>
              Clear uploaded datasets
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

import { Download, Image, Maximize2, RotateCcw, Share2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { FileUploader, type UploadHint } from './FileUploader'
import { iconButtonClass, controlClass } from '../ui'

interface DatasetOption {
  id: string
  label: string
  count: number
}

interface TopBarProps {
  datasetId: string
  datasets: DatasetOption[]
  onDatasetChange: (id: string) => void
  uploadHint: UploadHint
  onUploadHintChange: (hint: UploadHint) => void
  onFiles: (files: File[]) => void
  onResetView: () => void
  onFit: () => void
  onExportPng: () => void
  onExportCsv: () => void
  csvDisabled: boolean
  leftOpen: boolean
  rightOpen: boolean
  onToggleLeft: () => void
  onToggleRight: () => void
  busy: boolean
}

export function TopBar({
  datasetId,
  datasets,
  onDatasetChange,
  uploadHint,
  onUploadHintChange,
  onFiles,
  onResetView,
  onFit,
  onExportPng,
  onExportCsv,
  csvDisabled,
  leftOpen,
  rightOpen,
  onToggleLeft,
  onToggleRight,
  busy,
}: TopBarProps) {
  const [exportOpen, setExportOpen] = useState(false)
  const exportRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!exportOpen) return
    const close = (event: MouseEvent) => {
      if (!exportRef.current?.contains(event.target as Node)) setExportOpen(false)
    }
    window.addEventListener('mousedown', close)
    return () => window.removeEventListener('mousedown', close)
  }, [exportOpen])

  return (
    <header className="flex flex-wrap items-center gap-3 border-b border-white/10 bg-slate-950/90 px-4 py-3 backdrop-blur-md">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-500/20 text-violet-200">
          <Share2 className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <h1 className="truncate font-display text-base font-semibold tracking-tight text-white">Knowledge Graph Explorer</h1>
          <p className="truncate text-xs text-slate-400">TheoryKG, PracticeKG, and reconciled relationships</p>
        </div>
      </div>

      <label className="sr-only" htmlFor="dataset-select">
        Dataset
      </label>
      <select
        id="dataset-select"
        data-testid="dataset-select"
        className={`${controlClass} w-64`}
        value={datasetId}
        onChange={(event) => onDatasetChange(event.target.value)}
      >
        {datasets.map((dataset) => (
          <option key={dataset.id} value={dataset.id}>
            {dataset.label} ({dataset.count.toLocaleString()})
          </option>
        ))}
      </select>

      <div className="ml-auto flex flex-wrap items-center gap-2">
        <button type="button" className={iconButtonClass} onClick={onToggleLeft} aria-pressed={leftOpen}>
          {leftOpen ? 'Hide filters' : 'Show filters'}
        </button>
        <button type="button" className={iconButtonClass} onClick={onToggleRight} aria-pressed={rightOpen}>
          {rightOpen ? 'Hide details' : 'Show details'}
        </button>
        <FileUploader hint={uploadHint} onHintChange={onUploadHintChange} onFiles={onFiles} disabled={busy} />
        <button type="button" className={iconButtonClass} onClick={onResetView}>
          <RotateCcw className="h-4 w-4" />
          Reset view
        </button>
        <button type="button" className={iconButtonClass} onClick={onFit}>
          <Maximize2 className="h-4 w-4" />
          Fit graph
        </button>
        <div className="relative" ref={exportRef}>
          <button type="button" className={iconButtonClass} onClick={() => setExportOpen((open) => !open)} aria-expanded={exportOpen}>
            <Download className="h-4 w-4" />
            Export graph
          </button>
          {exportOpen && (
            <div className="absolute right-0 z-30 mt-2 w-52 rounded-xl border border-white/10 bg-slate-950 p-1 shadow-2xl">
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-white/5"
                onClick={() => {
                  setExportOpen(false)
                  onExportPng()
                }}
              >
                <Image className="h-4 w-4" />
                Export PNG
              </button>
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-white/5 disabled:opacity-40"
                disabled={csvDisabled}
                onClick={() => {
                  setExportOpen(false)
                  onExportCsv()
                }}
              >
                <Download className="h-4 w-4" />
                Export filtered CSV
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}

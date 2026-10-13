import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Share2 } from 'lucide-react'
import { TopBar } from './components/TopBar'
import { Sidebar, matchingNodes } from './components/Sidebar'
import { DetailsPanel } from './components/DetailsPanel'
import { GraphLegend } from './components/GraphLegend'
import { GraphViewer, type GraphHandle } from './components/GraphViewer'
import type { FileHint, Filters, KnowledgeFile, LayoutSettings, Selection } from './types/graph'
import { inferFileHint } from './utils/colors'
import { parseKnowledgeCsv } from './utils/csvParser'
import { buildGraph } from './utils/graphTransformer'
import { applyFilters, datasetOptions, defaultDatasetId, defaultFilters, defaultLayout, focusIdsFor, selectDatasetTriples } from './utils/filterGraph'
import { computeStats } from './utils/stats'
import { triplesToCsv } from './utils/exportData'
import { datasetUrl, downloadText } from './utils/format'
import type { UploadHint } from './components/FileUploader'

interface Notice {
  id: string
  tone: 'info' | 'warning' | 'error'
  text: string
}

const PRESETS: { id: string; file: string; name: string; hint: FileHint; presetId: 'theory' | 'practice' | 'sample' }[] = [
  { id: 'theory', file: 'theorykg.csv', name: 'TheoryKG', hint: 'original-theory', presetId: 'theory' },
  { id: 'practice', file: 'practicekg.csv', name: 'PracticeKG', hint: 'original-practice', presetId: 'practice' },
  { id: 'sample', file: 'sample-reconciled.csv', name: 'Sample reconciled', hint: 'unspecified', presetId: 'sample' },
]

function toneClass(tone: Notice['tone']): string {
  if (tone === 'error') return 'border-rose-400/40 bg-rose-950/80 text-rose-50'
  if (tone === 'warning') return 'border-amber-300/40 bg-amber-950/80 text-amber-50'
  return 'border-sky-300/30 bg-slate-900/90 text-slate-100'
}

export default function App() {
  const graphRef = useRef<GraphHandle>(null)
  const [files, setFiles] = useState<KnowledgeFile[]>([])
  const [datasetId, setDatasetId] = useState('all')
  const [filters, setFilters] = useState<Filters>(defaultFilters)
  const [layout, setLayout] = useState<LayoutSettings>(defaultLayout)
  const [selection, setSelection] = useState<Selection>(null)
  const [focusNonce, setFocusNonce] = useState(0)
  const [uploadHint, setUploadHint] = useState<UploadHint>('auto')
  const [notices, setNotices] = useState<Notice[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [leftOpen, setLeftOpen] = useState(() => window.innerWidth >= 900)
  const [rightOpen, setRightOpen] = useState(() => window.innerWidth >= 1280)
  const [showLabels, setShowLabels] = useState(true)
  const [showDynamicLabels, setShowDynamicLabels] = useState(false)

  const pushNotice = useCallback((notice: Notice) => {
    setNotices((current) => [notice, ...current].slice(0, 4))
  }, [])

  const loadPresets = useCallback(async () => {
    setLoading(true)
    const loaded: KnowledgeFile[] = []
    const missing: string[] = []
    const nextNotices: Notice[] = []
    for (const preset of PRESETS) {
      try {
        const response = await fetch(datasetUrl(preset.file))
        if (!response.ok) throw new Error(String(response.status))
        const text = await response.text()
        if (text.trimStart().startsWith('<')) throw new Error('not csv')
        const parsed = parseKnowledgeCsv(text, { fileId: preset.id, fileName: preset.file, fileHint: preset.hint })
        if (parsed.errors.length > 0) {
          nextNotices.push({ id: `${preset.id}-error`, tone: 'error', text: parsed.errors.join(' ') })
          continue
        }
        loaded.push({
          id: preset.id,
          name: preset.name,
          source: 'preset',
          presetId: preset.presetId,
          hint: preset.hint,
          triples: parsed.triples,
          warnings: parsed.warnings,
        })
        for (const warning of parsed.warnings) {
          nextNotices.push({ id: `${preset.id}-${warning}`, tone: 'warning', text: warning })
        }
      } catch {
        if (preset.presetId === 'sample') {
          nextNotices.push({ id: 'sample-missing', tone: 'error', text: 'The sample reconciled dataset could not be loaded.' })
        } else {
          missing.push(preset.name)
        }
      }
    }
    if (missing.length > 0) {
      nextNotices.push({
        id: 'research-missing',
        tone: 'info',
        text: `${missing.join(' and ')} ${missing.length === 1 ? 'is' : 'are'} not hosted with this site. Upload the CSV to explore it. The original research files stay local until publication is approved.`,
      })
    }
    setFiles((current) => [...loaded, ...current.filter((file) => file.source === 'upload')])
    setDatasetId(defaultDatasetId(loaded))
    const total = loaded.reduce((sum, file) => sum + file.triples.length, 0)
    setFilters((current) => ({ ...current, performanceMode: total > 2500 ? true : current.performanceMode }))
    setNotices(nextNotices.slice(0, 4))
    setLoading(false)
  }, [])

  useEffect(() => {
    void loadPresets()
  }, [loadPresets])

  const ingestFiles = useCallback(
    async (selected: File[]) => {
      setBusy(true)
      const uploaded: KnowledgeFile[] = []
      for (const file of selected) {
        try {
          const text = await file.text()
          const hint = uploadHint === 'auto' ? inferFileHint(file.name) : uploadHint
          const parsed = parseKnowledgeCsv(text, {
            fileId: `upload-${file.name}-${Date.now()}`,
            fileName: file.name,
            fileHint: hint,
          })
          if (parsed.errors.length > 0) {
            pushNotice({ id: `err-${file.name}-${Date.now()}`, tone: 'error', text: parsed.errors.join(' ') })
            continue
          }
          uploaded.push({
            id: `upload-${file.name}-${Date.now()}`,
            name: file.name,
            source: 'upload',
            hint,
            triples: parsed.triples,
            warnings: parsed.warnings,
          })
          pushNotice({
            id: `ok-${file.name}-${Date.now()}`,
            tone: 'info',
            text: `Loaded ${parsed.triples.length.toLocaleString()} triples from ${file.name}.`,
          })
          for (const warning of parsed.warnings) {
            pushNotice({ id: `warn-${file.name}-${warning}`, tone: 'warning', text: warning })
          }
        } catch (error) {
          pushNotice({
            id: `read-${file.name}`,
            tone: 'error',
            text: error instanceof Error ? error.message : `Could not read ${file.name}.`,
          })
        }
      }
      if (uploaded.length > 0) {
        setFiles((current) => [...current, ...uploaded])
        setDatasetId('all')
        setFilters((current) => ({
          ...current,
          performanceMode: current.performanceMode || uploaded.reduce((sum, file) => sum + file.triples.length, 0) > 2500,
        }))
      }
      setBusy(false)
    },
    [pushNotice, uploadHint],
  )

  useEffect(() => {
    const prevent = (event: DragEvent) => event.preventDefault()
    const drop = (event: DragEvent) => {
      event.preventDefault()
      const dropped = [...(event.dataTransfer?.files ?? [])]
      if (dropped.length > 0) void ingestFiles(dropped)
    }
    window.addEventListener('dragover', prevent)
    window.addEventListener('drop', drop)
    return () => {
      window.removeEventListener('dragover', prevent)
      window.removeEventListener('drop', drop)
    }
  }, [ingestFiles])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelection(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const datasets = useMemo(() => datasetOptions(files), [files])
  const activeTriples = useMemo(() => selectDatasetTriples(files, datasetId), [files, datasetId])
  const built = useMemo(() => buildGraph(activeTriples), [activeTriples])
  const focusIds = useMemo(() => (filters.hop > 0 ? focusIdsFor(selection, built.links) : []), [filters.hop, selection, built.links])
  const filtered = useMemo(() => applyFilters(built, filters, focusIds), [built, filters, focusIds])
  const stats = useMemo(() => computeStats(built.nodes, built.links, filtered.nodes, filtered.links), [built, filtered])

  useEffect(() => {
    if (!selection) return
    const visible =
      selection.kind === 'node'
        ? filtered.nodes.some((node) => node.id === selection.id)
        : filtered.links.some((link) => link.id === selection.id)
    if (!visible) setSelection(null)
  }, [filtered, selection])

  const selectedNode = selection?.kind === 'node' ? (filtered.nodes.find((node) => node.id === selection.id) ?? null) : null
  const selectedLink = selection?.kind === 'link' ? (filtered.links.find((link) => link.id === selection.id) ?? null) : null
  const connected = selectedNode ? filtered.links.filter((link) => link.source === selectedNode.id || link.target === selectedNode.id) : []
  const parallel = selectedLink
    ? filtered.links.filter((link) => link.source === selectedLink.source && link.target === selectedLink.target)
    : []

  const relations = useMemo(() => [...new Set(built.links.map((link) => link.relation))].sort((a, b) => a.localeCompare(b)), [built.links])
  const verificationStatuses = useMemo(() => {
    const values = new Set<string>()
    for (const link of built.links) {
      if (link.triple.verificationStatus) values.add(link.triple.verificationStatus)
    }
    return [...values].sort()
  }, [built.links])
  const hasUnspecifiedStatus = built.links.some((link) => !link.triple.verificationStatus)

  const selectNode = (id: string, zoom = false) => {
    setSelection({ kind: 'node', id })
    setRightOpen(true)
    if (zoom) setFocusNonce((value) => value + 1)
  }

  const exportCsv = () => {
    if (filtered.links.length === 0) {
      pushNotice({ id: 'csv-empty', tone: 'warning', text: 'There are no filtered relationships to export.' })
      return
    }
    downloadText('knowledge-graph-triples.csv', triplesToCsv(filtered.links))
  }

  const exportPng = () => {
    if (!graphRef.current) {
      pushNotice({ id: 'png-empty', tone: 'warning', text: 'The graph is not ready to export yet.' })
      return
    }
    graphRef.current.exportPng()
  }

  return (
    <div className="flex h-screen flex-col bg-[#070b14] text-slate-100">
      <TopBar
        datasetId={datasetId}
        datasets={datasets}
        onDatasetChange={(id) => {
          setDatasetId(id)
          setSelection(null)
          setFilters((current) => (current.hop === 0 ? current : { ...current, hop: 0 }))
        }}
        uploadHint={uploadHint}
        onUploadHintChange={setUploadHint}
        onFiles={(selected) => void ingestFiles(selected)}
        onResetView={() => {
          setSelection(null)
          graphRef.current?.resetView()
        }}
        onFit={() => graphRef.current?.fit()}
        onExportPng={exportPng}
        onExportCsv={exportCsv}
        csvDisabled={filtered.links.length === 0}
        leftOpen={leftOpen}
        rightOpen={rightOpen}
        onToggleLeft={() => setLeftOpen((open) => !open)}
        onToggleRight={() => setRightOpen((open) => !open)}
        busy={busy || loading}
      />

      {notices.length > 0 && (
        <div className="space-y-2 border-b border-white/10 bg-slate-950/80 px-4 py-2">
          {notices.map((notice) => (
            <div key={notice.id} className={`flex items-start justify-between gap-3 rounded-xl border px-3 py-2 text-sm ${toneClass(notice.tone)}`}>
              <p>{notice.text}</p>
              <button type="button" className="text-xs opacity-70 hover:opacity-100" onClick={() => setNotices((current) => current.filter((item) => item.id !== notice.id))}>
                Dismiss
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        {leftOpen && (
          <Sidebar
            files={files}
            datasetId={datasetId}
            datasets={datasets}
            onDatasetChange={(id) => {
              setDatasetId(id)
              setSelection(null)
              setFilters((current) => (current.hop === 0 ? current : { ...current, hop: 0 }))
            }}
            onRemoveFile={(id) => setFiles((current) => current.filter((file) => file.id !== id))}
            filters={filters}
            onChange={(patch) => setFilters((current) => ({ ...current, ...patch }))}
            onResetFilters={() => setFilters({ ...defaultFilters(), performanceMode: built.links.length > 2500 })}
            relations={relations}
            verificationStatuses={verificationStatuses}
            hasUnspecifiedStatus={hasUnspecifiedStatus}
            layout={layout}
            onLayout={(patch) => setLayout((current) => ({ ...current, ...patch }))}
            showLabels={showLabels}
            showDynamicLabels={showDynamicLabels}
            onShowLabels={setShowLabels}
            onShowDynamicLabels={setShowDynamicLabels}
            onPause={() => graphRef.current?.pause()}
            onResume={() => graphRef.current?.resume()}
            onReheat={() => graphRef.current?.reheat()}
            stats={stats}
            suggestions={matchingNodes(built.nodes, filters.entityQuery)}
            onSelectNode={selectNode}
            capped={filtered.capped}
            matchedBeforeCap={filtered.matchedBeforeCap}
          />
        )}

        <main className="relative min-w-0 flex-1">
          {loading && files.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-slate-300">Loading datasets…</div>
          ) : filtered.nodes.length === 0 ? (
            <div className="flex h-full items-center justify-center p-8">
              <div className="max-w-md text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-500/15 text-violet-200">
                  <Share2 className="h-5 w-5" />
                </div>
                <h2 className="font-display text-xl text-white">{files.length === 0 ? 'Upload a knowledge graph' : 'Nothing matches these filters'}</h2>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">
                  {files.length === 0
                    ? 'Drop a CSV anywhere, or use Upload CSV. TheoryKG and PracticeKG can also be placed in public/data for automatic loading.'
                    : 'Relax the category, confidence, relation, or neighborhood filters to bring relationships back into view.'}
                </p>
              </div>
            </div>
          ) : (
            <GraphViewer
              ref={graphRef}
              nodes={filtered.nodes}
              links={filtered.links}
              layout={layout}
              showLabels={showLabels}
              showDynamicLabels={showDynamicLabels}
              selection={selection}
              hop={filters.hop}
              focusNonce={focusNonce}
              onSelectNode={(id) => selectNode(id)}
              onSelectLink={(id) => {
                setSelection({ kind: 'link', id })
                setRightOpen(true)
              }}
              onClearSelection={() => setSelection(null)}
            />
          )}
          {filtered.links.length > 0 && (
            <div className="pointer-events-none absolute bottom-4 left-4 z-10">
              <GraphLegend counts={stats.categoryCounts} />
            </div>
          )}
          <div className="pointer-events-none absolute right-4 top-4 rounded-full border border-white/10 bg-slate-950/80 px-3 py-1 text-xs text-slate-300">
            {stats.visibleNodes.toLocaleString()} nodes · {stats.visibleLinks.toLocaleString()} relationships
          </div>
        </main>

        {rightOpen && (
          <DetailsPanel
            node={selectedNode}
            link={selectedLink}
            connected={connected}
            parallel={parallel}
            onSelectNode={selectNode}
            onSelectLink={(id) => {
              setSelection({ kind: 'link', id })
              setRightOpen(true)
            }}
          />
        )}
      </div>
    </div>
  )
}

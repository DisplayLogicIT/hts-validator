'use client'

import { useState, useRef, useEffect } from 'react'
import { parseRaw, applyMapping, detectColumns, type DetectionInfo, type ParsedRow, type ColumnMapping, type RawParseResult } from '@/lib/file-parser'
import { runConcurrent } from '@/lib/concurrency'

const CONCURRENCY = 20
const CACHE_KEY = 'hts_upload_cache'

interface ValidationResult {
  rowIndex: number
  htsCode: string
  label: string
  csvDesc: string
  description: string
  dutyRate: string | null
  valid: boolean
  status: 'done' | 'error'
  error?: string
}

type UploadState = 'idle' | 'parsing' | 'mapping' | 'parsed' | 'classifying' | 'complete'
type SaveState = 'idle' | 'saving' | 'saved' | 'error'

export function UploadForm() {
  const [uploadState, setUploadState] = useState<UploadState>('idle')
  const [rawParse, setRawParse] = useState<RawParseResult | null>(null)
  const [columnMapping, setColumnMapping] = useState<ColumnMapping | null>(null)
  const [aiMapping, setAiMapping] = useState(false)
  const [mappingError, setMappingError] = useState<string | null>(null)
  const [rows, setRows] = useState<ParsedRow[]>([])
  const [detection, setDetection] = useState<DetectionInfo | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const [parseError, setParseError] = useState<string | null>(null)
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [results, setResults] = useState<ValidationResult[]>([])
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    try {
      const saved = localStorage.getItem(CACHE_KEY)
      if (!saved) return
      const cache = JSON.parse(saved) as {
        uploadState: UploadState
        detection: DetectionInfo
        results: ValidationResult[]
        progress: { done: number; total: number }
        saveState?: SaveState
      }
      if (cache.uploadState === 'complete') {
        setUploadState('complete')
        setDetection(cache.detection)
        setResults(cache.results)
        setProgress(cache.progress)
        if (cache.saveState) setSaveState(cache.saveState)
      }
    } catch { /* ignore corrupt cache */ }
  }, [])

  useEffect(() => {
    if (uploadState === 'idle') { localStorage.removeItem(CACHE_KEY); return }
    if (uploadState !== 'complete') return
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ uploadState, detection, results, progress, saveState }))
    } catch { /* storage quota exceeded */ }
  }, [uploadState, detection, results, progress, saveState])

  async function handleFile(file: File) {
    setParseError(null)
    setMappingError(null)
    setUploadState('parsing')
    try {
      const raw = await parseRaw(file)
      setRawParse(raw)
      // Auto-detect as the starting point; user can correct or run AI
      const auto = detectColumns(raw.headers, raw.rawData)
      setColumnMapping({
        htsCol:   raw.headers[auto.htsIdx],
        labelCol: auto.labelIdx !== null ? raw.headers[auto.labelIdx] : null,
        descCol:  auto.descIdx  !== null ? raw.headers[auto.descIdx]  : null,
      })
      setUploadState('mapping')
    } catch (err) {
      setParseError(err instanceof Error ? err.message : 'Failed to parse file')
      setUploadState('idle')
    }
  }

  async function mapWithAI() {
    if (!rawParse) return
    setAiMapping(true)
    setMappingError(null)
    try {
      const res = await fetch('/api/map-columns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ headers: rawParse.headers, sample: rawParse.rawData.slice(0, 10) }),
      })
      const data = await res.json() as { htsCol?: string; labelCol?: string | null; descCol?: string | null; error?: string }
      if (!res.ok || data.error) { setMappingError(data.error ?? 'AI mapping failed'); return }
      setColumnMapping({ htsCol: data.htsCol!, labelCol: data.labelCol ?? null, descCol: data.descCol ?? null })
    } catch (err) {
      setMappingError(err instanceof Error ? err.message : 'AI mapping failed')
    } finally {
      setAiMapping(false)
    }
  }

  function confirmMapping() {
    if (!rawParse || !columnMapping) return
    setParseError(null)
    try {
      const result = applyMapping(rawParse, columnMapping)
      setRows(result.rows)
      setDetection(result.detection)
      setUploadState('parsed')
    } catch (err) {
      setParseError(err instanceof Error ? err.message : 'Failed to apply column mapping')
    }
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault(); setIsDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }
  function handleDragOver(e: React.DragEvent<HTMLDivElement>)  { e.preventDefault(); setIsDragOver(true) }
  function handleDragEnter(e: React.DragEvent<HTMLDivElement>) { e.preventDefault(); setIsDragOver(true) }
  function handleDragLeave(e: React.DragEvent<HTMLDivElement>) {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDragOver(false)
  }
  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
    e.target.value = ''
  }

  async function startValidation() {
    if (!rows.length || !detection) return
    setUploadState('classifying')
    setProgress({ done: 0, total: rows.length })
    setResults([])
    const accumulated: (ValidationResult | null)[] = Array(rows.length).fill(null)
    await runConcurrent(
      rows,
      async (row, i) => {
        try {
          const res = await fetch('/api/validate-hts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ hts_code: row.htsCode, row_index: i }),
          })
          const data = (await res.json()) as { valid?: boolean; description?: string; duty_rate?: string | null; error?: string }
          accumulated[i] = {
            rowIndex: i, htsCode: row.htsCode, label: row.label, csvDesc: row.csvDesc,
            description: data.description ?? '', dutyRate: data.duty_rate ?? null,
            valid: data.valid ?? false, status: res.ok ? 'done' : 'error',
            error: res.ok ? undefined : (data.error ?? 'Lookup failed'),
          }
        } catch {
          accumulated[i] = { rowIndex: i, htsCode: row.htsCode, label: row.label, csvDesc: row.csvDesc, description: '', dutyRate: null, valid: false, status: 'error', error: 'Network error' }
        }
        setResults(accumulated.filter((r): r is ValidationResult => r !== null))
        return null
      },
      { concurrency: CONCURRENCY, onProgress: (done, total) => setProgress({ done, total }) },
    )
    setUploadState('complete')
  }

  async function downloadResults() {
    const mod = await import('xlsx')
    const XLSX = (mod as unknown as { default?: typeof mod }).default ?? mod
    const wsData = results.map((r) => ({
      'HTS Code': r.htsCode,
      ...(r.label    ? { 'Part Number': r.label }       : {}),
      ...(r.csvDesc  ? { 'Description': r.csvDesc }     : {}),
      'USITC Description': r.description,
      'Duty Rate': r.dutyRate ?? '',
      'Result': r.status === 'error' ? `Error: ${r.error ?? ''}` : r.valid ? 'Valid' : 'Not Found',
    }))
    const ws = XLSX.utils.json_to_sheet(wsData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'HTS Validation')
    XLSX.writeFile(wb, `hts-validation-${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  async function saveToHistory() {
    if (!detection || results.length === 0) return
    setSaveState('saving'); setSaveError(null)
    try {
      const res = await fetch('/api/jobs/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          file_name: detection.fileName,
          row_count: results.length,
          results: results.map((r) => ({
            row_index: r.rowIndex, hts_code: r.htsCode, valid: r.valid,
            description: r.description, duty_rate: r.dutyRate,
            status: r.status, error: r.error, label: r.label, csv_desc: r.csvDesc,
          })),
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string }
        setSaveState('error'); setSaveError(`Failed to save: ${err.error ?? res.statusText}`); return
      }
      setSaveState('saved')
    } catch {
      setSaveState('error'); setSaveError('Could not reach the server.')
    }
  }

  function reset() {
    localStorage.removeItem(CACHE_KEY)
    setUploadState('idle'); setRows([]); setDetection(null); setResults([])
    setParseError(null); setMappingError(null); setSaveError(null); setSaveState('idle')
    setProgress({ done: 0, total: 0 }); setRawParse(null); setColumnMapping(null)
  }

  const validCount    = results.filter((r) => r.valid).length
  const notFoundCount = results.filter((r) => r.status === 'done' && !r.valid).length

  return (
    <div className="flex flex-col gap-4">

      {/* ── Drop zone ── */}
      {(uploadState === 'idle' || uploadState === 'parsing') && (
        <>
          {uploadState === 'parsing' ? (
            <div className="border-2 border-dashed border-blue-300 bg-blue-50 rounded-xl p-12 flex flex-col items-center justify-center gap-3 select-none">
              <svg className="w-8 h-8 text-blue-400 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={2} />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
              <p className="text-[12px] font-semibold text-blue-700" style={{ fontFamily: 'var(--font-plex-sans)' }}>Reading file…</p>
            </div>
          ) : (
            <div
              onDrop={handleDrop} onDragOver={handleDragOver} onDragEnter={handleDragEnter} onDragLeave={handleDragLeave}
              onClick={() => inputRef.current?.click()}
              className={['border-2 border-dashed rounded-xl p-12 flex flex-col items-center justify-center gap-3 cursor-pointer transition-colors select-none',
                isDragOver ? 'border-blue-400 bg-blue-50' : 'border-slate-200 bg-white hover:border-blue-300 hover:bg-slate-50'].join(' ')}
            >
              <svg className={`w-10 h-10 ${isDragOver ? 'text-blue-400' : 'text-slate-300'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              <div className="text-center">
                <p className="text-sm font-semibold text-slate-700" style={{ fontFamily: 'var(--font-plex-sans)' }}>Drop XLSX or CSV here</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Any spreadsheet format — AI maps your columns automatically</p>
              </div>
              <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFileInput} />
            </div>
          )}
          {parseError && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              <p className="text-[11px] font-semibold text-red-700 mb-0.5">Upload failed</p>
              <p className="text-[11px] text-red-600">{parseError}</p>
            </div>
          )}
        </>
      )}

      {/* ── Column mapping step ── */}
      {uploadState === 'mapping' && rawParse && columnMapping && (
        <>
          <div className="flex items-center gap-3 bg-white border border-slate-200 rounded-xl px-4 py-3 shadow-sm">
            <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center shrink-0">
              <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-semibold text-slate-900 truncate" style={{ fontFamily: 'var(--font-plex-sans)' }}>{rawParse.fileName}</p>
              <p className="text-[10px] text-slate-400">{rawParse.rawData.length.toLocaleString()} rows · {rawParse.headers.length} columns detected</p>
            </div>
            <button onClick={reset} className="w-6 h-6 flex items-center justify-center rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors shrink-0">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
            </button>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-[12px] font-semibold text-slate-900" style={{ fontFamily: 'var(--font-plex-sans)' }}>Column Mapping</p>
                <p className="text-[10px] text-slate-400 mt-0.5">Review which columns map to each field. Edit if needed.</p>
              </div>
              <button
                onClick={mapWithAI}
                disabled={aiMapping}
                className="flex items-center gap-1.5 text-[10.5px] font-semibold text-blue-600 border border-blue-200 bg-blue-50 hover:bg-blue-100 disabled:opacity-50 rounded-lg px-2.5 py-1.5 transition-colors"
              >
                {aiMapping ? (
                  <><svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={2} /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" /></svg> Mapping…</>
                ) : (
                  <><svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" /></svg> Map with AI</>
                )}
              </button>
            </div>

            {mappingError && (
              <p className="text-[10px] text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 mb-3">{mappingError}</p>
            )}

            <div className="flex flex-col gap-2.5">
              {/* HTS Code column — required */}
              <div className="flex items-center gap-3">
                <div className="w-28 shrink-0">
                  <p className="text-[10.5px] font-semibold text-slate-700">HTS Code</p>
                  <p className="text-[9px] text-red-500">required</p>
                </div>
                <select
                  value={columnMapping.htsCol}
                  onChange={(e) => setColumnMapping((m) => m ? { ...m, htsCol: e.target.value } : m)}
                  className="flex-1 text-[11px] border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-800 focus:outline-none focus:border-blue-400"
                >
                  {rawParse.headers.map((h) => <option key={h} value={h}>{h}</option>)}
                </select>
                <span className="text-[9px] text-slate-400 w-24 truncate shrink-0">
                  e.g. {rawParse.rawData[0]?.[columnMapping.htsCol] ?? '—'}
                </span>
              </div>

              {/* Part Number — optional */}
              <div className="flex items-center gap-3">
                <div className="w-28 shrink-0">
                  <p className="text-[10.5px] font-semibold text-slate-700">Part Number</p>
                  <p className="text-[9px] text-slate-400">optional</p>
                </div>
                <select
                  value={columnMapping.labelCol ?? ''}
                  onChange={(e) => setColumnMapping((m) => m ? { ...m, labelCol: e.target.value || null } : m)}
                  className="flex-1 text-[11px] border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-800 focus:outline-none focus:border-blue-400"
                >
                  <option value="">— None —</option>
                  {rawParse.headers.filter((h) => h !== columnMapping.htsCol).map((h) => <option key={h} value={h}>{h}</option>)}
                </select>
                <span className="text-[9px] text-slate-400 w-24 truncate shrink-0">
                  {columnMapping.labelCol ? (rawParse.rawData[0]?.[columnMapping.labelCol] ?? '—') : ''}
                </span>
              </div>

              {/* Description — optional */}
              <div className="flex items-center gap-3">
                <div className="w-28 shrink-0">
                  <p className="text-[10.5px] font-semibold text-slate-700">Description</p>
                  <p className="text-[9px] text-slate-400">optional</p>
                </div>
                <select
                  value={columnMapping.descCol ?? ''}
                  onChange={(e) => setColumnMapping((m) => m ? { ...m, descCol: e.target.value || null } : m)}
                  className="flex-1 text-[11px] border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-800 focus:outline-none focus:border-blue-400"
                >
                  <option value="">— None —</option>
                  {rawParse.headers.filter((h) => h !== columnMapping.htsCol && h !== columnMapping.labelCol).map((h) => <option key={h} value={h}>{h}</option>)}
                </select>
                <span className="text-[9px] text-slate-400 w-24 truncate shrink-0">
                  {columnMapping.descCol ? (rawParse.rawData[0]?.[columnMapping.descCol] ?? '—') : ''}
                </span>
              </div>
            </div>

            {parseError && (
              <p className="text-[10px] text-red-600 mt-2">{parseError}</p>
            )}

            <button
              onClick={confirmMapping}
              className="w-full mt-4 bg-[#1e293b] hover:bg-[#334155] text-white rounded-xl py-2.5 text-[12px] font-semibold transition-colors flex items-center justify-center gap-2"
              style={{ fontFamily: 'var(--font-plex-sans)' }}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><polyline points="20 6 9 17 4 12" /></svg>
              Confirm Mapping &amp; Preview
            </button>
          </div>
        </>
      )}

      {/* ── File info card (parsed / classifying / complete) ── */}
      {(uploadState === 'parsed' || uploadState === 'classifying' || uploadState === 'complete') && detection && (
        <>
          <div className="flex items-center gap-3 bg-white border border-slate-200 rounded-xl px-4 py-3 shadow-sm">
            <div className="w-8 h-8 bg-green-50 rounded-lg flex items-center justify-center shrink-0">
              <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-semibold text-slate-900 truncate" style={{ fontFamily: 'var(--font-plex-sans)' }}>{detection.fileName}</p>
              <p className="text-[10px] text-green-600">
                ✓ {detection.totalRows} codes · HTS: &ldquo;{detection.htsCol}&rdquo;
                {detection.labelCol ? ` · Part#: "${detection.labelCol}"` : ''}
                {detection.descCol  ? ` · Desc: "${detection.descCol}"` : ''}
              </p>
              {detection.skippedInvalid > 0 && (
                <p className="text-[10px] text-amber-600 mt-0.5">⚠ {detection.skippedInvalid} rows skipped — HTS code not recognised</p>
              )}
              {detection.truncated && (
                <p className="text-[10px] text-amber-600 mt-0.5">⚠ Showing first 5,000 of file — split the file to process the rest</p>
              )}
            </div>
            {uploadState !== 'classifying' && (
              <button onClick={reset} className="w-6 h-6 flex items-center justify-center rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors shrink-0">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </button>
            )}
          </div>

          {uploadState === 'parsed' && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex gap-3 items-start">
              <svg className="w-3.5 h-3.5 text-blue-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
              <p className="text-[10.5px] text-blue-800 leading-relaxed">
                Each HTS code will be cross-referenced against the USITC schedule. Exact matches are <strong>Valid</strong>; missing codes are <strong>Not Found</strong>.
              </p>
            </div>
          )}

          {uploadState === 'classifying' && (
            <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 shadow-sm">
              <div className="flex justify-between items-center mb-2">
                <span className="text-[11px] font-semibold text-slate-700">Validating against USITC…</span>
                <span className="text-[11px] text-slate-500">{progress.done} / {progress.total}</span>
              </div>
              <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-blue-700 to-blue-400 rounded-full transition-all duration-300" style={{ width: `${progress.total > 0 ? (progress.done / progress.total) * 100 : 0}%` }} />
              </div>
              <p className="text-[9px] text-slate-400 mt-1.5">Running {Math.min(CONCURRENCY, rows.length)} lookups at a time · Do not close this tab</p>
            </div>
          )}

          {uploadState === 'complete' && (
            <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
              <div>
                <span className="text-[11px] font-semibold text-green-700">✓ Complete — {progress.total} codes checked</span>
                <span className="text-[10px] text-slate-500 ml-3">{validCount} valid · {notFoundCount} not found</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={reset} className="flex items-center gap-1.5 border border-slate-300 hover:border-slate-400 bg-white hover:bg-slate-50 text-slate-600 rounded-lg px-3 py-1.5 text-[11px] font-medium transition-colors">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 1 0 .49-3.75" /></svg>
                  Start Over
                </button>
                {saveState === 'saved' ? (
                  <span className="flex items-center gap-1.5 text-green-700 text-[11px] font-medium px-3 py-1.5">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><polyline points="20 6 9 17 4 12" /></svg>
                    Saved
                  </span>
                ) : (
                  <button onClick={saveToHistory} disabled={saveState === 'saving'} className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white rounded-lg px-3 py-1.5 text-[11px] font-medium transition-colors">
                    {saveState === 'saving'
                      ? <><svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={2} /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" /></svg> Saving…</>
                      : <><svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" /><polyline points="17 21 17 13 7 13 7 21" /><polyline points="7 3 7 8 15 8" /></svg> Save to History</>
                    }
                  </button>
                )}
                <button onClick={downloadResults} className="flex items-center gap-1.5 bg-[#1e293b] hover:bg-[#334155] text-white rounded-lg px-3 py-1.5 text-[11px] font-medium transition-colors">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
                  Download (.xlsx)
                </button>
              </div>
            </div>
          )}

          {saveError && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
              <p className="text-[11px] font-semibold text-amber-700 mb-0.5">Save warning</p>
              <p className="text-[11px] text-amber-700">{saveError}</p>
            </div>
          )}

          {/* Preview table */}
          {uploadState === 'parsed' && (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
              <div className="bg-slate-50 border-b border-slate-200 px-4 py-2.5">
                <span className="text-[10px] font-semibold text-slate-700">Preview — first {Math.min(10, rows.length)} of {rows.length} rows</span>
              </div>
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-slate-50">
                    <td className="text-[8px] text-slate-400 px-4 py-2 font-semibold uppercase tracking-wide w-8">#</td>
                    <td className="text-[8px] text-slate-400 px-4 py-2 font-semibold uppercase tracking-wide">HTS Code</td>
                    {detection.labelCol && <td className="text-[8px] text-slate-400 px-4 py-2 font-semibold uppercase tracking-wide">Part Number</td>}
                    {detection.descCol  && <td className="text-[8px] text-slate-400 px-4 py-2 font-semibold uppercase tracking-wide">Description</td>}
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 10).map((row, i) => (
                    <tr key={i} className="border-t border-slate-100">
                      <td className="text-[10px] text-slate-400 px-4 py-2">{i + 1}</td>
                      <td className="text-[10px] text-blue-800 px-4 py-2 font-medium" style={{ fontFamily: 'var(--font-plex-mono)' }}>{row.htsCode}</td>
                      {detection.labelCol && <td className="text-[10px] text-slate-600 px-4 py-2">{row.label}</td>}
                      {detection.descCol  && <td className="text-[10px] text-slate-500 px-4 py-2 truncate max-w-[200px]">{row.csvDesc}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
              {rows.length > 10 && <div className="bg-slate-50 border-t border-slate-100 px-4 py-1.5"><span className="text-[9px] text-slate-400">+ {rows.length - 10} more rows</span></div>}
            </div>
          )}

          {/* Results table */}
          {(uploadState === 'classifying' || uploadState === 'complete') && results.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
              <div className="bg-slate-50 border-b border-slate-200 px-4 py-2.5"><span className="text-[10px] font-semibold text-slate-700">Results</span></div>
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-slate-50">
                    <td className="text-[8px] text-slate-400 px-4 py-2 font-semibold uppercase tracking-wide">HTS Code</td>
                    {detection.labelCol && <td className="text-[8px] text-slate-400 px-4 py-2 font-semibold uppercase tracking-wide">Part Number</td>}
                    <td className="text-[8px] text-slate-400 px-4 py-2 font-semibold uppercase tracking-wide">USITC Description</td>
                    <td className="text-[8px] text-slate-400 px-4 py-2 font-semibold uppercase tracking-wide">Duty Rate</td>
                    <td className="text-[8px] text-slate-400 px-4 py-2 font-semibold uppercase tracking-wide">Result</td>
                  </tr>
                </thead>
                <tbody>
                  {results.map((r) => (
                    <tr key={r.rowIndex} className="border-t border-slate-100">
                      <td className="text-[10px] text-blue-800 px-4 py-2 font-medium" style={{ fontFamily: 'var(--font-plex-mono)' }}>{r.htsCode}</td>
                      {detection.labelCol && <td className="text-[10px] text-slate-700 px-4 py-2 truncate max-w-[120px]">{r.label || '—'}</td>}
                      <td className="text-[10px] text-slate-600 px-4 py-2 max-w-[240px] truncate">{r.description || '—'}</td>
                      <td className="text-[10px] text-slate-600 px-4 py-2">{r.dutyRate ?? '—'}</td>
                      <td className="px-4 py-2">
                        {r.status === 'error'
                          ? <span className="text-[9px] bg-red-50 text-red-700 border border-red-100 rounded px-1.5 py-0.5 font-semibold" title={r.error}>Error</span>
                          : r.valid
                            ? <span className="text-[9px] bg-green-50 text-green-700 border border-green-100 rounded px-1.5 py-0.5 font-semibold">✓ Valid</span>
                            : <span className="text-[9px] bg-amber-50 text-amber-700 border border-amber-100 rounded px-1.5 py-0.5 font-semibold">Not Found</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {uploadState === 'parsed' && (
            <button onClick={startValidation} className="w-full bg-[#1e293b] hover:bg-[#334155] text-white rounded-xl py-3 text-[12px] font-semibold transition-colors flex items-center justify-center gap-2" style={{ fontFamily: 'var(--font-plex-sans)' }}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><polygon points="5 3 19 12 5 21 5 3" /></svg>
              Validate {rows.length} HTS Codes
            </button>
          )}
        </>
      )}
    </div>
  )
}

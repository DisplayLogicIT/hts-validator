'use client'

import { useState, useCallback, useRef } from 'react'
import * as XLSX from 'xlsx'
import Papa from 'papaparse'

interface ParsedRow {
  partNumber: string
  description: string
}

interface DetectionInfo {
  partCol: string
  descCol: string | null
  fileName: string
  totalRows: number
}

interface ClassificationResult {
  rowIndex: number
  partNumber: string
  htsCode: string | null
  confidence: number | null
  status: 'done' | 'error'
  error?: string
}

type UploadState = 'idle' | 'parsed' | 'classifying' | 'complete'

function detectColumns(headers: string[]): { partIdx: number; descIdx: number | null } {
  const partKeywords = ['part', 'nsn', 'pn', 'p/n', 'part_no', 'part_number', 'partnumber']
  const descKeywords = ['desc', 'description', 'name', 'item']
  const h = headers.map((s) => s.toLowerCase().trim())

  const partIdxFound = h.findIndex((c) => partKeywords.some((k) => c.includes(k)))
  const partIdx = partIdxFound === -1 ? 0 : partIdxFound

  const descIdxFound = h.findIndex(
    (c, i) => i !== partIdx && descKeywords.some((k) => c.includes(k)),
  )
  let descIdx: number | null = null
  if (descIdxFound !== -1) {
    descIdx = descIdxFound
  } else if (headers.length > 1) {
    descIdx = partIdx === 0 ? 1 : 0
  }

  return { partIdx, descIdx }
}

export function UploadForm() {
  const [uploadState, setUploadState] = useState<UploadState>('idle')
  const [rows, setRows] = useState<ParsedRow[]>([])
  const [detection, setDetection] = useState<DetectionInfo | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [results, setResults] = useState<ClassificationResult[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  function processRawRows(
    data: Record<string, string>[],
    headers: string[],
    fileName: string,
  ) {
    if (data.length === 0) return
    const { partIdx, descIdx } = detectColumns(headers)
    const partCol = headers[partIdx]
    const descCol = descIdx !== null ? headers[descIdx] : null

    const parsed: ParsedRow[] = data
      .map((row) => ({
        partNumber: String(row[partCol] ?? '').trim(),
        description: descCol ? String(row[descCol] ?? '').trim() : '',
      }))
      .filter((r) => r.partNumber.length > 0)

    setRows(parsed)
    setDetection({ partCol, descCol, fileName, totalRows: parsed.length })
    setUploadState('parsed')
  }

  function parseFile(file: File) {
    const ext = file.name.split('.').pop()?.toLowerCase()
    if (ext === 'csv') {
      Papa.parse<Record<string, string>>(file, {
        header: true,
        skipEmptyLines: true,
        complete: (result) => {
          const headers = result.meta.fields ?? []
          processRawRows(result.data, headers, file.name)
        },
      })
    } else {
      const reader = new FileReader()
      reader.onload = (e) => {
        const wb = XLSX.read(e.target?.result, { type: 'array' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const data = XLSX.utils.sheet_to_json<Record<string, string>>(ws, { defval: '' })
        const headers = data.length > 0 ? Object.keys(data[0]) : []
        processRawRows(data, headers, file.name)
      }
      reader.readAsArrayBuffer(file)
    }
  }

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) parseFile(file)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback(() => setIsDragOver(false), [])

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) parseFile(file)
  }

  async function startClassification() {
    if (!rows.length || !detection) return
    setUploadState('classifying')
    setProgress({ done: 0, total: rows.length })
    setResults([])

    const jobRes = await fetch('/api/jobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        file_name: detection.fileName,
        row_count: rows.length,
      }),
    })
    const { id: jobId } = (await jobRes.json()) as { id: string }

    const accumulated: ClassificationResult[] = []

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      const query = row.description
        ? `${row.partNumber} ${row.description}`
        : row.partNumber

      try {
        const res = await fetch('/api/validate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query, job_id: jobId, row_index: i }),
        })
        const data = (await res.json()) as {
          hts_code?: string
          confidence_score?: number
          error?: string
        }

        const pct =
          data.confidence_score != null ? Math.round(data.confidence_score * 100) : null

        accumulated.push({
          rowIndex: i,
          partNumber: row.partNumber,
          htsCode: data.hts_code ?? null,
          confidence: pct,
          status: res.ok ? 'done' : 'error',
          error: res.ok ? undefined : (data.error ?? 'Unknown error'),
        })
      } catch {
        accumulated.push({
          rowIndex: i,
          partNumber: row.partNumber,
          htsCode: null,
          confidence: null,
          status: 'error',
          error: 'Network error',
        })
      }

      setResults([...accumulated])
      setProgress({ done: i + 1, total: rows.length })
    }

    await fetch(`/api/jobs/${jobId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'complete', rows_done: rows.length }),
    })

    setUploadState('complete')
  }

  function downloadResults() {
    const wsData = results.map((r) => ({
      'Part Number': r.partNumber,
      'HTS Code': r.htsCode ?? '',
      'Confidence': r.confidence != null ? `${r.confidence}%` : '',
      'Status': r.status === 'error' ? `Error: ${r.error ?? ''}` : 'Done',
    }))
    const ws = XLSX.utils.json_to_sheet(wsData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'HTS Results')
    XLSX.writeFile(wb, `hts-results-${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  function confColor(pct: number | null): string {
    if (pct == null) return '#94a3b8'
    if (pct >= 80) return '#16a34a'
    if (pct >= 60) return '#ca8a04'
    return '#dc2626'
  }

  function reset() {
    setUploadState('idle')
    setRows([])
    setDetection(null)
    setResults([])
  }

  return (
    <div className="flex flex-col gap-4">

      {/* State 1: Idle drop zone */}
      {uploadState === 'idle' && (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => inputRef.current?.click()}
          className={[
            'border-2 border-dashed rounded-xl p-12 flex flex-col items-center justify-center gap-3 cursor-pointer transition-colors',
            isDragOver
              ? 'border-blue-400 bg-blue-50'
              : 'border-slate-200 bg-white hover:border-blue-300 hover:bg-slate-50',
          ].join(' ')}
        >
          <svg
            className={`w-10 h-10 ${isDragOver ? 'text-blue-400' : 'text-slate-300'}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          <div className="text-center">
            <p className="text-sm font-semibold text-slate-700" style={{ fontFamily: 'var(--font-plex-sans)' }}>
              Drop XLSX or CSV here
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">or click to browse · max 10 MB</p>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={handleFileInput}
          />
        </div>
      )}

      {/* States 2–4: File loaded */}
      {uploadState !== 'idle' && detection && (
        <>
          {/* File pill */}
          <div className="flex items-center gap-3 bg-white border border-slate-200 rounded-xl px-4 py-3 shadow-sm">
            <div className="w-8 h-8 bg-green-50 rounded-lg flex items-center justify-center shrink-0">
              <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-semibold text-slate-900 truncate" style={{ fontFamily: 'var(--font-plex-sans)' }}>
                {detection.fileName}
              </p>
              <p className="text-[10px] text-green-600">
                ✓ {detection.totalRows} parts detected · Part No. in &ldquo;{detection.partCol}&rdquo;
                {detection.descCol ? `, Description in "${detection.descCol}"` : ''}
              </p>
            </div>
            {uploadState === 'parsed' && (
              <button
                onClick={reset}
                className="text-[10px] text-slate-400 hover:text-slate-600 underline shrink-0"
              >
                Replace
              </button>
            )}
          </div>

          {/* Agent detection banner */}
          {uploadState === 'parsed' && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex gap-3 items-start">
              <svg className="w-3.5 h-3.5 text-blue-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <p className="text-[10.5px] text-blue-800 leading-relaxed">
                Agent detected <strong>Part Number</strong> in column &ldquo;{detection.partCol}&rdquo;
                {detection.descCol ? <> and <strong>Description</strong> in column &ldquo;{detection.descCol}&rdquo;</> : ''}.
                {' '}Each row becomes one USITC classification lookup.
              </p>
            </div>
          )}

          {/* Progress bar */}
          {uploadState === 'classifying' && (
            <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 shadow-sm">
              <div className="flex justify-between items-center mb-2">
                <span className="text-[11px] font-semibold text-slate-700" style={{ fontFamily: 'var(--font-plex-sans)' }}>
                  Classifying against USITC…
                </span>
                <span className="text-[11px] text-slate-500">{progress.done} / {progress.total}</span>
              </div>
              <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-700 to-blue-400 rounded-full transition-all duration-300"
                  style={{ width: `${progress.total > 0 ? (progress.done / progress.total) * 100 : 0}%` }}
                />
              </div>
              <p className="text-[9px] text-slate-400 mt-1.5">Do not close this tab</p>
            </div>
          )}

          {/* Complete banner */}
          {uploadState === 'complete' && (
            <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 flex items-center justify-between">
              <span className="text-[11px] font-semibold text-green-700">
                ✓ Classification complete — {progress.total} / {progress.total}
              </span>
              <button
                onClick={downloadResults}
                className="flex items-center gap-1.5 bg-[#1e293b] hover:bg-[#334155] text-white rounded-lg px-3 py-1.5 text-[11px] font-medium transition-colors"
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Download Results (.xlsx)
              </button>
            </div>
          )}

          {/* Preview table */}
          {uploadState === 'parsed' && (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
              <div className="bg-slate-50 border-b border-slate-200 px-4 py-2.5 flex justify-between items-center">
                <span className="text-[10px] font-semibold text-slate-700">
                  Preview — first {Math.min(10, rows.length)} of {rows.length} rows
                </span>
              </div>
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-slate-50">
                    <td className="text-[8px] text-slate-400 px-4 py-2 font-semibold uppercase tracking-wide w-8">#</td>
                    <td className="text-[8px] text-slate-400 px-4 py-2 font-semibold uppercase tracking-wide">Part Number</td>
                    {detection.descCol && (
                      <td className="text-[8px] text-slate-400 px-4 py-2 font-semibold uppercase tracking-wide">Description</td>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 10).map((row, i) => (
                    <tr key={i} className="border-t border-slate-100">
                      <td className="text-[10px] text-slate-400 px-4 py-2">{i + 1}</td>
                      <td
                        className="text-[10px] text-blue-800 px-4 py-2 font-medium"
                        style={{ fontFamily: 'var(--font-plex-mono)' }}
                      >
                        {row.partNumber}
                      </td>
                      {detection.descCol && (
                        <td className="text-[10px] text-slate-600 px-4 py-2">{row.description}</td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
              {rows.length > 10 && (
                <div className="bg-slate-50 border-t border-slate-100 px-4 py-1.5">
                  <span className="text-[9px] text-slate-400">+ {rows.length - 10} more rows</span>
                </div>
              )}
            </div>
          )}

          {/* Live results table */}
          {(uploadState === 'classifying' || uploadState === 'complete') && results.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
              <div className="bg-slate-50 border-b border-slate-200 px-4 py-2.5">
                <span className="text-[10px] font-semibold text-slate-700">Results</span>
              </div>
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-slate-50">
                    <td className="text-[8px] text-slate-400 px-4 py-2 font-semibold uppercase tracking-wide">Part Number</td>
                    <td className="text-[8px] text-slate-400 px-4 py-2 font-semibold uppercase tracking-wide">HTS Code</td>
                    <td className="text-[8px] text-slate-400 px-4 py-2 font-semibold uppercase tracking-wide">Conf.</td>
                    <td className="text-[8px] text-slate-400 px-4 py-2 font-semibold uppercase tracking-wide">Status</td>
                  </tr>
                </thead>
                <tbody>
                  {results.map((r) => (
                    <tr key={r.rowIndex} className="border-t border-slate-100">
                      <td
                        className="text-[10px] text-blue-800 px-4 py-2 font-medium"
                        style={{ fontFamily: 'var(--font-plex-mono)' }}
                      >
                        {r.partNumber}
                      </td>
                      <td
                        className="text-[10px] text-slate-800 px-4 py-2 font-medium"
                        style={{ fontFamily: 'var(--font-plex-mono)' }}
                      >
                        {r.htsCode ?? '—'}
                      </td>
                      <td className="text-[10px] font-semibold px-4 py-2" style={{ color: confColor(r.confidence) }}>
                        {r.confidence != null ? `${r.confidence}%` : '—'}
                      </td>
                      <td className="px-4 py-2">
                        {r.status === 'done' ? (
                          <span className="text-[9px] bg-green-50 text-green-700 border border-green-100 rounded px-1.5 py-0.5 font-semibold">Done</span>
                        ) : (
                          <span className="text-[9px] bg-red-50 text-red-700 border border-red-100 rounded px-1.5 py-0.5 font-semibold" title={r.error}>Error</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Start button */}
          {uploadState === 'parsed' && (
            <button
              onClick={startClassification}
              className="w-full bg-[#1e293b] hover:bg-[#334155] text-white rounded-xl py-3 text-[12px] font-semibold transition-colors flex items-center justify-center gap-2"
              style={{ fontFamily: 'var(--font-plex-sans)' }}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
              Start Classification — {rows.length} parts
            </button>
          )}

          {/* Upload another */}
          {uploadState === 'complete' && (
            <button
              onClick={reset}
              className="text-[11px] text-slate-500 hover:text-slate-700 underline text-center w-full"
            >
              Upload another file
            </button>
          )}
        </>
      )}
    </div>
  )
}

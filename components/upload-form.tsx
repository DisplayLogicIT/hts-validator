'use client'

import { useState, useRef } from 'react'
import Papa from 'papaparse'

const CONCURRENCY = 20

interface ParsedRow {
  htsCode: string
  label: string // part number or other reference column, shown in output
}

interface DetectionInfo {
  htsCol: string
  labelCol: string | null
  fileName: string
  totalRows: number
}

interface ValidationResult {
  rowIndex: number
  htsCode: string
  label: string
  description: string
  dutyRate: string | null
  valid: boolean
  status: 'done' | 'error'
  error?: string
}

type UploadState = 'idle' | 'parsed' | 'classifying' | 'complete'

function detectColumns(headers: string[]): { htsIdx: number; labelIdx: number | null } {
  const htsKeywords = ['hts', 'tariff', 'harmonized', 'htsus', 'hs']
  const labelKeywords = ['part', 'nsn', 'pn', 'p/n', 'description', 'desc', 'item', 'name', 'product']
  const h = headers.map((s) => s.toLowerCase().trim())
  const htsIdxFound = h.findIndex((c) => htsKeywords.some((k) => c.includes(k)))
  const htsIdx = htsIdxFound === -1 ? 0 : htsIdxFound
  const labelIdxFound = h.findIndex((c, i) => i !== htsIdx && labelKeywords.some((k) => c.includes(k)))
  return { htsIdx, labelIdx: labelIdxFound === -1 ? null : labelIdxFound }
}

export function UploadForm() {
  const [uploadState, setUploadState] = useState<UploadState>('idle')
  const [rows, setRows] = useState<ParsedRow[]>([])
  const [detection, setDetection] = useState<DetectionInfo | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const [parseError, setParseError] = useState<string | null>(null)
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [results, setResults] = useState<ValidationResult[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  function processRawRows(data: Record<string, string>[], headers: string[], fileName: string) {
    if (data.length === 0) {
      setParseError('No rows found. Make sure the file has a header row and data rows.')
      return
    }
    const { htsIdx, labelIdx } = detectColumns(headers)
    const htsCol = headers[htsIdx]
    const labelCol = labelIdx !== null ? headers[labelIdx] : null
    const parsed: ParsedRow[] = data
      .map((row) => ({
        htsCode: String(row[htsCol] ?? '').trim(),
        label: labelCol ? String(row[labelCol] ?? '').trim() : '',
      }))
      .filter((r) => r.htsCode.length > 0)
    if (parsed.length === 0) {
      setParseError(`No HTS codes found in column "${htsCol}". Make sure the file has a header row with a column named HTS, Tariff, or HTSUS.`)
      return
    }
    setRows(parsed)
    setDetection({ htsCol, labelCol, fileName, totalRows: parsed.length })
    setUploadState('parsed')
  }

  function parseFile(file: File) {
    setParseError(null)
    const ext = file.name.split('.').pop()?.toLowerCase()
    if (ext === 'csv') {
      Papa.parse<Record<string, string>>(file, {
        header: true,
        skipEmptyLines: true,
        complete: (result) => processRawRows(result.data, result.meta.fields ?? [], file.name),
        error: (err) => setParseError(`CSV error: ${err.message}`),
      })
    } else {
      import('xlsx')
        .then((mod) => {
          const XLSX = (mod as unknown as { default?: typeof mod }).default ?? mod
          const reader = new FileReader()
          reader.onload = (e) => {
            try {
              const wb = XLSX.read(e.target?.result, { type: 'array' })
              const ws = wb.Sheets[wb.SheetNames[0]]
              const data = XLSX.utils.sheet_to_json<Record<string, string>>(ws, { defval: '' })
              const headers = data.length > 0 ? Object.keys(data[0]) : []
              processRawRows(data, headers, file.name)
            } catch (err) {
              setParseError(`Could not read file: ${err instanceof Error ? err.message : String(err)}`)
            }
          }
          reader.onerror = () => setParseError('File read failed. Try again.')
          reader.readAsArrayBuffer(file)
        })
        .catch((err) => setParseError(`Parser failed to load: ${err instanceof Error ? err.message : String(err)}`))
    }
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setIsDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) parseFile(file)
  }

  function handleDragOver(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setIsDragOver(true)
  }

  function handleDragEnter(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setIsDragOver(true)
  }

  function handleDragLeave(e: React.DragEvent<HTMLDivElement>) {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDragOver(false)
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) parseFile(file)
    e.target.value = ''
  }

  async function startValidation() {
    if (!rows.length || !detection) return
    setUploadState('classifying')
    setProgress({ done: 0, total: rows.length })
    setResults([])

    const jobRes = await fetch('/api/jobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ file_name: detection.fileName, row_count: rows.length }),
    })
    const jobJson = (await jobRes.json()) as { id?: string }
    const jobId = jobJson.id ?? null

    const accumulated: (ValidationResult | null)[] = Array(rows.length).fill(null)
    let doneCount = 0
    let nextIdx = 0

    async function validateRow(i: number) {
      const row = rows[i]
      try {
        const res = await fetch('/api/validate-hts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ hts_code: row.htsCode, ...(jobId ? { job_id: jobId } : {}), row_index: i }),
        })
        const data = (await res.json()) as { valid?: boolean; description?: string; duty_rate?: string | null; error?: string }
        accumulated[i] = {
          rowIndex: i,
          htsCode: row.htsCode,
          label: row.label,
          description: data.description ?? '',
          dutyRate: data.duty_rate ?? null,
          valid: data.valid ?? false,
          status: res.ok ? 'done' : 'error',
          error: res.ok ? undefined : (data.error ?? 'Lookup failed'),
        }
      } catch {
        accumulated[i] = { rowIndex: i, htsCode: row.htsCode, label: row.label, description: '', dutyRate: null, valid: false, status: 'error', error: 'Network error' }
      }
      doneCount++
      setProgress({ done: doneCount, total: rows.length })
      setResults(accumulated.filter((r): r is ValidationResult => r !== null))
    }

    async function worker() {
      while (nextIdx < rows.length) await validateRow(nextIdx++)
    }

    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, rows.length) }, worker))

    if (jobId) {
      await fetch(`/api/jobs/${jobId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'complete', rows_done: rows.length }),
      })
    }
    setUploadState('complete')
  }

  async function downloadResults() {
    const mod = await import('xlsx')
    const XLSX = (mod as unknown as { default?: typeof mod }).default ?? mod
    const wsData = results.map((r) => ({
      'HTS Code': r.htsCode,
      ...(r.label ? { 'Part / Reference': r.label } : {}),
      'Description': r.description,
      'Duty Rate': r.dutyRate ?? '',
      'Result': r.status === 'error' ? `Error: ${r.error ?? ''}` : r.valid ? 'Valid' : 'Not Found',
    }))
    const ws = XLSX.utils.json_to_sheet(wsData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'HTS Validation')
    XLSX.writeFile(wb, `hts-validation-${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  function reset() {
    setUploadState('idle'); setRows([]); setDetection(null); setResults([]); setParseError(null)
  }

  const validCount = results.filter((r) => r.valid).length
  const notFoundCount = results.filter((r) => r.status === 'done' && !r.valid).length

  return (
    <div className="flex flex-col gap-4">

      {uploadState === 'idle' && (
        <>
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
              <p className="text-[11px] text-slate-400 mt-0.5">File must have an HTS code column · max 10 MB</p>
            </div>
            <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFileInput} />
          </div>
          {parseError && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              <p className="text-[11px] font-semibold text-red-700 mb-0.5">Upload failed</p>
              <p className="text-[11px] text-red-600">{parseError}</p>
            </div>
          )}
        </>
      )}

      {uploadState !== 'idle' && detection && (
        <>
          {/* File pill */}
          <div className="flex items-center gap-3 bg-white border border-slate-200 rounded-xl px-4 py-3 shadow-sm">
            <div className="w-8 h-8 bg-green-50 rounded-lg flex items-center justify-center shrink-0">
              <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-semibold text-slate-900 truncate" style={{ fontFamily: 'var(--font-plex-sans)' }}>{detection.fileName}</p>
              <p className="text-[10px] text-green-600">✓ {detection.totalRows} codes · HTS in &ldquo;{detection.htsCol}&rdquo;{detection.labelCol ? ` · Reference in “${detection.labelCol}”` : ''}</p>
            </div>
            {uploadState === 'parsed' && <button onClick={reset} className="text-[10px] text-slate-400 hover:text-slate-600 underline shrink-0">Replace</button>}
          </div>

          {/* Info banner */}
          {uploadState === 'parsed' && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex gap-3 items-start">
              <svg className="w-3.5 h-3.5 text-blue-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
              <p className="text-[10.5px] text-blue-800 leading-relaxed">
                Each HTS code will be cross-referenced directly against the USITC schedule. Codes that match exactly are <strong>Valid</strong>. Codes not found in the schedule are <strong>Not Found</strong>.
              </p>
            </div>
          )}

          {/* Progress bar */}
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

          {/* Complete banner */}
          {uploadState === 'complete' && (
            <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
              <div>
                <span className="text-[11px] font-semibold text-green-700">✓ Complete — {progress.total} codes checked</span>
                <span className="text-[10px] text-slate-500 ml-3">{validCount} valid · {notFoundCount} not found</span>
              </div>
              <button onClick={downloadResults} className="flex items-center gap-1.5 bg-[#1e293b] hover:bg-[#334155] text-white rounded-lg px-3 py-1.5 text-[11px] font-medium transition-colors shrink-0">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
                Download Results (.xlsx)
              </button>
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
                    {detection.labelCol && <td className="text-[8px] text-slate-400 px-4 py-2 font-semibold uppercase tracking-wide">Reference</td>}
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 10).map((row, i) => (
                    <tr key={i} className="border-t border-slate-100">
                      <td className="text-[10px] text-slate-400 px-4 py-2">{i + 1}</td>
                      <td className="text-[10px] text-blue-800 px-4 py-2 font-medium" style={{ fontFamily: 'var(--font-plex-mono)' }}>{row.htsCode}</td>
                      {detection.labelCol && <td className="text-[10px] text-slate-600 px-4 py-2">{row.label}</td>}
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
                    <td className="text-[8px] text-slate-400 px-4 py-2 font-semibold uppercase tracking-wide">Description</td>
                    <td className="text-[8px] text-slate-400 px-4 py-2 font-semibold uppercase tracking-wide">Duty Rate</td>
                    <td className="text-[8px] text-slate-400 px-4 py-2 font-semibold uppercase tracking-wide">Result</td>
                  </tr>
                </thead>
                <tbody>
                  {results.map((r) => (
                    <tr key={r.rowIndex} className="border-t border-slate-100">
                      <td className="text-[10px] text-blue-800 px-4 py-2 font-medium" style={{ fontFamily: 'var(--font-plex-mono)' }}>{r.htsCode}</td>
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

          {uploadState === 'complete' && (
            <button onClick={reset} className="text-[11px] text-slate-500 hover:text-slate-700 underline text-center w-full">Upload another file</button>
          )}
        </>
      )}
    </div>
  )
}

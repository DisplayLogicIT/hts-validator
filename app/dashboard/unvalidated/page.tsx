'use client'

import { useState, useEffect, useRef } from 'react'

interface ResultRow {
  id: string
  input_text: string
  hts_code: string | null
  hts_description: string | null
  raw_response: { csv_desc?: string; description?: string } | null
}

interface JobGroup {
  id: string
  file_name: string | null
  input_query: string | null
  type: string
  created_at: string
  results: ResultRow[]
}

type RowScanState = 'idle' | 'scanning' | 'found' | 'not_found' | 'no_description' | 'error'

interface ScanResult {
  state: RowScanState
  hts_code?: string
  description?: string
  duty_rate?: string | null
}

interface BatchProgress {
  total: number
  done: number
  found: number
  running: boolean
}

const SCAN_CONCURRENCY = 5

function formatDate(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  if (d.toDateString() === now.toDateString()) {
    return `Today ${d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
  }
  return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function UnvalidatedPage() {
  const [jobs, setJobs] = useState<JobGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [expandedJob, setExpandedJob] = useState<string | null>(null)
  const [scanState, setScanState] = useState<Record<string, ScanResult>>({})
  const [batchProgress, setBatchProgress] = useState<Record<string, BatchProgress>>({})
  const abortRefs = useRef<Record<string, boolean>>({})

  useEffect(() => {
    fetch('/api/results?status=not_found')
      .then((r) => r.json())
      .then((d: { jobs?: JobGroup[]; error?: string }) => {
        if (d.error) { setFetchError(d.error); setLoading(false); return }
        setJobs(d.jobs ?? [])
        setLoading(false)
      })
      .catch((e: Error) => { setFetchError(e.message); setLoading(false) })
  }, [])

  const totalUnvalidated = jobs.reduce((sum, j) => {
    const found = j.results.filter((r) => scanState[r.id]?.state === 'found').length
    return sum + j.results.length - found
  }, 0)

  async function scanOne(resultId: string): Promise<ScanResult> {
    setScanState((p) => ({ ...p, [resultId]: { state: 'scanning' } }))
    try {
      const res = await fetch(`/api/results/${resultId}/scan`, { method: 'POST' })
      const data = await res.json() as {
        valid?: boolean
        hts_code?: string
        description?: string
        duty_rate?: string | null
        reason?: string
        error?: string
      }
      if (!res.ok) {
        const s: ScanResult = { state: 'error' }
        setScanState((p) => ({ ...p, [resultId]: s }))
        return s
      }
      let s: ScanResult
      if (data.valid) {
        s = { state: 'found', hts_code: data.hts_code, description: data.description, duty_rate: data.duty_rate }
      } else if (data.reason === 'no_description') {
        s = { state: 'no_description' }
      } else {
        s = { state: 'not_found' }
      }
      setScanState((p) => ({ ...p, [resultId]: s }))
      return s
    } catch {
      const s: ScanResult = { state: 'error' }
      setScanState((p) => ({ ...p, [resultId]: s }))
      return s
    }
  }

  async function scanAll(job: JobGroup) {
    const pending = job.results.filter((r) => {
      const s = scanState[r.id]?.state
      return !s || s === 'not_found' || s === 'error'
    })
    if (!pending.length) return

    abortRefs.current[job.id] = false
    setBatchProgress((p) => ({ ...p, [job.id]: { total: pending.length, done: 0, found: 0, running: true } }))

    let idx = 0
    let found = 0

    async function worker() {
      while (idx < pending.length) {
        if (abortRefs.current[job.id]) break
        const row = pending[idx++]
        const result = await scanOne(row.id)
        if (result.state === 'found') found++
        setBatchProgress((p) => ({
          ...p,
          [job.id]: { total: pending.length, done: (p[job.id]?.done ?? 0) + 1, found, running: true },
        }))
      }
    }

    await Promise.all(
      Array.from({ length: Math.min(SCAN_CONCURRENCY, pending.length) }, () => worker())
    )
    setBatchProgress((p) => ({ ...p, [job.id]: { ...p[job.id], running: false } }))
  }

  function stopScan(jobId: string) {
    abortRefs.current[jobId] = true
    setBatchProgress((p) => ({ ...p, [jobId]: { ...p[jobId], running: false } }))
  }

  return (
    <div className="flex flex-col h-full">
      <div className="topbar px-6 py-3 shrink-0 flex items-center justify-between">
        <div>
          <h1 className="text-sm font-semibold text-slate-900" style={{ fontFamily: 'var(--font-plex-sans)' }}>Unvalidated</h1>
          <p className="text-[11px] text-slate-400" style={{ fontFamily: 'var(--font-plex-sans)' }}>
            Codes not matched in USITC · Scan All uses part description to find the correct code
          </p>
        </div>
        <span className="text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 rounded-full px-2.5 py-1">
          {loading
            ? <span className="inline-block w-14 h-2 bg-amber-200 rounded animate-pulse" />
            : `${totalUnvalidated} need attention`}
        </span>
      </div>

      <div className="flex-1 overflow-auto p-6 flex flex-col gap-3">
        {fetchError ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[12px] text-red-700">
            <span className="font-semibold">API error: </span>{fetchError}
          </div>
        ) : loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="data-card px-4 py-3.5 flex items-center gap-3 animate-pulse">
              <div className="w-7 h-7 rounded-lg bg-slate-100" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 w-40 bg-slate-100 rounded" />
                <div className="h-2 w-24 bg-slate-100 rounded" />
              </div>
              <div className="h-5 w-20 bg-slate-100 rounded-full" />
            </div>
          ))
        ) : jobs.length === 0 ? (
          <div className="flex flex-col items-center justify-center flex-1 gap-2 text-slate-400">
            <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-[12px]">All clear — no codes failed validation</p>
          </div>
        ) : (
          jobs.map((job) => {
            const isOpen = expandedJob === job.id
            const label = job.type === 'batch' ? (job.file_name ?? 'Untitled batch') : (job.input_query ?? 'Single lookup')
            const bp = batchProgress[job.id]
            const pendingCount = job.results.filter((r) => {
              const s = scanState[r.id]?.state
              return !s || s === 'not_found' || s === 'error'
            }).length

            return (
              <div key={job.id} className="data-card overflow-hidden">

                {/* Job header */}
                <div className="flex items-center gap-3 px-4 py-3.5">
                  <button
                    onClick={() => setExpandedJob(isOpen ? null : job.id)}
                    className="flex items-center gap-3 flex-1 min-w-0 text-left hover:opacity-80 transition-opacity"
                  >
                    <div className="w-7 h-7 rounded-lg bg-amber-50 border border-amber-100 flex items-center justify-center shrink-0">
                      <svg className="w-3.5 h-3.5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                        <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-semibold text-slate-900 truncate" style={{ fontFamily: 'var(--font-plex-sans)' }}>{label}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">{formatDate(job.created_at)} · {job.results.length} parts</p>
                    </div>
                  </button>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-100 rounded-full px-2 py-0.5">
                      {job.results.length} not found
                    </span>
                    <button
                      onClick={() => { setExpandedJob(job.id); scanAll(job) }}
                      disabled={bp?.running || pendingCount === 0}
                      className="flex items-center gap-1.5 text-[10.5px] font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg px-2.5 py-1.5 transition-colors"
                    >
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                      Scan All
                    </button>
                    <button onClick={() => setExpandedJob(isOpen ? null : job.id)}>
                      <svg
                        className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                        fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                      >
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    </button>
                  </div>
                </div>

                {isOpen && (
                  <div className="border-t border-slate-100">

                    {/* Progress bar — matches upload form style */}
                    {bp?.running && (
                      <div className="px-4 py-3 bg-blue-50/60 border-b border-blue-100">
                        <div className="flex justify-between items-center mb-1.5">
                          <span className="text-[11px] font-semibold text-slate-700">
                            Scanning against USITC…
                          </span>
                          <div className="flex items-center gap-3">
                            <span className="text-[11px] text-slate-500">
                              {bp.done} / {bp.total} · <span className="text-green-700 font-semibold">{bp.found} validated</span>
                            </span>
                            <button
                              onClick={() => stopScan(job.id)}
                              className="text-[10px] font-medium text-slate-400 hover:text-red-500 transition-colors"
                            >
                              Stop
                            </button>
                          </div>
                        </div>
                        <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-blue-700 to-blue-400 rounded-full transition-all duration-300"
                            style={{ width: `${bp.total > 0 ? (bp.done / bp.total) * 100 : 0}%` }}
                          />
                        </div>
                        <p className="text-[9px] text-slate-400 mt-1.5">
                          Running {SCAN_CONCURRENCY} description lookups at a time · searching hts.usitc.gov
                        </p>
                      </div>
                    )}

                    {/* Completion banner */}
                    {bp && !bp.running && bp.done > 0 && (
                      <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                        <span className="text-[11px] text-slate-600">
                          Scan complete ·{' '}
                          <span className="text-green-700 font-semibold">{bp.found} validated</span>
                          {' '}· {bp.total - bp.found} still not found
                        </span>
                        {pendingCount > 0 && (
                          <button
                            onClick={() => scanAll(job)}
                            className="text-[10px] font-semibold text-blue-600 hover:text-blue-700 transition-colors"
                          >
                            Re-scan remaining
                          </button>
                        )}
                      </div>
                    )}

                    {/* Results table */}
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="bg-slate-50">
                          <td className="text-[9px] text-slate-400 px-4 py-2.5 font-semibold uppercase tracking-wide">Input Code</td>
                          <td className="text-[9px] text-slate-400 px-4 py-2.5 font-semibold uppercase tracking-wide">Part Description</td>
                          <td className="text-[9px] text-slate-400 px-4 py-2.5 font-semibold uppercase tracking-wide">USITC Match</td>
                          <td className="text-[9px] text-slate-400 px-4 py-2.5 font-semibold uppercase tracking-wide">Duty</td>
                          <td className="text-[9px] text-slate-400 px-4 py-2.5 font-semibold uppercase tracking-wide w-16">Action</td>
                        </tr>
                      </thead>
                      <tbody>
                        {job.results.map((r) => {
                          const scan = scanState[r.id]
                          const isScanning = scan?.state === 'scanning'
                          const isFound = scan?.state === 'found'
                          const csvDesc = r.raw_response?.csv_desc ?? r.raw_response?.description ?? ''

                          return (
                            <tr
                              key={r.id}
                              className={`border-t border-slate-100 transition-colors ${isFound ? 'bg-green-50/50' : 'hover:bg-slate-50/40'}`}
                            >
                              {/* Input code */}
                              <td className="px-4 py-2.5">
                                <p className="text-[11px] font-medium text-slate-800 truncate max-w-[120px]" style={{ fontFamily: 'var(--font-plex-mono)' }}>
                                  {r.input_text}
                                </p>
                              </td>

                              {/* Part description from CSV */}
                              <td className="px-4 py-2.5 max-w-[200px]">
                                {csvDesc
                                  ? <p className="text-[10.5px] text-slate-600 truncate">{csvDesc}</p>
                                  : <span className="text-[9.5px] text-slate-300 italic">No description</span>}
                              </td>

                              {/* USITC match result */}
                              <td className="px-4 py-2.5">
                                {!scan || scan.state === 'idle' ? (
                                  <span className="text-[9px] bg-amber-50 text-amber-700 border border-amber-100 rounded px-1.5 py-0.5 font-semibold">Not Found</span>
                                ) : isScanning ? (
                                  <span className="flex items-center gap-1.5 text-[10px] text-slate-500">
                                    <span className="w-3 h-3 border border-slate-300 border-t-transparent rounded-full animate-spin" />
                                    Searching…
                                  </span>
                                ) : isFound ? (
                                  <div>
                                    <p className="text-[10.5px] font-semibold text-green-700" style={{ fontFamily: 'var(--font-plex-mono)' }}>{scan.hts_code}</p>
                                    <p className="text-[9.5px] text-slate-500 truncate max-w-[180px] mt-0.5">{scan.description}</p>
                                  </div>
                                ) : scan.state === 'no_description' ? (
                                  <span className="text-[9px] bg-slate-100 text-slate-500 border border-slate-200 rounded px-1.5 py-0.5 font-semibold">No description to search</span>
                                ) : scan.state === 'not_found' ? (
                                  <span className="text-[9px] bg-red-50 text-red-600 border border-red-100 rounded px-1.5 py-0.5 font-semibold">Not in USITC</span>
                                ) : (
                                  <span className="text-[9px] bg-red-50 text-red-600 border border-red-100 rounded px-1.5 py-0.5 font-semibold">Scan error</span>
                                )}
                              </td>

                              {/* Duty rate */}
                              <td className="px-4 py-2.5">
                                <span className="text-[10.5px] text-slate-600">
                                  {isFound ? (scan.duty_rate ?? '—') : '—'}
                                </span>
                              </td>

                              {/* Per-row scan button */}
                              <td className="px-4 py-2.5">
                                <button
                                  onClick={() => scanOne(r.id)}
                                  disabled={isScanning || isFound || !csvDesc}
                                  title={!csvDesc ? 'No description available' : isFound ? 'Already validated' : 'Scan this part'}
                                  className="text-[10px] font-semibold text-blue-600 hover:text-blue-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
                                >
                                  {isScanning ? (
                                    <span className="w-3 h-3 border border-blue-400 border-t-transparent rounded-full animate-spin" />
                                  ) : isFound ? (
                                    <svg className="w-3 h-3 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                      <polyline points="20 6 9 17 4 12" />
                                    </svg>
                                  ) : (
                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                    </svg>
                                  )}
                                  {isFound ? '✓' : 'Scan'}
                                </button>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

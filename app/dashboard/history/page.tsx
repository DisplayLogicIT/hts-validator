'use client'

import { useState, useEffect, useCallback } from 'react'

interface JobRow {
  id: string
  type: 'single' | 'batch'
  status: string
  file_name: string | null
  row_count: number | null
  rows_done: number
  input_query: string | null
  created_at: string
  archived_at: string | null
}

interface ResultRow {
  id: string
  input_text: string
  hts_code: string | null
  hts_description: string | null
  raw_response: { duty_rate?: string | null; valid?: boolean } | null
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  if (d.toDateString() === now.toDateString()) {
    return `Today ${d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
  }
  return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
}

function SkeletonRow() {
  return (
    <div className="data-card px-4 py-3.5 flex items-center gap-3 animate-pulse">
      <div className="w-7 h-7 rounded-lg bg-slate-100" />
      <div className="flex-1 space-y-1.5">
        <div className="h-3 w-48 bg-slate-100 rounded" />
        <div className="h-2 w-24 bg-slate-100 rounded" />
      </div>
      <div className="h-5 w-16 bg-slate-100 rounded-full" />
    </div>
  )
}

export default function HistoryPage() {
  const [jobs, setJobs] = useState<JobRow[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [expandedJob, setExpandedJob] = useState<string | null>(null)
  const [jobResults, setJobResults] = useState<Record<string, ResultRow[]>>({})
  const [loadingResults, setLoadingResults] = useState<Record<string, boolean>>({})
  const [archiving, setArchiving] = useState<Record<string, boolean>>({})

  const loadJobs = useCallback(() => {
    setLoading(true)
    fetch('/api/jobs')
      .then((r) => r.json())
      .then((d: { jobs?: JobRow[]; error?: string }) => {
        if (d.error) { setFetchError(d.error); setLoading(false); return }
        setJobs(d.jobs ?? [])
        setLoading(false)
      })
      .catch((e: Error) => { setFetchError(e.message); setLoading(false) })
  }, [])

  useEffect(() => { loadJobs() }, [loadJobs])

  function toggleExpand(jobId: string) {
    if (expandedJob === jobId) {
      setExpandedJob(null)
      return
    }
    setExpandedJob(jobId)
    if (!jobResults[jobId]) {
      setLoadingResults((p) => ({ ...p, [jobId]: true }))
      fetch(`/api/jobs/${jobId}/results`)
        .then((r) => r.json())
        .then((d: { results?: ResultRow[]; error?: string }) => {
          setJobResults((p) => ({ ...p, [jobId]: d.results ?? [] }))
          setLoadingResults((p) => ({ ...p, [jobId]: false }))
        })
        .catch(() => {
          setJobResults((p) => ({ ...p, [jobId]: [] }))
          setLoadingResults((p) => ({ ...p, [jobId]: false }))
        })
    }
  }

  async function archiveJob(jobId: string) {
    setArchiving((p) => ({ ...p, [jobId]: true }))
    const res = await fetch(`/api/jobs/${jobId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ archive: true }),
    })
    if (res.ok) {
      setJobs((prev) => prev.filter((j) => j.id !== jobId))
      if (expandedJob === jobId) setExpandedJob(null)
    }
    setArchiving((p) => ({ ...p, [jobId]: false }))
  }

  return (
    <div className="flex flex-col h-full">
      <div className="topbar px-6 py-3 shrink-0 flex items-center justify-between">
        <div>
          <h1 className="text-sm font-semibold text-slate-900" style={{ fontFamily: 'var(--font-plex-sans)' }}>Job History</h1>
          <p className="text-[11px] text-slate-400" style={{ fontFamily: 'var(--font-plex-sans)' }}>
            Every upload and validation run · archived items live in Settings
          </p>
        </div>
        <span className="text-[11px] text-slate-500 bg-slate-100 border border-slate-200 rounded-full px-2.5 py-1">
          {loading ? <span className="inline-block w-8 h-2 bg-slate-200 rounded animate-pulse" /> : `${jobs.length} total`}
        </span>
      </div>

      <div className="flex-1 overflow-auto p-6 flex flex-col gap-3">
        {fetchError ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[12px] text-red-700">
            <span className="font-semibold">API error: </span>{fetchError}
          </div>
        ) : loading ? (
          Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
        ) : jobs.length === 0 ? (
          <div className="flex flex-col items-center justify-center flex-1 gap-2 text-slate-400">
            <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
            <p className="text-[12px]">No jobs yet — upload a file to begin</p>
          </div>
        ) : (
          jobs.map((job) => {
            const isOpen = expandedJob === job.id
            const label = job.type === 'batch' ? (job.file_name ?? 'Untitled batch') : (job.input_query ?? 'Single lookup')
            const results = jobResults[job.id] ?? []
            const isLoadingResults = loadingResults[job.id]
            const isArchiving = archiving[job.id]

            return (
              <div key={job.id} className="data-card overflow-hidden">
                <div className="w-full flex items-center gap-3 px-4 py-3.5">
                  {/* Expand button */}
                  <button
                    onClick={() => toggleExpand(job.id)}
                    className="flex items-center gap-3 flex-1 min-w-0 text-left hover:opacity-80 transition-opacity"
                  >
                    <div className="w-7 h-7 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0">
                      <svg className="w-3.5 h-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-semibold text-slate-900 truncate" style={{ fontFamily: 'var(--font-plex-sans)' }}>{label}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">{formatDate(job.created_at)} · {job.row_count ?? job.rows_done ?? '?'} rows</p>
                    </div>
                  </button>

                  {/* Status badge */}
                  <div className="shrink-0">
                    {job.status === 'complete'
                      ? <span className="text-[9px] bg-green-50 text-green-700 border border-green-100 rounded px-1.5 py-0.5 font-semibold">Complete</span>
                      : job.status === 'processing'
                        ? <span className="text-[9px] bg-blue-50 text-blue-700 border border-blue-100 rounded px-1.5 py-0.5 font-semibold">Processing</span>
                        : <span className="text-[9px] bg-red-50 text-red-700 border border-red-100 rounded px-1.5 py-0.5 font-semibold">{job.status}</span>}
                  </div>

                  {/* Delete (archive) button */}
                  <button
                    onClick={() => archiveJob(job.id)}
                    disabled={isArchiving}
                    title="Move to archive"
                    className="shrink-0 w-6 h-6 rounded flex items-center justify-center text-slate-300 hover:text-red-400 hover:bg-red-50 transition-colors"
                  >
                    {isArchiving
                      ? <span className="w-3 h-3 border border-slate-300 border-t-transparent rounded-full animate-spin" />
                      : (
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                          <path d="M10 11v6M14 11v6" />
                          <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                        </svg>
                      )}
                  </button>

                  {/* Expand chevron */}
                  <button onClick={() => toggleExpand(job.id)} className="shrink-0">
                    <svg
                      className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                    >
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </button>
                </div>

                {isOpen && (
                  <div className="border-t border-slate-100">
                    {isLoadingResults ? (
                      <div className="flex items-center justify-center py-8 gap-2 text-slate-400">
                        <span className="w-4 h-4 border border-slate-300 border-t-transparent rounded-full animate-spin" />
                        <span className="text-[11px]">Loading results…</span>
                      </div>
                    ) : results.length === 0 ? (
                      <p className="text-[11px] text-slate-400 text-center py-6">No results saved for this job.</p>
                    ) : (
                      <table className="w-full border-collapse">
                        <thead>
                          <tr className="bg-slate-50">
                            <td className="text-[9px] text-slate-400 px-4 py-2.5 font-semibold uppercase tracking-wide">Input</td>
                            <td className="text-[9px] text-slate-400 px-4 py-2.5 font-semibold uppercase tracking-wide">HTS Code</td>
                            <td className="text-[9px] text-slate-400 px-4 py-2.5 font-semibold uppercase tracking-wide">Description</td>
                            <td className="text-[9px] text-slate-400 px-4 py-2.5 font-semibold uppercase tracking-wide">Duty</td>
                            <td className="text-[9px] text-slate-400 px-4 py-2.5 font-semibold uppercase tracking-wide">Status</td>
                          </tr>
                        </thead>
                        <tbody>
                          {results.map((r) => (
                            <tr key={r.id} className="border-t border-slate-100 hover:bg-slate-50/60 transition-colors">
                              <td className="px-4 py-2.5">
                                <p className="text-[11px] font-medium text-slate-900 truncate max-w-[160px]" style={{ fontFamily: 'var(--font-plex-mono)' }}>
                                  {r.input_text}
                                </p>
                              </td>
                              <td className="px-4 py-2.5">
                                <span className="text-[10.5px] font-medium text-blue-800" style={{ fontFamily: 'var(--font-plex-mono)' }}>
                                  {r.hts_code ?? '—'}
                                </span>
                              </td>
                              <td className="px-4 py-2.5 max-w-[220px]">
                                <p className="text-[10.5px] text-slate-600 truncate">{r.hts_description || '—'}</p>
                              </td>
                              <td className="px-4 py-2.5">
                                <span className="text-[10.5px] text-slate-700">{r.raw_response?.duty_rate || '—'}</span>
                              </td>
                              <td className="px-4 py-2.5">
                                {r.hts_code
                                  ? <span className="text-[9px] bg-green-50 text-green-700 border border-green-100 rounded px-1.5 py-0.5 font-semibold">Valid</span>
                                  : <span className="text-[9px] bg-amber-50 text-amber-700 border border-amber-100 rounded px-1.5 py-0.5 font-semibold">Not found</span>}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
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

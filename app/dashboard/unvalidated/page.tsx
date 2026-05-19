'use client'

import { useState, useEffect } from 'react'

interface ResultRow {
  id: string
  input_text: string
  hts_code: string | null
  hts_description: string | null
}

interface JobGroup {
  id: string
  file_name: string | null
  input_query: string | null
  type: string
  created_at: string
  results: ResultRow[]
}

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

  const totalUnvalidated = jobs.reduce((sum, j) => sum + j.results.length, 0)

  return (
    <div className="flex flex-col h-full">
      <div className="topbar px-6 py-3 shrink-0 flex items-center justify-between">
        <div>
          <h1 className="text-sm font-semibold text-slate-900" style={{ fontFamily: 'var(--font-plex-sans)' }}>Unvalidated</h1>
          <p className="text-[11px] text-slate-400" style={{ fontFamily: 'var(--font-plex-sans)' }}>Codes not found in USITC · review and re-submit with a corrected code</p>
        </div>
        <span className="text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 rounded-full px-2.5 py-1">
          {loading ? <span className="inline-block w-14 h-2 bg-amber-200 rounded animate-pulse" /> : `${totalUnvalidated} need attention`}
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
            return (
              <div key={job.id} className="data-card overflow-hidden">
                <button
                  onClick={() => setExpandedJob(isOpen ? null : job.id)}
                  className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-slate-50/60 transition-colors text-left"
                >
                  <div className="w-7 h-7 rounded-lg bg-amber-50 border border-amber-100 flex items-center justify-center shrink-0">
                    <svg className="w-3.5 h-3.5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                      <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-semibold text-slate-900 truncate" style={{ fontFamily: 'var(--font-plex-sans)' }}>{label}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">{formatDate(job.created_at)}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-100 rounded-full px-2 py-0.5">
                      {job.results.length} not found
                    </span>
                    <svg className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </div>
                </button>

                {isOpen && (
                  <div className="border-t border-slate-100">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="bg-slate-50">
                          <td className="text-[9px] text-slate-400 px-4 py-2.5 font-semibold uppercase tracking-wide">Input Code</td>
                          <td className="text-[9px] text-slate-400 px-4 py-2.5 font-semibold uppercase tracking-wide">Status</td>
                        </tr>
                      </thead>
                      <tbody>
                        {job.results.map((r) => (
                          <tr key={r.id} className="border-t border-slate-100 hover:bg-slate-50/40 transition-colors">
                            <td className="px-4 py-2.5">
                              <p className="text-[11px] font-medium text-slate-900 truncate max-w-[320px]" style={{ fontFamily: 'var(--font-plex-mono)' }}>
                                {r.input_text}
                              </p>
                            </td>
                            <td className="px-4 py-2.5">
                              <span className="text-[9px] bg-amber-50 text-amber-700 border border-amber-100 rounded px-1.5 py-0.5 font-semibold">Not Found in USITC</span>
                            </td>
                          </tr>
                        ))}
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

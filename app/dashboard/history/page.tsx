'use client'

import { useState, useEffect } from 'react'

interface JobRow {
  id: string
  type: 'single' | 'batch'
  status: string
  file_name: string | null
  row_count: number | null
  rows_done: number
  valid_count: number
  not_found_count: number
  input_query: string | null
  created_at: string
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  if (d.toDateString() === now.toDateString()) {
    return `Today ${d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
  }
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

function SkeletonRow() {
  return (
    <div className="border-t border-slate-100 px-4 py-3.5 flex items-center gap-4">
      <div className="flex-1 space-y-1.5">
        <div className="h-2.5 w-36 bg-slate-100 rounded animate-pulse" />
        <div className="h-2 w-16 bg-slate-100 rounded animate-pulse" />
      </div>
      <div className="h-4 w-16 bg-slate-100 rounded animate-pulse" />
      <div className="h-2.5 w-8 bg-slate-100 rounded animate-pulse" />
      <div className="h-2.5 w-8 bg-slate-100 rounded animate-pulse" />
      <div className="h-2.5 w-8 bg-slate-100 rounded animate-pulse" />
      <div className="h-2.5 w-16 bg-slate-100 rounded animate-pulse" />
    </div>
  )
}

export default function HistoryPage() {
  const [jobs, setJobs] = useState<JobRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/jobs')
      .then((r) => r.json())
      .then((d: { jobs?: JobRow[] }) => { setJobs(d.jobs ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  return (
    <div className="flex flex-col h-full">
      <div className="topbar px-6 py-3 shrink-0 flex items-center justify-between">
        <div>
          <h1 className="text-sm font-semibold text-slate-900" style={{ fontFamily: 'var(--font-plex-sans)' }}>Job History</h1>
          <p className="text-[11px] text-slate-400" style={{ fontFamily: 'var(--font-plex-sans)' }}>Every upload and validation run</p>
        </div>
        <span className="text-[11px] text-slate-500 bg-slate-100 border border-slate-200 rounded-full px-2.5 py-1">
          {loading ? <span className="inline-block w-8 h-2 bg-slate-200 rounded animate-pulse" /> : `${jobs.length} total`}
        </span>
      </div>

      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="data-card">
            <div className="bg-slate-50 border-b border-slate-100 h-10" />
            {Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)}
          </div>
        ) : jobs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-slate-400">
            <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
            <p className="text-[12px]">No jobs yet — upload a file to begin</p>
          </div>
        ) : (
          <div className="data-card">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <td className="text-[9px] text-slate-400 px-4 py-3 font-semibold uppercase tracking-wide">File / Query</td>
                  <td className="text-[9px] text-slate-400 px-4 py-3 font-semibold uppercase tracking-wide">Status</td>
                  <td className="text-[9px] text-slate-400 px-4 py-3 font-semibold uppercase tracking-wide">Total</td>
                  <td className="text-[9px] text-slate-400 px-4 py-3 font-semibold uppercase tracking-wide">Valid</td>
                  <td className="text-[9px] text-slate-400 px-4 py-3 font-semibold uppercase tracking-wide">Not Found</td>
                  <td className="text-[9px] text-slate-400 px-4 py-3 font-semibold uppercase tracking-wide">Date</td>
                </tr>
              </thead>
              <tbody>
                {jobs.map((job) => {
                  const label = job.type === 'batch' ? (job.file_name ?? 'Untitled batch') : (job.input_query ?? 'Single lookup')
                  return (
                    <tr key={job.id} className="border-t border-slate-100 hover:bg-slate-50/80 transition-colors">
                      <td className="px-4 py-3">
                        <p className="text-[11px] font-medium text-slate-900 truncate max-w-[200px]" style={{ fontFamily: 'var(--font-plex-sans)' }} title={label}>{label}</p>
                        <p className="text-[9px] text-slate-400">{job.type === 'batch' ? 'Batch upload' : 'Single lookup'}</p>
                      </td>
                      <td className="px-4 py-3">
                        {job.status === 'complete'
                          ? <span className="text-[9px] bg-green-50 text-green-700 border border-green-100 rounded px-1.5 py-0.5 font-semibold">Complete</span>
                          : job.status === 'processing'
                            ? <span className="text-[9px] bg-blue-50 text-blue-700 border border-blue-100 rounded px-1.5 py-0.5 font-semibold">Processing</span>
                            : <span className="text-[9px] bg-red-50 text-red-700 border border-red-100 rounded px-1.5 py-0.5 font-semibold">{job.status}</span>}
                      </td>
                      <td className="px-4 py-3 text-[11px] text-slate-800">{job.row_count ?? job.rows_done ?? '—'}</td>
                      <td className="px-4 py-3 text-[11px] font-semibold text-green-700">
                        {job.valid_count > 0 ? job.valid_count : <span className="text-slate-400 font-normal">—</span>}
                      </td>
                      <td className="px-4 py-3 text-[11px] font-semibold text-amber-700">
                        {job.not_found_count > 0 ? job.not_found_count : <span className="text-slate-400 font-normal">—</span>}
                      </td>
                      <td className="px-4 py-3 text-[11px] text-slate-500">{formatDate(job.created_at)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

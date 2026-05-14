'use client'

import { useState, useEffect } from 'react'

interface Part {
  id: string
  part_number: string
  description: string | null
  hts_code: string
  usitc_description: string | null
  duty_rate: string | null
  last_validated_at: string | null
}

interface Job {
  id: string
  file_name: string | null
  input_query: string | null
  type: string
  created_at: string
  valid_count: number
  row_count: number | null
  parts: Part[]
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  if (d.toDateString() === now.toDateString()) {
    return `Today ${d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
  }
  return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function ValidatedPage() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedJob, setExpandedJob] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/parts?view=jobs&status=valid')
      .then((r) => r.json())
      .then((d: { jobs?: Job[] }) => { setJobs(d.jobs ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const totalValid = jobs.reduce((sum, j) => sum + j.parts.length, 0)

  return (
    <div className="flex flex-col h-full">
      <div className="topbar px-6 py-3 shrink-0 flex items-center justify-between">
        <div>
          <h1 className="text-sm font-semibold text-slate-900" style={{ fontFamily: 'var(--font-plex-sans)' }}>Validated</h1>
          <p className="text-[11px] text-slate-400" style={{ fontFamily: 'var(--font-plex-sans)' }}>USITC-confirmed HTS codes · organized by batch</p>
        </div>
        <span className="text-[11px] font-semibold bg-green-50 text-green-700 border border-green-200 rounded-full px-2.5 py-1">
          {loading ? <span className="inline-block w-10 h-2 bg-green-200 rounded animate-pulse" /> : `${totalValid} valid`}
        </span>
      </div>

      <div className="flex-1 overflow-auto p-6 flex flex-col gap-3">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="data-card px-4 py-3.5 flex items-center gap-3 animate-pulse">
              <div className="w-7 h-7 rounded-lg bg-slate-100" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 w-40 bg-slate-100 rounded" />
                <div className="h-2 w-24 bg-slate-100 rounded" />
              </div>
              <div className="h-5 w-16 bg-slate-100 rounded-full" />
            </div>
          ))
        ) : jobs.length === 0 ? (
          <div className="flex flex-col items-center justify-center flex-1 gap-2 text-slate-400">
            <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-[12px]">No validated parts yet — upload a file to begin</p>
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
                  <div className="w-7 h-7 rounded-lg bg-green-50 border border-green-100 flex items-center justify-center shrink-0">
                    <svg className="w-3.5 h-3.5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75" />
                      <circle cx="12" cy="12" r="9" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-semibold text-slate-900 truncate" style={{ fontFamily: 'var(--font-plex-sans)' }}>{label}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">{formatDate(job.created_at)}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] font-semibold bg-green-50 text-green-700 border border-green-100 rounded-full px-2 py-0.5">
                      {job.parts.length} valid
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
                          <td className="text-[9px] text-slate-400 px-4 py-2.5 font-semibold uppercase tracking-wide">Part Number</td>
                          <td className="text-[9px] text-slate-400 px-4 py-2.5 font-semibold uppercase tracking-wide">Description</td>
                          <td className="text-[9px] text-slate-400 px-4 py-2.5 font-semibold uppercase tracking-wide">HTS Code</td>
                          <td className="text-[9px] text-slate-400 px-4 py-2.5 font-semibold uppercase tracking-wide">USITC Description</td>
                          <td className="text-[9px] text-slate-400 px-4 py-2.5 font-semibold uppercase tracking-wide">Duty Rate</td>
                        </tr>
                      </thead>
                      <tbody>
                        {job.parts.map((part) => (
                          <tr key={part.id} className="border-t border-slate-100 hover:bg-slate-50/60 transition-colors">
                            <td className="px-4 py-2.5">
                              <p className="text-[11px] font-medium text-slate-900 truncate max-w-[140px]" style={{ fontFamily: 'var(--font-plex-sans)' }}>
                                {part.part_number || '—'}
                              </p>
                            </td>
                            <td className="px-4 py-2.5 max-w-[160px]">
                              <p className="text-[10.5px] text-slate-500 truncate">{part.description || '—'}</p>
                            </td>
                            <td className="px-4 py-2.5">
                              <span className="text-[10.5px] font-medium text-blue-800" style={{ fontFamily: 'var(--font-plex-mono)' }}>{part.hts_code}</span>
                            </td>
                            <td className="px-4 py-2.5 max-w-[220px]">
                              <p className="text-[10.5px] text-slate-600 truncate">{part.usitc_description || '—'}</p>
                            </td>
                            <td className="px-4 py-2.5">
                              <span className="text-[10.5px] text-slate-700">{part.duty_rate || '—'}</span>
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

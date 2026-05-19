'use client'

import { useState, useEffect } from 'react'

interface LookupResult {
  suggested_hts: string
  duty_rate: string
  confidence: string
  reasoning: string
}

interface Part {
  id: string
  part_number: string
  description: string | null
  hts_code: string
  validation_status: string
  lookup_status: string
  lookup_result: LookupResult | null
}

interface Job {
  id: string
  file_name: string | null
  input_query: string | null
  type: string
  created_at: string
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

export default function UnvalidatedPage() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [expandedJob, setExpandedJob] = useState<string | null>(null)
  const [lookingUp, setLookingUp] = useState<Set<string>>(new Set())
  const [lookupResults, setLookupResults] = useState<Map<string, LookupResult>>(new Map())
  const [expandedLookup, setExpandedLookup] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/parts?view=jobs&status=not_found,error,pending')
      .then((r) => r.json())
      .then((d: { jobs?: Job[]; error?: string }) => {
        if (d.error) { setFetchError(d.error); setLoading(false); return }
        const fetchedJobs = d.jobs ?? []
        setJobs(fetchedJobs)
        // Pre-populate results from DB (previously looked-up parts)
        const init = new Map<string, LookupResult>()
        for (const job of fetchedJobs) {
          for (const part of job.parts) {
            if (part.lookup_result && part.lookup_status === 'complete') {
              init.set(part.id, part.lookup_result)
            }
          }
        }
        setLookupResults(init)
        setLoading(false)
      })
      .catch((e: Error) => { setFetchError(e.message); setLoading(false) })
  }, [])

  async function runLookup(partId: string) {
    setLookingUp((prev) => new Set(prev).add(partId))
    setExpandedLookup(partId)
    try {
      const res = await fetch(`/api/parts/${partId}/lookup`, { method: 'POST' })
      const data = await res.json() as { result?: LookupResult }
      if (data.result) {
        setLookupResults((prev) => new Map(prev).set(partId, data.result!))
      }
    } catch { /* show stale state */ }
    setLookingUp((prev) => { const s = new Set(prev); s.delete(partId); return s })
  }

  const totalUnvalidated = jobs.reduce((sum, j) => sum + j.parts.length, 0)

  return (
    <div className="flex flex-col h-full">
      <div className="topbar px-6 py-3 shrink-0 flex items-center justify-between">
        <div>
          <h1 className="text-sm font-semibold text-slate-900" style={{ fontFamily: 'var(--font-plex-sans)' }}>Unvalidated</h1>
          <p className="text-[11px] text-slate-400" style={{ fontFamily: 'var(--font-plex-sans)' }}>Codes not found in USITC · use Research to find the correct classification</p>
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
            <p className="text-[12px]">All parts validated — nothing needs attention</p>
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
                      {job.parts.length} unvalidated
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
                          <td className="text-[9px] text-slate-400 px-4 py-2.5 font-semibold uppercase tracking-wide">Status</td>
                          <td className="text-[9px] text-slate-400 px-4 py-2.5 font-semibold uppercase tracking-wide">Action</td>
                        </tr>
                      </thead>
                      <tbody>
                        {job.parts.flatMap((part) => {
                          const isLookingUp = lookingUp.has(part.id)
                          const result = lookupResults.get(part.id)
                          const isExpanded = expandedLookup === part.id

                          const mainRow = (
                            <tr key={part.id} className="border-t border-slate-100 hover:bg-slate-50/40 transition-colors">
                              <td className="px-4 py-2.5">
                                <p className="text-[11px] font-medium text-slate-900 truncate max-w-[130px]" style={{ fontFamily: 'var(--font-plex-sans)' }}>
                                  {part.part_number || '—'}
                                </p>
                              </td>
                              <td className="px-4 py-2.5 max-w-[160px]">
                                <p className="text-[10.5px] text-slate-500 truncate">{part.description || '—'}</p>
                              </td>
                              <td className="px-4 py-2.5">
                                <span className="text-[10.5px] font-medium text-slate-700" style={{ fontFamily: 'var(--font-plex-mono)' }}>{part.hts_code}</span>
                              </td>
                              <td className="px-4 py-2.5">
                                {part.validation_status === 'not_found' && (
                                  <span className="text-[9px] bg-amber-50 text-amber-700 border border-amber-100 rounded px-1.5 py-0.5 font-semibold">Not Found</span>
                                )}
                                {part.validation_status === 'error' && (
                                  <span className="text-[9px] bg-red-50 text-red-700 border border-red-100 rounded px-1.5 py-0.5 font-semibold">Error</span>
                                )}
                                {part.validation_status === 'pending' && (
                                  <span className="text-[9px] bg-slate-100 text-slate-600 border border-slate-200 rounded px-1.5 py-0.5 font-semibold">Pending</span>
                                )}
                              </td>
                              <td className="px-4 py-2.5">
                                <button
                                  onClick={() => {
                                    if (result) {
                                      setExpandedLookup(isExpanded ? null : part.id)
                                    } else {
                                      runLookup(part.id)
                                    }
                                  }}
                                  disabled={isLookingUp}
                                  className={[
                                    'text-[10px] font-semibold px-2.5 py-1 rounded-md border transition-colors whitespace-nowrap',
                                    result
                                      ? 'bg-blue-50 text-blue-700 border-blue-100 hover:bg-blue-100'
                                      : 'bg-[#0c1525] text-white border-transparent hover:bg-[#152030]',
                                    isLookingUp ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer',
                                  ].join(' ')}
                                >
                                  {isLookingUp ? (
                                    <span className="flex items-center gap-1.5">
                                      <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                      </svg>
                                      Researching…
                                    </span>
                                  ) : result ? (
                                    isExpanded ? 'Hide' : 'View Result'
                                  ) : (
                                    'Research →'
                                  )}
                                </button>
                              </td>
                            </tr>
                          )

                          if (!isExpanded || !result) return [mainRow]

                          const confidenceColor =
                            result.confidence === 'high' ? '#15803d'
                            : result.confidence === 'medium' ? '#b45309'
                            : '#dc2626'

                          const resultRow = (
                            <tr key={`${part.id}-lookup`} className="border-t border-blue-100 bg-blue-50/50">
                              <td colSpan={5} className="px-4 py-3">
                                <div className="flex flex-col gap-2">
                                  <div className="flex items-start gap-6 flex-wrap">
                                    <div>
                                      <p className="text-[9px] text-slate-400 uppercase tracking-wide font-semibold mb-0.5">Suggested HTS</p>
                                      <p className="text-[13px] font-bold text-blue-800" style={{ fontFamily: 'var(--font-plex-mono)' }}>
                                        {result.suggested_hts || '—'}
                                      </p>
                                    </div>
                                    <div>
                                      <p className="text-[9px] text-slate-400 uppercase tracking-wide font-semibold mb-0.5">Duty Rate</p>
                                      <p className="text-[13px] font-bold text-slate-800">{result.duty_rate || '—'}</p>
                                    </div>
                                    <div>
                                      <p className="text-[9px] text-slate-400 uppercase tracking-wide font-semibold mb-0.5">Confidence</p>
                                      <p className="text-[12px] font-semibold capitalize" style={{ color: confidenceColor }}>{result.confidence}</p>
                                    </div>
                                  </div>
                                  <p className="text-[10.5px] text-slate-600 leading-relaxed border-t border-blue-100 pt-2">{result.reasoning}</p>
                                </div>
                              </td>
                            </tr>
                          )

                          return [mainRow, resultRow]
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

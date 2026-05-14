'use client'

import { useState, useEffect } from 'react'

interface Part {
  id: string
  part_number: string
  hts_code: string
  validation_status: string
  last_validated_at: string | null
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
        <div className="h-2.5 w-28 bg-slate-100 rounded animate-pulse" />
      </div>
      <div className="h-2.5 w-24 bg-slate-100 rounded animate-pulse" />
      <div className="h-4 w-16 bg-amber-100 rounded animate-pulse" />
      <div className="h-2.5 w-20 bg-slate-100 rounded animate-pulse" />
    </div>
  )
}

export default function UnvalidatedPage() {
  const [parts, setParts] = useState<Part[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/parts?status=not_found,error,pending')
      .then((r) => r.json())
      .then((d: { parts?: Part[] }) => { setParts(d.parts ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  return (
    <div className="flex flex-col h-full">
      <div className="bg-white border-b border-slate-200 px-6 py-3 shrink-0 flex items-center justify-between">
        <div>
          <h1 className="text-sm font-semibold text-slate-900" style={{ fontFamily: 'var(--font-plex-sans)' }}>Unvalidated Parts</h1>
          <p className="text-[11px] text-slate-400" style={{ fontFamily: 'var(--font-plex-sans)' }}>Codes not found in USITC or never checked — review and correct</p>
        </div>
        <span className="text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 rounded-full px-2.5 py-1">
          {loading ? <span className="inline-block w-14 h-2 bg-amber-200 rounded animate-pulse" /> : `${parts.length} need attention`}
        </span>
      </div>

      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <div className="bg-slate-50 border-b border-slate-200 h-10" />
            {Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)}
          </div>
        ) : parts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-slate-400">
            <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-[12px]">All parts validated — nothing needs attention</p>
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <td className="text-[9px] text-slate-400 px-4 py-3 font-semibold uppercase tracking-wide">Part / Reference</td>
                  <td className="text-[9px] text-slate-400 px-4 py-3 font-semibold uppercase tracking-wide">HTS Code</td>
                  <td className="text-[9px] text-slate-400 px-4 py-3 font-semibold uppercase tracking-wide">Status</td>
                  <td className="text-[9px] text-slate-400 px-4 py-3 font-semibold uppercase tracking-wide">Last Checked</td>
                </tr>
              </thead>
              <tbody>
                {parts.map((part) => (
                  <tr key={part.id} className="border-t border-slate-100 hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="text-[11px] font-medium text-slate-900 truncate max-w-[200px]" style={{ fontFamily: 'var(--font-plex-sans)' }}>
                        {part.part_number || '—'}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[10.5px] font-medium text-slate-700" style={{ fontFamily: 'var(--font-plex-mono)' }}>{part.hts_code}</span>
                    </td>
                    <td className="px-4 py-3">
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
                    <td className="px-4 py-3 text-[10.5px] text-slate-500">
                      {part.last_validated_at ? formatDate(part.last_validated_at) : 'Never'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

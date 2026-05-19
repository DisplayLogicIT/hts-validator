'use client'

import { useState } from 'react'

interface ValidateResponse {
  hts_code: string
  hts_description: string
  confidence_score: number
  source_url: string
  reasoning: string
  duty_rate?: string
  chapter?: string
  error?: string
}

export function LookupForm() {
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ValidateResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!query.trim()) return
    setLoading(true)
    setResult(null)
    setError(null)

    try {
      const res = await fetch('/api/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      })
      const data = (await res.json()) as ValidateResponse
      if (!res.ok) {
        setError(data.error ?? 'Validation failed')
      } else {
        setResult(data)
      }
    } catch {
      setError('Network error — please try again')
    } finally {
      setLoading(false)
    }
  }

  const pct = result ? Math.round(result.confidence_score * 100) : 0
  const confidenceColor =
    pct >= 80 ? '#16a34a' : pct >= 60 ? '#ca8a04' : '#dc2626'

  return (
    <div className="flex flex-col gap-4">
      {/* Search card */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
        <label
          htmlFor="hts-query"
          className="block text-[10px] font-semibold text-slate-600 uppercase tracking-[0.05em] mb-1.5"
          style={{ fontFamily: 'var(--font-plex-sans)' }}
        >
          Part Number or Description
        </label>
        <form onSubmit={handleSubmit} className="flex gap-2">
          <div className="relative flex-1">
            <input
              id="hts-query"
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g. MIL-C-5015 circular connector, aluminum shell"
              className="w-full bg-slate-50 border border-slate-200 rounded-lg h-9 px-3 text-[12px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent pr-7"
              style={{ fontFamily: 'var(--font-plex-sans)' }}
              disabled={loading}
            />
            {(query || result) && !loading && (
              <button
                type="button"
                onClick={() => { setQuery(''); setResult(null); setError(null) }}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors"
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            )}
          </div>
          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="bg-[#1e293b] hover:bg-[#334155] text-white rounded-lg h-9 px-4 text-[11px] font-medium disabled:opacity-40 transition-colors shrink-0"
            style={{ fontFamily: 'var(--font-plex-sans)' }}
          >
            {loading ? (
              <span className="flex items-center gap-1.5">
                <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                Looking up…
              </span>
            ) : (
              'Look up'
            )}
          </button>
        </form>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[12px] text-red-700">
          {error}
        </div>
      )}

      {/* Result card */}
      {result && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          {/* Result header */}
          <div className="bg-[#eff6ff] border-b border-[#bfdbfe] px-4 py-3.5 flex items-start justify-between">
            <div>
              <p className="text-[9px] text-blue-500 uppercase tracking-[0.07em] font-semibold mb-0.5">
                HTS Code
              </p>
              <p
                className="text-[22px] font-bold text-[#1e40af] leading-none"
                style={{ fontFamily: 'var(--font-plex-mono)' }}
              >
                {result.hts_code || '—'}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[9px] text-blue-500 uppercase tracking-[0.07em] font-semibold mb-0.5">
                Confidence
              </p>
              <p
                className="text-[22px] font-bold leading-none"
                style={{ color: confidenceColor }}
              >
                {pct}%
              </p>
            </div>
          </div>

          {/* Result body */}
          <div className="px-4 py-4 flex flex-col gap-3">
            {result.hts_description && (
              <div>
                <p className="text-[9px] text-slate-400 uppercase tracking-[0.05em] mb-1">
                  Description
                </p>
                <p
                  className="text-[12px] text-slate-800"
                  style={{ fontFamily: 'var(--font-plex-sans)' }}
                >
                  {result.hts_description}
                </p>
              </div>
            )}

            {result.reasoning && (
              <div>
                <p className="text-[9px] text-slate-400 uppercase tracking-[0.05em] mb-1">
                  Reasoning
                </p>
                <p
                  className="text-[11px] text-slate-500 leading-relaxed"
                  style={{ fontFamily: 'var(--font-plex-sans)' }}
                >
                  {result.reasoning}
                </p>
              </div>
            )}

            {/* Footer row */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
              <div className="flex gap-5">
                {result.duty_rate && (
                  <div>
                    <p className="text-[9px] text-slate-400 uppercase tracking-[0.05em]">
                      Duty Rate
                    </p>
                    <p
                      className="text-[11px] text-slate-800 font-medium mt-0.5"
                      style={{ fontFamily: 'var(--font-plex-sans)' }}
                    >
                      {result.duty_rate}
                    </p>
                  </div>
                )}
                {result.chapter && (
                  <div>
                    <p className="text-[9px] text-slate-400 uppercase tracking-[0.05em]">Chapter</p>
                    <p
                      className="text-[11px] text-slate-800 font-medium mt-0.5"
                      style={{ fontFamily: 'var(--font-plex-sans)' }}
                    >
                      {result.chapter}
                    </p>
                  </div>
                )}
              </div>
              {result.source_url && (
                <a
                  href={result.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] text-blue-500 hover:text-blue-700 underline transition-colors ml-auto"
                >
                  View on USITC →
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

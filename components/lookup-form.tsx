'use client'

import { useState } from 'react'

interface ValidateResponse {
  hts_code: string
  hts_description: string
  confidence_score: number
  source_url: string
  reasoning: string
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
      const data = await res.json() as ValidateResponse
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
    pct >= 90 ? 'text-green-600 dark:text-green-400' :
    pct >= 70 ? 'text-yellow-600 dark:text-yellow-400' :
    'text-red-600 dark:text-red-400'

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Part number or description — e.g. MIL-C-5015 circular connector"
          className="flex-1 rounded-md border border-gray-300 dark:border-gray-700 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading || !query.trim()}
          className="px-4 py-2 rounded-md bg-black text-white dark:bg-white dark:text-black text-sm font-medium disabled:opacity-40"
        >
          {loading ? 'Looking up…' : 'Look up'}
        </button>
      </form>

      {error && (
        <div className="rounded-md border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950 p-4 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {result && (
        <div className="rounded-md border border-gray-200 dark:border-gray-800 p-4 space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">HTS Code</p>
              <p className="text-2xl font-mono font-bold">{result.hts_code || '—'}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Confidence</p>
              <p className={`text-2xl font-bold ${confidenceColor}`}>{pct}%</p>
            </div>
          </div>

          {result.hts_description && (
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Description</p>
              <p className="text-sm">{result.hts_description}</p>
            </div>
          )}

          {result.reasoning && (
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Reasoning</p>
              <p className="text-sm opacity-70">{result.reasoning}</p>
            </div>
          )}

          {result.source_url && (
            <a
              href={result.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block text-xs underline opacity-60 hover:opacity-100"
            >
              View on USITC →
            </a>
          )}
        </div>
      )}
    </div>
  )
}

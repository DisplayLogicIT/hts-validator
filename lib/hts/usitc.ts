const BASE = (process.env.USITC_API_BASE ?? 'https://hts.usitc.gov').replace(/\/$/, '')

export interface HtsResult {
  hts_code: string
  description: string
  source_url: string
}

export async function searchHts(query: string): Promise<HtsResult[]> {
  const params = new URLSearchParams({ query })
  const res = await fetch(`${BASE}/reststop/api/search?${params}`, {
    headers: { Accept: 'application/json' },
  })

  if (!res.ok) {
    throw new Error(`USITC API responded with ${res.status} ${res.statusText}`)
  }

  const raw: unknown = await res.json()
  const rawObj = raw as Record<string, unknown>
  const items: unknown[] = Array.isArray(raw) ? raw : Array.isArray(rawObj?.results) ? rawObj.results : []

  return (items as Record<string, unknown>[])
    .map((item) => ({
      hts_code: String(item.hts_code ?? item.code ?? item.number ?? ''),
      description: String(item.description ?? item.brief_description ?? ''),
      source_url: `${BASE}/reststop/api/details/${encodeURIComponent(String(item.hts_code ?? item.code ?? item.number ?? ''))}`,
    }))
    .filter((r) => r.hts_code.length > 0)
}

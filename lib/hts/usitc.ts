// USITC HTS public API — no key required.
// Endpoint: https://hts.usitc.gov/reststop/search?keyword=<query>
const BASE = 'https://hts.usitc.gov/reststop'

export interface HtsResult {
  hts_code: string
  description: string
  duty_rate: string | null
  source_url: string
}

export interface HtsLookupResult {
  valid: boolean
  hts_code: string
  description: string
  duty_rate: string | null
  source_url: string
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
}

function normalizeCode(code: string): string {
  return code.replace(/[.\s-]/g, '').toLowerCase()
}

// In-memory cache for deduplication within a single function instance.
// Persistent caching is handled by the hts_cache table (migration 006).
const lookupCache = new Map<string, HtsLookupResult>()
const searchCache = new Map<string, HtsResult[]>()

// Used by the single Lookup page — AI agent searches by product keyword
export async function searchHts(query: string): Promise<HtsResult[]> {
  const cacheKey = query.toLowerCase().trim()
  const cached = searchCache.get(cacheKey)
  if (cached) return cached

  const params = new URLSearchParams({ keyword: query })
  const res = await fetch(`${BASE}/search?${params}`, {
    headers: { Accept: 'application/json' },
  })
  if (!res.ok) throw new Error(`USITC API responded with ${res.status} ${res.statusText}`)

  const items = (await res.json()) as Record<string, unknown>[]
  const queryWords = query.toLowerCase().split(/[\s,+]+/).filter((w) => w.length > 3)

  const results = items
    .filter((item) => {
      const code = String(item.htsno ?? '')
      if (!code.includes('.') || code.length < 7) return false
      const desc = stripHtml(String(item.description ?? '')).toLowerCase()
      return queryWords.length === 0 || queryWords.some((w) => desc.includes(w))
    })
    .slice(0, 15)
    .map((item) => ({
      hts_code: String(item.htsno ?? ''),
      description: stripHtml(String(item.description ?? '')),
      duty_rate: item.general ? String(item.general) : null,
      source_url: `https://hts.usitc.gov/search?keyword=${encodeURIComponent(String(item.htsno ?? ''))}`,
    }))
    .filter((r) => r.description.length > 0)

  searchCache.set(cacheKey, results)
  return results
}

// Used by the batch Upload page — validates an HTS code directly against USITC
export async function lookupHtsCode(htsCode: string): Promise<HtsLookupResult> {
  const cleaned = htsCode.trim()
  const cacheKey = normalizeCode(cleaned)
  const cached = lookupCache.get(cacheKey)
  if (cached) return cached

  const params = new URLSearchParams({ keyword: cleaned })
  const res = await fetch(`${BASE}/search?${params}`, {
    headers: { Accept: 'application/json' },
  })
  if (!res.ok) throw new Error(`USITC API error: ${res.status}`)

  const items = (await res.json()) as Record<string, unknown>[]
  const match = items.find((item) => normalizeCode(String(item.htsno ?? '')) === cacheKey)

  const result: HtsLookupResult = match
    ? {
        valid: true,
        hts_code: String(match.htsno ?? cleaned),
        description: stripHtml(String(match.description ?? '')),
        duty_rate: match.general ? String(match.general) : null,
        source_url: `https://hts.usitc.gov/search?keyword=${encodeURIComponent(String(match.htsno ?? ''))}`,
      }
    : { valid: false, hts_code: cleaned, description: '', duty_rate: null, source_url: '' }

  lookupCache.set(cacheKey, result)
  return result
}

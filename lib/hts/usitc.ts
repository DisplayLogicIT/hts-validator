// USITC HTS public API — no key required.
// Endpoint: https://hts.usitc.gov/reststop/search?keyword=<query>
// The API does loose OR matching across all words, so we post-filter by relevance.
const BASE = 'https://hts.usitc.gov/reststop'

export interface HtsResult {
  hts_code: string
  description: string
  duty_rate: string | null
  source_url: string
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
}

export async function searchHts(query: string): Promise<HtsResult[]> {
  const params = new URLSearchParams({ keyword: query })
  const res = await fetch(`${BASE}/search?${params}`, {
    headers: { Accept: 'application/json' },
  })

  if (!res.ok) {
    throw new Error(`USITC API responded with ${res.status} ${res.statusText}`)
  }

  const items = (await res.json()) as Record<string, unknown>[]

  // Post-filter: description must contain at least one meaningful query word.
  // The API does loose OR matching so multi-word queries return unrelated results.
  const queryWords = query
    .toLowerCase()
    .split(/[\s,+]+/)
    .filter((w) => w.length > 3)

  return items
    .filter((item) => {
      const code = String(item.htsno ?? '')
      if (!code.includes('.') || code.length < 7) return false
      const desc = stripHtml(String(item.description ?? '')).toLowerCase()
      return queryWords.length === 0 || queryWords.some((w) => desc.includes(w))
    })
    .slice(0, 15)
    .map((item) => {
      const code = String(item.htsno ?? '')
      const description = stripHtml(String(item.description ?? ''))
      const dutyRate = item.general ? String(item.general) : null
      return {
        hts_code: code,
        description,
        duty_rate: dutyRate,
        source_url: `https://hts.usitc.gov/search?keyword=${encodeURIComponent(code)}`,
      }
    })
    .filter((r) => r.description.length > 0)
}

// USITC HTS public API — no key required.
// Correct endpoint: https://hts.usitc.gov/reststop/search?keyword=<query>
// Discovered by inspecting the Angular app bundle (apiBaseUrl config).
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

  return items
    .filter((item) => {
      const code = String(item.htsno ?? '')
      // Only include specific product entries — full codes contain dots (e.g. 8544.42.90.00)
      return code.includes('.') && code.length >= 7
    })
    .slice(0, 20)
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

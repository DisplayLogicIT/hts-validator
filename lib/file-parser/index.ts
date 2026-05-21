import Papa from 'papaparse'

export interface ParsedRow {
  htsCode: string
  label: string
  csvDesc: string
}

export interface DetectionInfo {
  htsCol: string
  labelCol: string | null
  descCol: string | null
  fileName: string
  totalRows: number
  skippedInvalid: number
  truncated: boolean
}

export interface ParseResult {
  rows: ParsedRow[]
  detection: DetectionInfo
}

const MAX_ROWS = 5_000

// schedule_b listed before generic 'hs' so the two-char suffix doesn't steal priority
const HTS_KEYWORDS   = ['hts', 'tariff', 'harmonized', 'htsus', 'schedule_b', 'scheduleb', 'schedule b', 'hs']
const LABEL_KEYWORDS = ['partnumber', 'part_number', 'part number', 'nsn', 'pn', 'p/n', 'item', 'name', 'product']
const DESC_KEYWORDS  = ['descriptn', 'description', 'desc']

// HTS codes are 6–10 digits, optionally separated by periods or hyphens
function isValidHtsCode(raw: string): boolean {
  const digits = raw.replace(/[\s.\-]/g, '')
  return /^\d{6,10}$/.test(digits)
}

export function detectColumns(headers: string[], sample: Record<string, string>[] = []): { htsIdx: number; labelIdx: number | null; descIdx: number | null } {
  const h = headers.map((s) => s.toLowerCase().trim())

  // Collect every column that matches any HTS keyword, with keyword rank (lower = higher priority)
  const candidates = h.reduce<{ idx: number; rank: number }[]>((acc, col, idx) => {
    const rank = HTS_KEYWORDS.findIndex((k) => col.includes(k))
    if (rank !== -1) acc.push({ idx, rank })
    return acc
  }, [])

  let htsIdx = 0
  if (candidates.length > 0) {
    // Count non-empty values in a sample to prefer the column that actually has data
    const slice = sample.slice(0, 200)
    const ranked = candidates.map((c) => ({
      ...c,
      filled: slice.filter((row) => String(row[headers[c.idx]] ?? '').trim().length > 0).length,
    }))
    // Most filled first; break ties by keyword rank (lower = higher priority keyword)
    ranked.sort((a, b) => b.filled - a.filled || a.rank - b.rank)
    htsIdx = ranked[0].idx
  }

  const labelIdxFound = h.findIndex((c, i) => i !== htsIdx && LABEL_KEYWORDS.some((k) => c.includes(k)))
  const descIdxFound = h.findIndex((c, i) => {
    if (i === htsIdx) return false
    if (labelIdxFound !== -1 && i === labelIdxFound) return false
    return DESC_KEYWORDS.some((k) => c.includes(k))
  })
  return {
    htsIdx,
    labelIdx: labelIdxFound === -1 ? null : labelIdxFound,
    descIdx: descIdxFound === -1 ? null : descIdxFound,
  }
}

function buildResult(data: Record<string, string>[], headers: string[], fileName: string): ParseResult {
  if (data.length === 0) throw new Error('No rows found. Make sure the file has a header row and data rows.')
  const { htsIdx, labelIdx, descIdx } = detectColumns(headers, data)
  const htsCol   = headers[htsIdx]
  const labelCol = labelIdx !== null ? headers[labelIdx] : null
  const descCol  = descIdx  !== null ? headers[descIdx]  : null

  const mapped = data.map((row) => ({
    htsCode: String(row[htsCol]   ?? '').trim(),
    label:   labelCol ? String(row[labelCol] ?? '').trim() : '',
    csvDesc: descCol  ? String(row[descCol]  ?? '').trim() : '',
  }))

  const valid   = mapped.filter((r) => r.htsCode.length > 0 && isValidHtsCode(r.htsCode))
  const skippedInvalid = mapped.length - valid.length

  if (valid.length === 0) {
    throw new Error(`No valid HTS codes found in column "${htsCol}". Codes must be 6–10 digits (e.g. 8471.30.0100).`)
  }

  const truncated = valid.length > MAX_ROWS
  const rows = truncated ? valid.slice(0, MAX_ROWS) : valid

  return {
    rows,
    detection: { htsCol, labelCol, descCol, fileName, totalRows: rows.length, skippedInvalid, truncated },
  }
}

export function parseFile(file: File): Promise<ParseResult> {
  const ext = file.name.split('.').pop()?.toLowerCase()
  if (ext === 'csv') {
    return new Promise((resolve, reject) => {
      Papa.parse<Record<string, string>>(file, {
        header: true,
        skipEmptyLines: true,
        complete: (result) => {
          try { resolve(buildResult(result.data, result.meta.fields ?? [], file.name)) }
          catch (err) { reject(err) }
        },
        error: (err) => reject(new Error(`CSV error: ${err.message}`)),
      })
    })
  }
  return import('xlsx').then(
    (mod) => new Promise((resolve, reject) => {
      const XLSX = (mod as unknown as { default?: typeof mod }).default ?? mod
      const reader = new FileReader()
      reader.onload = (e) => {
        try {
          const wb   = XLSX.read(e.target?.result, { type: 'array' })
          const ws   = wb.Sheets[wb.SheetNames[0]]
          const data = XLSX.utils.sheet_to_json<Record<string, string>>(ws, { defval: '' })
          resolve(buildResult(data, data.length > 0 ? Object.keys(data[0]) : [], file.name))
        } catch (err) {
          reject(new Error(`Could not read file: ${err instanceof Error ? err.message : String(err)}`))
        }
      }
      reader.onerror = () => reject(new Error('File read failed. Try again.'))
      reader.readAsArrayBuffer(file)
    }),
    (err) => Promise.reject(new Error(`Parser failed to load: ${err instanceof Error ? err.message : String(err)}`)),
  )
}

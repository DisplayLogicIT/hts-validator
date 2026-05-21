import Papa from 'papaparse'

export interface ParsedRow {
  htsCode: string
  label: string
  csvDesc: string
}

export interface ColumnMapping {
  htsCol: string
  labelCol: string | null
  descCol: string | null
}

export interface RawParseResult {
  headers: string[]
  rawData: Record<string, string>[]
  fileName: string
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

const HTS_KEYWORDS   = ['hts', 'tariff', 'harmonized', 'htsus', 'schedule_b', 'scheduleb', 'schedule b', 'hs']
const LABEL_KEYWORDS = ['partnumber', 'part_number', 'part number', 'nsn', 'pn', 'p/n', 'item', 'name', 'product']
const DESC_KEYWORDS  = ['descriptn', 'description', 'desc']

// HTS codes are 6–10 digits, optionally separated by periods or hyphens
function isValidHtsCode(raw: string): boolean {
  const digits = raw.replace(/[\s.\-]/g, '')
  return /^\d{6,10}$/.test(digits)
}

// Short keywords (≤2 chars) need word-boundary matching to avoid false positives
function matchesHtsKeyword(col: string, keyword: string): boolean {
  if (keyword.length <= 2) {
    return new RegExp(`(?:^|[^a-z0-9])${keyword}(?:[^a-z0-9]|$)`).test(col)
  }
  return col.includes(keyword)
}

export function detectColumns(headers: string[], sample: Record<string, string>[] = []): { htsIdx: number; labelIdx: number | null; descIdx: number | null } {
  const h = headers.map((s) => s.toLowerCase().trim())

  const candidates = h.reduce<{ idx: number; rank: number }[]>((acc, col, idx) => {
    const rank = HTS_KEYWORDS.findIndex((k) => matchesHtsKeyword(col, k))
    if (rank !== -1) acc.push({ idx, rank })
    return acc
  }, [])

  let htsIdx = 0
  if (candidates.length > 0) {
    const slice = sample.slice(0, 200)
    const ranked = candidates.map((c) => ({
      ...c,
      filled: slice.filter((row) => String(row[headers[c.idx]] ?? '').trim().length > 0).length,
    }))
    ranked.sort((a, b) => b.filled - a.filled || a.rank - b.rank)
    htsIdx = ranked[0].idx
  } else {
    // No keyword match — find the column whose values most resemble HTS codes
    const slice = sample.slice(0, 50)
    if (slice.length > 0) {
      const scores = headers.map((col, idx) => ({
        idx,
        score: slice.filter((row) => isValidHtsCode(String(row[col] ?? '').trim())).length,
      }))
      scores.sort((a, b) => b.score - a.score)
      if (scores[0].score > 0) htsIdx = scores[0].idx
    }
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

// Apply an explicit column mapping to raw data, with HTS validation and row cap
export function applyMapping(raw: RawParseResult, mapping: ColumnMapping): ParseResult {
  const { htsCol, labelCol, descCol } = mapping
  const { headers, rawData, fileName } = raw

  if (!headers.includes(htsCol)) {
    throw new Error(`Column "${htsCol}" not found in file.`)
  }

  const mapped = rawData.map((row) => ({
    htsCode: String(row[htsCol]   ?? '').trim(),
    label:   labelCol ? String(row[labelCol] ?? '').trim() : '',
    csvDesc: descCol  ? String(row[descCol]  ?? '').trim() : '',
  }))

  const valid = mapped.filter((r) => r.htsCode.length > 0 && isValidHtsCode(r.htsCode))
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

// Read a file to raw headers + data without any column detection
async function readRaw(file: File): Promise<{ headers: string[]; rawData: Record<string, string>[] }> {
  const ext = file.name.split('.').pop()?.toLowerCase()
  if (ext === 'csv') {
    return new Promise((resolve, reject) => {
      Papa.parse<Record<string, string>>(file, {
        header: true,
        skipEmptyLines: true,
        complete: (result) => resolve({ headers: result.meta.fields ?? [], rawData: result.data }),
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
          resolve({ headers: data.length > 0 ? Object.keys(data[0]) : [], rawData: data })
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

export async function parseRaw(file: File): Promise<RawParseResult> {
  if (file.size === 0) throw new Error('File is empty.')
  const { headers, rawData } = await readRaw(file)
  if (rawData.length === 0) throw new Error('No rows found. Make sure the file has a header row and data rows.')
  return { headers, rawData, fileName: file.name }
}

// Convenience: auto-detect columns and apply — used for backward compat
export async function parseFile(file: File): Promise<ParseResult> {
  const raw = await parseRaw(file)
  const { htsIdx, labelIdx, descIdx } = detectColumns(raw.headers, raw.rawData)
  return applyMapping(raw, {
    htsCol:   raw.headers[htsIdx],
    labelCol: labelIdx !== null ? raw.headers[labelIdx] : null,
    descCol:  descIdx  !== null ? raw.headers[descIdx]  : null,
  })
}

import { createSupabaseAdminClient } from '@/lib/supabase/server'

export type JobType   = 'single' | 'batch'
export type JobStatus = 'pending' | 'processing' | 'complete' | 'error'

export interface Job {
  id: string
  type: JobType
  status: string
  file_name: string | null
  row_count: number | null
  rows_done: number
  input_query: string | null
  created_at: string
}

export interface JobCreate {
  orgId: string
  userId: string
  type: JobType
  status: JobStatus
  fileName?: string
  rowCount?: number
  inputQuery?: string
}

export interface JobPatch {
  status?: JobStatus
  rows_done?: number
}

export interface ValidationResultCreate {
  jobId: string
  inputText: string
  htsCode: string | null
  htsDescription: string | null
  confidenceScore: number | null
  sourceUrl: string | null
  rawResponse: unknown
  rowIndex?: number | null
}

export interface GroupedResultRow {
  id: string
  job_id: string
  input_text: string
  hts_code: string | null
  hts_description: string | null
  confidence_score: number | null
  source_url: string | null
  raw_response: unknown
  created_at: string
}

export interface JobWithResults {
  id: string
  file_name: string | null
  input_query: string | null
  type: string
  created_at: string
  results: GroupedResultRow[]
}

const RESULT_COLS = 'id, job_id, input_text, hts_code, hts_description, confidence_score, source_url, raw_response, created_at'

async function createJob(data: JobCreate): Promise<string | null> {
  const supabase = createSupabaseAdminClient()
  const { data: job, error } = await supabase
    .from('validation_jobs')
    .insert({
      org_id:      data.orgId,
      user_id:     data.userId,
      type:        data.type,
      status:      data.status,
      file_name:   data.fileName   ?? null,
      row_count:   data.rowCount   ?? null,
      input_query: data.inputQuery ?? null,
    })
    .select('id')
    .single()
  if (error) { console.error('createJob:', error.message); return null }
  return job.id
}

async function listJobs(scopeId: string): Promise<Job[]> {
  const supabase = createSupabaseAdminClient()
  const { data, error } = await supabase
    .from('validation_jobs')
    .select('id, type, status, file_name, row_count, rows_done, input_query, created_at')
    .eq('org_id', scopeId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as Job[]
}

async function getJobOwnerId(id: string): Promise<string | null> {
  const supabase = createSupabaseAdminClient()
  const { data } = await supabase
    .from('validation_jobs')
    .select('org_id')
    .eq('id', id)
    .single()
  return data?.org_id ?? null
}

// Strips migration-004 columns (valid_count, not_found_count) that aren't applied yet
async function patchJob(id: string, updates: JobPatch): Promise<void> {
  const supabase = createSupabaseAdminClient()
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (updates.status    !== undefined) row.status    = updates.status
  if (updates.rows_done !== undefined) row.rows_done = updates.rows_done
  const { error } = await supabase.from('validation_jobs').update(row).eq('id', id)
  if (error) throw error
}

async function createValidationResult(data: ValidationResultCreate): Promise<void> {
  const supabase = createSupabaseAdminClient()
  const { error } = await supabase.from('validation_results').insert({
    job_id:           data.jobId,
    input_text:       data.inputText,
    hts_code:         data.htsCode,
    hts_description:  data.htsDescription,
    confidence_score: data.confidenceScore,
    source_url:       data.sourceUrl,
    raw_response:     data.rawResponse,
    row_index:        data.rowIndex ?? null,
  })
  if (error) console.error('createValidationResult:', error.message)
}

interface BulkResult {
  row_index: number
  hts_code: string
  valid: boolean
  description: string
  duty_rate: string | null
  status: 'done' | 'error'
  error?: string
  label: string
  csv_desc: string
}

async function bulkInsertResults(jobId: string, results: BulkResult[]): Promise<void> {
  const supabase = createSupabaseAdminClient()
  const rows = results.map((r) => ({
    job_id:           jobId,
    input_text:       r.label || r.hts_code,
    hts_code:         r.valid ? r.hts_code : null,
    hts_description:  r.description || null,
    confidence_score: r.valid ? 1.0 : 0.0,
    source_url:       null,
    raw_response:     { valid: r.valid, description: r.description, duty_rate: r.duty_rate, status: r.status, error: r.error },
    row_index:        r.row_index,
  }))
  const { error } = await supabase.from('validation_results').insert(rows)
  if (error) throw error
}

async function listResultsGroupedByJob(scopeId: string, status: 'valid' | 'not_found'): Promise<JobWithResults[]> {
  const supabase = createSupabaseAdminClient()
  const { data: jobs, error: jobsError } = await supabase
    .from('validation_jobs')
    .select('id, file_name, input_query, type, created_at')
    .eq('org_id', scopeId)
    .order('created_at', { ascending: false })
  if (jobsError) throw jobsError
  if (!jobs?.length) return []

  const jobIds = jobs.map((j) => j.id)
  const { data: results, error: resultsError } = status === 'valid'
    ? await supabase.from('validation_results').select(RESULT_COLS).in('job_id', jobIds).not('hts_code', 'is', null)
    : await supabase.from('validation_results').select(RESULT_COLS).in('job_id', jobIds).is('hts_code', null)
  if (resultsError) throw resultsError

  const byJob = new Map<string, GroupedResultRow[]>()
  for (const r of results ?? []) {
    if (!byJob.has(r.job_id)) byJob.set(r.job_id, [])
    byJob.get(r.job_id)!.push(r as GroupedResultRow)
  }

  return jobs
    .filter((j) => (byJob.get(j.id)?.length ?? 0) > 0)
    .map((j) => ({ ...j, results: byJob.get(j.id) ?? [] }))
}

export const jobRepository = {
  createJob,
  listJobs,
  getJobOwnerId,
  patchJob,
  createValidationResult,
  bulkInsertResults,
  listResultsGroupedByJob,
}

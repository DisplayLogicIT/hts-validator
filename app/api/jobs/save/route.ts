import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { jobRepository } from '@/lib/db/jobs'

interface SaveResult {
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

export async function POST(req: NextRequest) {
  try {
    const { userId, orgId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const scopeId = orgId ?? userId
    const body = await req.json() as {
      file_name: string
      row_count: number
      results: SaveResult[]
    }

    if (!body.file_name || !Array.isArray(body.results) || body.results.length === 0) {
      return NextResponse.json({ error: 'file_name and results are required' }, { status: 400 })
    }

    const jobId = await jobRepository.createJob({
      orgId:     scopeId,
      userId,
      type:      'batch',
      status:    'complete',
      fileName:  body.file_name,
      rowCount:  body.row_count,
    })
    if (!jobId) return NextResponse.json({ error: 'Failed to create job' }, { status: 500 })

    await jobRepository.bulkInsertResults(jobId, body.results)

    return NextResponse.json({ id: jobId })
  } catch (err) {
    console.error('POST /api/jobs/save:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Save failed' },
      { status: 500 },
    )
  }
}

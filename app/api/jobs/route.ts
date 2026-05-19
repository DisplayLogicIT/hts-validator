import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { jobRepository } from '@/lib/db/jobs'

export async function POST(req: NextRequest) {
  try {
    const { userId, orgId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { file_name, row_count } = await req.json() as { file_name: string; row_count: number }
    const scopeId = orgId ?? userId

    const id = await jobRepository.createJob({
      orgId: scopeId,
      userId,
      type: 'batch',
      status: 'processing',
      fileName: file_name,
      rowCount: row_count,
    })

    if (!id) return NextResponse.json({ error: 'Failed to create job' }, { status: 500 })
    return NextResponse.json({ id })
  } catch (err) {
    console.error('POST /api/jobs:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Create failed' }, { status: 500 })
  }
}

export async function GET() {
  try {
    const { userId, orgId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const scopeId = orgId ?? userId
    const jobs = await jobRepository.listJobs(scopeId)
    return NextResponse.json({ jobs })
  } catch (err) {
    console.error('GET /api/jobs:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Query failed' }, { status: 500 })
  }
}

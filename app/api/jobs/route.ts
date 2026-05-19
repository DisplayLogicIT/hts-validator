import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { jobRepository } from '@/lib/db/jobs'

export async function POST(req: NextRequest) {
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
}

export async function GET() {
  const { userId, orgId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const scopeId = orgId ?? userId
  try {
    const jobs = await jobRepository.listJobs(scopeId)
    return NextResponse.json({ jobs })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Query failed' }, { status: 500 })
  }
}

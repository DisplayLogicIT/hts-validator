import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { jobRepository } from '@/lib/db/jobs'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { userId, orgId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const scopeId = orgId ?? userId

    const ownerId = await jobRepository.getJobOwnerId(id)
    if (!ownerId || ownerId !== scopeId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const results = await jobRepository.listJobResults(id)
    return NextResponse.json({ results })
  } catch (err) {
    console.error('GET /api/jobs/[id]/results:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Query failed' }, { status: 500 })
  }
}

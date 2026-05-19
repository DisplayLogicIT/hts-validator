import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { jobRepository } from '@/lib/db/jobs'

export async function GET(req: NextRequest) {
  try {
    const { userId, orgId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const status = (req.nextUrl.searchParams.get('status') ?? 'valid') as 'valid' | 'not_found'
    const scopeId = orgId ?? userId

    const jobs = await jobRepository.listResultsGroupedByJob(scopeId, status)
    return NextResponse.json({ jobs })
  } catch (err) {
    console.error('GET /api/results:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Query failed' }, { status: 500 })
  }
}

import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { jobRepository } from '@/lib/db/jobs'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId, orgId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const scopeId = orgId ?? userId

  const ownerId = await jobRepository.getJobOwnerId(id)
  if (!ownerId || ownerId !== scopeId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // valid_count and not_found_count are omitted — migration 004 not yet applied
  const body = await req.json() as { status?: string; rows_done?: number }
  try {
    await jobRepository.patchJob(id, {
      status:    body.status    as 'pending' | 'processing' | 'complete' | 'error' | undefined,
      rows_done: body.rows_done,
    })
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Update failed' }, { status: 500 })
  }
}

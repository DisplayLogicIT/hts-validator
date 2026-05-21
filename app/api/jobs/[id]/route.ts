import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { jobRepository } from '@/lib/db/jobs'

export async function PATCH(
  req: NextRequest,
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

    const body = await req.json() as { status?: string; rows_done?: number; archive?: boolean; restore?: boolean }

    if (body.archive) {
      await jobRepository.archiveJob(id)
      return NextResponse.json({ ok: true })
    }
    if (body.restore) {
      await jobRepository.restoreJob(id)
      return NextResponse.json({ ok: true })
    }

    await jobRepository.patchJob(id, {
      status:    body.status    as 'pending' | 'processing' | 'complete' | 'error' | undefined,
      rows_done: body.rows_done,
    })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('PATCH /api/jobs/[id]:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Update failed' }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
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

    const body = await req.json() as { password?: string }
    const expected = process.env.ARCHIVE_DELETE_PASSWORD
    if (!expected) {
      return NextResponse.json({ error: 'Archive delete password not configured' }, { status: 500 })
    }
    if (body.password !== expected) {
      return NextResponse.json({ error: 'Incorrect password' }, { status: 403 })
    }

    await jobRepository.permanentDeleteJob(id)
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('DELETE /api/jobs/[id]:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Delete failed' }, { status: 500 })
  }
}

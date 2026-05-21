'use client'

import { useUser } from '@clerk/nextjs'
import { useState, useEffect, useCallback } from 'react'

interface ArchivedJob {
  id: string
  type: string
  file_name: string | null
  input_query: string | null
  row_count: number | null
  created_at: string
  archived_at: string | null
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="data-card overflow-hidden">
      <div className="px-5 py-3.5 border-b border-slate-100">
        <h2 className="text-[11.5px] font-semibold text-slate-900" style={{ fontFamily: 'var(--font-plex-sans)' }}>{title}</h2>
      </div>
      <div className="px-5 py-4">{children}</div>
    </div>
  )
}

function FieldRow({ label, value }: { label: string; value: string | undefined | null }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-slate-50 last:border-0">
      <span className="text-[11px] text-slate-500" style={{ fontFamily: 'var(--font-plex-sans)' }}>{label}</span>
      <span className="text-[11px] font-medium text-slate-800" style={{ fontFamily: 'var(--font-plex-mono)' }}>{value ?? '—'}</span>
    </div>
  )
}

function Toggle({ label, description, enabled }: { label: string; description: string; enabled: boolean }) {
  return (
    <div className="flex items-start justify-between py-3 border-b border-slate-50 last:border-0">
      <div>
        <p className="text-[11.5px] font-medium text-slate-800" style={{ fontFamily: 'var(--font-plex-sans)' }}>{label}</p>
        <p className="text-[10px] text-slate-400 mt-0.5">{description}</p>
      </div>
      <button
        className="relative inline-flex h-5 w-9 shrink-0 cursor-not-allowed items-center rounded-full border border-transparent transition-colors"
        style={{ background: enabled ? 'rgb(59,130,246)' : 'rgb(226,232,240)' }}
        title="Notification settings coming soon"
        disabled
      >
        <span
          className="inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform"
          style={{ transform: enabled ? 'translateX(18px)' : 'translateX(2px)' }}
        />
      </button>
    </div>
  )
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
}

function DeleteModal({
  jobId,
  label,
  onConfirm,
  onCancel,
}: {
  jobId: string
  label: string
  onConfirm: (jobId: string, password: string) => void
  onCancel: () => void
}) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!password) { setError('Password required'); return }
    setSubmitting(true)
    setError(null)
    try {
      await onConfirm(jobId, password)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="data-card w-full max-w-sm mx-4 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h3 className="text-[13px] font-semibold text-slate-900">Permanently delete?</h3>
          <p className="text-[10.5px] text-slate-500 mt-1 leading-relaxed">
            <span className="font-medium text-slate-700">{label}</span> and all its results will be permanently removed. This cannot be undone.
          </p>
        </div>
        <form onSubmit={handleSubmit} className="px-5 py-4 flex flex-col gap-3">
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1">
              Admin password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password to confirm"
              autoFocus
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-[12px] text-slate-900 placeholder:text-slate-300 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100 transition"
            />
          </div>
          {error && <p className="text-[11px] text-red-600">{error}</p>}
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 border border-slate-200 text-slate-600 text-[11.5px] font-medium rounded-lg px-3 py-2 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 bg-red-600 text-white text-[11.5px] font-semibold rounded-lg px-3 py-2 hover:bg-red-700 disabled:opacity-50 transition-colors"
            >
              {submitting ? 'Deleting…' : 'Delete permanently'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function SettingsPage() {
  const { user, isLoaded } = useUser()
  const [archivedJobs, setArchivedJobs] = useState<ArchivedJob[]>([])
  const [archiveLoading, setArchiveLoading] = useState(true)
  const [archiveError, setArchiveError] = useState<string | null>(null)
  const [restoring, setRestoring] = useState<Record<string, boolean>>({})
  const [deleteModal, setDeleteModal] = useState<{ id: string; label: string } | null>(null)

  const loadArchive = useCallback(() => {
    setArchiveLoading(true)
    fetch('/api/jobs?archived=true')
      .then((r) => r.json())
      .then((d: { jobs?: ArchivedJob[]; error?: string }) => {
        if (d.error) { setArchiveError(d.error); setArchiveLoading(false); return }
        setArchivedJobs(d.jobs ?? [])
        setArchiveLoading(false)
      })
      .catch((e: Error) => { setArchiveError(e.message); setArchiveLoading(false) })
  }, [])

  useEffect(() => { loadArchive() }, [loadArchive])

  async function restoreJob(id: string) {
    setRestoring((p) => ({ ...p, [id]: true }))
    const res = await fetch(`/api/jobs/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ restore: true }),
    })
    if (res.ok) {
      setArchivedJobs((prev) => prev.filter((j) => j.id !== id))
    }
    setRestoring((p) => ({ ...p, [id]: false }))
  }

  async function permanentDelete(jobId: string, password: string) {
    const res = await fetch(`/api/jobs/${jobId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    })
    const data = await res.json() as { ok?: boolean; error?: string }
    if (!res.ok) throw new Error(data.error ?? 'Delete failed')
    setArchivedJobs((prev) => prev.filter((j) => j.id !== jobId))
    setDeleteModal(null)
  }

  return (
    <div className="flex flex-col h-full">
      <div className="topbar px-6 py-3 shrink-0 flex items-center justify-between">
        <div>
          <h1 className="text-sm font-semibold text-slate-900" style={{ fontFamily: 'var(--font-plex-sans)' }}>Settings</h1>
          <p className="text-[11px] text-slate-400" style={{ fontFamily: 'var(--font-plex-sans)' }}>Manage your account, archive, and preferences</p>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6 flex flex-col gap-4 max-w-2xl">

        {/* Account */}
        <SectionCard title="Account">
          {!isLoaded ? (
            <div className="space-y-2 animate-pulse">
              <div className="h-3 w-48 bg-slate-100 rounded" />
              <div className="h-3 w-64 bg-slate-100 rounded" />
              <div className="h-3 w-32 bg-slate-100 rounded" />
            </div>
          ) : (
            <>
              <FieldRow label="Name" value={user?.fullName} />
              <FieldRow label="Email" value={user?.primaryEmailAddress?.emailAddress} />
              <FieldRow label="User ID" value={user?.id} />
              <div className="pt-3">
                <a
                  href="/sign-in"
                  className="inline-flex items-center gap-1.5 text-[11px] font-medium text-blue-600 hover:text-blue-700 transition-colors"
                >
                  Manage account via Clerk
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                    <polyline points="15 3 21 3 21 9" />
                    <line x1="10" y1="14" x2="21" y2="3" />
                  </svg>
                </a>
              </div>
            </>
          )}
        </SectionCard>

        {/* Archive */}
        <div className="data-card overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="text-[11.5px] font-semibold text-slate-900" style={{ fontFamily: 'var(--font-plex-sans)' }}>Archive</h2>
              <p className="text-[10px] text-slate-400 mt-0.5">Jobs deleted from History — full backup. Permanent delete requires admin password.</p>
            </div>
            <span className="text-[10px] font-semibold bg-slate-100 text-slate-500 border border-slate-200 rounded-full px-2 py-0.5">
              {archiveLoading ? '…' : archivedJobs.length}
            </span>
          </div>
          <div className="px-5 py-3">
            {archiveError ? (
              <p className="text-[11px] text-red-600">{archiveError}</p>
            ) : archiveLoading ? (
              <div className="space-y-2.5 animate-pulse">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-10 bg-slate-50 rounded-lg" />
                ))}
              </div>
            ) : archivedJobs.length === 0 ? (
              <p className="text-[11px] text-slate-400 text-center py-4">No archived jobs — items deleted from History appear here.</p>
            ) : (
              <div className="flex flex-col gap-1.5">
                {archivedJobs.map((job) => {
                  const label = job.type === 'batch' ? (job.file_name ?? 'Untitled batch') : (job.input_query ?? 'Single lookup')
                  return (
                    <div key={job.id} className="flex items-center gap-3 rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2.5">
                      <div className="flex-1 min-w-0">
                        <p className="text-[11.5px] font-medium text-slate-800 truncate" style={{ fontFamily: 'var(--font-plex-sans)' }}>{label}</p>
                        <p className="text-[9.5px] text-slate-400 mt-0.5">
                          Created {formatDate(job.created_at)} · archived {job.archived_at ? formatDate(job.archived_at) : '—'} · {job.row_count ?? '?'} rows
                        </p>
                      </div>
                      <button
                        onClick={() => restoreJob(job.id)}
                        disabled={restoring[job.id]}
                        title="Restore to History"
                        className="shrink-0 text-[10px] font-semibold text-blue-600 hover:text-blue-700 disabled:opacity-40 transition-colors px-2 py-1 rounded hover:bg-blue-50"
                      >
                        {restoring[job.id] ? 'Restoring…' : 'Restore'}
                      </button>
                      <button
                        onClick={() => setDeleteModal({ id: job.id, label })}
                        title="Permanently delete (requires admin password)"
                        className="shrink-0 w-6 h-6 rounded flex items-center justify-center text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                          <path d="M10 11v6M14 11v6" />
                          <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                        </svg>
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* API & Integrations */}
        <SectionCard title="API &amp; Integrations">
          <div className="flex items-start gap-3 py-1">
            <div className="w-7 h-7 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0 mt-0.5">
              <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <rect x="2" y="9" width="20" height="13" rx="2" />
                <path d="M8 9V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v4" />
              </svg>
            </div>
            <div>
              <p className="text-[11.5px] font-medium text-slate-800" style={{ fontFamily: 'var(--font-plex-sans)' }}>API Access</p>
              <p className="text-[10px] text-slate-400 mt-0.5">Programmatic access to your validation results</p>
              <span
                className="inline-block mt-2 text-[8px] font-semibold rounded px-1.5 py-0.5 tracking-wide uppercase"
                style={{ background: 'rgba(51,65,85,0.08)', color: 'rgba(100,116,139,0.9)' }}
              >
                Coming soon
              </span>
            </div>
          </div>
        </SectionCard>

        {/* Notifications */}
        <SectionCard title="Notifications">
          <Toggle label="Batch complete" description="Email when a file upload finishes processing" enabled={false} />
          <Toggle label="Validation errors" description="Alert when rows fail validation" enabled={false} />
          <Toggle label="Weekly digest" description="Summary of validation activity each Monday" enabled={false} />
          <p className="text-[9.5px] text-slate-400 pt-3">Notification delivery coming soon — toggles are non-functional.</p>
        </SectionCard>

      </div>

      {deleteModal && (
        <DeleteModal
          jobId={deleteModal.id}
          label={deleteModal.label}
          onConfirm={permanentDelete}
          onCancel={() => setDeleteModal(null)}
        />
      )}
    </div>
  )
}

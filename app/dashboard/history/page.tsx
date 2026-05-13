import { auth } from '@clerk/nextjs/server'
import { createSupabaseAdminClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

interface JobRow {
  id: string
  type: 'single' | 'batch'
  status: string
  file_name: string | null
  row_count: number | null
  rows_done: number
  input_query: string | null
  created_at: string
  validation_results: { confidence_score: number | null }[]
}

function avgConf(results: { confidence_score: number | null }[]): number | null {
  const valid = results.filter((r) => r.confidence_score != null)
  if (valid.length === 0) return null
  return valid.reduce((sum, r) => sum + (r.confidence_score ?? 0), 0) / valid.length
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const isToday = d.toDateString() === now.toDateString()
  if (isToday) {
    return `Today ${d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
  }
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

function confColor(pct: number): string {
  if (pct >= 80) return 'text-green-600'
  if (pct >= 60) return 'text-amber-600'
  return 'text-red-600'
}

export default async function HistoryPage() {
  const { userId, orgId } = await auth()
  const scopeId = orgId ?? userId!

  const supabase = createSupabaseAdminClient()
  const { data: jobs } = await supabase
    .from('validation_jobs')
    .select(`
      id,
      type,
      status,
      file_name,
      row_count,
      rows_done,
      input_query,
      created_at,
      validation_results ( confidence_score )
    `)
    .eq('org_id', scopeId)
    .order('created_at', { ascending: false })

  const rows = (jobs ?? []) as JobRow[]

  return (
    <div className="flex flex-col h-full">
      <div className="bg-white border-b border-slate-200 px-6 py-3 shrink-0 flex items-center justify-between">
        <div>
          <h1
            className="text-sm font-semibold text-slate-900"
            style={{ fontFamily: 'var(--font-plex-sans)' }}
          >
            Job History
          </h1>
          <p
            className="text-[11px] text-slate-400"
            style={{ fontFamily: 'var(--font-plex-sans)' }}
          >
            Every classification run — single lookups and batch jobs
          </p>
        </div>
        <span className="text-[11px] text-slate-500 bg-slate-100 border border-slate-200 rounded-full px-2.5 py-1">
          {rows.length} total
        </span>
      </div>

      <div className="flex-1 overflow-auto p-6">
        {rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-slate-400">
            <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
            <p className="text-[12px]">No jobs yet — run a lookup or upload a file</p>
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <td className="text-[9px] text-slate-400 px-4 py-3 font-semibold uppercase tracking-wide">File / Query</td>
                  <td className="text-[9px] text-slate-400 px-4 py-3 font-semibold uppercase tracking-wide">Type</td>
                  <td className="text-[9px] text-slate-400 px-4 py-3 font-semibold uppercase tracking-wide">Rows</td>
                  <td className="text-[9px] text-slate-400 px-4 py-3 font-semibold uppercase tracking-wide">Avg Conf.</td>
                  <td className="text-[9px] text-slate-400 px-4 py-3 font-semibold uppercase tracking-wide">Date</td>
                  <td className="text-[9px] text-slate-400 px-4 py-3 font-semibold uppercase tracking-wide"></td>
                </tr>
              </thead>
              <tbody>
                {rows.map((job) => {
                  const avg = avgConf(job.validation_results)
                  const avgPct = avg != null ? Math.round(avg * 100) : null
                  const label =
                    job.type === 'batch'
                      ? (job.file_name ?? 'Untitled batch')
                      : (job.input_query ?? 'Single lookup')

                  return (
                    <tr key={job.id} className="border-t border-slate-100 hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3">
                        <p
                          className="text-[11px] font-medium text-slate-900 truncate max-w-[200px]"
                          style={{ fontFamily: 'var(--font-plex-sans)' }}
                          title={label}
                        >
                          {label}
                        </p>
                        <p className="text-[9px] text-slate-400">
                          {job.type === 'batch' ? `${job.row_count ?? 0} parts` : 'Single lookup'}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        {job.type === 'batch' ? (
                          <span className="text-[9px] bg-blue-50 text-blue-700 border border-blue-100 rounded px-1.5 py-0.5 font-semibold">Batch</span>
                        ) : (
                          <span className="text-[9px] bg-slate-100 text-slate-600 border border-slate-200 rounded px-1.5 py-0.5 font-semibold">Single</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-[11px] text-slate-800">
                        {job.type === 'batch' ? (job.row_count ?? '—') : 1}
                      </td>
                      <td className="px-4 py-3">
                        {avgPct != null ? (
                          <span className={`text-[11px] font-semibold ${confColor(avgPct)}`}>
                            {avgPct}%
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-[11px] text-slate-500">
                        {formatDate(job.created_at)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-[10px] text-blue-500 hover:text-blue-700 cursor-pointer underline">View</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

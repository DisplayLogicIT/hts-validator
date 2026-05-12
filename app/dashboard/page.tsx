import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { LookupForm } from '@/components/lookup-form'

export const dynamic = 'force-dynamic'

interface Stats {
  todayCount: number
  avgConfidence: number | null
}

async function getStats(): Promise<Stats | null> {
  try {
    const supabase = createSupabaseAdminClient()
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const { data, error } = await supabase
      .from('validation_results')
      .select('confidence_score')
      .gte('created_at', today.toISOString())
    if (error) return null
    const count = data?.length ?? 0
    const avg =
      count > 0
        ? data.reduce((sum, r) => sum + (r.confidence_score ?? 0), 0) / count
        : null
    return { todayCount: count, avgConfidence: avg }
  } catch {
    return null
  }
}

export default async function DashboardPage() {
  const stats = await getStats()
  const pct = stats?.avgConfidence != null ? Math.round(stats.avgConfidence * 100) : null
  const confColor =
    pct == null ? ''
    : pct >= 80 ? 'text-green-600 font-semibold'
    : pct >= 60 ? 'text-amber-600 font-semibold'
    : 'text-red-600 font-semibold'

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between shrink-0">
        <div>
          <h1
            className="text-sm font-semibold text-slate-900"
            style={{ fontFamily: 'var(--font-plex-sans)' }}
          >
            HTS Lookup
          </h1>
          <p
            className="text-[11px] text-slate-400"
            style={{ fontFamily: 'var(--font-plex-sans)' }}
          >
            Classify a Pentagon part number against USITC
          </p>
        </div>
        {stats && (
          <div className="flex gap-2">
            <span className="bg-slate-100 border border-slate-200 rounded-full px-2.5 py-1 text-[11px] text-slate-500">
              <span className="text-slate-900 font-semibold">{stats.todayCount}</span> today
            </span>
            {pct != null && (
              <span className="bg-slate-100 border border-slate-200 rounded-full px-2.5 py-1 text-[11px] text-slate-500">
                avg <span className={confColor}>{pct}%</span> conf
              </span>
            )}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-2xl mx-auto">
          <LookupForm />
        </div>
      </div>
    </div>
  )
}

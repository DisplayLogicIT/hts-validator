import { auth } from '@clerk/nextjs/server'
import { createSupabaseAdminClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

interface Part {
  id: string
  part_number: string
  hts_code: string
  usitc_description: string | null
  duty_rate: string | null
  last_validated_at: string | null
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  if (d.toDateString() === now.toDateString()) {
    return `Today ${d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
  }
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

export default async function ValidatedPage() {
  const { userId, orgId } = await auth()
  const scopeId = orgId ?? userId!

  const supabase = createSupabaseAdminClient()
  const { data } = await supabase
    .from('parts')
    .select('id, part_number, hts_code, usitc_description, duty_rate, last_validated_at')
    .eq('org_id', scopeId)
    .eq('validation_status', 'valid')
    .order('last_validated_at', { ascending: false })

  const parts = (data ?? []) as Part[]

  return (
    <div className="flex flex-col h-full">
      <div className="bg-white border-b border-slate-200 px-6 py-3 shrink-0 flex items-center justify-between">
        <div>
          <h1 className="text-sm font-semibold text-slate-900" style={{ fontFamily: 'var(--font-plex-sans)' }}>
            Validated Parts
          </h1>
          <p className="text-[11px] text-slate-400" style={{ fontFamily: 'var(--font-plex-sans)' }}>
            HTS codes confirmed against the USITC schedule · re-checked every Monday
          </p>
        </div>
        <span className="text-[11px] font-semibold bg-green-50 text-green-700 border border-green-200 rounded-full px-2.5 py-1">
          {parts.length} valid
        </span>
      </div>

      <div className="flex-1 overflow-auto p-6">
        {parts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-slate-400">
            <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-[12px]">No validated parts yet — upload a file to begin</p>
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <td className="text-[9px] text-slate-400 px-4 py-3 font-semibold uppercase tracking-wide">Part / Reference</td>
                  <td className="text-[9px] text-slate-400 px-4 py-3 font-semibold uppercase tracking-wide">HTS Code</td>
                  <td className="text-[9px] text-slate-400 px-4 py-3 font-semibold uppercase tracking-wide">USITC Description</td>
                  <td className="text-[9px] text-slate-400 px-4 py-3 font-semibold uppercase tracking-wide">Duty Rate</td>
                  <td className="text-[9px] text-slate-400 px-4 py-3 font-semibold uppercase tracking-wide">Last Checked</td>
                </tr>
              </thead>
              <tbody>
                {parts.map((part) => (
                  <tr key={part.id} className="border-t border-slate-100 hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="text-[11px] font-medium text-slate-900 truncate max-w-[180px]" style={{ fontFamily: 'var(--font-plex-sans)' }}>
                        {part.part_number || '—'}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[10.5px] font-medium text-blue-800" style={{ fontFamily: 'var(--font-plex-mono)' }}>
                        {part.hts_code}
                      </span>
                    </td>
                    <td className="px-4 py-3 max-w-[260px]">
                      <p className="text-[10.5px] text-slate-600 truncate">{part.usitc_description || '—'}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[10.5px] text-slate-700">{part.duty_rate || '—'}</span>
                    </td>
                    <td className="px-4 py-3 text-[10.5px] text-slate-500">
                      {part.last_validated_at ? formatDate(part.last_validated_at) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

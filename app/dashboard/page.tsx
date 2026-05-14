import { LookupForm } from '@/components/lookup-form'

export default function DashboardPage() {
  return (
    <div className="flex flex-col h-full">
      <div className="topbar px-6 py-3 flex items-center justify-between shrink-0">
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
            Classify a part number against the USITC schedule
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-2xl mx-auto">
          <LookupForm />
        </div>
      </div>
    </div>
  )
}

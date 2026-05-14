import { UploadForm } from '@/components/upload-form'

export const dynamic = 'force-dynamic'

export default function UploadPage() {
  return (
    <div className="flex flex-col h-full">
      <div className="topbar px-6 py-3 shrink-0">
        <h1
          className="text-sm font-semibold text-slate-900"
          style={{ fontFamily: 'var(--font-plex-sans)' }}
        >
          Upload Parts File
        </h1>
        <p
          className="text-[11px] text-slate-400"
          style={{ fontFamily: 'var(--font-plex-sans)' }}
        >
          Drop a file — the agent classifies every part against USITC
        </p>
      </div>
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-2xl mx-auto">
          <UploadForm />
        </div>
      </div>
    </div>
  )
}

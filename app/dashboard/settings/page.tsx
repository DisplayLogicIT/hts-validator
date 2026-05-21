'use client'

import { useUser } from '@clerk/nextjs'

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

export default function SettingsPage() {
  const { user, isLoaded } = useUser()

  return (
    <div className="flex flex-col h-full">
      <div className="topbar px-6 py-3 shrink-0 flex items-center justify-between">
        <div>
          <h1 className="text-sm font-semibold text-slate-900" style={{ fontFamily: 'var(--font-plex-sans)' }}>Settings</h1>
          <p className="text-[11px] text-slate-400" style={{ fontFamily: 'var(--font-plex-sans)' }}>Manage your account and preferences</p>
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
          <Toggle
            label="Batch complete"
            description="Email when a file upload finishes processing"
            enabled={false}
          />
          <Toggle
            label="Validation errors"
            description="Alert when rows fail validation"
            enabled={false}
          />
          <Toggle
            label="Weekly digest"
            description="Summary of validation activity each Monday"
            enabled={false}
          />
          <p className="text-[9.5px] text-slate-400 pt-3">Notification delivery coming soon — toggles are non-functional.</p>
        </SectionCard>

      </div>
    </div>
  )
}

import { UserButton } from '@clerk/nextjs'
import { currentUser } from '@clerk/nextjs/server'
import Link from 'next/link'
import { IBM_Plex_Mono, IBM_Plex_Sans } from 'next/font/google'

const plexSans = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-plex-sans',
})

const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-plex-mono',
})

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser()
  const displayName =
    [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.username || 'User'
  const email = user?.emailAddresses?.[0]?.emailAddress ?? ''

  return (
    <div
      className={`${plexSans.variable} ${plexMono.variable} flex h-screen overflow-hidden`}
      style={{ fontFamily: 'var(--font-plex-sans), system-ui, sans-serif' }}
    >
      {/* ── Sidebar ── */}
      <aside className="w-[220px] flex-shrink-0 bg-[#1e293b] flex flex-col">
        {/* Logo */}
        <div className="px-5 py-[18px] border-b border-[#334155]">
          <p className="text-[13px] font-bold text-slate-50 tracking-wide">HTS Validator</p>
          <p className="text-[10px] text-[#64748b] mt-0.5 tracking-wide">USITC Classification</p>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2.5 py-3 flex flex-col gap-0.5">
          <p className="text-[9px] font-semibold text-[#475569] uppercase tracking-[0.08em] px-2.5 py-2">
            Workspace
          </p>

          {/* Lookup — active */}
          <Link
            href="/dashboard"
            className="flex items-center gap-2.5 px-2.5 py-[7px] rounded-md bg-[#334155] border-l-2 border-blue-400 text-slate-100 text-[11.5px] font-medium"
          >
            <svg className="w-3.5 h-3.5 text-blue-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
            </svg>
            Lookup
          </Link>

          {/* Upload — soon */}
          <div className="flex items-center gap-2.5 px-2.5 py-[7px] rounded-md text-[#475569] text-[11.5px] select-none cursor-not-allowed">
            <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            Upload
            <span className="ml-auto text-[8.5px] text-[#475569] bg-[#0f172a] border border-[#334155] rounded-full px-1.5 py-[2px] font-semibold tracking-wide">
              Soon
            </span>
          </div>

          {/* Batch Jobs */}
          <div className="flex items-center gap-2.5 px-2.5 py-[7px] rounded-md text-[#475569] text-[11.5px] select-none cursor-not-allowed">
            <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <rect x="2" y="7" width="20" height="14" rx="2" />
              <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
            </svg>
            Batch Jobs
          </div>

          {/* History */}
          <div className="flex items-center gap-2.5 px-2.5 py-[7px] rounded-md text-[#475569] text-[11.5px] select-none cursor-not-allowed">
            <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
            History
          </div>
        </nav>

        {/* User footer */}
        <div className="px-4 py-3.5 border-t border-[#334155] flex items-center gap-2.5 min-w-0">
          <UserButton afterSignOutUrl="/" />
          <div className="min-w-0 flex-1">
            <p className="text-[10.5px] text-slate-200 font-medium truncate">{displayName}</p>
            <p className="text-[9px] text-[#475569] truncate">{email}</p>
          </div>
        </div>
      </aside>

      {/* ── Main ── */}
      <main className="flex-1 min-w-0 overflow-auto bg-[#f8fafc]">{children}</main>
    </div>
  )
}

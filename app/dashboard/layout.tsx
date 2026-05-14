import { UserButton } from '@clerk/nextjs'
import { currentUser } from '@clerk/nextjs/server'
import { IBM_Plex_Mono, IBM_Plex_Sans } from 'next/font/google'
import { DashboardNav } from '@/components/dashboard-nav'

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
      {/* Sidebar */}
      <aside
        className="w-[220px] flex-shrink-0 flex flex-col"
        style={{ background: 'linear-gradient(175deg, #0c1525 0%, #152030 55%, #1c2b3e 100%)' }}
      >
        {/* Logo area */}
        <div className="relative px-5 py-[18px] border-b border-white/[0.07]">
          {/* Top accent line */}
          <div
            className="absolute top-0 left-0 right-0 h-[2px]"
            style={{ background: 'linear-gradient(90deg, #3b82f6 0%, #1d4ed8 60%, transparent 100%)' }}
          />
          <div className="flex items-center gap-2.5">
            {/* Waveform logo mark */}
            <div
              className="w-7 h-7 rounded-[7px] flex items-center justify-center flex-shrink-0"
              style={{
                background: 'rgba(59,130,246,0.15)',
                border: '1px solid rgba(59,130,246,0.28)',
              }}
            >
              <svg width="15" height="11" viewBox="0 0 15 11" fill="none">
                <path
                  d="M1 5.5 L3 2 L5 8.5 L7 0.5 L9 9.5 L11 3 L13 5.5"
                  stroke="#60a5fa"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <div>
              <p className="text-[12.5px] font-bold text-white tracking-wide leading-tight">
                HTS Validator
              </p>
              <p className="text-[9px] tracking-wider uppercase mt-0.5" style={{ color: 'rgba(96,165,250,0.6)' }}>
                USITC Classification
              </p>
            </div>
          </div>
        </div>

        <DashboardNav />

        <div className="px-4 py-3.5 border-t border-white/[0.07] flex items-center gap-2.5 min-w-0">
          <UserButton afterSignOutUrl="/" />
          <div className="min-w-0 flex-1">
            <p className="text-[10.5px] text-slate-200 font-medium truncate">{displayName}</p>
            <p className="text-[9px] text-slate-500 truncate">{email}</p>
          </div>
        </div>
      </aside>

      <main className="flex-1 min-w-0 overflow-auto content-bg">{children}</main>
    </div>
  )
}

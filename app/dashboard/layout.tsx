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
      <aside className="w-[220px] flex-shrink-0 bg-[#1e293b] flex flex-col">
        <div className="px-5 py-[18px] border-b border-[#334155]">
          <p className="text-[13px] font-bold text-slate-50 tracking-wide">HTS Validator</p>
          <p className="text-[10px] text-[#64748b] mt-0.5 tracking-wide">USITC Classification</p>
        </div>

        <DashboardNav />

        <div className="px-4 py-3.5 border-t border-[#334155] flex items-center gap-2.5 min-w-0">
          <UserButton afterSignOutUrl="/" />
          <div className="min-w-0 flex-1">
            <p className="text-[10.5px] text-slate-200 font-medium truncate">{displayName}</p>
            <p className="text-[9px] text-[#475569] truncate">{email}</p>
          </div>
        </div>
      </aside>

      <main className="flex-1 min-w-0 overflow-auto bg-[#f8fafc]">{children}</main>
    </div>
  )
}

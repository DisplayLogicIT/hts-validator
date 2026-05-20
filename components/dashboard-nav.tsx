'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const navItems = [
  {
    href: '/dashboard',
    exact: true,
    label: 'Lookup',
    icon: (
      <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
      </svg>
    ),
  },
  {
    href: '/dashboard/upload',
    exact: false,
    label: 'Upload',
    icon: (
      <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
      </svg>
    ),
  },
  {
    href: '/dashboard/history',
    exact: false,
    label: 'History',
    icon: (
      <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
      </svg>
    ),
  },
  {
    href: '/dashboard/validated',
    exact: false,
    label: 'Validated',
    icon: (
      <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path d="M9 12l2 2 4-4" />
        <circle cx="12" cy="12" r="10" />
      </svg>
    ),
  },
  {
    href: '/dashboard/unvalidated',
    exact: false,
    label: 'Unvalidated',
    icon: (
      <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    ),
  },
] as const

const disabledItems = [
  {
    label: 'Batch Jobs',
    icon: (
      <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <rect x="2" y="7" width="20" height="14" rx="2" />
        <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
      </svg>
    ),
  },
] as const

export function DashboardNav() {
  const pathname = usePathname()

  return (
    <nav className="flex-1 px-2.5 py-3 flex flex-col gap-0.5">
      {/* Section label with decorative line */}
      <div className="flex items-center gap-2 px-2.5 py-2">
        <p className="text-[9px] font-semibold uppercase tracking-[0.1em] shrink-0" style={{ color: 'rgba(96,165,250,0.45)' }}>
          Workspace
        </p>
        <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.06)' }} />
      </div>

      {navItems.map((item) => {
        const isActive = item.exact
          ? pathname === item.href
          : pathname.startsWith(item.href)

        if (isActive) {
          return (
            <Link
              key={item.href}
              href={item.href}
              className="relative flex items-center gap-2.5 px-2.5 py-[7px] rounded-md text-white text-[11.5px] font-medium overflow-hidden"
              style={{ background: 'linear-gradient(90deg, rgba(59,130,246,0.22) 0%, rgba(59,130,246,0.07) 100%)' }}
            >
              <span
                className="absolute left-0 top-1.5 bottom-1.5 w-[2.5px] rounded-full"
                style={{ background: 'linear-gradient(180deg, #60a5fa, #3b82f6)' }}
              />
              <span className="text-blue-300">{item.icon}</span>
              {item.label}
            </Link>
          )
        }

        return (
          <Link
            key={item.href}
            href={item.href}
            className="flex items-center gap-2.5 px-2.5 py-[7px] rounded-md text-[11.5px] transition-colors"
            style={{ color: 'rgba(100,116,139,1)' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'rgba(203,213,225,1)'
              e.currentTarget.style.background = 'rgba(255,255,255,0.04)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'rgba(100,116,139,1)'
              e.currentTarget.style.background = 'transparent'
            }}
          >
            <span style={{ color: 'rgba(71,85,105,1)' }}>{item.icon}</span>
            {item.label}
          </Link>
        )
      })}

      {disabledItems.map((item) => (
        <div
          key={item.label}
          className="flex items-center gap-2.5 px-2.5 py-[7px] rounded-md text-[11.5px] select-none cursor-not-allowed"
          style={{ color: 'rgba(71,85,105,0.7)' }}
        >
          <span style={{ color: 'rgba(51,65,85,0.8)' }}>{item.icon}</span>
          {item.label}
          <span
            className="ml-auto text-[8px] font-semibold rounded px-1 py-0.5 tracking-wide"
            style={{ background: 'rgba(51,65,85,0.5)', color: 'rgba(100,116,139,0.9)' }}
          >
            SOON
          </span>
        </div>
      ))}

      <div className="mt-auto px-2.5 pt-4 pb-1">
        <span
          className="text-[9px] font-mono select-none"
          style={{ color: 'rgba(71,85,105,0.55)' }}
          title="Build version — changes with every deploy"
        >
          {process.env.NEXT_PUBLIC_APP_VERSION}
        </span>
      </div>
    </nav>
  )
}

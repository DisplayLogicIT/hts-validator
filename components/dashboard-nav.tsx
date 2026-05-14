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
      <p className="text-[9px] font-semibold text-[#475569] uppercase tracking-[0.08em] px-2.5 py-2">
        Workspace
      </p>

      {navItems.map((item) => {
        const isActive = item.exact
          ? pathname === item.href
          : pathname.startsWith(item.href)

        return (
          <Link
            key={item.href}
            href={item.href}
            className={
              isActive
                ? 'flex items-center gap-2.5 px-2.5 py-[7px] rounded-md bg-[#334155] border-l-2 border-blue-400 text-slate-100 text-[11.5px] font-medium'
                : 'flex items-center gap-2.5 px-2.5 py-[7px] rounded-md text-[#64748b] text-[11.5px] hover:text-slate-300 transition-colors'
            }
          >
            <span className={isActive ? 'text-blue-300' : 'text-[#475569]'}>
              {item.icon}
            </span>
            {item.label}
          </Link>
        )
      })}

      {disabledItems.map((item) => (
        <div
          key={item.label}
          className="flex items-center gap-2.5 px-2.5 py-[7px] rounded-md text-[#475569] text-[11.5px] select-none cursor-not-allowed"
        >
          {item.icon}
          {item.label}
        </div>
      ))}
    </nav>
  )
}

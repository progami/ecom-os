'use client'

import Link from 'next/link'
import { ReactNode } from 'react'
import { usePathname } from 'next/navigation'

function Sidebar() {
  const pathname = usePathname()

  const items = [
    { href: '/', label: 'Dashboard', ariaLabel: 'Go to Dashboard' },
    { href: '/employees', label: 'Employees', ariaLabel: 'Manage Employees' },
    { href: '/resources', label: 'Resources', ariaLabel: 'View Resources' },
    { href: '/policies', label: 'Policies', ariaLabel: 'Company Policies' },
  ]

  return (
    <aside className="hidden md:flex md:flex-col md:w-64 bg-slate-900 text-white border-r border-slate-800">
      <div className="px-6 py-4 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-white font-bold text-sm">
            HR
          </div>
          <span className="text-xl font-bold">
            HRMS
          </span>
          <span className="ml-1 inline-block w-1.5 h-1.5 rounded-full bg-primary align-super" />
        </div>
      </div>
      <nav className="flex-1 px-3 py-4 overflow-y-auto">
        <ul className="space-y-1">
          {items.map(item => {
            const isActive = pathname === item.href
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-label={item.ariaLabel}
                  aria-current={isActive ? 'page' : undefined}
                  className={`
                    flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium
                    transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary
                    ${isActive
                      ? 'bg-primary text-white shadow-lg'
                      : 'text-gray-300 hover:text-white hover:bg-slate-800'
                    }
                  `}
                >
                  <span>{item.label}</span>
                  {isActive && <span className="sr-only">(current)</span>}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>
      <div className="p-4 border-t border-slate-800">
        <div className="flex items-center justify-between">
          <div className="text-xs text-gray-400">
            <span className="sr-only">Application </span>Version 1.1.0
          </div>
          <div className="px-2 py-1 bg-primary/20 text-primary text-[10px] font-semibold rounded">
            NEW DESIGN
          </div>
        </div>
      </div>
    </aside>
  )
}

function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-white">
      <div className="flex h-16 items-center gap-4 px-4 sm:px-6 md:px-8">
        <button className="md:hidden touch-target text-foreground">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="3" y1="12" x2="21" y2="12"></line>
            <line x1="3" y1="6" x2="21" y2="6"></line>
            <line x1="3" y1="18" x2="21" y2="18"></line>
          </svg>
        </button>
        <div className="flex flex-1 items-center justify-between">
          <div className="flex items-center gap-2 md:hidden">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-white font-bold text-sm">
              HR
            </div>
            <span className="text-lg font-bold text-foreground">HRMS</span>
          </div>
          <div className="flex-1"></div>
          <div className="flex items-center gap-4">
            <button className="touch-target rounded-lg hover:bg-muted p-2 text-muted-foreground">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
              </svg>
            </button>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-accent"></div>
              <div className="hidden sm:block text-sm">
                <div className="font-medium text-foreground">Admin User</div>
                <div className="text-muted-foreground text-xs">admin@hrms.com</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}

export default function HRMSLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col min-h-0">
        <Header />
        <main className="flex-1 overflow-y-auto">
          <div className="container mx-auto px-4 sm:px-6 md:px-8 py-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}

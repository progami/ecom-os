'use client'

import Link from 'next/link'
import { ReactNode, useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'

// Simple icon components to avoid external dependencies
function HomeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  )
}

function UsersIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  )
}

function FolderIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
    </svg>
  )
}

function DocumentIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  )
}

function MenuIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  )
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  )
}

interface NavItem {
  name: string
  href: string
  icon: React.ComponentType<{ className?: string }>
}

interface NavSection {
  title: string
  items: NavItem[]
}

const navigation: NavSection[] = [
  {
    title: '',
    items: [
      { name: 'Dashboard', href: '/', icon: HomeIcon },
    ]
  },
  {
    title: 'People',
    items: [
      { name: 'Employees', href: '/employees', icon: UsersIcon },
    ]
  },
  {
    title: 'Company',
    items: [
      { name: 'Resources', href: '/resources', icon: FolderIcon },
      { name: 'Policies', href: '/policies', icon: DocumentIcon },
    ]
  },
]

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ')
}

function Sidebar({ onClose }: { onClose?: () => void }) {
  const pathname = usePathname()
  const version = process.env.NEXT_PUBLIC_VERSION || '1.0.0'

  const matchesPath = (href: string) => {
    if (href === '/') return pathname === '/' || pathname === ''
    return pathname.startsWith(href)
  }

  return (
    <div className="flex grow flex-col gap-y-3 overflow-y-auto border-r border-slate-200 bg-white px-4 pb-3">
      <div className="flex h-16 shrink-0 items-center justify-between">
        <Link href="/" className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-600 to-teal-500 shadow-md">
            <span className="text-lg font-bold text-white">HR</span>
          </div>
          <span className="text-xl font-bold text-slate-900">HRMS</span>
        </Link>
        {onClose && (
          <button onClick={onClose} className="md:hidden p-2 rounded-lg hover:bg-slate-100">
            <XIcon className="h-5 w-5 text-slate-500" />
          </button>
        )}
      </div>

      <nav className="flex flex-1 flex-col">
        <ul role="list" className="flex flex-1 flex-col gap-y-7">
          <li>
            <ul role="list" className="-mx-2 space-y-3">
              {navigation.map((section, sectionIdx) => (
                <li key={sectionIdx}>
                  {section.title && (
                    <div className="px-2 pb-1 pt-2 text-xs font-bold uppercase tracking-[0.1em] text-cyan-700/70">
                      {section.title}
                    </div>
                  )}
                  <ul role="list" className="space-y-1">
                    {section.items.map((item) => (
                      <li key={item.name}>
                        <Link
                          href={item.href}
                          onClick={onClose}
                          className={cn(
                            matchesPath(item.href)
                              ? 'bg-cyan-50 text-cyan-900'
                              : 'text-slate-700 hover:text-cyan-700 hover:bg-slate-50',
                            'group flex gap-x-3 rounded-lg py-2 px-3 text-sm leading-5 font-medium transition-all duration-200'
                          )}
                        >
                          <item.icon
                            className={cn(
                              matchesPath(item.href)
                                ? 'text-cyan-600'
                                : 'text-slate-400 group-hover:text-cyan-600',
                              'h-5 w-5 shrink-0'
                            )}
                          />
                          {item.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </li>
        </ul>
      </nav>

      <div className="border-t border-slate-200 pt-3">
        <div className="flex items-center justify-between px-2 py-2">
          <span className="text-xs text-slate-500">v{version}</span>
        </div>
      </div>
    </div>
  )
}

function MobileNav({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  if (!isOpen) return null

  return (
    <div className="relative z-50 md:hidden">
      <div
        className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="fixed inset-0 flex">
        <div className="relative mr-16 flex w-full max-w-xs flex-1">
          <Sidebar onClose={onClose} />
        </div>
      </div>
    </div>
  )
}

function Header({ onMenuClick }: { onMenuClick: () => void }) {
  const pathname = usePathname()

  const getCurrentPageName = () => {
    for (const section of navigation) {
      for (const item of section.items) {
        if (item.href === '/') {
          if (pathname === '/' || pathname === '') return item.name
        } else if (pathname.startsWith(item.href)) {
          return item.name
        }
      }
    }
    return 'Dashboard'
  }

  return (
    <div className="sticky top-0 z-40 flex items-center gap-x-6 bg-white px-4 py-4 shadow-soft border-b border-slate-200 sm:px-6 md:hidden">
      <button
        type="button"
        className="-m-2.5 p-2.5 text-slate-700"
        onClick={onMenuClick}
      >
        <span className="sr-only">Open sidebar</span>
        <MenuIcon className="h-6 w-6" />
      </button>
      <div className="flex-1 text-sm font-semibold leading-6 text-slate-900">
        {getCurrentPageName()}
      </div>
    </div>
  )
}

export default function HRMSLayout({ children }: { children: ReactNode }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const version = process.env.NEXT_PUBLIC_VERSION || '1.0.0'

  // Close mobile menu on route change
  const pathname = usePathname()
  useEffect(() => {
    setMobileMenuOpen(false)
  }, [pathname])

  return (
    <>
      {/* Desktop Navigation */}
      <div className="hidden md:fixed md:inset-y-0 md:z-50 md:flex md:w-64 md:flex-col">
        <Sidebar />
      </div>

      {/* Mobile Navigation */}
      <MobileNav isOpen={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />

      {/* Main Content */}
      <div className="md:pl-64 transition-all duration-300 h-screen flex flex-col overflow-hidden bg-slate-50">
        <Header onMenuClick={() => setMobileMenuOpen(true)} />

        <main className="flex-1 flex flex-col min-h-0">
          <div className="flex-1 flex flex-col px-4 sm:px-6 md:px-8 py-6 min-h-0 overflow-y-auto">
            {children}
          </div>
        </main>

        <footer className="flex-shrink-0 border-t border-slate-200 bg-white/95 backdrop-blur-sm">
          <div className="px-4 sm:px-6 md:px-8 py-4">
            <p className="text-xs text-slate-500 text-center">
              HRMS v{version} &bull; Human Resource Management System
            </p>
          </div>
        </footer>
      </div>
    </>
  )
}

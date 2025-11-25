'use client'

import Link from 'next/link'
import { ReactNode, useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'

// Icons
function HomeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
    </svg>
  )
}

function UsersIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
    </svg>
  )
}

function FolderIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
    </svg>
  )
}

function DocumentIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    </svg>
  )
}

function MenuIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
    </svg>
  )
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
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

  const matchesPath = (href: string) => {
    if (href === '/') return pathname === '/' || pathname === ''
    return pathname.startsWith(href)
  }

  return (
    <div className="flex grow flex-col gap-y-5 overflow-y-auto border-r border-slate-200 bg-white px-6 pb-4">
      <div className="flex h-16 shrink-0 items-center justify-between">
        <Link href="/" className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-600">
            <span className="text-sm font-bold text-white">HR</span>
          </div>
          <span className="text-lg font-semibold text-slate-900">HRMS</span>
        </Link>
        {onClose && (
          <button onClick={onClose} className="md:hidden p-2 hover:bg-slate-100 rounded-lg">
            <XIcon className="h-5 w-5 text-slate-500" />
          </button>
        )}
      </div>

      <nav className="flex flex-1 flex-col">
        <ul role="list" className="flex flex-1 flex-col gap-y-7">
          <li>
            <ul role="list" className="-mx-2 space-y-1">
              {navigation.map((section, sectionIdx) => (
                <li key={sectionIdx}>
                  {section.title && (
                    <div className="px-3 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
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
                              ? 'bg-cyan-50 text-cyan-600'
                              : 'text-slate-700 hover:text-slate-900 hover:bg-slate-50',
                            'group flex gap-x-3 rounded-lg py-2 px-3 text-sm font-medium'
                          )}
                        >
                          <item.icon
                            className={cn(
                              matchesPath(item.href)
                                ? 'text-cyan-600'
                                : 'text-slate-400 group-hover:text-slate-600',
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
    </div>
  )
}

function MobileNav({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  if (!isOpen) return null

  return (
    <div className="relative z-50 md:hidden">
      <div className="fixed inset-0 bg-slate-900/80" onClick={onClose} />
      <div className="fixed inset-0 flex">
        <div className="relative mr-16 flex w-full max-w-xs flex-1">
          <div className="absolute left-full top-0 flex w-16 justify-center pt-5">
            <button type="button" className="-m-2.5 p-2.5" onClick={onClose}>
              <XIcon className="h-6 w-6 text-white" />
            </button>
          </div>
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
    <div className="sticky top-0 z-40 flex items-center gap-x-6 bg-white px-4 py-4 border-b border-slate-200 sm:px-6 md:hidden">
      <button type="button" className="-m-2.5 p-2.5 text-slate-700" onClick={onMenuClick}>
        <MenuIcon className="h-6 w-6" />
      </button>
      <div className="flex-1 text-sm font-semibold text-slate-900">
        {getCurrentPageName()}
      </div>
    </div>
  )
}

export default function HRMSLayout({ children }: { children: ReactNode }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const version = process.env.NEXT_PUBLIC_VERSION || '1.1.0'

  const pathname = usePathname()
  useEffect(() => {
    setMobileMenuOpen(false)
  }, [pathname])

  return (
    <>
      {/* Desktop Sidebar */}
      <div className="hidden md:fixed md:inset-y-0 md:z-50 md:flex md:w-64 md:flex-col">
        <Sidebar />
      </div>

      {/* Mobile Nav */}
      <MobileNav isOpen={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />

      {/* Main Content */}
      <div className="md:pl-64 h-screen flex flex-col overflow-hidden bg-slate-50">
        <Header onMenuClick={() => setMobileMenuOpen(true)} />

        <main className="flex-1 flex flex-col min-h-0">
          <div className="flex-1 flex flex-col px-4 sm:px-6 lg:px-8 py-6 min-h-0 overflow-y-auto">
            {children}
          </div>
        </main>

        <footer className="border-t border-slate-200 bg-white">
          <div className="px-4 sm:px-6 lg:px-8 py-3">
            <p className="text-xs text-slate-500 text-center">
              HRMS v{version}
            </p>
          </div>
        </footer>
      </div>
    </>
  )
}

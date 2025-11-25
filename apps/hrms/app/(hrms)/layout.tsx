'use client'

import Link from 'next/link'
import { ReactNode, useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'

// Simple icon components
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

function UserCircleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17.982 18.725A7.488 7.488 0 0012 15.75a7.488 7.488 0 00-5.982 2.975m11.963 0a9 9 0 10-11.963 0m11.963 0A8.966 8.966 0 0112 21a8.966 8.966 0 01-5.982-2.275M15 9.75a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  )
}

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
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

function Sidebar({ onClose, isCollapsed = false }: { onClose?: () => void; isCollapsed?: boolean }) {
  const pathname = usePathname()
  const [userMenuOpen, setUserMenuOpen] = useState(false)

  // Close user menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuOpen && !(event.target as HTMLElement).closest('.user-menu-container')) {
        setUserMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [userMenuOpen])

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
          <span className={cn(
            "text-xl font-bold text-slate-900 transition-all duration-300",
            isCollapsed && "md:hidden lg:inline"
          )}>HRMS</span>
        </Link>

        <div className="flex items-center gap-2">
          {/* User avatar/menu */}
          <div className={cn(
            "relative transition-all duration-300 user-menu-container",
            isCollapsed && "md:hidden lg:block"
          )}>
            <button
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <div className="h-8 w-8 rounded-full bg-gradient-to-br from-cyan-500 to-teal-400 flex items-center justify-center shadow-sm">
                <UserCircleIcon className="h-5 w-5 text-white" />
              </div>
              <ChevronDownIcon className={cn(
                "h-4 w-4 text-slate-400 transition-transform duration-200",
                userMenuOpen && "rotate-180"
              )} />
            </button>
            {/* Dropdown menu */}
            {userMenuOpen && (
              <div className="absolute right-0 top-full mt-1 w-56 bg-white rounded-xl shadow-lg border border-slate-200 py-1 z-50">
                <div className="px-4 py-3 border-b border-slate-100">
                  <p className="text-sm font-medium text-slate-900">HR Admin</p>
                  <p className="text-xs text-slate-500 mt-0.5">admin@company.com</p>
                </div>
                <div className="py-1">
                  <button
                    className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-2"
                  >
                    <UserCircleIcon className="h-4 w-4 text-slate-400" />
                    Profile Settings
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Mobile close button */}
          {onClose && (
            <button onClick={onClose} className="md:hidden p-2 rounded-lg hover:bg-slate-100">
              <XIcon className="h-5 w-5 text-slate-500" />
            </button>
          )}
        </div>
      </div>

      <nav className="flex flex-1 flex-col">
        <ul role="list" className="flex flex-1 flex-col gap-y-6">
          <li>
            <ul role="list" className="-mx-2 space-y-1">
              {navigation.map((section, sectionIdx) => (
                <li key={sectionIdx}>
                  {section.title && (
                    <div className={cn(
                      "px-3 pb-1.5 pt-4 text-[11px] font-semibold uppercase tracking-wider text-slate-400 transition-all duration-300",
                      isCollapsed && "md:hidden lg:block"
                    )}>
                      {section.title}
                    </div>
                  )}
                  <ul role="list" className="space-y-0.5">
                    {section.items.map((item) => (
                      <li key={item.name}>
                        <Link
                          href={item.href}
                          onClick={onClose}
                          className={cn(
                            matchesPath(item.href)
                              ? 'bg-gradient-to-r from-cyan-50 to-teal-50 text-cyan-700 border-l-2 border-cyan-500'
                              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 border-l-2 border-transparent',
                            'group flex gap-x-3 rounded-lg py-2.5 px-3 text-sm font-medium transition-all duration-200'
                          )}
                        >
                          <item.icon
                            className={cn(
                              matchesPath(item.href)
                                ? 'text-cyan-600'
                                : 'text-slate-400 group-hover:text-slate-600',
                              'h-5 w-5 shrink-0 transition-colors'
                            )}
                          />
                          <span className={cn(
                            "transition-all duration-300",
                            isCollapsed && "md:hidden lg:inline"
                          )}>
                            {item.name}
                          </span>
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
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="fixed inset-0 flex">
        <div className="relative mr-16 flex w-full max-w-xs flex-1">
          <div className="absolute left-full top-0 flex w-16 justify-center pt-5">
            <button
              type="button"
              className="-m-2.5 p-2.5"
              onClick={onClose}
            >
              <span className="sr-only">Close sidebar</span>
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
    <div className="sticky top-0 z-40 flex items-center gap-x-4 bg-white/95 backdrop-blur-sm px-4 py-4 shadow-sm border-b border-slate-200 sm:px-6 md:hidden">
      <button
        type="button"
        className="-m-2 p-2 text-slate-600 hover:text-slate-900 transition-colors"
        onClick={onMenuClick}
      >
        <span className="sr-only">Open sidebar</span>
        <MenuIcon className="h-6 w-6" />
      </button>
      <div className="h-6 w-px bg-slate-200" />
      <div className="flex-1 text-sm font-semibold text-slate-900">
        {getCurrentPageName()}
      </div>
    </div>
  )
}

export default function HRMSLayout({ children }: { children: ReactNode }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [isTabletCollapsed, setIsTabletCollapsed] = useState(false)
  const version = process.env.NEXT_PUBLIC_VERSION || '1.1.0'
  const releaseTag = `hrms-${version}`
  const releaseUrl = `https://github.com/progami/ecom-os/releases/tag/${releaseTag}`

  // Close mobile menu on route change
  const pathname = usePathname()
  useEffect(() => {
    setMobileMenuOpen(false)
  }, [pathname])

  return (
    <>
      {/* Desktop Navigation */}
      <div className={cn(
        "hidden md:fixed md:inset-y-0 md:z-50 md:flex md:flex-col transition-all duration-300",
        isTabletCollapsed ? "md:w-16 lg:w-64" : "md:w-64"
      )}>
        <Sidebar isCollapsed={isTabletCollapsed} />
      </div>

      {/* Mobile Navigation */}
      <MobileNav isOpen={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />

      {/* Main Content */}
      <div className={cn(
        "transition-all duration-300 h-screen flex flex-col overflow-hidden bg-slate-50",
        isTabletCollapsed ? "md:pl-16 lg:pl-64" : "md:pl-64"
      )}>
        <Header onMenuClick={() => setMobileMenuOpen(true)} />

        <main className="flex-1 flex flex-col min-h-0">
          <div className="flex-1 flex flex-col px-4 sm:px-6 md:px-8 py-6 min-h-0 overflow-y-auto">
            {children}
          </div>
        </main>

        <footer className="flex-shrink-0 border-t border-slate-200 bg-white/80 backdrop-blur-sm">
          <div className="px-4 sm:px-6 md:px-8 py-3">
            <p className="text-xs text-slate-400 text-center">
              HRMS{' '}
              <a
                href={releaseUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-cyan-600 transition-colors"
              >
                v{version}
              </a>
              {' '}• Human Resource Management System
            </p>
          </div>
        </footer>
      </div>
    </>
  )
}

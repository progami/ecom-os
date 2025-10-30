'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession } from 'next-auth/react'
import {
  Home,
  Package,
  FileText,
  Settings,
  Users,
  LogOut,
  Menu,
  X,
  BarChart3,
  Calculator,
  Building,
  BookOpen,
  Calendar,
  AlertTriangle,
} from '@/lib/lucide-icons'
import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { portalUrl } from '@/lib/portal'

interface NavSection {
  title: string
  items: Array<{
    name: string
    href: string
    icon: React.ComponentType<{ className?: string }>
  }>
}

const baseNavigation: NavSection[] = [
  {
    title: '',
    items: [
      { name: 'Dashboard', href: '/dashboard', icon: Home },
    ]
  },
  {
    title: 'Operations',
    items: [
      { name: 'Purchase Orders', href: '/operations/purchase-orders', icon: FileText },
      { name: 'Inventory Ledger', href: '/operations/inventory', icon: BookOpen },
      { name: 'Pallet Variance', href: '/operations/pallet-variance', icon: AlertTriangle },
    ]
  },
  {
    title: 'Finance',
    items: [
      { name: 'Storage Ledger', href: '/finance/storage-ledger', icon: Calendar },
      { name: 'Cost Ledger', href: '/finance/cost-ledger', icon: BarChart3 },
      { name: 'Warehouse Invoices', href: '/operations/warehouse-invoices', icon: FileText },
      { name: 'Invoices', href: '/finance/invoices', icon: FileText },
      { name: 'Reconciliation', href: '/finance/reconciliation', icon: Calculator },
    ]
  },
  {
    title: 'Configuration',
    items: [
      { name: 'Products', href: '/config/products', icon: Package },
      { name: 'Warehouse Configs', href: '/config/warehouses', icon: Building },
    ]
  },
]


export function MainNav() {
  const pathname = usePathname()
  const { data: session } = useSession()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [isTabletCollapsed, setIsTabletCollapsed] = useState(false)
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

  if (!session) return null

  // Check if user has admin role
  const isAdmin = session.user.role === 'admin'
  
  // Use base navigation for all users
  const userNavigation = baseNavigation

  // Get current page name for mobile header
  const matchesPath = (href: string) => {
    const [targetPath] = href.split('?')
    return pathname.startsWith(targetPath)
  }

  const getCurrentPageName = () => {
    for (const section of userNavigation) {
      for (const item of section.items) {
        if (matchesPath(item.href)) {
          return item.name
        }
      }
    }
    return 'Dashboard'
  }

  return (
    <>
      {/* Desktop Navigation - responsive for tablets */}
      <div className={cn(
        "hidden md:fixed md:inset-y-0 md:z-50 md:flex md:flex-col transition-all duration-300",
        isTabletCollapsed ? "md:w-16 lg:w-64" : "md:w-64"
      )}>
        <div className="flex grow flex-col gap-y-3 overflow-y-auto border-r border-slate-200 bg-white dark:bg-[#041324] dark:border-[#0b3a52] px-4 pb-3">
          <div className="flex h-16 shrink-0 items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href="/dashboard" scroll={false} className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-600 to-brand-teal-500 shadow-md dark:shadow-[0_12px_24px_rgba(0,194,185,0.25)]">
                  <span className="text-lg font-bold text-white">W</span>
                </div>
                <span className={cn("text-xl font-bold text-slate-900 dark:text-white transition-all duration-300", isTabletCollapsed && "md:hidden lg:inline")}>WMS</span>
              </Link>
            </div>
            
            {/* User info and tablet collapse */}
            <div className="flex items-center gap-2">
              {/* User avatar/menu */}
              <div className={cn("relative transition-all duration-300 user-menu-container", isTabletCollapsed && "md:hidden lg:block")}>
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
                >
                  <div className="h-7 w-7 rounded-full bg-cyan-600/10 dark:bg-[#00C2B9]/20 flex items-center justify-center">
                    <span className="text-xs font-medium text-cyan-700 dark:text-[#00C2B9]">
                      {session.user.name?.charAt(0).toUpperCase()}
                    </span>
                  </div>
                </button>
                {/* Dropdown menu */}
                {userMenuOpen && (
                  <div className="absolute right-0 top-full mt-1 w-56 bg-white dark:bg-[#06182b] rounded-lg shadow-soft-lg border border-slate-200 dark:border-[#0b3a52] py-1 z-50">
                    <div className="px-3 py-2 border-b border-slate-200 dark:border-[#0b3a52]">
                      <p className="text-xs text-slate-500">Signed in as</p>
                      <p className="text-sm font-medium truncate">{session.user.name}</p>
                      <p className="text-xs text-slate-500 truncate">{session.user.email}</p>
                    </div>
                    
                    {/* Admin options */}
                    {isAdmin && (
                      <>
                        <div className="py-1 border-b border-slate-200 dark:border-[#0b3a52]">
                          <Link
                            href="/admin/users"
                            onClick={() => setUserMenuOpen(false)}
                            className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-white/5 transition-colors flex items-center gap-2"
                          >
                            <Users className="h-4 w-4" />
                            Users
                          </Link>
                          <Link
                            href="/admin/settings"
                            onClick={() => setUserMenuOpen(false)}
                            className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-white/5 transition-colors flex items-center gap-2"
                          >
                            <Settings className="h-4 w-4" />
                            Settings
                          </Link>
                        </div>
                      </>
                    )}

                    <button
                      onClick={() => {
                        const url = portalUrl('/api/auth/signout')
                        url.searchParams.set('callbackUrl', `${window.location.origin}/auth/login`)
                        window.location.href = url.toString()
                      }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-white/5 transition-colors flex items-center gap-2"
                    >
                      <LogOut className="h-4 w-4" />
                      Sign out
                    </button>
                  </div>
                )}
              </div>
              
              {/* Tablet collapse button */}
              <button
                onClick={() => setIsTabletCollapsed(!isTabletCollapsed)}
                className="hidden md:block lg:hidden p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
              >
                <Menu className="h-5 w-5" />
              </button>
            </div>
          </div>
          <nav className="flex flex-1 flex-col">
            <ul role="list" className="flex flex-1 flex-col gap-y-7">
              <li>
                <ul role="list" className="-mx-2 space-y-3">
                  {userNavigation.map((section, sectionIdx) => (
                    <li key={sectionIdx}>
                      {section.title && (
                        <div className={cn(
                          "px-2 pb-1 pt-2 text-xs font-bold uppercase tracking-[0.1em] text-cyan-700/70 dark:text-cyan-300/60 transition-all duration-300",
                          isTabletCollapsed && "md:hidden lg:block"
                        )}>
                          {section.title}
                        </div>
                      )}
                      <ul role="list" className="space-y-1">
                        {section.items.map((item) => (
                          <li key={item.name}>
                            <Link
                              href={item.href}
                              scroll={false}
                              className={cn(
                                matchesPath(item.href)
                                  ? 'bg-cyan-50 text-cyan-900 dark:bg-[#00C2B9]/10 dark:text-cyan-100'
                                  : 'text-slate-700 hover:text-cyan-700 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-cyan-100',
                                'group flex gap-x-3 rounded-lg py-2 px-3 text-sm leading-5 font-medium transition-all duration-200'
                              )}
                            >
                              <item.icon
                                className={cn(
                                  matchesPath(item.href)
                                    ? 'text-cyan-600 dark:text-[#00C2B9]'
                                    : 'text-slate-400 group-hover:text-cyan-600 dark:group-hover:text-[#00C2B9]',
                                  'h-5 w-5 shrink-0'
                                )}
                                aria-hidden="true"
                              />
                              <span className={cn(
                                "transition-all duration-300",
                                isTabletCollapsed && "md:hidden lg:inline"
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
      </div>

      {/* Mobile Navigation */}
      <div className="sticky top-0 z-40 flex items-center gap-x-6 bg-white dark:bg-[#041324] px-4 py-4 shadow-soft border-b border-slate-200 dark:border-[#0b3a52] sm:px-6 md:hidden">
        <button
          type="button"
          className="-m-2.5 p-2.5 text-slate-700 dark:text-slate-300"
          onClick={() => setMobileMenuOpen(true)}
        >
          <span className="sr-only">Open sidebar</span>
          <Menu className="h-6 w-6" aria-hidden="true" />
        </button>
        <div className="flex-1 text-sm font-semibold leading-6 text-slate-900 dark:text-white">
          {getCurrentPageName()}
        </div>
      </div>

      {/* Mobile menu overlay */}
      {mobileMenuOpen && (
        <div className="relative z-50 lg:hidden">
          <div
            className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="fixed inset-0 flex">
            <div className="relative mr-16 flex w-full max-w-xs flex-1">
              <div className="absolute left-full top-0 flex w-16 justify-center pt-5">
                <button
                  type="button"
                  className="-m-2.5 p-2.5"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <span className="sr-only">Close sidebar</span>
                  <X className="h-6 w-6 text-white" aria-hidden="true" />
                </button>
              </div>
              <div className="flex grow flex-col gap-y-5 overflow-y-auto bg-white dark:bg-[#041324] px-6 pb-4">
                <div className="flex h-16 shrink-0 items-center">
                  <Link href="/dashboard" scroll={false} className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-600 to-brand-teal-500 shadow-md dark:shadow-[0_12px_24px_rgba(0,194,185,0.25)]">
                      <span className="text-lg font-bold text-white">W</span>
                    </div>
                    <span className="text-xl font-bold text-slate-900 dark:text-white">WMS</span>
                  </Link>
                </div>
                <nav className="flex flex-1 flex-col">
                  <ul role="list" className="flex flex-1 flex-col gap-y-7">
                    <li>
                      <ul role="list" className="-mx-2 space-y-3">
                        {userNavigation.map((section, sectionIdx) => (
                          <li key={sectionIdx}>
                            {section.title && (
                              <div className="px-2 pb-2 text-xs font-bold uppercase tracking-[0.1em] text-cyan-700/70 dark:text-cyan-300/60">
                                {section.title}
                              </div>
                            )}
                            <ul role="list" className="space-y-1">
                              {section.items.map((item) => (
                                <li key={item.name}>
                                  <Link
                                    href={item.href}
                                    scroll={false}
                                    className={cn(
                                      matchesPath(item.href)
                                        ? 'bg-cyan-50 text-cyan-900 dark:bg-[#00C2B9]/10 dark:text-cyan-100'
                                        : 'text-slate-700 hover:text-cyan-700 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-cyan-100',
                                      'group flex gap-x-3 rounded-lg py-2 px-3 text-sm leading-5 font-medium transition-all duration-200'
                                    )}
                                    onClick={() => setMobileMenuOpen(false)}
                                  >
                                    <item.icon
                                      className={cn(
                                        matchesPath(item.href)
                                          ? 'text-cyan-600 dark:text-[#00C2B9]'
                                          : 'text-slate-400 group-hover:text-cyan-600 dark:group-hover:text-[#00C2B9]',
                                        'h-5 w-5 shrink-0'
                                      )}
                                      aria-hidden="true"
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
            </div>
          </div>
        </div>
      )}
    </>
  )
}

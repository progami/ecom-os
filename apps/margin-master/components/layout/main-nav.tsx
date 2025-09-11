'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Calculator,
  Home,
  Package,
  Settings,
  Menu,
  X,
  TrendingUp,
  DollarSign,
  Layers,
  Zap,
} from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'

interface NavSection {
  title: string
  items: Array<{
    name: string
    href: string
    icon: any
  }>
}

const navigation = [
  {
    title: '',
    items: [
      { name: 'Dashboard', href: '/dashboard', icon: Home },
    ]
  },
  {
    title: 'Tools',
    items: [
      { name: 'Combination Generator', href: '/combination-generator', icon: Zap },
      { name: 'Results', href: '/combination-results', icon: TrendingUp },
    ]
  },
  {
    title: 'Configuration',
    items: [
      { name: 'Material Profiles', href: '/materials', icon: Layers },
      { name: 'Sourcing Profiles', href: '/sourcing', icon: Package },
      { name: 'Amazon Fee Tables', href: '/amazon-fees', icon: DollarSign },
    ]
  },
  // Settings page temporarily disabled due to disk space
  // {
  //   title: 'Settings',
  //   items: [
  //     { name: 'Settings', href: '/settings', icon: Settings },
  //   ]
  // },
] as NavSection[]

export function MainNav() {
  const pathname = usePathname()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <>
      {/* Desktop Navigation */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:z-50 lg:flex lg:w-72 lg:flex-col">
        <div className="flex grow flex-col gap-y-5 overflow-y-auto border-r border-gray-200 bg-white dark:bg-gray-900 dark:border-gray-800 px-6 pb-4">
          <div className="flex h-16 shrink-0 items-center">
            <Link href="/dashboard" className="flex items-center gap-2">
              <Calculator className="h-8 w-8 text-primary" />
              <span className="text-xl font-bold">MarginMaster</span>
            </Link>
          </div>
          <nav className="flex flex-1 flex-col">
            <ul role="list" className="flex flex-1 flex-col gap-y-7">
              <li>
                <ul role="list" className="-mx-2 space-y-6">
                  {navigation.map((section, sectionIdx) => (
                    <li key={sectionIdx}>
                      {section.title && (
                        <div className="px-2 pb-2 text-xs font-semibold leading-6 text-gray-400 uppercase tracking-wider">
                          {section.title}
                        </div>
                      )}
                      <ul role="list" className="space-y-1">
                        {section.items.map((item) => (
                          <li key={item.name}>
                            <Link
                              href={item.href}
                              className={cn(
                                pathname === item.href
                                  ? 'bg-gray-100 text-primary dark:bg-gray-800'
                                  : 'text-gray-700 hover:text-primary hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-800',
                                'group flex gap-x-3 rounded-md p-2 text-sm leading-6 font-semibold'
                              )}
                            >
                              <item.icon
                                className={cn(
                                  pathname === item.href
                                    ? 'text-primary'
                                    : 'text-gray-400 group-hover:text-primary',
                                  'h-6 w-6 shrink-0'
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

      {/* Mobile Navigation */}
      <div className="sticky top-0 z-40 flex items-center gap-x-6 bg-white dark:bg-gray-900 px-4 py-4 shadow-sm sm:px-6 lg:hidden">
        <button
          type="button"
          className="-m-2.5 p-2.5 text-gray-700 dark:text-gray-400 lg:hidden"
          onClick={() => setMobileMenuOpen(true)}
        >
          <span className="sr-only">Open sidebar</span>
          <Menu className="h-6 w-6" aria-hidden="true" />
        </button>
        <div className="flex-1 text-sm font-semibold leading-6 text-gray-900 dark:text-white">
          MarginMaster
        </div>
      </div>

      {/* Mobile menu overlay */}
      {mobileMenuOpen && (
        <div className="relative z-50 lg:hidden">
          <div
            className="fixed inset-0 bg-gray-900/80"
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
              <div className="flex grow flex-col gap-y-5 overflow-y-auto bg-white dark:bg-gray-900 px-6 pb-4">
                <div className="flex h-16 shrink-0 items-center">
                  <Link href="/dashboard" className="flex items-center gap-2">
                    <Calculator className="h-8 w-8 text-primary" />
                    <span className="text-xl font-bold">MarginMaster</span>
                  </Link>
                </div>
                <nav className="flex flex-1 flex-col">
                  <ul role="list" className="flex flex-1 flex-col gap-y-7">
                    <li>
                      <ul role="list" className="-mx-2 space-y-6">
                        {navigation.map((section, sectionIdx) => (
                          <li key={sectionIdx}>
                            {section.title && (
                              <div className="px-2 pb-2 text-xs font-semibold leading-6 text-gray-400 uppercase tracking-wider">
                                {section.title}
                              </div>
                            )}
                            <ul role="list" className="space-y-1">
                              {section.items.map((item) => (
                                <li key={item.name}>
                                  <Link
                                    href={item.href}
                                    className={cn(
                                      pathname === item.href
                                        ? 'bg-gray-100 text-primary dark:bg-gray-800'
                                        : 'text-gray-700 hover:text-primary hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-800',
                                      'group flex gap-x-3 rounded-md p-2 text-sm leading-6 font-semibold'
                                    )}
                                    onClick={() => setMobileMenuOpen(false)}
                                  >
                                    <item.icon
                                      className={cn(
                                        pathname === item.href
                                          ? 'text-primary'
                                          : 'text-gray-400 group-hover:text-primary',
                                        'h-6 w-6 shrink-0'
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
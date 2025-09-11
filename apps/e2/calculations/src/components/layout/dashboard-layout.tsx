'use client'

import React, { ReactNode } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  BarChart3,
  Calculator,
  DollarSign,
  FileText,
  Package,
  TrendingUp,
  Users,
  ChevronRight,
  Home,
  Receipt,
  Building,
  GitCompare,
  BookOpen,
  Layers,
  FileBarChart
} from 'lucide-react'

interface DashboardLayoutProps {
  children: ReactNode
}

const navigation = [
  { name: 'Budget Strategies', href: '/financial-dashboard', icon: Layers },
  { name: 'Products', href: '/financial-dashboard/product-margins', icon: DollarSign },
  { name: 'Sales Forecast', href: '/financial-dashboard/sales-forecast', icon: TrendingUp },
  { name: 'Order Forecast', href: '/financial-dashboard/order-planning', icon: Package },
  { name: 'Expense Forecast', href: '/financial-dashboard/expense-forecast', icon: Receipt },
  { name: 'General Ledger', href: '/financial-dashboard/general-ledger', icon: FileBarChart },
  { name: 'Reports', href: '/financial-dashboard/reports', icon: FileText },
  { name: 'Charts', href: '/financial-dashboard/charts', icon: BarChart3 },
  { name: 'Chart of Accounts', href: '/financial-dashboard/chart-of-accounts', icon: BookOpen },
]

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const pathname = usePathname()

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      {/* Sidebar */}
      <div className="hidden md:flex md:flex-shrink-0">
        <div className="flex flex-col w-64">
          <div className="flex flex-col flex-grow pt-5 pb-4 overflow-y-auto bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700">
            <div className="flex items-center flex-shrink-0 px-4">
              <h1 className="text-xl font-semibold text-gray-900 dark:text-white">E2 Financial</h1>
            </div>
            <div className="mt-8 flex-grow flex flex-col">
              <nav className="flex-1 px-2 space-y-1">
                {navigation.map((item) => {
                  const isActive = pathname === item.href || 
                    (item.href === '/financial-dashboard/general-ledger' && pathname.startsWith('/financial-dashboard/general-ledger'))
                  const isDisabled = false
                  
                  if (isDisabled) {
                    return (
                      <div
                        key={item.name}
                        className="text-gray-400 cursor-not-allowed group flex items-center px-2 py-2 text-sm font-medium rounded-md opacity-50"
                      >
                        <item.icon
                          className="text-gray-400 mr-3 flex-shrink-0 h-5 w-5"
                          aria-hidden="true"
                        />
                        {item.name}
                      </div>
                    )
                  }
                  
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      prefetch={true}
                      className={cn(
                        isActive
                          ? 'bg-primary text-primary-foreground'
                          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white',
                        'group flex items-center px-2 py-2 text-sm font-medium rounded-md transition-colors'
                      )}
                    >
                      <item.icon
                        className={cn(
                          isActive
                            ? 'text-primary-foreground'
                            : 'text-gray-400 group-hover:text-gray-500 dark:group-hover:text-gray-300',
                          'mr-3 flex-shrink-0 h-5 w-5'
                        )}
                        aria-hidden="true"
                      />
                      {item.name}
                      {isActive && (
                        <ChevronRight className="ml-auto h-4 w-4" />
                      )}
                    </Link>
                  )
                })}
              </nav>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
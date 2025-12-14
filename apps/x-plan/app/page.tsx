'use client'

import { Suspense, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { clsx } from 'clsx'
import {
  Package,
  ClipboardList,
  TrendingUp,
  Wallet,
  ChevronRight,
  LineChart,
  Wallet2,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { ThemeToggle } from '@/components/theme-toggle'

type SheetOption = {
  slug: string
  label: string
  description: string
  icon: LucideIcon
}

type Category = {
  key: string
  label: string
  description: string
  icon: LucideIcon
  sheets: SheetOption[]
}

const CATEGORIES: Category[] = [
  {
    key: 'products',
    label: 'Products',
    description: 'Master data for products & business parameters',
    icon: Package,
    sheets: [
      {
        slug: '1-product-setup',
        label: 'Product Setup',
        description: 'Manage your product catalog, lead times, and cost parameters',
        icon: Package,
      },
    ],
  },
  {
    key: 'operations',
    label: 'Operations',
    description: 'Purchase orders, timelines & supplier payments',
    icon: ClipboardList,
    sheets: [
      {
        slug: '2-ops-planning',
        label: 'Ops Planning',
        description: 'Track purchase orders, production timelines, and payment schedules',
        icon: ClipboardList,
      },
    ],
  },
  {
    key: 'sales',
    label: 'Sales',
    description: 'Weekly sales forecasts & inventory tracking',
    icon: TrendingUp,
    sheets: [
      {
        slug: '3-sales-planning',
        label: 'Sales Planning',
        description: 'Forecast sales, monitor stock levels, and plan inventory',
        icon: TrendingUp,
      },
    ],
  },
  {
    key: 'finance',
    label: 'Finance',
    description: 'Profit & loss analysis and cash flow tracking',
    icon: Wallet,
    sheets: [
      {
        slug: '4-fin-planning-pl',
        label: 'Profit & Loss',
        description: 'Analyze revenue, costs, margins, and net profit',
        icon: LineChart,
      },
      {
        slug: '5-fin-planning-cash-flow',
        label: 'Cash Flow',
        description: 'Track cash inflows, outflows, and runway',
        icon: Wallet2,
      },
    ],
  },
]

function CategoryNavigation() {
  const searchParams = useSearchParams()
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)

  const buildHref = (slug: string) => {
    const params = new URLSearchParams(searchParams?.toString() ?? '')
    const query = params.toString()
    return `/${slug}${query ? `?${query}` : ''}`
  }

  const handleCategoryClick = (key: string) => {
    setSelectedCategory(selectedCategory === key ? null : key)
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-[#041324]">
      {CATEGORIES.map((category, index) => {
        const isSelected = selectedCategory === category.key
        const Icon = category.icon
        const isLast = index === CATEGORIES.length - 1

        return (
          <div key={category.key}>
            {/* Category Row */}
            <button
              type="button"
              onClick={() => handleCategoryClick(category.key)}
              className={clsx(
                'group flex w-full items-center gap-4 px-6 py-5 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-cyan-400',
                isSelected
                  ? 'bg-gradient-to-r from-cyan-50 to-white dark:from-cyan-950/40 dark:to-[#041324]'
                  : 'hover:bg-slate-50 dark:hover:bg-white/5',
                !isLast && !isSelected && 'border-b border-slate-100 dark:border-white/5'
              )}
            >
              <div
                className={clsx(
                  'flex h-12 w-12 shrink-0 items-center justify-center rounded-xl transition-colors',
                  isSelected
                    ? 'bg-cyan-600 text-white dark:bg-cyan-500'
                    : 'bg-slate-100 text-slate-600 group-hover:bg-slate-200 dark:bg-white/5 dark:text-slate-400 dark:group-hover:bg-white/10'
                )}
              >
                <Icon className="h-6 w-6" />
              </div>
              <div className="min-w-0 flex-1">
                <span
                  className={clsx(
                    'block text-base font-semibold transition-colors',
                    isSelected
                      ? 'text-cyan-700 dark:text-cyan-300'
                      : 'text-slate-900 dark:text-slate-100'
                  )}
                >
                  {category.label}
                </span>
                <span
                  className={clsx(
                    'block text-sm transition-colors',
                    isSelected
                      ? 'text-cyan-600/80 dark:text-cyan-400/70'
                      : 'text-slate-500 dark:text-slate-400'
                  )}
                >
                  {category.description}
                </span>
              </div>
              <ChevronRight
                className={clsx(
                  'h-5 w-5 shrink-0 transition-transform',
                  isSelected
                    ? 'rotate-90 text-cyan-600 dark:text-cyan-400'
                    : 'text-slate-400 dark:text-slate-500'
                )}
              />
            </button>

            {/* Expanded Sheet Options */}
            {isSelected && (
              <div
                className={clsx(
                  'border-t border-cyan-100 bg-slate-50/50 dark:border-cyan-900/30 dark:bg-white/[0.02]',
                  !isLast && 'border-b border-b-slate-100 dark:border-b-white/5'
                )}
              >
                {category.sheets.map((sheet) => {
                  const SheetIcon = sheet.icon
                  return (
                    <Link
                      key={sheet.slug}
                      href={buildHref(sheet.slug)}
                      className="group flex items-center gap-4 px-6 py-4 pl-[88px] transition-all hover:bg-white dark:hover:bg-white/5"
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-slate-500 shadow-sm transition-colors group-hover:bg-cyan-50 group-hover:text-cyan-600 dark:bg-white/5 dark:text-slate-400 dark:group-hover:bg-cyan-900/20 dark:group-hover:text-cyan-400">
                        <SheetIcon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="block text-sm font-medium text-slate-900 transition-colors group-hover:text-cyan-700 dark:text-slate-100 dark:group-hover:text-cyan-300">
                          {sheet.label}
                        </span>
                        <span className="block text-xs text-slate-500 dark:text-slate-400">
                          {sheet.description}
                        </span>
                      </div>
                      <ChevronRight className="h-4 w-4 shrink-0 text-slate-300 transition-colors group-hover:text-cyan-500 dark:text-slate-600 dark:group-hover:text-cyan-400" />
                    </Link>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50 dark:bg-[#041324]">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 px-4 py-4 shadow-lg backdrop-blur-xl dark:border-[#0b3a52] dark:bg-[#041324]/95 dark:shadow-[0_26px_55px_rgba(1,12,24,0.55)] sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-cyan-600 shadow-md dark:bg-[#00c2b9] dark:shadow-[0_12px_24px_rgba(0,194,185,0.25)]">
              <span className="text-xl font-bold text-white dark:text-[#002430]">X</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-xs font-bold uppercase tracking-[0.1em] text-cyan-700/70 dark:text-cyan-300/60">
                X-Plan
              </span>
              <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">
                Planning Workbook
              </h1>
            </div>
          </div>
          <ThemeToggle />
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <div className="mb-8">
            <p className="text-slate-600 dark:text-slate-400">
              Select a category to view available planning sheets
            </p>
          </div>

          {/* Category Navigation Table */}
          <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-slate-100 dark:bg-white/5" />}>
            <CategoryNavigation />
          </Suspense>
        </div>
      </main>
    </div>
  )
}

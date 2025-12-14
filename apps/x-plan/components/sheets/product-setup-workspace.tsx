'use client'

import clsx from 'clsx'
import type { ReactNode } from 'react'
import { useMemo } from 'react'
import { Package, Settings, TrendingUp, Wallet, ChevronRight } from 'lucide-react'

import { ProductSetupGrid } from '@/components/sheets/product-setup-grid'
import {
  ProductSetupParametersPanel,
  type ProductSetupParametersPanelProps,
} from '@/components/sheets/product-setup-panels'
import { usePersistentState } from '@/hooks/usePersistentState'

type ParameterList = ProductSetupParametersPanelProps['parameters']

type ProductSetupWorkspaceProps = {
  products: Array<{ id: string; sku: string; name: string }>
  operationsParameters: ParameterList
  salesParameters: ParameterList
  financeParameters: ParameterList
}

type TabKey = 'catalogue' | 'operations' | 'sales' | 'finance'

const TAB_CONFIG: Array<{
  key: TabKey
  label: string
  description: string
  icon: typeof Package
}> = [
  {
    key: 'catalogue',
    label: 'Products',
    description: 'Manage your product catalog',
    icon: Package,
  },
  {
    key: 'operations',
    label: 'Operations',
    description: 'Lead times & logistics',
    icon: Settings,
  },
  {
    key: 'sales',
    label: 'Sales',
    description: 'Inventory thresholds',
    icon: TrendingUp,
  },
  {
    key: 'finance',
    label: 'Finance',
    description: 'Cash flow settings',
    icon: Wallet,
  },
]

export function ProductSetupWorkspace({
  products,
  operationsParameters,
  salesParameters,
  financeParameters,
}: ProductSetupWorkspaceProps) {
  const [activeTab, setActiveTab] = usePersistentState<TabKey | null>('xplan:product-setup:tab', 'catalogue')

  const tabPanels = useMemo(() => {
    return {
      catalogue: (
        <ProductSetupGrid products={products} />
      ),
      operations: (
        <ProductSetupParametersPanel
          title="Operations Defaults"
          description="Set default lead times for your supply chain stages"
          parameterType="ops"
          parameters={operationsParameters}
        />
      ),
      sales: (
        <ProductSetupParametersPanel
          title="Sales Defaults"
          description="Configure inventory warning thresholds"
          parameterType="sales"
          parameters={salesParameters}
        />
      ),
      finance: (
        <ProductSetupParametersPanel
          title="Finance Defaults"
          description="Set up cash flow and payment parameters"
          parameterType="finance"
          parameters={financeParameters}
        />
      ),
    } satisfies Record<TabKey, ReactNode>
  }, [financeParameters, operationsParameters, products, salesParameters])

  const handleTabClick = (key: TabKey) => {
    setActiveTab(activeTab === key ? null : key)
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-[#041324]">
      {TAB_CONFIG.map((tab, index) => {
        const isActive = activeTab === tab.key
        const Icon = tab.icon
        const isLast = index === TAB_CONFIG.length - 1

        return (
          <div key={tab.key}>
            {/* Category Row */}
            <button
              type="button"
              onClick={() => handleTabClick(tab.key)}
              className={clsx(
                'group flex w-full items-center gap-4 px-6 py-5 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-cyan-400',
                isActive
                  ? 'bg-gradient-to-r from-cyan-50 to-white dark:from-cyan-950/40 dark:to-[#041324]'
                  : 'hover:bg-slate-50 dark:hover:bg-white/5',
                !isLast && !isActive && 'border-b border-slate-100 dark:border-white/5'
              )}
            >
              <div
                className={clsx(
                  'flex h-12 w-12 shrink-0 items-center justify-center rounded-xl transition-colors',
                  isActive
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
                    isActive
                      ? 'text-cyan-700 dark:text-cyan-300'
                      : 'text-slate-900 dark:text-slate-100'
                  )}
                >
                  {tab.label}
                </span>
                <span
                  className={clsx(
                    'block text-sm transition-colors',
                    isActive
                      ? 'text-cyan-600/80 dark:text-cyan-400/70'
                      : 'text-slate-500 dark:text-slate-400'
                  )}
                >
                  {tab.description}
                </span>
              </div>
              <ChevronRight
                className={clsx(
                  'h-5 w-5 shrink-0 transition-transform',
                  isActive
                    ? 'rotate-90 text-cyan-600 dark:text-cyan-400'
                    : 'text-slate-400 dark:text-slate-500'
                )}
              />
            </button>

            {/* Expanded Content */}
            {isActive && (
              <div
                className={clsx(
                  'border-t border-cyan-100 bg-slate-50/50 px-6 py-6 dark:border-cyan-900/30 dark:bg-white/[0.02]',
                  !isLast && 'border-b border-b-slate-100 dark:border-b-white/5'
                )}
              >
                {tabPanels[tab.key]}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

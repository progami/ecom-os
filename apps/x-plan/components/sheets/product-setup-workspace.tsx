'use client'

import clsx from 'clsx'
import type { ReactNode } from 'react'
import { useMemo } from 'react'
import { Package, Settings, TrendingUp, Wallet } from 'lucide-react'

import { ProductSetupGrid } from '@/components/sheets/product-setup-grid'
import {
  ProductSetupParametersPanel,
  type ProductSetupParametersPanelProps,
} from '@/components/sheets/product-setup-panels'
import { usePersistentState } from '@/hooks/usePersistentState'

type ParameterList = ProductSetupParametersPanelProps['parameters']

type ProductSetupWorkspaceProps = {
  strategyId: string
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
  strategyId,
  products,
  operationsParameters,
  salesParameters,
  financeParameters,
}: ProductSetupWorkspaceProps) {
  const [activeTab, setActiveTab] = usePersistentState<TabKey>('xplan:product-setup:tab', 'catalogue')

  const tabPanels = useMemo(() => {
    return {
      catalogue: <ProductSetupGrid strategyId={strategyId} products={products} />,
      operations: (
        <ProductSetupParametersPanel
          strategyId={strategyId}
          parameterType="ops"
          parameters={operationsParameters}
        />
      ),
      sales: (
        <ProductSetupParametersPanel
          strategyId={strategyId}
          parameterType="sales"
          parameters={salesParameters}
        />
      ),
      finance: (
        <ProductSetupParametersPanel
          strategyId={strategyId}
          parameterType="finance"
          parameters={financeParameters}
        />
      ),
    } satisfies Record<TabKey, ReactNode>
  }, [strategyId, financeParameters, operationsParameters, products, salesParameters])

  return (
    <div className="flex gap-6">
      {/* Left sidebar - Category navigation */}
      <div className="w-64 shrink-0">
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-white/10 dark:bg-[#041324]">
          {TAB_CONFIG.map((tab, index) => {
            const isActive = activeTab === tab.key
            const Icon = tab.icon
            const isLast = index === TAB_CONFIG.length - 1

            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={clsx(
                  'group flex w-full items-center gap-3 px-4 py-3.5 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-cyan-400',
                  isActive
                    ? 'bg-cyan-50 dark:bg-cyan-950/40'
                    : 'hover:bg-slate-50 dark:hover:bg-white/5',
                  !isLast && 'border-b border-slate-100 dark:border-white/5'
                )}
              >
                <div
                  className={clsx(
                    'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors',
                    isActive
                      ? 'bg-cyan-600 text-white dark:bg-cyan-500'
                      : 'bg-slate-100 text-slate-500 group-hover:bg-slate-200 dark:bg-white/5 dark:text-slate-400 dark:group-hover:bg-white/10'
                  )}
                >
                  <Icon className="h-4.5 w-4.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <span
                    className={clsx(
                      'block text-sm font-medium transition-colors',
                      isActive
                        ? 'text-cyan-700 dark:text-cyan-300'
                        : 'text-slate-700 dark:text-slate-200'
                    )}
                  >
                    {tab.label}
                  </span>
                  <span
                    className={clsx(
                      'block text-xs transition-colors',
                      isActive
                        ? 'text-cyan-600/70 dark:text-cyan-400/60'
                        : 'text-slate-400 dark:text-slate-500'
                    )}
                  >
                    {tab.description}
                  </span>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Right content area */}
      <div className="min-w-0 flex-1">
        {tabPanels[activeTab]}
      </div>
    </div>
  )
}

'use client'

import clsx from 'clsx'
import type { ReactNode } from 'react'
import { useId, useMemo } from 'react'
import { Package, Settings, TrendingUp, Wallet } from 'lucide-react'

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
  const [activeTab, setActiveTab] = usePersistentState<TabKey>('xplan:product-setup:tab', 'catalogue')
  const tablistId = useId()

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

  const activeConfig = TAB_CONFIG.find((tab) => tab.key === activeTab) ?? TAB_CONFIG[0]

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <nav
        role="tablist"
        aria-label="Product setup sections"
        className="grid grid-cols-2 gap-3 sm:grid-cols-4"
      >
        {TAB_CONFIG.map((tab) => {
          const isActive = tab.key === activeTab
          const Icon = tab.icon
          return (
            <button
              key={tab.key}
              id={`${tablistId}-${tab.key}`}
              role="tab"
              type="button"
              aria-selected={isActive}
              aria-controls={`${tablistId}-${tab.key}-panel`}
              onClick={() => setActiveTab(tab.key)}
              className={clsx(
                'group relative flex flex-col items-start gap-2 rounded-xl border p-4 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900',
                isActive
                  ? 'border-cyan-500 bg-gradient-to-br from-cyan-50 to-white shadow-md dark:border-cyan-400/60 dark:from-cyan-950/40 dark:to-[#041324]'
                  : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm dark:border-white/10 dark:bg-[#041324] dark:hover:border-white/20'
              )}
            >
              <div
                className={clsx(
                  'flex h-10 w-10 items-center justify-center rounded-lg transition-colors',
                  isActive
                    ? 'bg-cyan-600 text-white dark:bg-cyan-500'
                    : 'bg-slate-100 text-slate-600 group-hover:bg-slate-200 dark:bg-white/5 dark:text-slate-400 dark:group-hover:bg-white/10'
                )}
              >
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <span
                  className={clsx(
                    'block text-sm font-semibold transition-colors',
                    isActive
                      ? 'text-cyan-700 dark:text-cyan-300'
                      : 'text-slate-900 dark:text-slate-100'
                  )}
                >
                  {tab.label}
                </span>
                <span
                  className={clsx(
                    'block text-xs transition-colors',
                    isActive
                      ? 'text-cyan-600/80 dark:text-cyan-400/70'
                      : 'text-slate-500 dark:text-slate-400'
                  )}
                >
                  {tab.description}
                </span>
              </div>
              {isActive && (
                <div className="absolute -bottom-px left-4 right-4 h-0.5 rounded-full bg-cyan-500 dark:bg-cyan-400" />
              )}
            </button>
          )
        })}
      </nav>

      {/* Tab Content */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-[#041324]">
        {TAB_CONFIG.map((tab) => {
          const isActive = tab.key === activeTab
          return (
            <div
              key={tab.key}
              id={`${tablistId}-${tab.key}-panel`}
              role="tabpanel"
              aria-labelledby={`${tablistId}-${tab.key}`}
              hidden={!isActive}
            >
              {isActive ? tabPanels[tab.key] : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}

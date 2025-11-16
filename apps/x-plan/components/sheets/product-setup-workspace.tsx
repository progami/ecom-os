'use client'

import clsx from 'clsx'
import type { ReactNode } from 'react'
import { useId, useMemo, useState } from 'react'

import { ProductSetupGrid } from '@/components/sheets/product-setup-grid'
import {
  ProductSetupParametersPanel,
  type ProductSetupParametersPanelProps,
} from '@/components/sheets/product-setup-panels'

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
}> = [
  {
    key: 'catalogue',
    label: 'Product',
  },
  {
    key: 'operations',
    label: 'Ops',
  },
  {
    key: 'sales',
    label: 'Sales',
  },
  {
    key: 'finance',
    label: 'Fin',
  },
]

export function ProductSetupWorkspace({
  products,
  operationsParameters,
  salesParameters,
  financeParameters,
}: ProductSetupWorkspaceProps) {
  const [activeTab, setActiveTab] = useState<TabKey>('catalogue')
  const tablistId = useId()

  const tabPanels = useMemo(() => {
    return {
      catalogue: (
        <ProductSetupGrid products={products} />
      ),
      operations: (
        <ProductSetupParametersPanel
          title="Defaults"
          parameters={operationsParameters}
        />
      ),
      sales: (
        <ProductSetupParametersPanel
          title="Defaults"
          parameters={salesParameters}
        />
      ),
      finance: (
        <ProductSetupParametersPanel
          title="Defaults"
          parameters={financeParameters}
        />
      ),
    } satisfies Record<TabKey, ReactNode>
  }, [financeParameters, operationsParameters, products, salesParameters])

  return (
    <section className="space-y-5">
      <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-[#041324]">
        <nav role="tablist" aria-label="Product setup sections" className="flex flex-wrap gap-2">
          {TAB_CONFIG.map((tab) => {
            const isActive = tab.key === activeTab
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
                  'rounded-lg border px-4 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60',
                  isActive
                    ? 'border-cyan-600 bg-cyan-600 text-white dark:border-cyan-400 dark:bg-cyan-400 dark:text-slate-900'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-400 hover:text-slate-900 dark:border-white/15 dark:bg-transparent dark:text-slate-300 dark:hover:border-cyan-400/50 dark:hover:text-cyan-300'
                )}
              >
                {tab.label}
              </button>
            )
          })}
        </nav>

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
    </section>
  )
}

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
  subtitle: string
  description: string
}> = [
  {
    key: 'catalogue',
    label: 'Catalogue',
    subtitle: 'SKU roster',
    description: 'Create, edit, or retire SKUs that power every downstream table.',
  },
  {
    key: 'operations',
    label: 'Operations',
    subtitle: 'Supply defaults',
    description: 'Set sourcing assumptions like production timelines and MOQ.',
  },
  {
    key: 'sales',
    label: 'Sales',
    subtitle: 'Demand guardrails',
    description: 'Tune warning thresholds and forecast fallbacks for planners.',
  },
  {
    key: 'finance',
    label: 'Finance',
    subtitle: 'Cash levers',
    description: 'Manage carrying costs, payment cadences, and target margins.',
  },
]

const panelAccent =
  'rounded-3xl border border-slate-200 dark:border-[#0b3a52] bg-white dark:bg-[#041324] p-6 text-slate-900 dark:text-slate-100 shadow-lg dark:shadow-[0_26px_55px_rgba(1,12,24,0.55)] ring-1 ring-slate-200 dark:ring-[#0f2e45]/60 before:pointer-events-none before:absolute before:inset-0 before:bg-[radial-gradient(circle_at_8%_18%,rgba(0,194,185,0.16),transparent_60%),radial-gradient(circle_at_92%_22%,rgba(0,194,185,0.08),transparent_60%)] before:opacity-90 before:mix-blend-screen before:content-[""] backdrop-blur-xl'

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
        <ProductSetupGrid
          products={products}
          className="!space-y-6"
        />
      ),
      operations: (
        <ProductSetupParametersPanel
          title="Operations parameters"
          description="Supply chain defaults applied to new products, POs, and lead calculations."
          parameters={operationsParameters}
        />
      ),
      sales: (
        <ProductSetupParametersPanel
          title="Sales parameters"
          description="Demand heuristics that shape forecast smoothing and stock warnings."
          parameters={salesParameters}
        />
      ),
      finance: (
        <ProductSetupParametersPanel
          title="Finance parameters"
          description="Cash flow assumptions used to project working capital and profitability."
          parameters={financeParameters}
        />
      ),
    } satisfies Record<TabKey, ReactNode>
  }, [financeParameters, operationsParameters, products, salesParameters])

  return (
    <section className="space-y-6">
      <header className={clsx('relative overflow-hidden', panelAccent)}>
        <div className="relative flex flex-col gap-4">
          <div className="space-y-2">
            <p className="text-sm font-semibold uppercase tracking-[0.4em] text-cyan-700 dark:text-cyan-300/80">Product setup</p>
            <h1 className="text-3xl font-semibold text-slate-900 dark:text-white">Configure your launchpad</h1>
            <p className="max-w-2xl text-sm leading-relaxed text-slate-700 dark:text-slate-200/80">
              Keep every workbook tab aligned by curating catalogue data and business parameters from a single place. Switch between tables without losing context.
            </p>
          </div>
          <div role="tablist" aria-label="Product setup sections" className="flex flex-wrap gap-2">
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
                    'flex min-w-[160px] flex-1 items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60 sm:flex-none',
                    isActive
                      ? 'border-[#00c2b9] bg-cyan-600 text-white shadow-[0_18px_40px_rgba(0,194,185,0.2)] dark:bg-[#00c2b9]/15 dark:text-cyan-100'
                      : 'border-slate-300 bg-white/5 text-slate-700 hover:border-cyan-300/50 hover:text-cyan-900 dark:border-white/12 dark:text-slate-200 dark:hover:text-cyan-100'
                  )}
                >
                  <div className="space-y-0.5">
                    <span className={clsx(
                      'text-xs font-semibold uppercase tracking-[0.3em]',
                      isActive
                        ? 'text-white/90 dark:text-cyan-200'
                        : 'text-cyan-700 dark:text-cyan-300/80'
                    )}>{tab.subtitle}</span>
                    <span className="block text-sm font-medium">{tab.label}</span>
                  </div>
                  <svg
                    className={clsx('h-5 w-5 transition-transform', isActive ? 'text-white dark:text-cyan-100' : 'text-slate-400 dark:text-slate-500')}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              )
            })}
          </div>
        </div>
      </header>
      {TAB_CONFIG.map((tab) => {
        const isActive = tab.key === activeTab
        return (
          <div
            key={tab.key}
            id={`${tablistId}-${tab.key}-panel`}
            role="tabpanel"
            aria-labelledby={`${tablistId}-${tab.key}`}
            hidden={!isActive}
            className="animate-fade-in"
          >
            {isActive ? tabPanels[tab.key] : null}
          </div>
        )
      })}
    </section>
  )
}

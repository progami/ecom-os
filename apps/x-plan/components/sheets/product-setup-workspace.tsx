'use client'

import clsx from 'clsx'
import type { ReactNode } from 'react'
import { Package, Settings, TrendingUp, Wallet } from 'lucide-react'

import { ProductSetupGrid } from '@/components/sheets/product-setup-grid'
import {
  ProductSetupParametersPanel,
  type ProductSetupParametersPanelProps,
} from '@/components/sheets/product-setup-panels'

type ParameterList = ProductSetupParametersPanelProps['parameters']

type ProductSetupWorkspaceProps = {
  strategyId: string
  products: Array<{ id: string; sku: string; name: string }>
  operationsParameters: ParameterList
  salesParameters: ParameterList
  financeParameters: ParameterList
}

interface SectionCardProps {
  icon: typeof Package
  title: string
  description: string
  children: ReactNode
  className?: string
  accentColor?: 'cyan' | 'emerald' | 'violet' | 'amber'
}

function SectionCard({ icon: Icon, title, description, children, className, accentColor = 'cyan' }: SectionCardProps) {
  const accentClasses = {
    cyan: 'bg-cyan-600 dark:bg-cyan-500',
    emerald: 'bg-emerald-600 dark:bg-emerald-500',
    violet: 'bg-violet-600 dark:bg-violet-500',
    amber: 'bg-amber-600 dark:bg-amber-500',
  }

  return (
    <section className={clsx('flex flex-col', className)}>
      <header className="mb-3 flex items-center gap-3">
        <div className={clsx('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white', accentClasses[accentColor])}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">{title}</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">{description}</p>
        </div>
      </header>
      {children}
    </section>
  )
}

export function ProductSetupWorkspace({
  strategyId,
  products,
  operationsParameters,
  salesParameters,
  financeParameters,
}: ProductSetupWorkspaceProps) {
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
      {/* Left column - Products catalog */}
      <SectionCard
        icon={Package}
        title="Products"
        description="Manage your product catalog"
        accentColor="cyan"
      >
        <ProductSetupGrid strategyId={strategyId} products={products} />
      </SectionCard>

      {/* Right column - Configuration panels */}
      <div className="flex flex-col gap-6">
        <SectionCard
          icon={Settings}
          title="Operations"
          description="Lead times & logistics"
          accentColor="emerald"
        >
          <ProductSetupParametersPanel
            strategyId={strategyId}
            parameterType="ops"
            parameters={operationsParameters}
          />
        </SectionCard>

        <SectionCard
          icon={TrendingUp}
          title="Sales"
          description="Inventory thresholds"
          accentColor="violet"
        >
          <ProductSetupParametersPanel
            strategyId={strategyId}
            parameterType="sales"
            parameters={salesParameters}
          />
        </SectionCard>

        <SectionCard
          icon={Wallet}
          title="Finance"
          description="Cash flow settings"
          accentColor="amber"
        >
          <ProductSetupParametersPanel
            strategyId={strategyId}
            parameterType="finance"
            parameters={financeParameters}
          />
        </SectionCard>
      </div>
    </div>
  )
}

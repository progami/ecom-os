'use client'

import { Package, Archive, DollarSign, Calculator } from '@/lib/lucide-icons'
import type { StorageSummary } from '@/hooks/useStorageLedger'

interface StorageCostSummaryProps {
  summary: StorageSummary
}

export function StorageCostSummary({ summary }: StorageCostSummaryProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
      <div className="bg-card overflow-hidden shadow rounded-lg">
        <div className="p-5">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <Package className="h-6 w-6 text-muted-foreground" />
            </div>
            <div className="ml-5 w-0 flex-1">
              <dl>
                <dt className="text-sm font-medium text-muted-foreground truncate">
                  Total Entries
                </dt>
                <dd className="text-lg font-medium text-foreground">
                  {summary.totalEntries.toLocaleString()}
                </dd>
              </dl>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-card overflow-hidden shadow rounded-lg">
        <div className="p-5">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <Archive className="h-6 w-6 text-cyan-400" />
            </div>
            <div className="ml-5 w-0 flex-1">
              <dl>
                <dt className="text-sm font-medium text-muted-foreground truncate">
                  Total Cartons
                </dt>
                <dd className="text-lg font-medium text-foreground">
                  {summary.totalCartons.toLocaleString()}
                </dd>
              </dl>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-card overflow-hidden shadow rounded-lg">
        <div className="p-5">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <DollarSign className="h-6 w-6 text-green-400" />
            </div>
            <div className="ml-5 w-0 flex-1">
              <dl>
                <dt className="text-sm font-medium text-muted-foreground truncate">
                  Total Storage Cost
                </dt>
                <dd className="text-lg font-medium text-foreground">
                  ${summary.totalStorageCost.toLocaleString('en-US', { 
                    minimumFractionDigits: 2, 
                    maximumFractionDigits: 2 
                  })}
                </dd>
              </dl>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-card overflow-hidden shadow rounded-lg">
        <div className="p-5">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <Calculator className="h-6 w-6 text-brand-teal-400" />
            </div>
            <div className="ml-5 w-0 flex-1">
              <dl>
                <dt className="text-sm font-medium text-muted-foreground truncate">
                  Costs Calculated
                </dt>
                <dd className="text-lg font-medium text-foreground">
                  {summary.entriesWithCosts} / {summary.totalEntries}
                  <span className="text-sm text-muted-foreground ml-2">
                    ({summary.costCalculationRate}%)
                  </span>
                </dd>
              </dl>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
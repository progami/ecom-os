'use client'

import { Package, Archive, DollarSign, Calculator } from '@/lib/lucide-icons'
import type { StorageSummary } from '@/hooks/useStorageLedger'

interface StorageCostSummaryProps {
  summary: StorageSummary
}

export function StorageCostSummary({ summary }: StorageCostSummaryProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
      <div className="bg-white overflow-hidden shadow rounded-lg">
        <div className="p-5">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <Package className="h-6 w-6 text-gray-400" />
            </div>
            <div className="ml-5 w-0 flex-1">
              <dl>
                <dt className="text-sm font-medium text-gray-500 truncate">
                  Total Entries
                </dt>
                <dd className="text-lg font-medium text-gray-900">
                  {summary.totalEntries.toLocaleString()}
                </dd>
              </dl>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white overflow-hidden shadow rounded-lg">
        <div className="p-5">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <Archive className="h-6 w-6 text-blue-400" />
            </div>
            <div className="ml-5 w-0 flex-1">
              <dl>
                <dt className="text-sm font-medium text-gray-500 truncate">
                  Total Cartons
                </dt>
                <dd className="text-lg font-medium text-gray-900">
                  {summary.totalCartons.toLocaleString()}
                </dd>
              </dl>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white overflow-hidden shadow rounded-lg">
        <div className="p-5">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <DollarSign className="h-6 w-6 text-green-400" />
            </div>
            <div className="ml-5 w-0 flex-1">
              <dl>
                <dt className="text-sm font-medium text-gray-500 truncate">
                  Total Storage Cost
                </dt>
                <dd className="text-lg font-medium text-gray-900">
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

      <div className="bg-white overflow-hidden shadow rounded-lg">
        <div className="p-5">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <Calculator className="h-6 w-6 text-purple-400" />
            </div>
            <div className="ml-5 w-0 flex-1">
              <dl>
                <dt className="text-sm font-medium text-gray-500 truncate">
                  Costs Calculated
                </dt>
                <dd className="text-lg font-medium text-gray-900">
                  {summary.entriesWithCosts} / {summary.totalEntries}
                  <span className="text-sm text-gray-500 ml-2">
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
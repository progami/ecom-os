'use client'

// React imports
import React, { useState, useEffect, useMemo, useCallback } from 'react'

// Internal utilities
import { formatCurrency } from '@/lib/utils'
import { sumBy } from '@/lib/utils/calculations'

// Icons
import { AlertCircle, Unlock, Calculator, Truck, RefreshCw, DollarSign, Package2 } from '@/lib/lucide-icons'

export interface CostEstimationItem {
  costCategory: string
  costName: string
  quantity: number
  unitRate: number
  totalCost: number
  isOverridden?: boolean
  overriddenRate?: number
}

interface CostsTabProps {
  warehouseId: string
  warehouseCode?: string
  receiveType: string
  totalCartons: number
  totalPallets: number
  totalSkuCount: number
  onCostsChange?: (costs: CostEstimationItem[], totalEstimate: number) => void
}

export interface CostsTabRef {
  getValidatedCosts: () => CostEstimationItem[] | { error: string }
  getTotalEstimate: () => number
}

export const ReceiveCostsTab = React.forwardRef<CostsTabRef, CostsTabProps>(({
  warehouseId,
  warehouseCode,
  receiveType,
  totalCartons,
  totalPallets,
  totalSkuCount,
  onCostsChange
}, ref) => {
  const [costs, setCosts] = useState<CostEstimationItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [freightCost, setFreightCost] = useState<number>(0)
  const [resolvedWarehouseCode, setResolvedWarehouseCode] = useState<string>('')

  // Resolve warehouse code from ID if not provided
  useEffect(() => {
    if (warehouseCode) {
      setResolvedWarehouseCode(warehouseCode)
      return
    }

    if (!warehouseId) {
      setResolvedWarehouseCode('')
      return
    }

    // Fetch warehouse to get code
    fetch(`/api/warehouses/${warehouseId}`)
      .then(res => res.json())
      .then(data => {
        if (data.code) {
          setResolvedWarehouseCode(data.code)
        }
      })
      .catch(() => {
        setResolvedWarehouseCode('')
      })
  }, [warehouseId, warehouseCode])

  // Fetch cost estimation from API
  const fetchCostEstimation = useCallback(async () => {
    if (!resolvedWarehouseCode || !receiveType) {
      setCosts([])
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/cost-estimation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          warehouseCode: resolvedWarehouseCode,
          transactionType: 'RECEIVE',
          receiveType,
          expectedCartons: totalCartons,
          expectedPallets: totalPallets,
          expectedSkuCount: totalSkuCount || 1,
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch cost estimation')
      }

      if (data.success && data.items) {
        setCosts(data.items.map((item: CostEstimationItem) => ({
          ...item,
          isOverridden: false,
        })))
      } else {
        setCosts([])
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch costs')
      setCosts([])
    } finally {
      setLoading(false)
    }
  }, [resolvedWarehouseCode, receiveType, totalCartons, totalPallets, totalSkuCount])

  // Fetch costs when inputs change
  useEffect(() => {
    fetchCostEstimation()
  }, [fetchCostEstimation])

  // Calculate total with freight
  const totalEstimate = useMemo(() => {
    const costTotal = sumBy(costs, 'totalCost')
    return costTotal + freightCost
  }, [costs, freightCost])

  // Notify parent of cost changes
  useEffect(() => {
    if (onCostsChange) {
      const allCosts = [
        ...costs,
        ...(freightCost > 0 ? [{
          costCategory: 'Freight',
          costName: 'Freight Cost',
          quantity: 1,
          unitRate: freightCost,
          totalCost: freightCost,
          isOverridden: false,
        }] : [])
      ]
      onCostsChange(allCosts, totalEstimate)
    }
  }, [costs, freightCost, totalEstimate, onCostsChange])

  // Override a cost rate
  const overrideCostRate = (index: number, newRate: number) => {
    setCosts(prevCosts => {
      const updated = [...prevCosts]
      const item = updated[index]
      updated[index] = {
        ...item,
        isOverridden: true,
        overriddenRate: newRate,
        unitRate: newRate,
        totalCost: Number((newRate * item.quantity).toFixed(2)),
      }
      return updated
    })
  }

  // Reset a cost to default
  const _resetCostRate = (_index: number) => {
    // Refetch to get original rates
    fetchCostEstimation()
  }

  // Toggle override mode for a cost
  const toggleOverride = (index: number) => {
    setCosts(prevCosts => {
      const updated = [...prevCosts]
      const item = updated[index]
      if (item.isOverridden) {
        // Reset - will be handled by refetch
        fetchCostEstimation()
        return prevCosts
      }
      updated[index] = {
        ...item,
        isOverridden: true,
      }
      return updated
    })
  }

  // Expose methods via ref
  const getValidatedCosts = (): CostEstimationItem[] | { error: string } => {
    const allCosts = [
      ...costs,
      ...(freightCost > 0 ? [{
        costCategory: 'Freight',
        costName: 'Freight Cost',
        quantity: 1,
        unitRate: freightCost,
        totalCost: freightCost,
      }] : [])
    ]

    if (allCosts.length === 0) {
      return { error: 'No costs configured for this transaction' }
    }

    return allCosts
  }

  const getTotalEstimate = () => totalEstimate

  React.useImperativeHandle(ref, () => ({
    getValidatedCosts,
    getTotalEstimate
  }))

  // Render states
  if (!warehouseId) {
    return (
      <div className="bg-white rounded-lg border border-slate-200">
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
          <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Cost Estimation
          </h3>
        </div>
        <div className="p-6">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0" />
              <p className="text-sm text-amber-800">
                Please select a warehouse in the Details tab first to see cost estimation.
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!receiveType) {
    return (
      <div className="bg-white rounded-lg border border-slate-200">
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
          <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Cost Estimation
          </h3>
        </div>
        <div className="p-6">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0" />
              <p className="text-sm text-amber-800">
                Please select an Inbound Type in the Details tab to see cost estimation.
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-slate-200">
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
          <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Cost Estimation
          </h3>
        </div>
        <div className="p-6">
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-600"></div>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg border border-slate-200">
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
          <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Cost Estimation
          </h3>
        </div>
        <div className="p-6">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
              <p className="text-sm text-red-800">{error}</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const receiveTypeLabels: Record<string, string> = {
    CONTAINER_20: "20' Container",
    CONTAINER_40: "40' Container",
    CONTAINER_40_HQ: "40' HQ Container",
    CONTAINER_45_HQ: "45' HQ Container",
    LCL: "LCL (Loose Cargo)",
  }

  return (
    <div className="space-y-6">
      {/* Header with inputs summary */}
      <div className="bg-white rounded-lg border border-slate-200">
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Cost Estimation
            </h3>
            <p className="text-sm text-slate-600 mt-1">
              Estimated costs based on warehouse rates for {receiveTypeLabels[receiveType] || receiveType}
            </p>
          </div>
          <button
            onClick={fetchCostEstimation}
            className="flex items-center gap-2 px-3 py-1.5 text-sm text-cyan-600 hover:text-cyan-700 hover:bg-cyan-50 rounded-md transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        </div>

        {/* Input summary */}
        <div className="px-6 py-3 bg-slate-50 border-b border-slate-200">
          <div className="flex items-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <Package2 className="h-4 w-4 text-slate-400" />
              <span className="text-slate-600">Cartons:</span>
              <span className="font-medium text-slate-900">{totalCartons}</span>
            </div>
            <div className="flex items-center gap-2">
              <Truck className="h-4 w-4 text-slate-400" />
              <span className="text-slate-600">Pallets:</span>
              <span className="font-medium text-slate-900">{totalPallets}</span>
            </div>
            <div className="flex items-center gap-2">
              <Calculator className="h-4 w-4 text-slate-400" />
              <span className="text-slate-600">SKUs:</span>
              <span className="font-medium text-slate-900">{totalSkuCount || 1}</span>
            </div>
          </div>
        </div>

        <div className="p-6">
          {costs.length === 0 ? (
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-center">
              <p className="text-sm text-slate-600">
                No cost rates configured for this warehouse and inbound type.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Cost line items */}
              <table className="w-full">
                <thead>
                  <tr className="text-left text-xs font-medium text-slate-500 uppercase tracking-wide">
                    <th className="pb-3 pr-4">Cost Item</th>
                    <th className="pb-3 pr-4 text-right">Rate</th>
                    <th className="pb-3 pr-4 text-center">Qty</th>
                    <th className="pb-3 pr-4 text-right">Total</th>
                    <th className="pb-3 w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {costs.map((cost, index) => (
                    <tr key={`${cost.costName}-${index}`} className="group">
                      <td className="py-3 pr-4">
                        <div>
                          <p className="text-sm font-medium text-slate-900">{cost.costName}</p>
                          <p className="text-xs text-slate-500">{cost.costCategory}</p>
                        </div>
                      </td>
                      <td className="py-3 pr-4 text-right">
                        {cost.isOverridden ? (
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={cost.unitRate}
                            onChange={(e) => overrideCostRate(index, parseFloat(e.target.value) || 0)}
                            className="w-24 px-2 py-1 text-right text-sm border border-cyan-300 rounded focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                          />
                        ) : (
                          <span className="text-sm text-slate-700">{formatCurrency(cost.unitRate)}</span>
                        )}
                      </td>
                      <td className="py-3 pr-4 text-center">
                        <span className="text-sm text-slate-600">{cost.quantity}</span>
                      </td>
                      <td className="py-3 pr-4 text-right">
                        <span className="text-sm font-medium text-slate-900">{formatCurrency(cost.totalCost)}</span>
                      </td>
                      <td className="py-3">
                        <button
                          type="button"
                          onClick={() => toggleOverride(index)}
                          className="p-1 text-slate-400 hover:text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity"
                          title={cost.isOverridden ? 'Reset to default' : 'Override rate'}
                        >
                          {cost.isOverridden ? <RefreshCw className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
                        </button>
                      </td>
                    </tr>
                  ))}

                  {/* Freight cost input */}
                  <tr className="border-t-2 border-slate-200">
                    <td className="py-3 pr-4">
                      <div>
                        <p className="text-sm font-medium text-slate-900">Freight Cost</p>
                        <p className="text-xs text-slate-500">Shipping / Transportation</p>
                      </div>
                    </td>
                    <td className="py-3 pr-4 text-right" colSpan={2}>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={freightCost || ''}
                        onChange={(e) => setFreightCost(parseFloat(e.target.value) || 0)}
                        placeholder="0.00"
                        className="w-32 px-3 py-1.5 text-right text-sm border border-slate-300 rounded-md focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                      />
                    </td>
                    <td className="py-3 pr-4 text-right">
                      <span className="text-sm font-medium text-slate-900">{formatCurrency(freightCost)}</span>
                    </td>
                    <td className="py-3"></td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Summary Bar */}
      <div className="bg-white rounded-xl border-2 border-slate-300 shadow-sm">
        <div className="px-6 py-4 grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
          <div className="flex items-center gap-3">
            <Truck className="h-5 w-5 text-blue-600 flex-shrink-0" />
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wide">Warehouse Costs</p>
              <p className="text-lg font-bold text-slate-900">{formatCurrency(sumBy(costs, 'totalCost'))}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Package2 className="h-5 w-5 text-purple-600 flex-shrink-0" />
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wide">Freight</p>
              <p className="text-lg font-bold text-slate-900">{formatCurrency(freightCost)}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 bg-gradient-to-br from-cyan-500 to-cyan-600 rounded-lg px-4 py-3 text-white">
            <div className="flex-1">
              <p className="text-xs uppercase tracking-wide opacity-90">Total Estimated Cost</p>
              <p className="text-2xl font-bold">{formatCurrency(totalEstimate)}</p>
            </div>
            {totalCartons > 0 && (
              <div className="border-l border-cyan-400/30 pl-4">
                <p className="text-xs opacity-90">Per Carton</p>
                <p className="text-xl font-bold">{formatCurrency(totalEstimate / totalCartons)}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
})

ReceiveCostsTab.displayName = 'ReceiveCostsTab'

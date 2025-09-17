'use client'

// React imports
import React, { useState, useEffect, useMemo } from 'react'

// Internal utilities
import { formatCurrency } from '@/lib/utils'
import { sumBy, calculateUnitCost } from '@/lib/utils/calculations'

// Types/interfaces
import type { CostRate } from '@/types/cost-types'

// Icons
import { AlertCircle, Lock, Unlock, Calculator, Truck } from '@/lib/lucide-icons'

export interface CostEntry {
  id: string
  costType: 'container' | 'carton' | 'pallet'
  costName: string
  quantity: number
  unitRate: number
  totalCost: number
  isManual: boolean
  isLocked: boolean
  description?: string
}

interface CostsTabProps {
  warehouseId: string
  totalCartons: number
  totalPallets: number
}

export interface CostsTabRef {
  getValidatedCosts: () => CostEntry[] | { error: string }
}

export const ReceiveCostsTab = React.forwardRef<CostsTabRef, CostsTabProps>(({ 
  warehouseId, 
  totalCartons, 
  totalPallets
}, ref) => {
  const [costs, setCosts] = useState<CostEntry[]>([])
  const [costRates, setCostRates] = useState<CostRate[]>([])
  const [loading, setLoading] = useState(true)
  const [isInitialized, setIsInitialized] = useState(false)

  // Fetch cost rates only when warehouse changes
  useEffect(() => {
    if (!warehouseId) {
      setLoading(false)
      setCostRates([])
      setCosts([])
      return
    }
    
    setLoading(true)
    setIsInitialized(false)

    fetch(`/api/warehouses/${warehouseId}/cost-rates`)
      .then(res => res.json())
      .then(data => {
        // Check if we got an error response
        if (data.error) {
          // console.error('Cost rates API error:', data.error)
          setCostRates([])
        } else {
          const rates = data.costRates || []
          setCostRates(rates)
        }
        setLoading(false)
      })
      .catch(_err => {
        // console.error('Failed to fetch cost data:', err)
        setCostRates([])
        setLoading(false)
      })
  }, [warehouseId])

  // Initialize costs when rates are loaded or quantities change
  useEffect(() => {
    if (!loading && costRates.length > 0 && !isInitialized) {
      const initialCosts = initializeCosts(costRates)
      setCosts(initialCosts)
      setIsInitialized(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, costRates, totalCartons, totalPallets, isInitialized])

  // Update handling costs when quantities change
  useEffect(() => {
    if (isInitialized && costs.length > 0) {
      setCosts(prevCosts => {
        return prevCosts.map(cost => {
          if ((cost.costType === 'carton' || cost.costType === 'pallet') && cost.isLocked) {
            // Find the original rate to determine unit of measure
            const rate = costRates.find(r => r.id === cost.id)
            if (rate) {
              let quantity = 1
              if (rate.unitOfMeasure?.toLowerCase().includes('carton')) {
                quantity = totalCartons
              } else if (rate.unitOfMeasure?.toLowerCase().includes('pallet')) {
                quantity = totalPallets
              }
              return {
                ...cost,
                quantity,
                totalCost: quantity * cost.unitRate
              }
            }
          }
          return cost
        })
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalCartons, totalPallets, isInitialized, costRates])

  // Expose method to get validated costs
  const getValidatedCosts = (): CostEntry[] | { error: string } => {
    // Filter out costs with zero or empty values (allow deletion from UI)
    const nonZeroCosts = costs.filter(cost => cost.totalCost > 0)
    
    // Validate that at least one cost remains after filtering
    if (nonZeroCosts.length === 0) {
      return { error: 'At least one cost entry with a value is required' }
    }

    // Validate manual costs have proper values
    const invalidCosts = nonZeroCosts.filter(cost => 
      cost.isManual && (cost.unitRate <= 0 || cost.quantity <= 0)
    )
    if (invalidCosts.length > 0) {
      return { error: 'Please ensure all costs have valid quantities and rates' }
    }

    // Validate container costs - REQUIRED for receive transactions
    const containerCosts = nonZeroCosts.filter(cost => 
      cost.costType === 'container'
    )
    
    if (containerCosts.length === 0) {
      return { error: 'At least one container cost is required for receive transactions.' }
    }

    return nonZeroCosts
  }

  // Expose this method via a ref
  React.useImperativeHandle(ref, () => ({
    getValidatedCosts
  }))

  const initializeCosts = (rates: CostRate[]) => {
    const initialCosts: CostEntry[] = []

    // Initialize container costs from rates (manual entry)
    const containerRates = rates.filter(rate => 
      rate.costCategory === 'container'
    )

    containerRates.forEach(rate => {
      initialCosts.push({
        id: rate.id,
        costType: 'container',
        costName: rate.costName,
        quantity: 1,
        unitRate: Number(rate.costValue || 0),
        totalCost: Number(rate.costValue || 0),
        isManual: true,
        isLocked: false
      })
    })

    // Initialize handling costs from rates (Carton and Pallet categories)
    const handlingRates = rates.filter(rate => 
      ['carton', 'pallet'].includes(rate.costCategory)
    )

    handlingRates.forEach(rate => {
      // Determine quantity based on unit of measure
      let quantity = 1
      if (rate.unitOfMeasure?.toLowerCase().includes('carton')) {
        quantity = totalCartons
      } else if (rate.unitOfMeasure?.toLowerCase().includes('pallet')) {
        quantity = totalPallets
      }
      
      const costType = rate.costCategory === 'carton' ? 'carton' : 'pallet'
      
      initialCosts.push({
        id: rate.id,
        costType: costType as 'carton' | 'pallet',
        costName: rate.costName,
        quantity: quantity,
        unitRate: Number(rate.costValue || 0),
        totalCost: quantity * Number(rate.costValue || 0),
        isManual: false,
        isLocked: true
      })
    })

    setCosts(initialCosts)
    return initialCosts
  }

  const updateCost = (id: string, field: keyof CostEntry, value: string | number | boolean | null) => {
    setCosts(prevCosts => {
      const newCosts = prevCosts.map(cost => {
        if (cost.id === id) {
          const updatedCost = { ...cost, [field]: value }
          
          // Recalculate total if quantity or rate changes
          if (field === 'quantity' || field === 'unitRate') {
            updatedCost.totalCost = updatedCost.quantity * updatedCost.unitRate
          }
          
          return updatedCost
        }
        return cost
      })
      
      return newCosts
    })
  }

  const toggleLock = (id: string) => {
    updateCost(id, 'isLocked', !costs.find(c => c.id === id)?.isLocked)
  }

  // Calculate totals
  const totals = useMemo(() => {
    const containerCosts = costs.filter(c => c.costType === 'container')
    const cartonCosts = costs.filter(c => c.costType === 'carton')
    const palletCosts = costs.filter(c => c.costType === 'pallet')
    
    const containerTotal = sumBy(containerCosts, 'totalCost')
    const cartonTotal = sumBy(cartonCosts, 'totalCost')
    const palletTotal = sumBy(palletCosts, 'totalCost')
    const handlingTotal = cartonTotal + palletTotal
    const grandTotal = containerTotal + handlingTotal
    const costPerCarton = calculateUnitCost(grandTotal, totalCartons)

    return {
      container: containerTotal,
      carton: cartonTotal,
      pallet: palletTotal,
      handling: handlingTotal,
      total: grandTotal,
      perCarton: costPerCarton
    }
  }, [costs, totalCartons])

  if (!warehouseId) {
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-lg border">
          <div className="px-6 py-4 border-b bg-gray-50">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Truck className="h-5 w-5" />
              Container Costs
            </h3>
          </div>
          <div className="p-6">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-amber-600" />
                <p className="text-sm text-amber-800">
                  Please select a warehouse in the Details tab first to configure receiving costs.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  // Check if we have any costs configured
  if (!loading && costs.length === 0) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-6">
        <div className="flex items-center gap-3">
          <AlertCircle className="h-6 w-6 text-amber-600 flex-shrink-0" />
          <div>
            <p className="text-amber-800 font-medium">No cost rates configured for this warehouse</p>
            <p className="text-amber-700 text-sm mt-1">
              Please contact your administrator to set up receiving and handling cost rates for this warehouse.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Container Costs Section */}
      <div className="bg-white rounded-lg border">
        <div className="px-6 py-4 border-b bg-gray-50">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Truck className="h-5 w-5" />
            Container Costs
          </h3>
          <p className="text-sm text-gray-600 mt-1">
            Enter actual container and freight costs
          </p>
        </div>
        
        <div className="p-6 space-y-4">
          {costs.filter(c => c.costType === 'container').map(cost => (
            <div key={cost.id} className="grid grid-cols-4 gap-4 items-center">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {cost.costName}
                </label>
                {cost.id === 'other' && (
                  <input
                    type="text"
                    placeholder="Specify..."
                    value={cost.description || ''}
                    onChange={(e) => updateCost(cost.id, 'description', e.target.value)}
                    className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-primary"
                  />
                )}
              </div>
              
              <div>
                <input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={cost.unitRate || ''}
                  onChange={(e) => updateCost(cost.id, 'unitRate', parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary"
                />
              </div>
              
              <div className="text-center">
                <span className="text-gray-500">×</span>
                <span className="ml-2 font-medium">{cost.quantity}</span>
              </div>
              
              <div className="text-right font-medium">
                {formatCurrency(cost.totalCost)}
              </div>
            </div>
          ))}
          
          <div className="pt-4 border-t">
            <div className="flex justify-between items-center text-lg font-semibold">
              <span>Container Total:</span>
              <span>{formatCurrency(totals.container)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Handling Costs Section */}
      <div className="bg-white rounded-lg border">
        <div className="px-6 py-4 border-b bg-gray-50">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Handling Costs
            <span className="text-sm font-normal text-gray-600">
              (Auto-calculated from rates)
            </span>
          </h3>
        </div>
        
        <div className="p-6 space-y-4">
          {costs.filter(c => c.costType === 'carton' || c.costType === 'pallet').map(cost => (
            <div key={cost.id} className="grid grid-cols-5 gap-4 items-center">
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {cost.costName}
                </label>
              </div>
              
              <div className="text-center">
                <span className="text-sm text-gray-600">{cost.quantity} × {formatCurrency(cost.unitRate)}</span>
              </div>
              
              <div className="text-right font-medium">
                {formatCurrency(cost.totalCost)}
              </div>
              
              <div className="text-center">
                <button
                  type="button"
                  onClick={() => toggleLock(cost.id)}
                  className="p-1 text-gray-400 hover:text-gray-600"
                  title={cost.isLocked ? 'Unlock to edit' : 'Lock to prevent edits'}
                >
                  {cost.isLocked ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
                </button>
              </div>
            </div>
          ))}
          
          <div className="pt-4 border-t">
            <div className="flex justify-between items-center text-lg font-semibold">
              <span>Handling Total:</span>
              <span>{formatCurrency(totals.handling)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Summary Section */}
      <div className="bg-blue-50 rounded-lg border border-blue-200 p-6">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-blue-700">Total Transaction Costs</p>
            <p className="text-2xl font-bold text-blue-900">{formatCurrency(totals.total)}</p>
          </div>
          <div>
            <p className="text-sm text-blue-700">Cost per Carton</p>
            <p className="text-2xl font-bold text-blue-900">{formatCurrency(totals.perCarton)}</p>
          </div>
        </div>
        
        {totalCartons === 0 && (
          <div className="mt-4 flex items-center gap-2 text-amber-600">
            <AlertCircle className="h-5 w-5" />
            <p className="text-sm">Add line items to calculate cost per carton</p>
          </div>
        )}
      </div>
    </div>
  )
})

ReceiveCostsTab.displayName = 'ReceiveCostsTab'

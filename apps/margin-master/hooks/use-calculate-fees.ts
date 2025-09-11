import { useMutation } from '@tanstack/react-query'

export interface CalculationRequest {
  name: string
  category: string
  subcategory?: string
  marketplace: string
  program: string
  salePrice: number
  productCost: number
  shippingCost: number
  length: number // cm
  width: number  // cm
  height: number // cm
  weight: number // grams
  isApparel?: boolean
  includeStorageFees?: boolean
  storageDuration?: number
  includeSippDiscount?: boolean
  includeLowInventoryFee?: boolean
  daysOfSupply?: number
}

export interface CalculationResponse {
  product: {
    name: string
    category: string
    subcategory?: string
    marketplace: string
    program: string
    dimensions: string
    weight: string
    isOversized: boolean
  }
  fees: {
    fulfillment: {
      amount: number
      sizeTier: string
      weightBand: string
      details?: any
    }
    referral: {
      amount: number
      percentage: number
      minimumFee?: number
      category: string
      subcategory?: string
    }
    storage?: {
      monthlyAmount: number
      totalAmount: number
      duration: number
      periodType: string
      isOversized: boolean
    }
    total: {
      amount: number
      percentageOfPrice: number
    }
  }
  costs: {
    product: number
    shipping: number
    amazonFees: number
    total: number
  }
  profitability: {
    salePrice: number
    netProfit: number
    profitMargin: number
    roi: number
    breakEven: boolean
  }
  currency: string
  calculated: string
}

export const useCalculateFees = () => {
  return useMutation<CalculationResponse, Error, CalculationRequest>({
    mutationFn: async (request: CalculationRequest) => {
      const response = await fetch('/api/calculate-fees', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      })
      
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.details || error.message || 'Failed to calculate fees')
      }
      
      return response.json()
    },
  })
}
// Cost-related type definitions

export interface CostRate {
 id: string
 warehouseId: string
 warehouse: { name: string; code: string }
 costCategory: string
 costName: string
 costValue: number
 unitOfMeasure: string
 effectiveDate: string
 endDate?: string
}

export interface CostEntry {
 id: string
 costType: 'container' | 'carton' | 'pallet'
 costName?: string
 quantity: number
 unitRate: number
 totalCost: number
 isLocked?: boolean
}

export interface CalculatedCost {
 costCategory: string
 quantity: number
 unitRate: number
 totalCost: number
 unitOfMeasure: string
}

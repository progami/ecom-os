export interface MaterialProfile {
  id: string
  name: string
  countryOfOrigin?: string | null
  costPerUnit: number
  costUnit: 'area' | 'weight' | 'volume' | 'piece'
  densityGCm3: number
  isActive: boolean
  notes?: string | null
  createdAt: Date
  updatedAt: Date
}

export interface SourcingProfile {
  id: string
  name: string
  countryOfOrigin?: string | null
  tariffRatePercent: number
  freightAssumptionCost?: number | null
  freightUnit?: string | null
  costBufferPercent: number
  createdAt: Date
  updatedAt: Date
}

export interface SimulationComponent {
  type: 'PRODUCT' | 'PACKAGING'
  materialId?: string
  materialProfileId?: string
  lengthCm?: number
  widthCm?: number
  heightCm?: number
  quantity?: number
  addedThicknessMm?: number
  addedWeightG?: number
}

export interface SimulationInput {
  marketplace: string
  targetSalePrice: number
  estimatedAcosPercent: number
  refundProvisionPercent: number
  sourcingProfileId: string
  components: SimulationComponent[]
}

export interface CalculatedValues {
  finalLengthIn: number
  finalWidthIn: number
  finalHeightIn: number
  finalWeightLb: number
}

export interface FeeAnalysis {
  sizeTier: string
  fbaFulfillmentFee: number
  referralFee: number
  estimatedStorageFee: number
  totalFees: number
}

export interface Profitability {
  landedCostPerUnit: number
  netMarginUsd: number
  netMarginPercent: number
  roiPercent: number
}

export interface SimulationResult {
  inputs: SimulationInput
  calculatedValues: CalculatedValues
  feeAnalysis: FeeAnalysis
  profitability: Profitability
}

// Amazon Fee Types
export interface FulfillmentFee {
  id: string
  sizeTier: string
  minLength: number
  maxLength: number
  minWidth: number
  maxWidth: number
  minHeight: number
  maxHeight: number
  minWeight: number
  maxWeight: number
  fee: number
  peakFee?: number
  effectiveDate: Date
}

export interface StorageFee {
  id: string
  month: string
  standardSize: number
  oversizeSize: number
  effectiveDate: Date
}

export interface ReferralFee {
  id: string
  category: string
  percentage: number
  minimumFee?: number
  effectiveDate: Date
}

export interface OptionalService {
  id: string
  serviceName: string
  description: string
  fee: number
  unit: string
  effectiveDate: Date
}

export interface Surcharge {
  id: string
  name: string
  description: string
  fee: number
  percentage?: number
  unit?: string
  applicableCategories?: string[]
  effectiveDate: Date
}

// Amazon Fees API DTOs
export interface CountryDTO {
  id: string
  code: string
  name: string
  region: string | null
  currency: string
  isActive: boolean
  programs: ProgramSummaryDTO[]
}

export interface ProgramSummaryDTO {
  id: string
  code: string
  name: string
  description: string | null
}

export interface ProgramDTO {
  id: string
  code: string
  name: string
  displayName: string
  description: string | null
  isActive: boolean
  availableCountries: CountrySummaryDTO[]
  feeTypes: string[]
}

export interface CountrySummaryDTO {
  id: string
  code: string
  name: string
  currency: string
}

export interface FulfilmentFeeDTO {
  id: string
  country: string
  countryCode: string
  currency: string
  program: string
  programCode: string
  programDisplayName?: string
  sizeTier: string
  sizeTierCode: string
  dimensions: {
    maxLength: number | null
    maxWidth: number | null
    maxHeight: number | null
    maxDimensions: number | null
  }
  weight: {
    min: number
    max: number | null
    unit: string
  }
  fees: {
    baseFee: number
    perUnitFee: number | null
    perUnitWeight: number | null
  }
  effectiveDate: string
  endDate: string | null
  isApparel: boolean
}

export interface StorageFeeDTO {
  id: string
  country: string
  countryCode: string
  currency: string
  program: string
  programCode: string
  period: {
    type: string
    monthStart: number | null
    monthEnd: number | null
    label: string
  }
  fees: {
    standardSize: number
    oversize: number
    unit: string
  }
  effectiveDate: string
  endDate: string | null
}

export interface ReferralFeeDTO {
  id: string
  country: string
  countryCode: string
  currency: string
  program: string
  programCode: string
  category: string
  subcategory: string | null
  fees: {
    percentage: number
    minimum: number | null
    perItemMinimum: number | null
  }
  effectiveDate: string
  endDate: string | null
}

export interface FeeBreakdown {
  name: string
  amount: number
  currency: string
  details?: Record<string, any>
}

export interface CalculateFeesRequest {
  product: {
    name?: string
    category: string
    dimensions: {
      length: number
      width: number
      height: number
    }
    weight: number
    price: number
    cost?: number
    isApparel?: boolean
  }
  marketplace: {
    countryCode: string
    programCode?: string
  }
  options?: {
    includeStorageFees?: boolean
    storageDuration?: number
    utilizationRatio?: number
    includeOptionalServices?: string[]
    includeSurcharges?: boolean
    returnRate?: number
  }
}

export interface CalculateFeesResponse {
  request: CalculateFeesRequest
  marketplace: {
    country: string
    currency: string
    program: string
  }
  product: {
    sizeTier: string
    weightBand: string
    category: string
    isOversized: boolean
  }
  fees: {
    fulfilment: FeeBreakdown
    referral: FeeBreakdown
    storage?: FeeBreakdown
    optionalServices?: FeeBreakdown[]
    surcharges?: FeeBreakdown[]
    total: {
      amount: number
      currency: string
      percentageOfPrice: number
    }
  }
  profitability?: {
    grossRevenue: number
    totalFees: number
    netRevenue: number
    productCost?: number
    netProfit?: number
    profitMargin?: number
    roi?: number
  }
  warnings?: string[]
}
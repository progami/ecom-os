import { ProductInput } from './types'

export interface ProductCostSummary {
  id: string
  name: string
  sku: string
  sellingPrice: number
  manufacturingCost: number
  freightCost: number
  tariffRate: number
  tacosPercent: number
  fbaFee: number
  amazonReferralRate: number
  storagePerMonth: number
  tariffCost: number
  advertisingCost: number
  landedUnitCost: number
  grossContribution: number
  grossMarginPercent: number
}

function toNumber(value: number | null | undefined): number {
  if (value == null || Number.isNaN(value)) return 0
  return Number(value)
}

export function computeProductCostSummary(product: ProductInput): ProductCostSummary {
  const sellingPrice = toNumber(product.sellingPrice)
  const manufacturingCost = toNumber(product.manufacturingCost)
  const freightCost = toNumber(product.freightCost)
  const tariffRate = toNumber(product.tariffRate)
  const tacosPercent = toNumber(product.tacosPercent)
  const fbaFee = toNumber(product.fbaFee)
  const amazonReferralRate = toNumber(product.amazonReferralRate)
  const storagePerMonth = toNumber(product.storagePerMonth)

  const tariffCost = sellingPrice * tariffRate
  const advertisingCost = sellingPrice * tacosPercent
  const landedUnitCost = manufacturingCost + freightCost + tariffCost + fbaFee + storagePerMonth
  const grossContribution = sellingPrice - landedUnitCost - advertisingCost
  const grossMarginPercent = sellingPrice === 0 ? 0 : grossContribution / sellingPrice

  return {
    id: product.id,
    name: product.name,
    sku: product.sku,
    sellingPrice,
    manufacturingCost,
    freightCost,
    tariffRate,
    tacosPercent,
    fbaFee,
    amazonReferralRate,
    storagePerMonth,
    tariffCost,
    advertisingCost,
    landedUnitCost,
    grossContribution,
    grossMarginPercent,
  }
}

export function buildProductCostIndex(products: ProductInput[]): Map<string, ProductCostSummary> {
  return new Map(products.map((product) => [product.id, computeProductCostSummary(product)]))
}

import type { TenantCode } from '@/lib/tenant/constants'

type AmazonMoney = {
  Amount?: unknown
  CurrencyCode?: unknown
}

export type AmazonProductFeesParseResult = {
  currencyCode: string | null
  totalFees: number | null
  fbaFees: number | null
  referralFee: number | null
  sizeTier: string | null
  feeBreakdown: Array<{ feeType: string; amount: number | null; currencyCode: string | null }>
}

export function getMarketplaceCurrencyCode(tenantCode?: TenantCode): string {
  if (tenantCode === 'UK') return 'GBP'
  return 'USD'
}

/**
 * Calculate Amazon FBA size tier from dimensions and weight.
 * Based on Amazon US product size tier definitions (starting Jan 15, 2026).
 * Dimensions in cm, weight in kg.
 */
export function calculateSizeTier(
  side1Cm: number | null,
  side2Cm: number | null,
  side3Cm: number | null,
  weightKg: number | null
): string | null {
  if (side1Cm === null || side2Cm === null || side3Cm === null || weightKg === null) return null

  const dimsIn = [side1Cm, side2Cm, side3Cm].map(d => d / 2.54).sort((a, b) => b - a)
  const longestIn = dimsIn[0]
  const medianIn = dimsIn[1]
  const shortestIn = dimsIn[2]
  const unitWeightLb = weightKg * 2.20462

  const girthIn = 2 * (medianIn + shortestIn)
  const lengthPlusGirthIn = longestIn + girthIn

  // Small standard-size: unit weight ≤ 16 oz, and ≤ 15" x 12" x 0.75"
  if (unitWeightLb <= 1 && longestIn <= 15 && medianIn <= 12 && shortestIn <= 0.75) {
    return 'Small Standard-Size'
  }

  // Large standard-size: not small standard-size, chargeable weight ≤ 20 lb, and ≤ 18" x 14" x 8"
  const dimensionalWeightStandardLb = (longestIn * medianIn * shortestIn) / 139
  const chargeableStandardLb = Math.max(unitWeightLb, dimensionalWeightStandardLb)
  if (chargeableStandardLb <= 20 && longestIn <= 18 && medianIn <= 14 && shortestIn <= 8) {
    return 'Large Standard-Size'
  }

  // Small/Large Bulky and Extra-Large use chargeable weight (max of unit and dimensional weight).
  // Dimensional weight assumes minimum width and height of 2" for these tiers.
  const bulkyMedianIn = Math.max(medianIn, 2)
  const bulkyShortestIn = Math.max(shortestIn, 2)
  const dimensionalWeightBulkyLb = (longestIn * bulkyMedianIn * bulkyShortestIn) / 139
  const chargeableBulkyLb = Math.max(unitWeightLb, dimensionalWeightBulkyLb)

  // Small Bulky: not standard-size, chargeable ≤ 50 lb, ≤ 37" x 28" x 20", and length+girth ≤ 130"
  if (
    chargeableBulkyLb <= 50 &&
    longestIn <= 37 &&
    medianIn <= 28 &&
    shortestIn <= 20 &&
    lengthPlusGirthIn <= 130
  ) {
    return 'Small Bulky'
  }

  // Large Bulky: not standard-size/small bulky, chargeable ≤ 50 lb, ≤ 59" x 33" x 33", and length+girth ≤ 130"
  if (
    chargeableBulkyLb <= 50 &&
    longestIn <= 59 &&
    medianIn <= 33 &&
    shortestIn <= 33 &&
    lengthPlusGirthIn <= 130
  ) {
    return 'Large Bulky'
  }

  // Extra-Large: everything else, split by chargeable weight.
  if (chargeableBulkyLb > 150) {
    return 'Extra-Large 150+ lb'
  }

  let isOvermax = false
  if (longestIn > 96) isOvermax = true
  if (lengthPlusGirthIn > 130) isOvermax = true
  if (isOvermax) return 'Overmax 0 to 150 lb'

  if (chargeableBulkyLb <= 50) {
    return 'Extra-Large 0 to 50 lb'
  }
  if (chargeableBulkyLb <= 70) {
    return 'Extra-Large 50+ to 70 lb'
  }

  return 'Extra-Large 70+ to 150 lb'
}

function coerceNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return null
    const parsed = Number(trimmed)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function coerceString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function parseMoney(value: unknown): { amount: number | null; currencyCode: string | null } {
  if (!value || typeof value !== 'object') return { amount: null, currencyCode: null }
  const candidate = value as AmazonMoney
  return {
    amount: coerceNumber(candidate.Amount),
    currencyCode: coerceString(candidate.CurrencyCode),
  }
}

function resolveFeesEstimateRoot(response: unknown): Record<string, unknown> | null {
  if (!response || typeof response !== 'object') return null
  const root = response as Record<string, unknown>
  const payload = typeof root.payload === 'object' && root.payload !== null ? (root.payload as Record<string, unknown>) : null
  return payload ?? root
}

export function parseAmazonProductFees(response: unknown): AmazonProductFeesParseResult {
  const root = resolveFeesEstimateRoot(response)
  const estimateResult =
    root && typeof root.FeesEstimateResult === 'object' && root.FeesEstimateResult !== null
      ? (root.FeesEstimateResult as Record<string, unknown>)
      : null

  const estimate =
    estimateResult && typeof estimateResult.FeesEstimate === 'object' && estimateResult.FeesEstimate !== null
      ? (estimateResult.FeesEstimate as Record<string, unknown>)
      : root && typeof root.FeesEstimate === 'object' && root.FeesEstimate !== null
        ? (root.FeesEstimate as Record<string, unknown>)
        : null

  const totalFeesMoney =
    estimate && typeof estimate.TotalFeesEstimate === 'object' && estimate.TotalFeesEstimate !== null
      ? parseMoney(estimate.TotalFeesEstimate)
      : { amount: null, currencyCode: null }

  const feeDetailListValue = estimate ? (estimate['FeeDetailList'] as unknown) : null
  const feeDetailListRaw = Array.isArray(feeDetailListValue) ? feeDetailListValue : []

  const feeBreakdown = feeDetailListRaw
    .map(detail => {
      if (!detail || typeof detail !== 'object') return null
      const record = detail as Record<string, unknown>
      const feeType = coerceString(record.FeeType) ?? 'Unknown'
      const finalFeeRecord =
        typeof record.FinalFee === 'object' && record.FinalFee !== null
          ? (record.FinalFee as Record<string, unknown>)
          : null
      const money = record.FeeAmount ?? record.FinalFee ?? finalFeeRecord?.['FeeAmount'] ?? null
      const parsed = parseMoney(money)
      return { feeType, amount: parsed.amount, currencyCode: parsed.currencyCode }
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row))

  const fbaExact = feeBreakdown.find(row => row.feeType.toUpperCase() === 'FBAFEES')
  const fbaCandidates = feeBreakdown.filter(row => row.feeType.toUpperCase().includes('FBA'))
  const fbaFees = fbaExact?.amount ?? (fbaCandidates.length ? fbaCandidates.map(row => row.amount ?? 0).reduce((a, b) => a + b, 0) : null)
  const currencyCode = fbaExact?.currencyCode ?? fbaCandidates.find(row => row.currencyCode)?.currencyCode ?? totalFeesMoney.currencyCode

  // Extract referral fee
  const referralFeeRow = feeBreakdown.find(row => {
    const normalized = row.feeType.toUpperCase().replace(/[^A-Z]/g, '')
    return normalized === 'REFERRALFEE'
  })
  const referralFee = referralFeeRow?.amount ?? null

  // Extract size tier from FBA fee types (e.g., "FBAPickAndPackFee-Standard-Size" or "FBAFulfillmentFee")
  // Amazon returns size tier info in the FeesEstimateIdentifier or in the fee breakdown
  let sizeTier: string | null = null

  // Check FeesEstimateIdentifier for size tier
  const feesIdentifier =
    estimateResult && typeof estimateResult.FeesEstimateIdentifier === 'object' && estimateResult.FeesEstimateIdentifier !== null
      ? (estimateResult.FeesEstimateIdentifier as Record<string, unknown>)
      : null
  if (feesIdentifier) {
    const program = coerceString(feesIdentifier.OptionalFulfillmentProgram)
    if (program) sizeTier = program
  }

  // Try to infer size tier from FBA fee type names if not found
  if (!sizeTier) {
    for (const row of feeBreakdown) {
      const upperType = row.feeType.toUpperCase()
      if (upperType.includes('SMALL') && upperType.includes('LIGHT')) {
        sizeTier = 'Small and Light'
        break
      }
      if (upperType.includes('STANDARD')) {
        sizeTier = 'Standard-Size'
        break
      }
      if (upperType.includes('OVERSIZE') || upperType.includes('OVER-SIZE')) {
        if (upperType.includes('SMALL')) sizeTier = 'Small Oversize'
        else if (upperType.includes('MEDIUM')) sizeTier = 'Medium Oversize'
        else if (upperType.includes('LARGE')) sizeTier = 'Large Oversize'
        else if (upperType.includes('SPECIAL')) sizeTier = 'Special Oversize'
        else sizeTier = 'Oversize'
        break
      }
    }
  }

  return {
    currencyCode,
    totalFees: totalFeesMoney.amount,
    fbaFees,
    referralFee,
    sizeTier,
    feeBreakdown,
  }
}

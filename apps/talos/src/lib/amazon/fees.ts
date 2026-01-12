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
 * Based on Amazon US FBA size tier thresholds (2024).
 * Dimensions in cm, weight in kg.
 */
export function calculateSizeTier(
  lengthCm: number | null,
  widthCm: number | null,
  heightCm: number | null,
  weightKg: number | null
): string | null {
  if (lengthCm === null || widthCm === null || heightCm === null) return null

  // Convert to inches for Amazon's thresholds
  const dims = [lengthCm, widthCm, heightCm].map(d => d / 2.54).sort((a, b) => b - a)
  const longest = dims[0]
  const median = dims[1]
  const shortest = dims[2]
  const weightLb = weightKg !== null ? weightKg * 2.20462 : 0

  // Girth = 2 * (median + shortest)
  const girth = 2 * (median + shortest)
  const lengthPlusGirth = longest + girth

  // Small Standard-Size: max 15" x 12" x 0.75", ≤ 1 lb
  if (longest <= 15 && median <= 12 && shortest <= 0.75 && weightLb <= 1) {
    return 'Small Standard-Size'
  }

  // Large Standard-Size: max 18" x 14" x 8", ≤ 20 lb
  if (longest <= 18 && median <= 14 && shortest <= 8 && weightLb <= 20) {
    return 'Large Standard-Size'
  }

  // Small Oversize: max 60" x 30", length + girth ≤ 130", ≤ 70 lb
  if (longest <= 60 && median <= 30 && lengthPlusGirth <= 130 && weightLb <= 70) {
    return 'Small Oversize'
  }

  // Medium Oversize: max 108" longest, length + girth ≤ 130", ≤ 150 lb
  if (longest <= 108 && lengthPlusGirth <= 130 && weightLb <= 150) {
    return 'Medium Oversize'
  }

  // Large Oversize: max 108" longest, length + girth ≤ 165", ≤ 150 lb
  if (longest <= 108 && lengthPlusGirth <= 165 && weightLb <= 150) {
    return 'Large Oversize'
  }

  // Special Oversize: anything larger
  return 'Special Oversize'
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

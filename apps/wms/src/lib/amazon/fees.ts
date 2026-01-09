import type { TenantCode } from '@/lib/tenant/constants'

type AmazonMoney = {
  Amount?: unknown
  CurrencyCode?: unknown
}

export type AmazonProductFeesParseResult = {
  currencyCode: string | null
  totalFees: number | null
  fbaFees: number | null
  feeBreakdown: Array<{ feeType: string; amount: number | null; currencyCode: string | null }>
}

export function getMarketplaceCurrencyCode(tenantCode?: TenantCode): string {
  if (tenantCode === 'UK') return 'GBP'
  return 'USD'
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

  return {
    currencyCode,
    totalFees: totalFeesMoney.amount,
    fbaFees,
    feeBreakdown,
  }
}

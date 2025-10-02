import { parseNumber, parsePercent } from '@/lib/utils/numbers'
import { BusinessParameterInput, BusinessParameterMap } from './types'

const DEFAULT_BUSINESS_PARAMETERS: BusinessParameterMap = {
  startingCash: 0,
  amazonPayoutDelayWeeks: 2,
  weeklyFixedCosts: 0,
  supplierPaymentTermsWeeks: 0,
  supplierPaymentSplit: [0.5, 0.3, 0.2],
  stockWarningWeeks: 4,
}

type MutableBusinessParameters = {
  -readonly [K in keyof BusinessParameterMap]: BusinessParameterMap[K]
}

export function normalizeBusinessParameters(
  rows: BusinessParameterInput[]
): BusinessParameterMap {
  const normalized: MutableBusinessParameters = { ...DEFAULT_BUSINESS_PARAMETERS }
  const splits: number[] = [...normalized.supplierPaymentSplit]

  for (const row of rows) {
    const label = row.label.trim().toLowerCase()
    const numeric = parseNumber(row.valueNumeric ?? row.valueText)

    switch (label) {
      case 'starting cash': {
        normalized.startingCash = numeric ?? normalized.startingCash
        break
      }
      case 'amazon payout delay (weeks)': {
        normalized.amazonPayoutDelayWeeks = numeric ?? normalized.amazonPayoutDelayWeeks
        break
      }
      case 'weekly fixed costs': {
        normalized.weeklyFixedCosts = numeric ?? normalized.weeklyFixedCosts
        break
      }
      case 'supplier payment terms (weeks)': {
        normalized.supplierPaymentTermsWeeks = numeric ?? normalized.supplierPaymentTermsWeeks
        break
      }
      case 'supplier payment split 1 (%)': {
        if (numeric != null) splits[0] = parsePercent(numeric) ?? splits[0]
        break
      }
      case 'supplier payment split 2 (%)': {
        if (numeric != null) splits[1] = parsePercent(numeric) ?? splits[1]
        break
      }
      case 'supplier payment split 3 (%)': {
        if (numeric != null) splits[2] = parsePercent(numeric) ?? splits[2]
        break
      }
      case 'weeks of stock warning threshold': {
        normalized.stockWarningWeeks = numeric ?? normalized.stockWarningWeeks
        break
      }
      default:
        break
    }
  }

  const splitTotal = splits.reduce((sum, value) => {
    const numeric = Number.isFinite(value) ? value : 0
    return sum + numeric
  }, 0)
  normalized.supplierPaymentSplit = splitTotal > 0 ? (splits as [number, number, number]) : normalized.supplierPaymentSplit

  return normalized
}

export { DEFAULT_BUSINESS_PARAMETERS }

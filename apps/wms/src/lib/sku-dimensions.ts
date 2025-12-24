export type DimensionTriplet = {
  lengthCm: number
  widthCm: number
  heightCm: number
}

function stripTrailingZeros(value: string): string {
  return value.includes('.') ? value.replace(/\.?0+$/, '') : value
}

function formatNumber(value: number, decimals: number): string {
  return stripTrailingZeros(value.toFixed(decimals))
}

export function parseDimensionTriplet(value: string | null | undefined): DimensionTriplet | null {
  if (!value) return null
  const normalized = value.replace(/[×]/g, 'x')
  const matches = normalized.match(/(\d+(?:\.\d+)?)/g)
  if (!matches || matches.length < 3) return null

  const parsed = matches.slice(0, 3).map(match => Number(match))
  if (parsed.some(num => !Number.isFinite(num) || num <= 0)) return null

  const [lengthCm, widthCm, heightCm] = parsed
  return { lengthCm, widthCm, heightCm }
}

export function formatDimensionTripletCm(value: DimensionTriplet, decimals: number = 2): string {
  return `${formatNumber(value.lengthCm, decimals)}x${formatNumber(value.widthCm, decimals)}x${formatNumber(
    value.heightCm,
    decimals
  )}`
}

export function coerceFiniteNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null
  }
  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  const fallback = Number((value as { toString?: () => string })?.toString?.() ?? NaN)
  return Number.isFinite(fallback) ? fallback : null
}

export function resolveDimensionTripletCm(options: {
  lengthCm?: unknown
  widthCm?: unknown
  heightCm?: unknown
  legacy?: string | null | undefined
}): DimensionTriplet | null {
  const lengthCm = coerceFiniteNumber(options.lengthCm)
  const widthCm = coerceFiniteNumber(options.widthCm)
  const heightCm = coerceFiniteNumber(options.heightCm)

  const anyNumeric = [lengthCm, widthCm, heightCm].some(value => value !== null)
  if (anyNumeric) {
    if (lengthCm === null || widthCm === null || heightCm === null) {
      return null
    }
    if (lengthCm <= 0 || widthCm <= 0 || heightCm <= 0) {
      return null
    }
    return { lengthCm, widthCm, heightCm }
  }

  return parseDimensionTriplet(options.legacy)
}

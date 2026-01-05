// Simplified review period types for small team (15-20 people)
export const REVIEW_PERIOD_TYPES = [
  'Q1', 'Q2', 'Q3', 'Q4', 'ANNUAL', 'PROBATION',
] as const

export type ReviewPeriodType = (typeof REVIEW_PERIOD_TYPES)[number]

export const REVIEW_PERIOD_TYPE_LABELS: Record<ReviewPeriodType, string> = {
  Q1: 'Q1 (Jan–Mar)',
  Q2: 'Q2 (Apr–Jun)',
  Q3: 'Q3 (Jul–Sep)',
  Q4: 'Q4 (Oct–Dec)',
  ANNUAL: 'Annual',
  PROBATION: 'Probation',
}

export const REVIEW_PERIOD_TYPES_BY_REVIEW_TYPE: Record<string, readonly ReviewPeriodType[]> = {
  PROBATION: ['PROBATION'],
  QUARTERLY: ['Q1', 'Q2', 'Q3', 'Q4'],
  ANNUAL: ['ANNUAL'],
}

export function getAllowedReviewPeriodTypes(reviewType: string): ReviewPeriodType[] {
  const allowed = REVIEW_PERIOD_TYPES_BY_REVIEW_TYPE[reviewType]
  return allowed ? [...allowed] : [...REVIEW_PERIOD_TYPES]
}

export function formatReviewPeriod(periodType: ReviewPeriodType, periodYear: number): string {
  const year = String(periodYear)
  switch (periodType) {
    case 'ANNUAL':
      return `Annual ${year}`
    case 'PROBATION':
      return `Probation ${year}`
    default:
      return `${periodType} ${year}`
  }
}

export function inferReviewPeriodParts(reviewPeriod: string): {
  periodType: ReviewPeriodType | null
  periodYear: number | null
} {
  const cleaned = reviewPeriod.trim()
  if (!cleaned) return { periodType: null, periodYear: null }

  const q = cleaned.match(/^Q\s*([1-4])\s*[-/ ]\s*(\d{4})$/i) ?? cleaned.match(/^Q([1-4])\s+(\d{4})$/i)
  if (q) return { periodType: `Q${q[1]}` as ReviewPeriodType, periodYear: Number(q[2]) }

  const annual = cleaned.match(/^(annual|year|fy)\s*[-/ ]\s*(\d{4})$/i) ?? cleaned.match(/^(annual|year|fy)\s+(\d{4})$/i)
  if (annual) return { periodType: 'ANNUAL', periodYear: Number(annual[2]) }

  const probation = cleaned.match(/^probation\s*[-/ ]\s*(\d{4})$/i) ?? cleaned.match(/^probation\s+(\d{4})$/i)
  if (probation) return { periodType: 'PROBATION', periodYear: Number(probation[1]) }

  const yearOnly = cleaned.match(/^(\d{4})$/)
  if (yearOnly) return { periodType: 'ANNUAL', periodYear: Number(yearOnly[1]) }

  return { periodType: null, periodYear: null }
}

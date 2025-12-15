/**
 * Standing Calculation Library
 *
 * Implements the "Traffic Light" standing system:
 * - GREEN: Role Model - No violations, review > 3.5, Honesty/Integrity > 3
 * - YELLOW: Misaligned/Coaching - Minor violation or review 2.5-3.5
 * - RED: Cultural Mismatch - Honesty/Integrity violation or review < 2.5
 */

import { prisma } from './prisma'

export type Standing = 'GREEN' | 'YELLOW' | 'RED'

export type StandingResult = {
  standing: Standing
  reason: string
  blocksPromotion: boolean
  suggestedAction?: 'TRAINING' | 'PIP' | 'TERMINATION_REVIEW'
}

export type ReviewWeights = {
  precision: number    // Attention to Detail
  transparency: number // Honesty
  reliability: number  // Integrity
  initiative: number   // Courage
}

// Default weights from the values system
const DEFAULT_WEIGHTS: ReviewWeights = {
  precision: 0.40,    // 40%
  transparency: 0.20, // 20%
  reliability: 0.20,  // 20%
  initiative: 0.20,   // 20%
}

// New hire weights (< 90 days) - disable Courage and Integrity
const NEW_HIRE_WEIGHTS: ReviewWeights = {
  precision: 0.80,    // 80%
  transparency: 0.20, // 20%
  reliability: 0,     // 0% - disabled
  initiative: 0,      // 0% - disabled
}

/**
 * Get review weights based on employee tenure
 */
export async function getReviewWeights(employeeId: string): Promise<ReviewWeights> {
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { joinDate: true }
  })

  if (!employee) return DEFAULT_WEIGHTS

  const daysSinceJoin = Math.floor(
    (Date.now() - new Date(employee.joinDate).getTime()) / (1000 * 60 * 60 * 24)
  )

  // New hire calibration: < 90 days
  if (daysSinceJoin < 90) {
    return NEW_HIRE_WEIGHTS
  }

  return DEFAULT_WEIGHTS
}

/**
 * Calculate weighted values score from a review
 */
export function calculateValuesScore(
  ratings: {
    ratingPrecision?: number | null
    ratingTransparency?: number | null
    ratingReliability?: number | null
    ratingInitiative?: number | null
  },
  weights: ReviewWeights
): number | null {
  const { ratingPrecision, ratingTransparency, ratingReliability, ratingInitiative } = ratings

  // If no values ratings, return null
  if (!ratingPrecision && !ratingTransparency && !ratingReliability && !ratingInitiative) {
    return null
  }

  let totalWeight = 0
  let weightedSum = 0

  if (ratingPrecision && weights.precision > 0) {
    weightedSum += ratingPrecision * weights.precision
    totalWeight += weights.precision
  }

  if (ratingTransparency && weights.transparency > 0) {
    weightedSum += ratingTransparency * weights.transparency
    totalWeight += weights.transparency
  }

  if (ratingReliability && weights.reliability > 0) {
    weightedSum += ratingReliability * weights.reliability
    totalWeight += weights.reliability
  }

  if (ratingInitiative && weights.initiative > 0) {
    weightedSum += ratingInitiative * weights.initiative
    totalWeight += weights.initiative
  }

  if (totalWeight === 0) return null

  return weightedSum / totalWeight
}

/**
 * Apply the "Values Veto" - cap score at 2.9 if Honesty or Integrity < 3
 * This is the "Competent Jerk Filter"
 */
export function applyValuesVeto(
  rawScore: number,
  ratingTransparency?: number | null, // Honesty
  ratingReliability?: number | null   // Integrity
): { score: number; vetoApplied: boolean; reason?: string } {
  const honestyLow = ratingTransparency !== null && ratingTransparency !== undefined && ratingTransparency < 3
  const integrityLow = ratingReliability !== null && ratingReliability !== undefined && ratingReliability < 3

  if (honestyLow || integrityLow) {
    const reasons: string[] = []
    if (honestyLow) reasons.push('Honesty/Communication')
    if (integrityLow) reasons.push('Integrity/Reliability')

    return {
      score: Math.min(rawScore, 2.9),
      vetoApplied: true,
      reason: 'Score capped due to low scores in Core Values: ' + reasons.join(', ')
    }
  }

  return { score: rawScore, vetoApplied: false }
}

/**
 * Calculate employee standing based on reviews and violations
 */
export async function calculateStanding(employeeId: string): Promise<StandingResult> {
  // Get latest completed performance review
  const latestReview = await prisma.performanceReview.findFirst({
    where: {
      employeeId,
      status: { in: ['COMPLETED', 'ACKNOWLEDGED'] }
    },
    orderBy: { reviewDate: 'desc' },
    select: {
      valuesScore: true,
      valuesVetoApplied: true,
      ratingTransparency: true,
      ratingReliability: true,
      overallRating: true,
    }
  })

  // Get active violations (not CLOSED or DISMISSED)
  const activeViolations = await prisma.disciplinaryAction.findMany({
    where: {
      employeeId,
      status: { notIn: ['CLOSED', 'DISMISSED'] }
    },
    select: {
      severity: true,
      primaryValueBreached: true,
    }
  })

  // Check for Honesty/Integrity violations (RED condition A)
  const hasHonestyIntegrityViolation = activeViolations.some(
    v => v.primaryValueBreached === 'BREACH_OF_HONESTY' || v.primaryValueBreached === 'BREACH_OF_INTEGRITY'
  )

  if (hasHonestyIntegrityViolation) {
    return {
      standing: 'RED',
      reason: 'Active violation for Honesty or Integrity',
      blocksPromotion: true,
      suggestedAction: 'TERMINATION_REVIEW'
    }
  }

  // Check if Values Veto was applied (RED condition B)
  if (latestReview?.valuesVetoApplied) {
    return {
      standing: 'RED',
      reason: 'Values Veto applied due to low Honesty/Integrity scores',
      blocksPromotion: true,
      suggestedAction: 'PIP'
    }
  }

  // Get the score to use (prefer valuesScore, fallback to overallRating)
  const score = latestReview?.valuesScore ?? latestReview?.overallRating ?? null

  // Check score-based conditions
  if (score !== null && score < 2.5) {
    // RED condition C
    return {
      standing: 'RED',
      reason: 'Review score below 2.5',
      blocksPromotion: true,
      suggestedAction: 'PIP'
    }
  }

  // Check for YELLOW conditions
  const hasMinorModerateViolation = activeViolations.some(
    v => v.severity === 'MINOR' || v.severity === 'MODERATE'
  )

  if (hasMinorModerateViolation) {
    // YELLOW condition A - Skill Gap
    const violationForDetail = activeViolations.some(v => v.primaryValueBreached === 'BREACH_OF_DETAIL')
    return {
      standing: 'YELLOW',
      reason: violationForDetail
        ? 'Active violation for Attention to Detail (training recommended)'
        : 'Active minor/moderate violation',
      blocksPromotion: false,
      suggestedAction: 'TRAINING'
    }
  }

  if (score !== null && score >= 2.5 && score <= 3.5) {
    // YELLOW condition B - Growth Gap
    return {
      standing: 'YELLOW',
      reason: 'Review score between 2.5 and 3.5 (coaching recommended)',
      blocksPromotion: false,
      suggestedAction: 'TRAINING'
    }
  }

  // Check for GREEN conditions
  if (activeViolations.length === 0 && score !== null && score > 3.5) {
    // Additional check: Honesty and Integrity must be > 3
    const honestyOk = !latestReview?.ratingTransparency || latestReview.ratingTransparency >= 3
    const integrityOk = !latestReview?.ratingReliability || latestReview.ratingReliability >= 3

    if (honestyOk && integrityOk) {
      return {
        standing: 'GREEN',
        reason: 'Role Model - No violations and strong performance',
        blocksPromotion: false
      }
    }
  }

  // Default to GREEN if no reviews yet and no violations
  if (activeViolations.length === 0) {
    return {
      standing: 'GREEN',
      reason: 'No violations (awaiting performance review)',
      blocksPromotion: false
    }
  }

  // Fallback to YELLOW for edge cases
  return {
    standing: 'YELLOW',
    reason: 'Pending review or minor issues',
    blocksPromotion: false
  }
}

/**
 * Calculate standing and return result
 */
export async function updateAndNotifyStanding(employeeId: string): Promise<StandingResult> {
  return calculateStanding(employeeId)
}

/**
 * Map violation type to suggested severity based on value breached
 * Honesty/Integrity breaches carry 2x "standing damage"
 */
export function suggestSeverityFromValueBreach(
  valueBreach: 'BREACH_OF_DETAIL' | 'BREACH_OF_HONESTY' | 'BREACH_OF_INTEGRITY' | 'BREACH_OF_COURAGE'
): 'MINOR' | 'MODERATE' | 'MAJOR' | 'CRITICAL' {
  switch (valueBreach) {
    case 'BREACH_OF_DETAIL':
      return 'MINOR' // Training issue
    case 'BREACH_OF_COURAGE':
      return 'MODERATE' // Coaching issue
    case 'BREACH_OF_HONESTY':
      return 'MAJOR' // Character issue
    case 'BREACH_OF_INTEGRITY':
      return 'CRITICAL' // Zero tolerance
    default:
      return 'MODERATE'
  }
}

/**
 * Get all employees with RED standing (for dashboard widget)
 */
export async function getRedStandingEmployees(): Promise<{
  id: string
  firstName: string
  lastName: string
  reason: string
}[]> {
  const employees = await prisma.employee.findMany({
    where: { status: 'ACTIVE' },
    select: { id: true, firstName: true, lastName: true }
  })

  const redEmployees: { id: string; firstName: string; lastName: string; reason: string }[] = []

  for (const emp of employees) {
    const standing = await calculateStanding(emp.id)
    if (standing.standing === 'RED') {
      redEmployees.push({
        id: emp.id,
        firstName: emp.firstName,
        lastName: emp.lastName,
        reason: standing.reason
      })
    }
  }

  return redEmployees
}

/**
 * Calculate cultural health metric (% in GREEN standing)
 */
export async function calculateCulturalHealth(): Promise<{
  greenPercentage: number
  yellowPercentage: number
  redPercentage: number
  totalEmployees: number
  redAlerts: { id: string; firstName: string; lastName: string; reason: string }[]
}> {
  const employees = await prisma.employee.findMany({
    where: { status: 'ACTIVE' },
    select: { id: true, firstName: true, lastName: true }
  })

  let green = 0
  let yellow = 0
  let red = 0
  const redAlerts: { id: string; firstName: string; lastName: string; reason: string }[] = []

  for (const emp of employees) {
    const standing = await calculateStanding(emp.id)
    switch (standing.standing) {
      case 'GREEN':
        green++
        break
      case 'YELLOW':
        yellow++
        break
      case 'RED':
        red++
        redAlerts.push({
          id: emp.id,
          firstName: emp.firstName,
          lastName: emp.lastName,
          reason: standing.reason
        })
        break
    }
  }

  const total = employees.length
  return {
    greenPercentage: total > 0 ? Math.round((green / total) * 100) : 0,
    yellowPercentage: total > 0 ? Math.round((yellow / total) * 100) : 0,
    redPercentage: total > 0 ? Math.round((red / total) * 100) : 0,
    totalEmployees: total,
    redAlerts
  }
}

import prisma from '@/lib/prisma'
import { ReviewPeriodType } from '@ecom-os/prisma-hrms'
import { getHREmployees } from './permissions'

// Quarter end dates (month is 0-indexed)
const QUARTER_END_DATES: Record<number, { month: number; day: number }> = {
  1: { month: 2, day: 31 },  // March 31
  2: { month: 5, day: 30 },  // June 30
  3: { month: 8, day: 30 },  // September 30
  4: { month: 11, day: 31 }, // December 31
}

// Map quarter number to ReviewPeriodType enum
const QUARTER_TO_PERIOD_TYPE: Record<number, ReviewPeriodType> = {
  1: 'Q1',
  2: 'Q2',
  3: 'Q3',
  4: 'Q4',
}

// Configuration
const DEADLINE_DAYS = 14           // 2 weeks to complete reviews
const REMINDER_SCHEDULE = [7, 3, 1] // Days before deadline to send reminders

/**
 * Get current quarter info from a date
 */
export function getCurrentQuarter(date: Date = new Date()): { year: number; quarter: number } {
  const month = date.getMonth()
  const year = date.getFullYear()
  const quarter = Math.floor(month / 3) + 1
  return { year, quarter }
}

/**
 * Get the end date for a specific quarter
 */
export function getQuarterEndDate(year: number, quarter: number): Date {
  const { month, day } = QUARTER_END_DATES[quarter]
  return new Date(year, month, day, 23, 59, 59)
}

/**
 * Get review period string (e.g., "Q4 2025")
 */
export function getReviewPeriod(year: number, quarter: number): string {
  return `Q${quarter} ${year}`
}

/**
 * Get the previous quarter info
 */
function getPreviousQuarter(year: number, quarter: number): { year: number; quarter: number } {
  if (quarter === 1) {
    return { year: year - 1, quarter: 4 }
  }
  return { year, quarter: quarter - 1 }
}

/**
 * Check if quarterly reviews need to be created and create them
 * Called on startup and periodically
 */
export async function checkAndCreateQuarterlyReviews(): Promise<{
  cycleCreated: boolean
  reviewsCreated: number
  errors: string[]
}> {
  const result = { cycleCreated: false, reviewsCreated: 0, errors: [] as string[] }

  const now = new Date()
  const { year: currentYear, quarter: currentQuarter } = getCurrentQuarter(now)

  // We create reviews for the PREVIOUS quarter (since we're reviewing completed work)
  const { year: prevYear, quarter: prevQuarter } = getPreviousQuarter(currentYear, currentQuarter)
  const quarterEndDate = getQuarterEndDate(prevYear, prevQuarter)

  // Only proceed if we're past the quarter end
  if (now < quarterEndDate) {
    return result
  }

  // Check if cycle already exists
  const existingCycle = await prisma.quarterlyReviewCycle.findUnique({
    where: {
      year_quarter: { year: prevYear, quarter: prevQuarter }
    }
  })

  if (existingCycle) {
    return result  // Already created for this quarter
  }

  // Create the cycle
  const deadline = new Date(quarterEndDate)
  deadline.setDate(deadline.getDate() + DEADLINE_DAYS)

  const cycle = await prisma.quarterlyReviewCycle.create({
    data: {
      year: prevYear,
      quarter: prevQuarter,
      reviewPeriod: getReviewPeriod(prevYear, prevQuarter),
      quarterEndDate,
      deadline,
      status: 'ACTIVE',
    }
  })
  result.cycleCreated = true
  console.log(`[Quarterly Reviews] Created cycle ${cycle.reviewPeriod}`)

  // Get all active employees
  const employees = await prisma.employee.findMany({
    where: { status: 'ACTIVE' },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      reportsToId: true,
      manager: {
        select: { id: true, firstName: true, lastName: true, email: true }
      }
    }
  })

  // Create draft reviews for each employee (skip those with no manager - top of hierarchy)
  for (const employee of employees) {
    // Skip employees without a manager (super admin / top of hierarchy)
    if (!employee.manager) {
      console.log(`[Quarterly Reviews] Skipping ${employee.firstName} ${employee.lastName} - no manager (top of hierarchy)`)
      continue
    }

    try {
      const reviewerName = `${employee.manager.firstName} ${employee.manager.lastName}`

      // Create review in NOT_STARTED state - manager must actively start it
      await prisma.performanceReview.create({
        data: {
          employeeId: employee.id,
          reviewType: 'QUARTERLY',
          // Structured period data
          periodType: QUARTER_TO_PERIOD_TYPE[prevQuarter],
          periodYear: prevYear,
          // Legacy string for backward compatibility
          reviewPeriod: cycle.reviewPeriod,
          reviewDate: quarterEndDate,
          reviewerName,
          assignedReviewerId: employee.manager.id,
          // No ratings set - manager fills these when they start
          overallRating: 0,
          status: 'NOT_STARTED',
          quarterlyCycleId: cycle.id,
          deadline: cycle.deadline,
        }
      })
      result.reviewsCreated++

      // Notify manager about new review
      if (employee.manager) {
        await prisma.notification.create({
          data: {
            type: 'QUARTERLY_REVIEW_CREATED',
            title: `Quarterly Review: ${employee.firstName} ${employee.lastName}`,
            message: `Please complete the ${cycle.reviewPeriod} quarterly review for ${employee.firstName} ${employee.lastName}. Deadline: ${cycle.deadline.toLocaleDateString()}.`,
            link: `/performance/reviews`,
            employeeId: employee.manager.id,
            relatedType: 'QUARTERLY_CYCLE',
            relatedId: cycle.id,
          }
        })
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Unknown error'
      result.errors.push(`Failed to create review for ${employee.firstName} ${employee.lastName}: ${message}`)
    }
  }

  // Update cycle stats
  await prisma.quarterlyReviewCycle.update({
    where: { id: cycle.id },
    data: { totalReviews: result.reviewsCreated }
  })

  console.log(`[Quarterly Reviews] Created ${result.reviewsCreated} draft reviews for ${cycle.reviewPeriod}`)

  // Notify HR about new cycle
  const hrEmployees = await getHREmployees()
  for (const hr of hrEmployees) {
    await prisma.notification.create({
      data: {
        type: 'QUARTERLY_REVIEW_CREATED',
        title: `${cycle.reviewPeriod} Quarterly Reviews Started`,
        message: `${result.reviewsCreated} quarterly reviews have been created. Deadline: ${cycle.deadline.toLocaleDateString()}.`,
        link: `/performance/reviews`,
        employeeId: hr.id,
        relatedType: 'QUARTERLY_CYCLE',
        relatedId: cycle.id,
      }
    })
  }

  return result
}

/**
 * Process reminders and escalations for pending reviews
 */
export async function processRemindersAndEscalations(): Promise<{
  remindersSent: number
  escalations: number
}> {
  const result = { remindersSent: 0, escalations: 0 }
  const now = new Date()

  // Get active cycles
  const activeCycles = await prisma.quarterlyReviewCycle.findMany({
    where: { status: 'ACTIVE' }
  })

  for (const cycle of activeCycles) {
    // Get pending reviews (NOT_STARTED or IN_PROGRESS) for this cycle
    const pendingReviews = await prisma.performanceReview.findMany({
      where: {
        quarterlyCycleId: cycle.id,
        status: { in: ['NOT_STARTED', 'IN_PROGRESS'] },
      },
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            reportsToId: true,
            manager: {
              select: { id: true, firstName: true, lastName: true, email: true }
            }
          }
        }
      }
    })

    for (const review of pendingReviews) {
      const daysUntilDeadline = Math.ceil(
        (cycle.deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      )

      // Check for escalation (past deadline)
      if (daysUntilDeadline < 0 && !review.escalatedToHR) {
        await escalateToHR(review, cycle)
        result.escalations++
        continue
      }

      // Check for reminders
      if (REMINDER_SCHEDULE.includes(daysUntilDeadline)) {
        // Don't send more than once per day
        const shouldSendReminder = !review.lastReminderAt ||
          now.getTime() - review.lastReminderAt.getTime() > 24 * 60 * 60 * 1000

        if (shouldSendReminder && review.employee.manager) {
          await sendReviewReminder(review, cycle, daysUntilDeadline)
          result.remindersSent++
        }
      }
    }

    // Check if cycle is complete (all reviews done)
    const pendingCount = await prisma.performanceReview.count({
      where: {
        quarterlyCycleId: cycle.id,
        status: { in: ['NOT_STARTED', 'IN_PROGRESS'] },
      }
    })

    if (pendingCount === 0 && cycle.status === 'ACTIVE') {
      await prisma.quarterlyReviewCycle.update({
        where: { id: cycle.id },
        data: { status: 'COMPLETED' }
      })
      console.log(`[Quarterly Reviews] Cycle ${cycle.reviewPeriod} completed`)
    }
  }

  return result
}

/**
 * Send reminder to manager about pending review
 */
async function sendReviewReminder(
  review: {
    id: string
    remindersSent: number
    employee: {
      id: string
      firstName: string
      lastName: string
      manager: { id: string; firstName: string; lastName: string } | null
    }
  },
  cycle: { reviewPeriod: string; deadline: Date },
  daysRemaining: number
): Promise<void> {
  if (!review.employee.manager) return

  await prisma.performanceReview.update({
    where: { id: review.id },
    data: {
      remindersSent: review.remindersSent + 1,
      lastReminderAt: new Date(),
    }
  })

  await prisma.notification.create({
    data: {
      type: 'QUARTERLY_REVIEW_REMINDER',
      title: `Review Due in ${daysRemaining} Day${daysRemaining !== 1 ? 's' : ''}`,
      message: `Please complete the ${cycle.reviewPeriod} quarterly review for ${review.employee.firstName} ${review.employee.lastName}. Deadline: ${cycle.deadline.toLocaleDateString()}.`,
      link: `/performance/reviews`,
      employeeId: review.employee.manager.id,
      relatedId: review.id,
      relatedType: 'REVIEW',
    }
  })

  console.log(`[Quarterly Reviews] Sent reminder for ${review.employee.firstName} ${review.employee.lastName} to ${review.employee.manager.firstName} ${review.employee.manager.lastName}`)
}

/**
 * Escalate overdue review to HR
 */
async function escalateToHR(
  review: {
    id: string
    reviewerName: string
    employee: {
      id: string
      firstName: string
      lastName: string
      manager: { id: string; firstName: string; lastName: string; email: string } | null
    }
  },
  cycle: { id: string; reviewPeriod: string; overdueCount: number }
): Promise<void> {
  // Mark as escalated
  await prisma.performanceReview.update({
    where: { id: review.id },
    data: {
      escalatedToHR: true,
      escalatedAt: new Date(),
    }
  })

  // Update cycle stats
  await prisma.quarterlyReviewCycle.update({
    where: { id: cycle.id },
    data: { overdueCount: cycle.overdueCount + 1 }
  })

  // Notify all HR employees
  const hrEmployees = await getHREmployees()
  for (const hr of hrEmployees) {
    await prisma.notification.create({
      data: {
        type: 'QUARTERLY_REVIEW_ESCALATED',
        title: 'Overdue Quarterly Review',
        message: `Quarterly review for ${review.employee.firstName} ${review.employee.lastName} is overdue. Reviewer: ${review.reviewerName}.`,
        link: `/performance/reviews`,
        employeeId: hr.id,
        relatedId: review.id,
        relatedType: 'REVIEW',
      }
    })
  }

  // Also notify the manager that it's overdue
  if (review.employee.manager) {
    await prisma.notification.create({
      data: {
        type: 'QUARTERLY_REVIEW_OVERDUE',
        title: 'Quarterly Review Overdue',
        message: `The ${cycle.reviewPeriod} quarterly review for ${review.employee.firstName} ${review.employee.lastName} is past due. Please complete it immediately.`,
        link: `/performance/reviews`,
        employeeId: review.employee.manager.id,
        relatedId: review.id,
        relatedType: 'REVIEW',
      }
    })
  }

  console.log(`[Quarterly Reviews] Escalated review for ${review.employee.firstName} ${review.employee.lastName} to HR`)
}

/**
 * Manually trigger quarterly review creation for a specific quarter
 * Used for testing or re-runs
 */
export async function createQuarterlyReviewsForPeriod(
  year: number,
  quarter: number,
  force: boolean = false
): Promise<{
  cycleCreated: boolean
  reviewsCreated: number
  errors: string[]
}> {
  const result = { cycleCreated: false, reviewsCreated: 0, errors: [] as string[] }

  // Check if cycle already exists
  const existingCycle = await prisma.quarterlyReviewCycle.findUnique({
    where: {
      year_quarter: { year, quarter }
    }
  })

  if (existingCycle && !force) {
    result.errors.push(`Cycle for Q${quarter} ${year} already exists. Use force=true to recreate.`)
    return result
  }

  // Delete existing cycle if forcing
  if (existingCycle && force) {
    await prisma.performanceReview.deleteMany({
      where: { quarterlyCycleId: existingCycle.id }
    })
    await prisma.quarterlyReviewCycle.delete({
      where: { id: existingCycle.id }
    })
  }

  const quarterEndDate = getQuarterEndDate(year, quarter)
  const deadline = new Date(quarterEndDate)
  deadline.setDate(deadline.getDate() + DEADLINE_DAYS)

  const cycle = await prisma.quarterlyReviewCycle.create({
    data: {
      year,
      quarter,
      reviewPeriod: getReviewPeriod(year, quarter),
      quarterEndDate,
      deadline,
      status: 'ACTIVE',
    }
  })
  result.cycleCreated = true

  // Get all active employees
  const employees = await prisma.employee.findMany({
    where: { status: 'ACTIVE' },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      reportsToId: true,
      manager: {
        select: { id: true, firstName: true, lastName: true }
      }
    }
  })

  for (const employee of employees) {
    // Skip employees without a manager (top of hierarchy)
    if (!employee.manager) {
      continue
    }

    try {
      const reviewerName = `${employee.manager.firstName} ${employee.manager.lastName}`

      await prisma.performanceReview.create({
        data: {
          employeeId: employee.id,
          reviewType: 'QUARTERLY',
          // Structured period data
          periodType: QUARTER_TO_PERIOD_TYPE[quarter],
          periodYear: year,
          // Legacy string for backward compatibility
          reviewPeriod: cycle.reviewPeriod,
          reviewDate: quarterEndDate,
          reviewerName,
          assignedReviewerId: employee.manager.id,
          overallRating: 0,
          status: 'NOT_STARTED',
          quarterlyCycleId: cycle.id,
          deadline: cycle.deadline,
        }
      })
      result.reviewsCreated++
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Unknown error'
      result.errors.push(`Failed to create review for ${employee.firstName} ${employee.lastName}: ${message}`)
    }
  }

  await prisma.quarterlyReviewCycle.update({
    where: { id: cycle.id },
    data: { totalReviews: result.reviewsCreated }
  })

  return result
}

/**
 * Update cycle stats when a review status changes
 */
export async function updateCycleStats(cycleId: string): Promise<void> {
  const completedCount = await prisma.performanceReview.count({
    where: {
      quarterlyCycleId: cycleId,
      status: { notIn: ['NOT_STARTED', 'IN_PROGRESS'] },
    }
  })

  const overdueCount = await prisma.performanceReview.count({
    where: {
      quarterlyCycleId: cycleId,
      escalatedToHR: true,
    }
  })

  await prisma.quarterlyReviewCycle.update({
    where: { id: cycleId },
    data: { completedCount, overdueCount }
  })
}

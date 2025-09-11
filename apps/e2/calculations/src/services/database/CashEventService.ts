
import { prisma } from '@/utils/database'
import { Prisma } from '@prisma/client'
import logger from '@/utils/logger'

export class CashEventService {
  private static instance: CashEventService

  private constructor() {}

  static getInstance(): CashEventService {
    if (!CashEventService.instance) {
      CashEventService.instance = new CashEventService()
    }
    return CashEventService.instance
  }

  // Create a new cash event
  async createCashEvent(data: {
    date: Date
    description: string
    amount: number
    type: 'fixed' | 'variable'
    category?: string
    metadata?: any
  }) {
    return prisma.cashEvent.create({
      data: {
        date: data.date,
        description: data.description,
        amount: new Prisma.Decimal(data.amount),
        type: data.type,
        category: data.category || 'other',
        metadata: data.metadata
      }
    })
  }

  // Get upcoming cash events
  async getUpcomingEvents(months: number) {
    const startDate = new Date()
    const endDate = new Date()
    endDate.setMonth(endDate.getMonth() + months)

    const events = await prisma.cashEvent.findMany({
      where: {
        date: {
          gte: startDate,
          lte: endDate
        },
        status: 'scheduled'
      },
      orderBy: {
        date: 'asc'
      }
    })

    return events.map(event => ({
      id: event.id,
      date: event.date,
      description: event.description,
      amount: event.amount.toNumber(),
      type: event.type,
      category: event.category,
      status: event.status
    }))
  }

  // Get events by type
  async getEventsByType(type: 'fixed' | 'variable', months?: number) {
    const where: any = { type, status: 'scheduled' }
    
    if (months) {
      const startDate = new Date()
      const endDate = new Date()
      endDate.setMonth(endDate.getMonth() + months)
      where.date = { gte: startDate, lte: endDate }
    }

    const events = await prisma.cashEvent.findMany({
      where,
      orderBy: { date: 'asc' }
    })

    return events.map(event => ({
      id: event.id,
      date: event.date,
      description: event.description,
      amount: event.amount.toNumber(),
      type: event.type,
      category: event.category,
      status: event.status
    }))
  }

  // Update a cash event
  async updateCashEvent(id: string, data: {
    date?: Date
    description?: string
    amount?: number
    type?: 'fixed' | 'variable'
    category?: string
    status?: string
  }) {
    const updateData: any = {}
    
    if (data.date) updateData.date = data.date
    if (data.description) updateData.description = data.description
    if (data.amount !== undefined) updateData.amount = new Prisma.Decimal(data.amount)
    if (data.type) updateData.type = data.type
    if (data.category) updateData.category = data.category
    if (data.status) updateData.status = data.status

    return prisma.cashEvent.update({
      where: { id },
      data: updateData
    })
  }

  // Delete a cash event
  async deleteCashEvent(id: string) {
    return prisma.cashEvent.delete({
      where: { id }
    })
  }

  // Mark event as completed
  async markAsCompleted(id: string) {
    return prisma.cashEvent.update({
      where: { id },
      data: {
        status: 'completed'
      }
    })
  }

  // Get cash flow summary
  async getCashFlowSummary(startDate: Date, endDate: Date) {
    const events = await prisma.cashEvent.findMany({
      where: {
        date: {
          gte: startDate,
          lte: endDate
        },
        status: 'scheduled'
      }
    })

    const totalInflows = events
      .filter(e => e.amount.toNumber() > 0)
      .reduce((sum, e) => sum + e.amount.toNumber(), 0)
    
    const totalOutflows = events
      .filter(e => e.amount.toNumber() < 0)
      .reduce((sum, e) => sum + Math.abs(e.amount.toNumber()), 0)

    return {
      totalInflows,
      totalOutflows,
      netCashImpact: totalInflows - totalOutflows,
      eventCount: events.length
    }
  }

  // Seed initial cash events (for migration from hardcoded data)
  async seedInitialEvents() {
    const existingCount = await prisma.cashEvent.count()
    if (existingCount > 0) {
      logger.info('Cash events already exist, skipping seed')
      return
    }

    const currentDate = new Date()
    const sampleEvents = [
      // Fixed costs
      { month: 1, description: 'Q1 Insurance Premium', amount: -15000, type: 'fixed' as const },
      { month: 4, description: 'Q2 Insurance Premium', amount: -15000, type: 'fixed' as const },
      { month: 7, description: 'Q3 Insurance Premium', amount: -15000, type: 'fixed' as const },
      { month: 10, description: 'Q4 Insurance Premium', amount: -15000, type: 'fixed' as const },
      
      // Variable events
      { month: 3, description: 'Marketing Campaign - Spring', amount: -25000, type: 'variable' as const },
      { month: 6, description: 'Mid-Year Bonus Pool', amount: -50000, type: 'variable' as const },
      { month: 9, description: 'Marketing Campaign - Fall', amount: -30000, type: 'variable' as const },
      { month: 11, description: 'Black Friday Promotions', amount: -40000, type: 'variable' as const },
      { month: 12, description: 'Year-End Bonus Pool', amount: -75000, type: 'variable' as const },
      
      // Positive cash events
      { month: 2, description: 'Tax Refund', amount: 20000, type: 'variable' as const },
      { month: 6, description: 'Equipment Sale', amount: 15000, type: 'variable' as const },
      { month: 12, description: 'Annual Rebate', amount: 30000, type: 'variable' as const }
    ]

    const createPromises = sampleEvents.map(event => {
      const eventDate = new Date(currentDate)
      eventDate.setMonth(currentDate.getMonth() + event.month - 1)
      
      return this.createCashEvent({
        date: eventDate,
        description: event.description,
        amount: event.amount,
        type: event.type
      })
    })

    await Promise.all(createPromises)
    logger.info(`Seeded ${sampleEvents.length} initial cash events`)
  }
}

export default CashEventService
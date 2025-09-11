import { BaseService } from './base.service'

/**
 * Finance Service
 * Note: Most finance functionality has been removed in v0.5.0
 * with the removal of Invoice, CalculatedCost, and related models
 */
export class FinanceService extends BaseService {
  constructor(context?: { user?: { id: string; role: string; warehouseId?: string } }) {
    super(context)
  }

  /**
   * Get financial dashboard data (stub)
   */
  async getDashboardData() {
    const currentDate = new Date()
    const billingPeriodStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
    const billingPeriodEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0)

    return {
      kpis: {
        totalRevenue: 0,
        revenueChange: 0,
        outstandingAmount: 0,
        outstandingCount: 0,
        costVariance: 0,
        collectionRate: 0
      },
      costBreakdown: [],
      invoiceStatus: {
        paid: { count: 0, amount: 0 },
        pending: { count: 0, amount: 0 },
        overdue: { count: 0, amount: 0 },
        disputed: { count: 0, amount: 0 }
      },
      billingPeriod: {
        start: billingPeriodStart,
        end: billingPeriodEnd
      },
      message: 'Finance functionality reduced in v0.5.0'
    }
  }

  /**
   * Get cost summary (stub)
   */
  async getCostSummary(_warehouseId: string, _startDate: Date, _endDate: Date) {
    return {
      totalCost: 0,
      costsByCategory: [],
      message: 'Cost calculation functionality simplified in v0.5.0'
    }
  }

  /**
   * Export financial data (stub)
   */
  async exportFinancialData(_format: 'csv' | 'excel' | 'pdf') {
    throw new Error('Export functionality removed in v0.5.0')
  }
}
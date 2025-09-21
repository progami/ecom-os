import { BaseService, ServiceContext } from './base.service'
import { Prisma, TransactionType } from '@prisma/client'

export interface DashboardStats {
  inventory: {
    totalSkus: number
    totalQuantity: number
    lowStockItems: number
    outOfStockItems: number
  }
  transactions: {
    todayReceived: number
    todayShipped: number
    weekReceived: number
    weekShipped: number
    monthReceived: number
    monthShipped: number
  }
  finance: {
    pendingInvoices: number
    disputedInvoices: number
    monthlyRevenue: number
    monthlyExpenses: number
  }
  warehouses: {
    activeCount: number
    totalCapacity: number
    utilizationRate: number
  }
}

export class DashboardService extends BaseService {
  constructor(context: ServiceContext) {
    super(context)
  }

  private async getScopedWarehouseCode(): Promise<string | undefined> {
    if (!this.session?.user) {
      return undefined
    }

    if (this.session.user.role !== 'staff' || !this.session.user.warehouseId) {
      return undefined
    }

    const warehouse = await this.prisma.warehouse.findUnique({
      where: { id: this.session.user.warehouseId },
      select: { code: true }
    })

    return warehouse?.code
  }

  /**
   * Get comprehensive dashboard statistics
   */
  async getDashboardStats(): Promise<DashboardStats> {
    const warehouseCode = await this.getScopedWarehouseCode()

    const [
      inventoryStats,
      transactionStats,
      financeStats,
      warehouseStats
    ] = await Promise.all([
      this.getInventoryStats(warehouseCode),
      this.getTransactionStats(warehouseCode),
      this.getFinanceStats(warehouseCode),
      this.getWarehouseStats(warehouseCode)
    ])

    return {
      inventory: inventoryStats,
      transactions: transactionStats,
      finance: financeStats,
      warehouses: warehouseStats
    }
  }

  /**
   * Get inventory statistics
   */
  private async getInventoryStats(warehouseCode?: string) {
    const [totalSkus, balances] = await Promise.all([
      this.prisma.sku.count(),
      this.getInventoryBalances(warehouseCode)
    ])

    let totalQuantity = 0
    let outOfStockItems = 0

    balances.forEach(quantity => {
      if (quantity > 0) {
        totalQuantity += quantity
      } else {
        outOfStockItems += 1
      }
    })

    return {
      totalSkus,
      totalQuantity,
      lowStockItems: 0,
      outOfStockItems
    }
  }

  /**
   * Get transaction statistics
   */
  private async getTransactionStats(warehouseCode?: string) {
    const now = new Date()
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const startOfWeek = new Date(startOfDay)
    startOfWeek.setDate(startOfWeek.getDate() - 7)
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

    const baseWhere: Prisma.InventoryTransactionWhereInput = warehouseCode
      ? { warehouseCode }
      : {}

    const countByType = (type: TransactionType, date: Date) =>
      this.prisma.inventoryTransaction.count({
        where: {
          ...baseWhere,
          transactionType: type,
          transactionDate: { gte: date }
        }
      })

    const [
      todayReceived,
      todayShipped,
      weekReceived,
      weekShipped,
      monthReceived,
      monthShipped
    ] = await Promise.all([
      countByType('RECEIVE', startOfDay),
      countByType('SHIP', startOfDay),
      countByType('RECEIVE', startOfWeek),
      countByType('SHIP', startOfWeek),
      countByType('RECEIVE', startOfMonth),
      countByType('SHIP', startOfMonth)
    ])

    return {
      todayReceived,
      todayShipped,
      weekReceived,
      weekShipped,
      monthReceived,
      monthShipped
    }
  }

  /**
   * Get finance statistics
   */
  private async getFinanceStats(warehouseCode?: string) {
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

    const costWhere: Prisma.CostLedgerWhereInput = {
      createdAt: { gte: startOfMonth },
      ...(warehouseCode ? { warehouseCode } : {})
    }

    const monthlyExpenses = await this.prisma.costLedger.aggregate({
      where: costWhere,
      _sum: { totalCost: true }
    })

    return {
      pendingInvoices: 0,
      disputedInvoices: 0,
      monthlyRevenue: 0,
      monthlyExpenses: Number(monthlyExpenses._sum.totalCost || 0)
    }
  }

  /**
   * Get warehouse statistics
   */
  private async getWarehouseStats(warehouseCode?: string) {
    const warehouseWhere: Prisma.WarehouseWhereInput = warehouseCode
      ? { code: warehouseCode }
      : {}

    const [activeCount, utilizedWarehouses] = await Promise.all([
      this.prisma.warehouse.count({
        where: {
          ...warehouseWhere,
          isActive: true
        }
      }),
      this.prisma.inventoryTransaction.groupBy({
        by: ['warehouseCode'],
        where: warehouseCode ? { warehouseCode } : {}
      })
    ])

    const utilizationRate = activeCount > 0
      ? Math.min(100, Math.round((utilizedWarehouses.length / activeCount) * 1000) / 10)
      : 0

    return {
      activeCount,
      totalCapacity: 0,
      utilizationRate
    }
  }

  /**
   * Retrieve net inventory balances per SKU/batch combination
   */
  private async getInventoryBalances(warehouseCode?: string): Promise<Map<string, number>> {
    const aggregates = await this.prisma.inventoryTransaction.groupBy({
      by: ['skuCode', 'batchLot'],
      where: warehouseCode ? { warehouseCode } : {},
      _sum: {
        cartonsIn: true,
        cartonsOut: true
      }
    })

    const balances = new Map<string, number>()

    for (const aggregate of aggregates) {
      const key = `${aggregate.skuCode}-${aggregate.batchLot}`
      const cartonsIn = Number(aggregate._sum.cartonsIn || 0)
      const cartonsOut = Number(aggregate._sum.cartonsOut || 0)
      balances.set(key, cartonsIn - cartonsOut)
    }

    return balances
  }

  /**
   * Get real-time activity feed
   */
  async getActivityFeed(limit: number = 10) {
    const warehouseCode = await this.getScopedWarehouseCode()

    const recentTransactions = await this.prisma.inventoryTransaction.findMany({
      where: warehouseCode ? { warehouseCode } : {},
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        transactionType: true,
        skuCode: true,
        cartonsIn: true,
        cartonsOut: true,
        createdAt: true,
        createdByName: true,
        warehouseName: true
      }
    })

    return recentTransactions.map(tx => ({
      id: tx.id,
      type: tx.transactionType,
      description: this.formatActivityDescription(tx),
      timestamp: tx.createdAt,
      user: tx.createdByName || 'System',
      warehouse: tx.warehouseName
    }))
  }

  /**
   * Format activity description for display
   */
  private formatActivityDescription(tx: { transactionType: TransactionType; skuCode: string; cartonsIn: number; cartonsOut: number }): string {
    const action = tx.transactionType === 'RECEIVE'
      ? 'received'
      : tx.transactionType === 'SHIP'
        ? 'shipped'
        : tx.transactionType === 'ADJUST_IN'
          ? 'adjusted in'
          : 'adjusted out'

    const quantity = tx.transactionType === 'SHIP' || tx.transactionType === 'ADJUST_OUT'
      ? tx.cartonsOut
      : tx.cartonsIn

    return `${action} ${quantity} cartons of ${tx.skuCode}`
  }
}

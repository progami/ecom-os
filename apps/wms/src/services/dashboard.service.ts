import { BaseService, ServiceContext } from './base.service'
import { Prisma } from '@prisma/client'

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

  /**
   * Get comprehensive dashboard statistics
   */
  async getDashboardStats(): Promise<DashboardStats> {
    const warehouseFilter = this.getWarehouseFilter()
    
    // Run all queries in parallel for performance
    const [
      inventoryStats,
      transactionStats,
      financeStats,
      warehouseStats
    ] = await Promise.all([
      this.getInventoryStats(warehouseFilter),
      this.getTransactionStats(warehouseFilter),
      this.getFinanceStats(warehouseFilter),
      this.getWarehouseStats(warehouseFilter)
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
  private async getInventoryStats(warehouseFilter: Prisma.InventoryTransactionWhereInput) {
    const [
      totalSkus,
      inventoryLevels,
      lowStockItems,
      outOfStockItems
    ] = await Promise.all([
      // Total unique SKUs (SKUs don't have warehouseId)
      this.prisma.sku.count(),
      
      // Total quantity across all SKUs
      this.calculateTotalInventory(warehouseFilter),
      
      // Low stock items (less than reorder point)
      this.prisma.sku.count({
        where: {
          ...warehouseFilter,
          reorderPoint: { gt: 0 }
          // Would need current inventory level calculation
        }
      }),
      
      // Out of stock items
      this.countOutOfStockItems(warehouseFilter)
    ])

    return {
      totalSkus,
      totalQuantity: inventoryLevels,
      lowStockItems,
      outOfStockItems
    }
  }

  /**
   * Get transaction statistics
   */
  private async getTransactionStats(warehouseFilter: Prisma.InventoryTransactionWhereInput) {
    const now = new Date()
    const startOfDay = new Date(now.setHours(0, 0, 0, 0))
    const startOfWeek = new Date(now.setDate(now.getDate() - 7))
    const startOfMonth = new Date(now.setDate(1))

    const baseWhere = warehouseFilter ? { warehouseCode: warehouseFilter.warehouseId } : {}

    const [
      todayReceived,
      todayShipped,
      weekReceived,
      weekShipped,
      monthReceived,
      monthShipped
    ] = await Promise.all([
      // Today's transactions
      this.prisma.inventoryTransaction.count({
        where: {
          ...baseWhere,
          transactionType: 'RECEIVE',
          transactionDate: { gte: startOfDay }
        }
      }),
      this.prisma.inventoryTransaction.count({
        where: {
          ...baseWhere,
          transactionType: 'SHIP',
          transactionDate: { gte: startOfDay }
        }
      }),
      
      // Week's transactions
      this.prisma.inventoryTransaction.count({
        where: {
          ...baseWhere,
          transactionType: 'RECEIVE',
          transactionDate: { gte: startOfWeek }
        }
      }),
      this.prisma.inventoryTransaction.count({
        where: {
          ...baseWhere,
          transactionType: 'SHIP',
          transactionDate: { gte: startOfWeek }
        }
      }),
      
      // Month's transactions
      this.prisma.inventoryTransaction.count({
        where: {
          ...baseWhere,
          transactionType: 'RECEIVE',
          transactionDate: { gte: startOfMonth }
        }
      }),
      this.prisma.inventoryTransaction.count({
        where: {
          ...baseWhere,
          transactionType: 'SHIP',
          transactionDate: { gte: startOfMonth }
        }
      })
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
  private async getFinanceStats(_warehouseFilter: Prisma.InventoryTransactionWhereInput) {
    const startOfMonth = new Date(new Date().setDate(1))
    
    const [
      pendingInvoices,
      disputedInvoices,
      monthlyRevenue,
      monthlyExpenses
    ] = await Promise.all([
      // Pending invoices (placeholder - invoice table not implemented)
      Promise.resolve(0),
      
      // Disputed invoices (placeholder - invoice table not implemented)
      Promise.resolve(0),
      
      // Monthly revenue (placeholder - invoice table not implemented)
      Promise.resolve({
        _sum: { totalAmount: 0 }
      }),
      
      // Monthly expenses (sum of cost ledger)
      this.prisma.costLedger.aggregate({
        where: {
          createdAt: { gte: startOfMonth }
        },
        _sum: { totalCost: true }
      })
    ])

    return {
      pendingInvoices,
      disputedInvoices,
      monthlyRevenue: monthlyRevenue._sum.totalAmount || 0,
      monthlyExpenses: Number(monthlyExpenses._sum.totalCost || 0)
    }
  }

  /**
   * Get warehouse statistics
   */
  private async getWarehouseStats(warehouseFilter: Prisma.WarehouseWhereInput) {
    const whereClause = warehouseFilter || {}
    
    const [
      activeCount,
      warehouseConfigs
    ] = await Promise.all([
      this.prisma.warehouse.count({
        where: {
          ...whereClause,
          isActive: true
        }
      }),
      
      // Placeholder - warehouseConfig table not implemented
      Promise.resolve([])
    ])

    const totalCapacity = warehouseConfigs.reduce(
      (sum, config) => sum + (config.maxPalletCapacity || 0), 
      0
    )
    
    const currentUsage = warehouseConfigs.reduce(
      (sum, config) => sum + (config.currentPalletCount || 0), 
      0
    )
    
    const utilizationRate = totalCapacity > 0 
      ? (currentUsage / totalCapacity) * 100 
      : 0

    return {
      activeCount,
      totalCapacity,
      utilizationRate: Math.round(utilizationRate * 10) / 10
    }
  }

  /**
   * Calculate total inventory across all warehouses
   */
  private async calculateTotalInventory(warehouseFilter: Prisma.InventoryTransactionWhereInput): Promise<number> {
    const transactions = await this.prisma.inventoryTransaction.groupBy({
      by: ['skuCode', 'batchLot', 'transactionType'],
      where: warehouseFilter ? { warehouseCode: warehouseFilter.warehouseId } : {},
      _sum: {
        cartonsIn: true,
        cartonsOut: true
      }
    })

    let totalQuantity = 0
    const inventory = new Map<string, number>()

    for (const tx of transactions) {
      const key = `${tx.skuCode}-${tx.batchLot}`
      const current = inventory.get(key) || 0
      
      if (tx.transactionType === 'RECEIVE' || tx.transactionType === 'ADJUST_IN') {
        inventory.set(key, current + (tx._sum.cartonsIn || 0))
      } else if (tx.transactionType === 'SHIP' || tx.transactionType === 'ADJUST_OUT') {
        inventory.set(key, current - (tx._sum.cartonsOut || 0))
      }
    }

    for (const quantity of inventory.values()) {
      if (quantity > 0) {
        totalQuantity += quantity
      }
    }

    return totalQuantity
  }

  /**
   * Count items that are out of stock
   */
  private async countOutOfStockItems(warehouseFilter: Prisma.InventoryTransactionWhereInput): Promise<number> {
    // Get all SKUs
    const skus = await this.prisma.sku.findMany({
      where: warehouseFilter,
      select: { skuCode: true }
    })

    let outOfStockCount = 0

    // Check inventory level for each SKU
    for (const sku of skus) {
      const inventory = await this.prisma.inventoryTransaction.groupBy({
        by: ['transactionType'],
        where: {
          skuCode: sku.skuCode,
          ...(warehouseFilter && { warehouseCode: warehouseFilter.warehouseId })
        },
        _sum: {
          cartonsIn: true,
          cartonsOut: true
        }
      })

      let balance = 0
      for (const tx of inventory) {
        if (tx.transactionType === 'RECEIVE' || tx.transactionType === 'ADJUST_IN') {
          balance += tx._sum.cartonsIn || 0
        } else if (tx.transactionType === 'SHIP' || tx.transactionType === 'ADJUST_OUT') {
          balance -= tx._sum.cartonsOut || 0
        }
      }

      if (balance <= 0) {
        outOfStockCount++
      }
    }

    return outOfStockCount
  }

  /**
   * Get real-time activity feed
   */
  async getActivityFeed(limit: number = 10) {
    const warehouseFilter = this.getWarehouseFilter()
    
    const recentTransactions = await this.prisma.inventoryTransaction.findMany({
      where: warehouseFilter ? { warehouseCode: warehouseFilter.warehouseId } : {},
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
  private formatActivityDescription(tx: { type: string; skuCode: string; cartonsIn: number; cartonsOut: number }): string {
    const quantity = tx.cartonsIn || tx.cartonsOut || 0
    const action = tx.transactionType === 'RECEIVE' ? 'received' : 
                   tx.transactionType === 'SHIP' ? 'shipped' : 'adjusted'
    
    return `${action} ${quantity} cartons of ${tx.skuCode}`
  }
}
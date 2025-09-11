// InventoryService.ts
// Service to manage inventory levels and automatic reordering

import SharedFinancialDataService from './SharedFinancialDataService'
import ProductService from '@/services/database/ProductService'
import SystemConfigService from '@/services/database/SystemConfigService'

interface InventoryItem {
  sku: string
  currentStock: number
  inTransit: number
  reserved: number // Units allocated to future orders
  available: number // currentStock + inTransit - reserved
  reorderPoint: number
  reorderQty: number
  leadTimeDays: number
  lastOrdered?: Date
  nextDelivery?: Date
}

interface ReorderSuggestion {
  sku: string
  currentStock: number
  weeksOfSupply: number
  suggestedQty: number
  orderDate: Date
  expectedDelivery: Date
  reason: string
}

interface ProductConfig {
  sku: string
  minWeeksSupply: number // Minimum weeks of inventory to maintain
  maxWeeksSupply: number // Maximum weeks of inventory
  containerQty: number // Units per container for this SKU
  unitCBM: number // Cubic meters per unit
  manufacturing: number // Manufacturing cost per unit
}

class InventoryService {
  private static instance: InventoryService
  private inventory: Map<string, InventoryItem> = new Map()
  private listeners: Set<() => void> = new Set()
  private productService: ProductService
  private configService: SystemConfigService
  
  // Configuration values - will be loaded from database
  private leadTimeDays: number = 45
  private weeksInLeadTime: number = 6.5
  private containerCBM: number = 67.7
  private freightCost: number = 6280
  private tariffRate: number = 0.075
  
  // Product configurations - will be loaded from database
  private productConfigs: Map<string, ProductConfig> = new Map()
  
  private constructor() {
    this.productService = ProductService.getInstance()
    this.configService = SystemConfigService.getInstance()
    this.initializeInventory()
  }
  
  static getInstance(): InventoryService {
    if (!InventoryService.instance) {
      InventoryService.instance = new InventoryService()
    }
    return InventoryService.instance
  }
  
  private async initializeInventory() {
    // Load configuration from database
    await this.loadConfig()
    // Load product configurations from database
    await this.loadProductConfigs()
    // Initialize with empty inventory - no assumptions
    // User should input actual inventory levels
    // Products will be added via addInventory method when products are set up
  }
  
  private async loadConfig() {
    try {
      const businessRules = await this.configService.getBusinessRules()
      
      // Load business rules
      this.tariffRate = businessRules.tariffRate || 0.075
      
      // Load inventory constants
      this.leadTimeDays = businessRules.leadTimeDays || 45
      this.weeksInLeadTime = this.leadTimeDays / 7
      
      // Keep default values for freight and container
      // These could be added to SystemConfig in the future
      this.freightCost = 6280
      this.containerCBM = 67.7
    } catch (error) {
      console.error('Failed to load inventory config from database:', error)
      // Use default values if config load fails
    }
  }
  
  private async loadProductConfigs() {
    const productsData = await this.productService.getProductsForDashboardAsync()
    
    this.productConfigs.clear()
    Object.entries(productsData).forEach(([sku, product]) => {
      // Calculate container quantities based on CBM
      const containerCBM = 68; // Standard 40ft container
      const unitCBM = 0.004; // Default if not available
      const containerQty = Math.floor(containerCBM / unitCBM);
      
      // Set weeks supply based on product type
      const minWeeksSupply = 20;
      const maxWeeksSupply = 30;
      
      this.productConfigs.set(sku, {
        sku: sku,
        minWeeksSupply,
        maxWeeksSupply,
        containerQty,
        unitCBM,
        manufacturing: product.manufacturingCost
      });
    });
  }
  
  // Get current inventory for a SKU
  getInventory(sku: string): InventoryItem | undefined {
    return this.inventory.get(sku)
  }
  
  // Get all inventory
  getAllInventory(): InventoryItem[] {
    return Array.from(this.inventory.values())
  }
  
  // Add new inventory item
  addInventory(item: InventoryItem): void {
    this.inventory.set(item.sku, item)
    this.productConfigs.set(item.sku, {
      sku: item.sku,
      minWeeksSupply: 8,
      maxWeeksSupply: 16,
      containerQty: 1000,
      unitCBM: 0.001,
      manufacturing: 0.65
    })
    this.notifyListeners()
  }
  
  // Remove inventory item
  removeInventory(sku: string): void {
    this.inventory.delete(sku)
    this.productConfigs.delete(sku)
    this.notifyListeners()
  }
  
  // Calculate weeks of supply based on sales velocity
  async calculateWeeksOfSupply(sku: string): Promise<number> {
    const inv = this.inventory.get(sku)
    if (!inv) return 0
    
    // Get sales data from SharedFinancialDataService
    const sharedData = SharedFinancialDataService.getInstance()
    const revenueData = await sharedData.getRevenue()
    
    // Calculate average weekly sales over last 13 weeks
    const currentDate = new Date()
    const weeksToAnalyze = 13
    let totalUnits = 0
    let weeksWithSales = 0
    
    // For now, use a default value since we don't have SKU-specific sales data in the Revenue model
    // In a real implementation, this would query RevenueCalculation or similar table with SKU data
    const avgWeeklySales = 100 // Default to 100 units/week
    
    return avgWeeklySales > 0 ? inv.available / avgWeeklySales : 999
  }
  
  // Get reorder suggestions
  async getReorderSuggestions(): Promise<ReorderSuggestion[]> {
    const suggestions: ReorderSuggestion[] = []
    const today = new Date()
    
    for (const [sku, inv] of this.inventory) {
      const config = this.productConfigs.get(sku)
      if (!config) continue
      
      const weeksOfSupply = await this.calculateWeeksOfSupply(sku)
      
      // Need to reorder if weeks of supply falls below minimum + lead time
      const reorderThreshold = config.minWeeksSupply + this.weeksInLeadTime
      
      if (weeksOfSupply < reorderThreshold) {
        // Calculate how much to order
        const avgWeeklySales = inv.available / weeksOfSupply
        const targetInventory = avgWeeklySales * config.maxWeeksSupply
        const suggestedQty = Math.ceil((targetInventory - inv.available) / config.containerQty) * config.containerQty
        
        // Create suggestion
        suggestions.push({
          sku,
          currentStock: inv.currentStock,
          weeksOfSupply,
          suggestedQty,
          orderDate: today,
          expectedDelivery: new Date(today.getTime() + this.leadTimeDays * 24 * 60 * 60 * 1000),
          reason: `Inventory below ${reorderThreshold} weeks (currently ${weeksOfSupply.toFixed(1)} weeks)`
        })
      }
    }
    
    return suggestions
  }
  
  // Calculate container optimization for multiple SKUs
  optimizeContainerLoading(orders: { sku: string; qty: number }[]): {
    containers: Array<{
      items: Array<{ sku: string; qty: number }>
      totalCBM: number
      utilization: number
    }>
    totalCost: number
  } {
    const containers: Array<{
      items: Array<{ sku: string; qty: number }>
      totalCBM: number
      utilization: number
    }> = []
    
    let currentContainer = {
      items: [] as Array<{ sku: string; qty: number }>,
      totalCBM: 0,
      utilization: 0
    }
    
    // Sort orders by CBM efficiency (larger items first)
    const sortedOrders = [...orders].sort((a, b) => {
      const configA = this.productConfigs.get(a.sku)
      const configB = this.productConfigs.get(b.sku)
      if (!configA || !configB) return 0
      return (configB.unitCBM * b.qty) - (configA.unitCBM * a.qty)
    })
    
    // Pack containers
    sortedOrders.forEach(order => {
      const config = this.productConfigs.get(order.sku)
      if (!config) return
      
      const orderCBM = config.unitCBM * order.qty
      
      if (currentContainer.totalCBM + orderCBM <= this.containerCBM) {
        // Fits in current container
        currentContainer.items.push(order)
        currentContainer.totalCBM += orderCBM
      } else {
        // Need new container
        if (currentContainer.items.length > 0) {
          currentContainer.utilization = (currentContainer.totalCBM / this.containerCBM) * 100
          containers.push(currentContainer)
        }
        
        currentContainer = {
          items: [order],
          totalCBM: orderCBM,
          utilization: 0
        }
      }
    })
    
    // Add last container
    if (currentContainer.items.length > 0) {
      currentContainer.utilization = (currentContainer.totalCBM / this.containerCBM) * 100
      containers.push(currentContainer)
    }
    
    // Calculate total cost
    let totalManufacturing = 0
    orders.forEach(order => {
      const config = this.productConfigs.get(order.sku)
      if (config) {
        totalManufacturing += config.manufacturing * order.qty
      }
    })
    
    const totalFreight = containers.length * this.freightCost
    const totalTariff = totalManufacturing * this.tariffRate
    const totalCost = totalManufacturing + totalFreight + totalTariff
    
    return { containers, totalCost }
  }
  
  // Update inventory levels
  updateInventory(sku: string, changes: Partial<InventoryItem>) {
    const current = this.inventory.get(sku)
    if (!current) return
    
    const updated = { ...current, ...changes }
    updated.available = updated.currentStock + updated.inTransit - updated.reserved
    
    this.inventory.set(sku, updated)
    this.notifyListeners()
  }
  
  // Process sales (reduce inventory)
  processSale(sku: string, units: number) {
    const inv = this.inventory.get(sku)
    if (!inv) return
    
    this.updateInventory(sku, {
      currentStock: Math.max(0, inv.currentStock - units),
      reserved: Math.max(0, inv.reserved - units)
    })
  }
  
  // Process incoming shipment
  processIncomingShipment(sku: string, units: number) {
    const inv = this.inventory.get(sku)
    if (!inv) return
    
    this.updateInventory(sku, {
      currentStock: inv.currentStock + units,
      inTransit: Math.max(0, inv.inTransit - units)
    })
  }
  
  // Create purchase order
  createPurchaseOrder(orders: Array<{ sku: string; qty: number }>) {
    const today = new Date()
    const deliveryDate = new Date(today.getTime() + this.leadTimeDays * 24 * 60 * 60 * 1000)
    
    orders.forEach(order => {
      const inv = this.inventory.get(order.sku)
      if (inv) {
        this.updateInventory(order.sku, {
          inTransit: inv.inTransit + order.qty,
          lastOrdered: today,
          nextDelivery: deliveryDate
        })
      }
    })
    
    return {
      orderDate: today,
      expectedDelivery: deliveryDate,
      items: orders,
      optimization: this.optimizeContainerLoading(orders)
    }
  }
  
  // Event listener methods
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }
  
  private notifyListeners() {
    this.listeners.forEach(listener => listener())
  }
}

export default InventoryService
export type { InventoryItem, ReorderSuggestion, ProductConfig }
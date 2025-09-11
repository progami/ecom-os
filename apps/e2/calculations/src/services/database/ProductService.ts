import { PrismaClient, Product, Prisma } from '@prisma/client'
import { prisma } from '@/utils/database'
import logger from '@/utils/logger'

// Legacy interfaces for backward compatibility
export interface ProductConfig {
  sku: string
  name: string
  price: number // retail price
  manufacturingCost: number
  freightCost: number
  warehouseCost: number
  fulfillmentFee: number
  amazonReferralFee: number
  refundAllowance: number
  category?: string
  packSize?: number
  thickness?: string
  group?: number
  country?: string
  micron?: number
  dimensions?: string
  density?: number
  weight?: number
  weightOz?: number
  weightLb?: number
  cbmPerUnit?: number
  sizeTier?: string
  tariffRate?: number
  tacos?: number
}

export interface ProductMargin {
  sku: string
  name: string
  retailPrice: number
  manufacturing: number
  freight: number
  thirdPLStorage: number
  amazonReferralFee: number
  fulfillmentFee: number
  refundAllowance: number
  group: number
  country: string
  packSize: number
  micron: number
  dimensions: string
  density: number
  weight: number
  weightOz: number
  weightLb: number
  cbmPerUnit: number
  sizeTier: string
  tariffRate: number
}

export interface ProductData {
  sku: string
  name: string
  price: number
  manufacturingCost: number
  freightCost: number
  warehouseCost: number
  fulfillmentFee: number
  tariffRate?: number
  packSize?: number
}

class ProductService {
  private static instance: ProductService
  private prisma: PrismaClient
  private cache: Map<string, Product> = new Map()
  private cacheInitialized: boolean = false
  private cacheLastRefreshed: Date = new Date(0)
  private readonly CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes
  private initPromise: Promise<void> | null = null

  private constructor() {
    // Use shared prisma instance instead of creating new one
    this.prisma = prisma
  }

  static getInstance(): ProductService {
    if (!ProductService.instance) {
      ProductService.instance = new ProductService()
    }
    return ProductService.instance
  }

  /**
   * Initialize the cache by loading all products from database
   */
  async initializeCache(): Promise<void> {
    // Prevent multiple simultaneous initializations
    if (this.initPromise) {
      return this.initPromise
    }

    this.initPromise = this.loadProductsIntoCache()
    await this.initPromise
    this.initPromise = null
  }

  private async loadProductsIntoCache(): Promise<void> {
    try {
      const products = await this.prisma.product.findMany({
        where: { status: 'active' }
      })
      
      // Custom sort: 6PK-7M, 12PK-7M, 1PK-32M, 3PK-32M
      const sortOrder = ['6PK - 7M', '12PK - 7M', '1PK - 32M', '3PK - 32M']
      products.sort((a, b) => {
        const indexA = sortOrder.indexOf(a.sku)
        const indexB = sortOrder.indexOf(b.sku)
        if (indexA === -1 && indexB === -1) return a.sku.localeCompare(b.sku)
        if (indexA === -1) return 1
        if (indexB === -1) return -1
        return indexA - indexB
      })

      this.cache.clear()
      products.forEach(product => {
        this.cache.set(product.sku, product)
      })

      this.cacheInitialized = true
      this.cacheLastRefreshed = new Date()
    } catch (error) {
      logger.error('Failed to initialize product cache:', error)
      throw error
    }
  }

  /**
   * Refresh cache if it's stale
   */
  private async refreshCacheIfNeeded(): Promise<void> {
    const now = new Date()
    const timeSinceRefresh = now.getTime() - this.cacheLastRefreshed.getTime()
    
    if (timeSinceRefresh > this.CACHE_TTL_MS) {
      await this.loadProductsIntoCache()
    }
  }

  /**
   * Ensure cache is initialized before synchronous operations
   */
  private ensureCacheInitialized(): void {
    if (!this.cacheInitialized) {
      throw new Error('Product cache not initialized. Call initializeCache() first.')
    }
  }

  /**
   * Invalidate the cache (useful after bulk updates)
   */
  async invalidateCache(): Promise<void> {
    this.cache.clear()
    this.cacheInitialized = false
    await this.initializeCache()
  }

  // ===== SYNCHRONOUS METHODS (use cache) =====

  /**
   * Get a single product by SKU (synchronous)
   */
  getProduct(sku: string): ProductConfig | null {
    this.ensureCacheInitialized()
    const product = this.cache.get(sku)
    return product ? this.toProductConfig(product) : null
  }

  /**
   * Get all products as ProductConfig (synchronous)
   */
  getAllProducts(): Record<string, ProductConfig> {
    this.ensureCacheInitialized()
    const result: Record<string, ProductConfig> = {}
    
    this.cache.forEach((product, sku) => {
      result[sku] = this.toProductConfig(product)
    })
    
    return result
  }

  /**
   * Get all product SKUs (synchronous)
   */
  getProductSkus(): string[] {
    this.ensureCacheInitialized()
    return Array.from(this.cache.keys())
  }

  /**
   * Get products by category (synchronous)
   */
  getProductsByCategory(category: string): ProductConfig[] {
    this.ensureCacheInitialized()
    const result: ProductConfig[] = []
    
    this.cache.forEach(product => {
      if (product.category === category) {
        result.push(this.toProductConfig(product))
      }
    })
    
    return result
  }

  /**
   * Get products formatted for dashboard use (synchronous)
   */
  getProductDataForDashboard(): Record<string, Omit<ProductConfig, 'sku'>> {
    this.ensureCacheInitialized()
    const result: Record<string, Omit<ProductConfig, 'sku'>> = {}
    
    this.cache.forEach((product, sku) => {
      const config = this.toProductConfig(product)
      const { sku: _, ...productData } = config
      result[sku] = productData
    })
    
    return result
  }

  /**
   * Validate if a SKU exists (synchronous)
   */
  isValidSku(sku: string): boolean {
    this.ensureCacheInitialized()
    return this.cache.has(sku)
  }

  /**
   * Get product price (synchronous)
   */
  getProductPrice(sku: string): number {
    this.ensureCacheInitialized()
    const product = this.cache.get(sku)
    return product?.pricing?.toNumber() || 0
  }

  /**
   * Calculate product financials (synchronous)
   */
  calculateProductFinancials(sku: string, units: number) {
    this.ensureCacheInitialized()
    const product = this.cache.get(sku)
    if (!product) throw new Error(`Product ${sku} not found`)
    
    const price = product.pricing?.toNumber() || 0
    const revenue = units * price
    
    // Use actual Product model fields with new names
    const cogs = units * product.investedCost.toNumber()
    
    
    // Calculate fees from Product fields
    const fulfillmentCosts = units * (
      product.referralFee.toNumber() + 
      product.fulfillmentFee.toNumber() + 
      product.refund.toNumber()
    )
    const grossProfit = revenue - cogs - fulfillmentCosts
    
    return {
      revenue,
      cogs,
      fulfillmentCosts,
      grossProfit,
      grossMargin: revenue > 0 ? (grossProfit / revenue) * 100 : 0
    }
  }

  /**
   * Get all products in ProductMargin format (synchronous)
   */
  getProductMargins(): ProductMargin[] {
    this.ensureCacheInitialized()
    const result: ProductMargin[] = []
    
    this.cache.forEach(product => {
      result.push(this.toProductMargin(product))
    })
    
    return result
  }

  // ===== ASYNC METHODS (database operations) =====

  /**
   * Get all active products (async)
   */
  async getActiveProducts(strategyId?: string): Promise<Product[]> {
    await this.refreshCacheIfNeeded()
    
    // If no strategyId provided, get the active strategy
    let activeStrategyId = strategyId
    if (!activeStrategyId) {
      const activeStrategy = await this.prisma.budgetStrategy.findFirst({
        where: { isActive: true }
      })
      activeStrategyId = activeStrategy?.id
    }
    
    const products = await this.prisma.product.findMany({
      where: { 
        status: 'active',
        strategyId: activeStrategyId,
      }
    })
    
    // Custom sort: 6PK-7M, 12PK-7M, 1PK-32M, 3PK-32M
    const sortOrder = ['6PK - 7M', '12PK - 7M', '1PK - 32M', '3PK - 32M']
    products.sort((a, b) => {
      const indexA = sortOrder.indexOf(a.sku)
      const indexB = sortOrder.indexOf(b.sku)
      if (indexA === -1 && indexB === -1) return a.sku.localeCompare(b.sku)
      if (indexA === -1) return 1
      if (indexB === -1) return -1
      return indexA - indexB
    })
    
    return products
  }

  /**
   * Get products formatted for dashboard use (async)
   */
  async getProductsForDashboardAsync(): Promise<Record<string, ProductData>> {
    await this.refreshCacheIfNeeded()
    const products = await this.getActiveProducts()
    const result: Record<string, ProductData> = {}
    
    products.forEach(product => {
      result[product.sku] = {
        sku: product.sku,
        name: product.name,
        price: product.pricing?.toNumber() || 0,
        manufacturingCost: product.manufacturing.toNumber(),
        freightCost: product.freight.toNumber(),
        warehouseCost: product.awd.toNumber(),
        fulfillmentFee: product.fulfillmentFee.toNumber(),
        tariffRate: product.tariff.toNumber(),
        packSize: undefined
      }
    })
    
    return result
  }

  /**
   * Get a single product by SKU (async)
   */
  async getProductBySku(sku: string, strategyId?: string): Promise<Product | null> {
    // Get active strategy if not provided
    let activeStrategyId = strategyId
    if (!activeStrategyId) {
      const activeStrategy = await this.prisma.budgetStrategy.findFirst({
        where: { isActive: true }
      })
      activeStrategyId = activeStrategy?.id
    }
    
    if (!activeStrategyId) {
      // If no strategy is active, try to find any product with this SKU
      const product = await this.prisma.product.findFirst({
        where: { 
          sku,
          status: 'active'
        },
        orderBy: { updatedAt: 'desc' }
      })
      
      // Update cache if found
      if (product && product.status === 'active') {
        this.cache.set(sku, product)
      }
      
      return product
    }
    
    // Use compound unique constraint
    const product = await this.prisma.product.findFirst({
      where: { 
        sku,
        strategyId: activeStrategyId,
        status: 'active'
      }
    })
    
    // Update cache if found
    if (product && product.status === 'active') {
      this.cache.set(sku, product)
    }
    
    return product
  }

  /**
   * Update product costs and pricing
   */
  async updateProductCosts(sku: string, data: {
    // INPUT FIELDS ONLY - these are editable in UI
    amazonPrice?: number         // [4000] Amazon Sales price
    manufacturingCost?: number   // [5020] Manufacturing cost
    freightCost?: number         // [5030] Ocean Freight cost
    warehouseCost?: number       // [5032] Storage AWD cost
    
    // Product configuration inputs
    sourcingCountry?: string
    destinationMarket?: string
    packSize?: number
    micron?: number
    
    // Physical dimensions inputs
    length?: number              // Package length in cm
    width?: number               // Package width in cm
    height?: number              // Package height in cm
    productLength?: number       // Product length in inches
    productWidth?: number        // Product width in inches
    productArea?: number         // Product area in sq inches
    density?: number             // Density in g/cm³
    weightGrams?: number         // Actual weight in grams
    weightOz?: number            // Actual weight in ounces
    
    // Rate inputs (percentages)
    tacos?: number               // TACoS % (advertising rate)
    tariffRate?: number          // Tariff rate %
    refundRate?: number          // Refund/return rate %
    
    // Inventory
    currentStock?: number
    
    // Strategy context
    strategyId?: string
    
    // SECURITY: Calculated fields are NOT accepted as inputs
    // These will be computed: fulfillmentFee, tariff, referralFee, 
    // refund, margin, marginPercent, weightGrams, weightOz, weightLb, cbm
  }): Promise<Product> {
    // Get active strategy if not provided
    let strategyId = data.strategyId
    if (!strategyId) {
      const activeStrategy = await this.prisma.budgetStrategy.findFirst({
        where: { isActive: true }
      })
      strategyId = activeStrategy?.id
    }
    
    // Get current product for this strategy
    const currentProduct = await this.prisma.product.findFirst({ 
      where: { 
        sku,
        strategyId
      } 
    })
    if (!currentProduct) throw new Error(`Product ${sku} not found for strategy ${strategyId}`)
    
    // Calculate derived values from inputs
    const pricing = data.amazonPrice ?? currentProduct.pricing?.toNumber() ?? 0
    const manufacturing = data.manufacturingCost ?? currentProduct.manufacturing?.toNumber() ?? 0
    const tariffRateValue = data.tariffRate ?? currentProduct.tariffRate?.toNumber() ?? 0
    const refundRateValue = data.refundRate ?? currentProduct.refundRate?.toNumber() ?? 0
    const tacosValue = data.tacos ?? currentProduct.tacos?.toNumber() ?? 0
    
    // Use provided weight or keep existing
    let weightGrams = data.weightGrams ?? currentProduct.weightGrams?.toNumber()
    let weightOz = data.weightOz ?? currentProduct.weightOz?.toNumber()
    
    // Convert between grams and oz if only one is provided
    if (weightGrams && !weightOz) {
      weightOz = weightGrams / 28.3495
    } else if (weightOz && !weightGrams) {
      weightGrams = weightOz * 28.3495
    }
    
    let weightLb = weightGrams ? weightGrams / 453.592 : currentProduct.weightLb?.toNumber()
    
    // Calculate CBM from dimensions
    let cbm: number | undefined
    const lengthCm = data.length ?? currentProduct.length?.toNumber()
    const widthCm = data.width ?? currentProduct.width?.toNumber()
    const heightCm = data.height ?? currentProduct.height?.toNumber()
    
    if (lengthCm && widthCm && heightCm) {
      cbm = (lengthCm * widthCm * heightCm) / 1000000
    }
    
    // Calculate financial fields
    const tariff = manufacturing * tariffRateValue
    const referralFee = pricing * 0.15  // Amazon's 15% referral fee
    const refund = pricing * refundRateValue
    const investedCost = manufacturing + (data.freightCost ?? currentProduct.freight?.toNumber() ?? 0) + tariff
    
    // Build package dimensions string if dimensions provided
    let packageDimensions: string | undefined
    if (lengthCm && widthCm && heightCm) {
      packageDimensions = `${lengthCm} x ${widthCm} x ${heightCm} cm`
    }
    
    // Map to actual database fields - ONLY INPUT FIELDS + CALCULATED VALUES
    const dbData: any = {
      // Input fields
      ...(data.amazonPrice !== undefined && { pricing: data.amazonPrice }),
      ...(data.manufacturingCost !== undefined && { manufacturing: data.manufacturingCost }),
      ...(data.freightCost !== undefined && { freight: data.freightCost }),
      ...(data.warehouseCost !== undefined && { awd: data.warehouseCost }),
      ...(data.sourcingCountry !== undefined && { sourcingCountry: data.sourcingCountry }),
      ...(data.destinationMarket !== undefined && { destinationMarket: data.destinationMarket }),
      ...(data.packSize !== undefined && { packSize: data.packSize }),
      ...(data.micron !== undefined && { micron: data.micron }),
      ...(data.length !== undefined && { length: data.length }),
      ...(data.width !== undefined && { width: data.width }),
      ...(data.height !== undefined && { height: data.height }),
      ...(data.productLength !== undefined && { productLength: data.productLength }),
      ...(data.productWidth !== undefined && { productWidth: data.productWidth }),
      ...(data.productArea !== undefined && { productArea: data.productArea }),
      ...(data.density !== undefined && { density: data.density }),
      ...(data.tacos !== undefined && { tacos: data.tacos }),
      ...(data.tariffRate !== undefined && { tariffRate: data.tariffRate }),
      ...(data.refundRate !== undefined && { refundRate: data.refundRate }),
      ...(data.currentStock !== undefined && { currentStock: data.currentStock }),
      
      // Calculated fields
      ...(weightGrams !== undefined && { weightGrams }),
      ...(weightOz !== undefined && { weightOz }),
      ...(weightLb !== undefined && { weightLb }),
      ...(cbm !== undefined && { cbm }),
      ...(packageDimensions !== undefined && { packageDimensions }),
      tariff,
      referralFee,
      refund,
      investedCost
    }
    
    const updated = await this.prisma.product.update({
      where: { id: currentProduct.id },
      data: dbData
    })
    
    // If size tier was updated, recalculate FBA fees
    if (data.sizeTier !== undefined || data.weightOz !== undefined) {
      const { AmazonFeeService } = await import('./AmazonFeeService')
      await AmazonFeeService.updateProductFBAFees(sku, strategyId)
      // Fetch the updated product with new FBA fees
      const updatedWithFees = await this.prisma.product.findFirst({
        where: { id: currentProduct.id }
      })
      if (updatedWithFees) {
        // Update cache
        if (updatedWithFees.status === 'active') {
          this.cache.set(sku, updatedWithFees)
        }
        return updatedWithFees
      }
    }
    
    // Update cache
    if (updated.status === 'active') {
      this.cache.set(sku, updated)
    }
    
    return updated
  }

  /**
   * Update multiple products at once
   */
  async updateMultipleProducts(updates: Array<{
    sku: string
    data: Partial<Product>
  }>): Promise<void> {
    const transactions = updates.map(({ sku, data }) => {
      const updateData: any = {
        ...data,
      }
      if (updateData.metadata === null) {
        updateData.metadata = Prisma.JsonNull
      }
      return this.prisma.product.update({
        where: { 
          sku_strategyId: {
            sku,
            strategyId: null
          }
        } as any,
        data: updateData
      })
    })
    
    const updatedProducts = await this.prisma.$transaction(transactions)
    
    // Update cache
    updatedProducts.forEach(product => {
      if (product.status === 'active') {
        this.cache.set(product.sku, product)
      }
    })
  }

  /**
   * Create a new product
   */
  async createProduct(data: {
    // REQUIRED FIELDS
    sku: string
    name: string
    
    // INPUT FIELDS ONLY - these are editable in UI
    amazonPrice: number          // [4000] Amazon Sales price
    manufacturingCost?: number   // [5020] Manufacturing cost
    freightCost?: number         // [5030] Ocean Freight cost
    warehouseCost?: number       // [5032] Storage AWD cost
    
    // Product configuration inputs
    category?: string
    sourcingCountry?: string
    destinationMarket?: string
    packSize?: number
    micron?: number
    
    // Physical dimensions inputs
    length?: number              // Package length in cm
    width?: number               // Package width in cm
    height?: number              // Package height in cm
    productArea?: number         // Product area in sq inches
    density?: number             // Density in g/cm³
    weightGrams?: number         // Actual weight in grams
    weightOz?: number            // Actual weight in ounces
    
    // Rate inputs (percentages)
    tacos?: number               // TACoS % (advertising rate)
    tariffRate?: number          // Tariff rate %
    refundRate?: number          // Refund/return rate %
    
    // Inventory
    currentStock?: number
    reorderPoint?: number
    reorderQuantity?: number
    
    // Strategy context
    strategyId?: string
    
    // SECURITY: Calculated fields are NOT accepted
    // fulfillmentFee, tariff, referralFee, margin, cbm, weightGrams, etc.
  }): Promise<Product> {
    // Get active strategy if not provided
    let strategyId = data.strategyId
    if (!strategyId) {
      const activeStrategy = await this.prisma.budgetStrategy.findFirst({
        where: { isActive: true }
      })
      strategyId = activeStrategy?.id
      if (!strategyId) {
        throw new Error('No active strategy found and no strategyId provided')
      }
    }
    
    // Calculate derived fields from inputs ONLY
    const manufacturing = data.manufacturingCost || 0
    const freight = data.freightCost || 0
    const tariffRate = data.tariffRate || 0.35
    const refundRate = data.refundRate || 0.01
    const tacosValue = data.tacos || 0.12
    
    // Use provided weight or default to 0
    let weightGrams = data.weightGrams || 0
    let weightOz = data.weightOz || 0
    
    // Convert between grams and oz if only one is provided
    if (weightGrams && !weightOz) {
      weightOz = weightGrams / 28.3495
    } else if (weightOz && !weightGrams) {
      weightGrams = weightOz * 28.3495
    }
    
    let weightLb = weightGrams / 453.592
    
    // Calculate CBM from dimensions
    let cbm = 0
    if (data.length && data.width && data.height) {
      cbm = (data.length * data.width * data.height) / 1000000
    }
    
    const packageDimensions = data.length && data.width && data.height
      ? `${data.length} x ${data.width} x ${data.height} cm`
      : ''
    
    // Calculate financial fields (NEVER accept these as inputs)
    const tariff = manufacturing * tariffRate
    const referralFee = data.amazonPrice * 0.15  // Amazon's fixed 15% referral fee
    const refund = data.amazonPrice * refundRate
    const investedCost = manufacturing + freight + tariff
    
    const created = await this.prisma.product.create({
      data: {
        sku: data.sku,
        name: data.name,
        strategyId: strategyId,
        pricing: data.amazonPrice,
        manufacturing: data.manufacturingCost || 0,
        freight: data.freightCost || 0,
        awd: data.warehouseCost || 0,
        fulfillmentFee: 0,  // Will be calculated dynamically after creation
        tariff: tariff,  // Calculated from tariffRate * manufacturing
        tariffRate: tariffRate,
        category: data.category || 'consumer-goods',
        status: 'active',
        description: data.name,
        // Additional fields
        sourcingCountry: data.sourcingCountry || '',
        destinationMarket: data.destinationMarket || 'US',
        packSize: data.packSize || 0,
        micron: data.micron || 0,
        length: data.length || 0,
        width: data.width || 0,
        height: data.height || 0,
        packageDimensions: packageDimensions,
        density: data.density || 0,
        weightGrams: weightGrams,
        weightOz: weightOz,
        weightLb: weightLb,
        cbm: cbm,
        sizeTier: this.calculateSizeTier(weightOz, data.length || 0, data.width || 0, data.height || 0),
        tacos: tacosValue,
        refundRate: refundRate,
        // Calculated fields (SECURITY: never accept these as inputs)
        referralFee: referralFee,
        refund: refund,
        margin: 0,  // Will be calculated when needed
        marginPercent: 0,  // Will be calculated when needed
        currentStock: data.currentStock || 0,
        reorderPoint: data.reorderPoint || null,
        reorderQuantity: data.reorderQuantity || null,
        investedCost: investedCost,
        productArea: data.productArea || 0,
      }
    })
    
    // Add to cache
    this.cache.set(created.sku, created)
    
    // Calculate and update FBA fee if we have dimensions and weight
    if (weightOz > 0 && created.sizeTier) {
      try {
        const { AmazonFeeService } = await import('./AmazonFeeService')
        const feeResult = await AmazonFeeService.calculateFBAFee(
          weightOz,
          created.sizeTier,
          data.amazonPrice,
          'US'
        )
        
        // Update the product with calculated FBA fee
        const updated = await this.prisma.product.update({
          where: { id: created.id },
          data: { fulfillmentFee: feeResult.fee }
        })
        
        // Update cache
        this.cache.set(updated.sku, updated)
        
        return updated
      } catch (error) {
        console.warn(`Failed to calculate FBA fee for ${created.sku}:`, error)
      }
    }
    
    return created
  }
  
  /**
   * Calculate Amazon size tier based on dimensions and weight
   */
  private calculateSizeTier(weightOz: number, lengthCm: number, widthCm: number, heightCm: number): string {
    // Convert cm to inches
    const lengthIn = lengthCm / 2.54
    const widthIn = widthCm / 2.54
    const heightIn = heightCm / 2.54
    
    // Sort dimensions to get longest, median, and shortest
    const dims = [lengthIn, widthIn, heightIn].sort((a, b) => b - a)
    const longest = dims[0]
    const median = dims[1]
    const shortest = dims[2]
    
    // Small standard: <= 16 oz, longest <= 15", median <= 12", shortest <= 0.75"
    if (weightOz <= 16 && longest <= 15 && median <= 12 && shortest <= 0.75) {
      return 'Small standard'
    }
    
    // Large standard: <= 20 lb, longest <= 18", median <= 14", shortest <= 8"
    if (weightOz <= 320 && longest <= 18 && median <= 14 && shortest <= 8) {
      return 'Large standard'
    }
    
    // Otherwise it's oversize
    return 'Oversize'
  }

  // ===== CONVERSION METHODS =====

  /**
   * Get product config data from metadata
   */
  private getProductConfigFromMetadata(product: Product): Partial<ProductConfig> {
    if (!product.metadata) return {}
    
    const metadata = product.metadata as any
    return {
      manufacturingCost: product.manufacturing.toNumber(),
      freightCost: product.freight.toNumber(),
      warehouseCost: product.awd.toNumber(),
      fulfillmentFee: product.fulfillmentFee.toNumber(),
      tariffRate: product.tariff.toNumber(),
      group: metadata.group,
      micron: metadata.micron,
      density: metadata.density,
      weight: metadata.weight,
      weightOz: metadata.weightOz,
      weightLb: metadata.weightLb,
      cbmPerUnit: metadata.cbmPerUnit,
      sizeTier: metadata.sizeTier
    }
  }

  /**
   * Convert Product to ProductConfig format
   */
  private toProductConfig(product: Product): ProductConfig {
    const price = product.pricing?.toNumber() || 0
    const metadata = product.metadata as any || {}
    
    return {
      sku: product.sku,
      name: product.name,
      price,
      manufacturingCost: product.manufacturing.toNumber(),
      freightCost: product.freight.toNumber(),
      warehouseCost: product.awd.toNumber(),
      fulfillmentFee: product.fulfillmentFee.toNumber(),
      amazonReferralFee: product.referralFee.toNumber(),
      refundAllowance: product.refund.toNumber(),
      category: product.category,
      packSize: metadata.packSize || undefined,
      thickness: metadata.thickness || undefined,
      group: metadata.group || 0,
      country: metadata.country || undefined,
      micron: metadata.micron || 0,
      dimensions: metadata.dimensions || undefined,
      density: metadata.density || 0,
      weight: metadata.weight || 0,
      weightOz: metadata.weightOz || 0,
      weightLb: metadata.weightLb || 0,
      cbmPerUnit: metadata.cbmPerUnit || 0,
      sizeTier: metadata.sizeTier || undefined,
      tariffRate: product.tariff.toNumber()
    }
  }

  /**
   * Convert Product to ProductMargin format
   */
  private toProductMargin(product: Product): ProductMargin {
    const metadata = product.metadata as any || {}
    return {
      sku: product.sku,
      name: product.name,
      retailPrice: product.pricing.toNumber(),
      manufacturing: product.manufacturing.toNumber(),
      freight: product.freight.toNumber(),
      thirdPLStorage: product.awd.toNumber(),
      amazonReferralFee: product.referralFee.toNumber(),
      fulfillmentFee: product.fulfillmentFee.toNumber(),
      refundAllowance: product.refund.toNumber(),
      group: metadata.group || 0,
      country: metadata.country || '',
      packSize: metadata.packSize || 0,
      micron: metadata.micron || 0,
      dimensions: metadata.dimensions || '',
      density: metadata.density || 0,
      weight: metadata.weight || 0,
      weightOz: metadata.weightOz || 0,
      weightLb: metadata.weightLb || 0,
      cbmPerUnit: metadata.cbmPerUnit || 0,
      sizeTier: metadata.sizeTier || '',
      tariffRate: product.tariff.toNumber()
    }
  }
}

export default ProductService
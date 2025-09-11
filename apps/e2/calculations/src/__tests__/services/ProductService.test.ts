// @ts-nocheck
import ProductService, { ProductConfig, ProductMargin } from '@/services/database/ProductService'
import { prisma } from '@/utils/database'

// Mock the shared prisma instance
jest.mock('@/utils/database', () => ({
  prisma: {
    product: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn()
    },
    $transaction: jest.fn(),
    $disconnect: jest.fn()
  }
}))

describe('ProductService', () => {
  let service: any

  const mockProducts = [
    {
      id: '1',
      sku: 'TS-007',
      name: 'CN(L) 6 Pack 7 Micron',
      amazonPrice: 6.99,
      manufacturingCost: 0.57,
      freightCost: 0.11,
      warehouseCost: 0.12,
      fbaFee: 2.56,
      tariffRate: 35,
      packSize: 6,
      thickness: '7μm',
      country: 'CN(L)',
      micron: 7,
      dimensions: '27*22.5*1.7',
      density: 0.67,
      weight: 322.34,
      weightOz: 11.37,
      weightLb: 0.71,
      cbmPerUnit: 0.00103275,
      sizeTier: '>8‑12 oz',
      category: 'consumer-goods',
      status: 'active',
      metadata: { group: 1 },
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: '2',
      sku: 'TS-009',
      name: 'CN(L) 12 Pack 7 Micron',
      amazonPrice: 12.99,
      manufacturingCost: 1.14,
      freightCost: 0.25,
      warehouseCost: 0.19,
      fbaFee: 5.37,
      tariffRate: 35,
      packSize: 12,
      thickness: '7μm',
      country: 'CN(L)',
      micron: 7,
      dimensions: '27*22.5*3.8',
      density: 0.67,
      weight: 574.69,
      weightOz: 20.27,
      weightLb: 1.27,
      cbmPerUnit: 0.0023085,
      sizeTier: '>20‑24 oz',
      category: 'consumer-goods',
      status: 'active',
      metadata: { group: 2 },
      createdAt: new Date(),
      updatedAt: new Date()
    }
  ]

  beforeEach(() => {
    // Get fresh instance
    service = ProductService.getInstance()
    
    // Reset mocks
    jest.clearAllMocks()
    
    // Clear cache
    service.invalidateCache()
    
    // Setup default mock responses
    prisma.product.findMany.mockResolvedValue(mockProducts)
    prisma.product.findUnique.mockImplementation(({ where }: any) => {
      const product = mockProducts.find(p => p.sku === where.sku)
      return Promise.resolve(product || null)
    })
  })

  describe('Cache Management', () => {
    it('should initialize cache on first call', async () => {
      await service.initializeCache()
      
      expect(prisma.product.findMany).toHaveBeenCalledWith({
        where: { status: 'active' }
      })
      expect(prisma.product.findMany).toHaveBeenCalledTimes(1)
    })

    it('should not reinitialize cache if already initialized', async () => {
      await service.initializeCache()
      await service.initializeCache()
      
      expect(prisma.product.findMany).toHaveBeenCalledTimes(1)
    })

    it('should invalidate cache properly', async () => {
      await service.initializeCache()
      service.invalidateCache()
      
      // After invalidation, next call should reinitialize
      await service.initializeCache()
      
      expect(prisma.product.findMany).toHaveBeenCalledTimes(2)
    })
  })

  describe('Synchronous Methods', () => {
    beforeEach(async () => {
      await service.initializeCache()
    })

    it('should get product by SKU synchronously', () => {
      const product = service.getProduct('TS-007')
      
      expect(product).toBeDefined()
      expect(product?.sku).toBe('TS-007')
      expect(product?.price).toBe(6.99)
      expect(product?.amazonReferralFee).toBe(6.99 * 0.15)
      expect(product?.refundAllowance).toBe(6.99 * 0.01)
    })

    it('should return undefined for non-existent SKU', () => {
      const product = service.getProduct('INVALID')
      expect(product).toBeUndefined()
    })

    it('should get all products synchronously', () => {
      const products = service.getAllProducts()
      
      expect(products).toHaveLength(2)
      expect(products[0].sku).toBe('TS-007')
      expect(products[1].sku).toBe('TS-009')
    })

    it('should get product SKUs synchronously', () => {
      const skus = service.getProductSkus()
      
      expect(skus).toEqual(['TS-007', 'TS-009'])
    })

    it('should validate SKU synchronously', () => {
      expect(service.isValidSku('TS-007')).toBe(true)
      expect(service.isValidSku('INVALID')).toBe(false)
    })

    it('should get product price synchronously', () => {
      expect(service.getProductPrice('TS-007')).toBe(6.99)
      expect(service.getProductPrice('TS-009')).toBe(12.99)
      expect(service.getProductPrice('INVALID')).toBe(0)
    })

    it('should calculate product financials correctly', () => {
      const financials = service.calculateProductFinancials('TS-007', 100)
      
      expect(financials.revenue).toBe(699) // 100 * 6.99
      expect(financials.cogs).toBeCloseTo(88) // 100 * (0.57 + 0.11 + tariffs)
      expect(financials.grossProfit).toBeLessThan(financials.revenue)
      expect(financials.grossMargin).toBeGreaterThan(0)
      expect(financials.grossMargin).toBeLessThan(100)
    })

    it('should throw error for invalid SKU in calculations', () => {
      expect(() => {
        service.calculateProductFinancials('INVALID', 100)
      }).toThrow('Product INVALID not found')
    })

    it('should get products by category', () => {
      const products = service.getProductsByCategory('consumer-goods')
      expect(products).toHaveLength(2)
    })

    it('should get product data for dashboard', () => {
      const dashboardData = service.getProductDataForDashboard()
      
      expect(dashboardData['TS-007']).toBeDefined()
      expect(dashboardData['TS-007'].name).toBe('CN(L) 6 Pack 7 Micron')
      expect(dashboardData['TS-007'].price).toBe(6.99)
      expect(dashboardData['TS-007']).not.toHaveProperty('sku')
    })
  })

  describe('Async Methods', () => {
    it('should get active products from database', async () => {
      const products = await service.getActiveProducts()
      
      expect(products).toEqual(mockProducts)
      expect(prisma.product.findMany).toHaveBeenCalledWith({
        where: { status: 'active' },
        orderBy: { sku: 'asc' }
      })
    })

    it('should get product by SKU from database', async () => {
      const product = await service.getProductBySku('TS-007')
      
      expect(product).toEqual(mockProducts[0])
      expect(prisma.product.findUnique).toHaveBeenCalledWith({
        where: { sku: 'TS-007' }
      })
    })

    it('should update product costs', async () => {
      const updateData = {
        manufacturingCost: 0.60,
        amazonPrice: 7.99
      }
      
      const updatedProduct = { ...mockProducts[0], ...updateData }
      prisma.product.update.mockResolvedValue(updatedProduct)
      
      const result = await service.updateProductCosts('TS-007', updateData)
      
      expect(result).toEqual(updatedProduct)
      expect(prisma.product.update).toHaveBeenCalledWith({
        where: { sku: 'TS-007' },
        data: expect.objectContaining(updateData)
      })
    })

    it('should update multiple products', async () => {
      const updates = [
        { sku: 'TS-007', data: { amazonPrice: 7.99 } },
        { sku: 'TS-009', data: { amazonPrice: 13.99 } }
      ]
      
      const updatedProducts = mockProducts.map((p, i) => ({
        ...p,
        amazonPrice: i === 0 ? 7.99 : 13.99
      }))
      
      prisma.$transaction.mockResolvedValue(updatedProducts)
      
      await service.updateMultipleProducts(updates)
      
      expect(prisma.$transaction).toHaveBeenCalled()
    })

    it('should create new product', async () => {
      const newProduct = {
        sku: 'TS-NEW',
        name: 'New Product',
        amazonPrice: 9.99,
        manufacturingCost: 1.00,
        freightCost: 0.20,
        warehouseCost: 0.15,
        fbaFee: 3.00
      }
      
      const createdProduct = {
        id: '3',
        ...newProduct,
        category: 'consumer-goods',
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date()
      }
      
      prisma.product.create.mockResolvedValue(createdProduct)
      
      const result = await service.createProduct(newProduct)
      
      expect(result).toEqual(createdProduct)
      expect(prisma.product.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          ...newProduct,
          category: 'consumer-goods',
          status: 'active'
        })
      })
    })
  })

  describe('Conversion Methods', () => {
    beforeEach(async () => {
      await service.initializeCache()
    })

    it('should convert to ProductMargin format', () => {
      const config = service.getProduct('TS-007')!
      const margin = service.toProductMargin(config)
      
      expect(margin.sku).toBe(config.sku)
      expect(margin.retailPrice).toBe(config.price)
      expect(margin.manufacturing).toBe(config.manufacturingCost)
      expect(margin.freight).toBe(config.freightCost)
      expect(margin.thirdPLStorage).toBe(config.warehouseCost)
      expect(margin.group).toBe(1)
    })

    it('should get product margins array', () => {
      const margins = service.getProductMargins()
      
      expect(margins).toHaveLength(2)
      expect(margins[0].sku).toBe('TS-007')
      expect(margins[0].retailPrice).toBe(6.99)
    })

    it('should access productMargins getter', () => {
      const margins = service.productMargins
      
      expect(margins).toHaveLength(2)
      expect(margins[0].sku).toBe('TS-007')
    })
  })

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      prisma.product.findMany.mockRejectedValue(new Error('Database error'))
      
      await expect(service.initializeCache()).rejects.toThrow('Database error')
    })

    it('should handle missing products in calculations', () => {
      expect(() => {
        service.calculateProductFinancials('MISSING', 100)
      }).toThrow('Product MISSING not found')
    })
  })
})